//go:build darwin && cgo

#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <objc/message.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>
#include "browser_darwin.h"

static const NSUInteger BurfMaxURLBytes = 64 * 1024;
static const NSUInteger BurfMaxDiagnosticBytes = 4 * 1024 * 1024;
static const NSUInteger BurfMaxPopups = 16;
static NSString *const BurfDrain = @"(function(){try{var d=window.__berthDevtools;var s=d&&typeof d.drain==='function'?d.drain():'';return typeof s==='string'?s:'';}catch(e){return '';}})()";

int burf_mac_browser_is_main_thread(void) {
    return [NSThread isMainThread];
}

static char *BurfError(NSString *message) {
    return strdup(message.UTF8String ?: "native browser operation failed");
}

static BOOL BurfHTTPURL(NSURL *url) {
    NSString *scheme = url.scheme.lowercaseString;
    return url != nil && ([scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"])
        && url.host.length > 0 && url.user == nil && url.password == nil
        && [url.absoluteString lengthOfBytesUsingEncoding:NSUTF8StringEncoding] <= BurfMaxURLBytes;
}

static BOOL BurfInertFrameURL(NSURL *url) {
    return [url.absoluteString isEqualToString:@"about:blank"]
        || [url.absoluteString isEqualToString:@"about:srcdoc"];
}

static BOOL BurfBlankPopupURL(NSURL *url) {
    return url == nil || url.absoluteString.length == 0
        || [url.absoluteString isEqualToString:@"about:blank"];
}

static BOOL BurfNavigationURL(NSURL *url, BOOL mainFrame, BOOL popup) {
    return BurfHTTPURL(url) || (!mainFrame && BurfInertFrameURL(url))
        || (popup && BurfBlankPopupURL(url));
}

@interface BurfBrowserPane : NSObject <WKNavigationDelegate, WKUIDelegate, NSWindowDelegate>
@property(nonatomic, strong) WKWebView *webview;
@property(nonatomic, weak) NSView *parent;
@property(nonatomic, weak) BurfBrowserPane *owner;
@property(nonatomic, strong) NSMutableArray<BurfBrowserPane *> *popups;
@property(nonatomic, strong) NSWindow *popupWindow;
@property(nonatomic, strong) NSView *inspectorAttachment;
@property(nonatomic, strong) NSTimer *timer;
@property(nonatomic, strong) id resizeObserver;
@property(nonatomic, copy) NSString *lastURL;
@property(nonatomic) uintptr_t handle;
@property(nonatomic) BOOL closed;
@property(nonatomic) BOOL consolePending;
@property(nonatomic) NSRect logicalBounds;
- (void)place;
- (void)startPolling;
- (BurfBrowserPane *)eventRoot;
- (NSUInteger)popupCount;
- (void)poll;
- (void)close;
- (void)emit:(int)kind data:(NSString *)data state:(NSString *)state;
@end

@implementation BurfBrowserPane
- (instancetype)init {
    self = [super init];
    if (self != nil) self.popups = [[NSMutableArray alloc] init];
    return self;
}

- (void)place {
    NSView *parent = self.parent;
    if (self.closed || parent == nil) return;
    if (self.popupWindow != nil) {
        self.webview.frame = parent.bounds;
        return;
    }
    NSRect bounds = parent.bounds;
    NSRect logical = self.logicalBounds;
    CGFloat width = MAX(1.0, logical.size.width);
    CGFloat height = MAX(1.0, logical.size.height);
    // DOM rectangles are logical points from the content's top-left corner.
    // AppKit content views can use either a flipped or a bottom-left origin.
    CGFloat y = parent.isFlipped ? NSMinY(bounds) + logical.origin.y
        : NSMaxY(bounds) - logical.origin.y - height;
    self.webview.frame = NSMakeRect(NSMinX(bounds) + logical.origin.x, y, width, height);
}

- (void)startPolling {
    __weak BurfBrowserPane *weakPane = self;
    self.timer = [NSTimer timerWithTimeInterval:0.5 repeats:YES block:^(NSTimer *timer) { [weakPane poll]; }];
    [NSRunLoop.mainRunLoop addTimer:self.timer forMode:NSRunLoopCommonModes];
}

- (BurfBrowserPane *)eventRoot {
    BurfBrowserPane *root = self;
    while (root != nil && !root.closed && root.owner != nil) root = root.owner;
    return root.closed ? nil : root;
}

- (NSUInteger)popupCount {
    NSUInteger count = self.popups.count;
    for (BurfBrowserPane *popup in self.popups) count += [popup popupCount];
    return count;
}

- (void)emit:(int)kind data:(NSString *)data state:(NSString *)state {
    if (self.closed || data == nil || (kind == 0 && self.owner != nil)) return;
    BurfBrowserPane *root = [self eventRoot];
    if (root == nil || root.handle == 0) return;
    NSUInteger limit = kind == 2 ? BurfMaxDiagnosticBytes : BurfMaxURLBytes;
    if ([data lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > limit) return;
    burfMacBrowserEvent(root.handle, kind, (char *)data.UTF8String, (char *)(state ?: @"").UTF8String);
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action
        decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    NSURL *url = action.request.URL;
    if (!self.closed && [url.scheme.lowercaseString isEqualToString:@"berth-pick"]) {
        // The Go callback checks the picker URL and JSON before reporting it.
        // Every custom scheme is cancelled; it never reaches a native opener.
        [self emit:1 data:url.absoluteString state:@""];
        decisionHandler(WKNavigationActionPolicyCancel);
        return;
    }
    BOOL mainFrame = action.targetFrame == nil || action.targetFrame.mainFrame;
    BOOL newPopup = action.targetFrame == nil && BurfBlankPopupURL(url);
    if (self.closed || (!newPopup && !BurfNavigationURL(url, mainFrame, self.popupWindow != nil))) {
        decisionHandler(WKNavigationActionPolicyCancel);
        return;
    }
    if (action.targetFrame.mainFrame) [self emit:0 data:url.absoluteString state:@"started"];
    decisionHandler(WKNavigationActionPolicyAllow);
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationResponse:(WKNavigationResponse *)response
        decisionHandler:(void (^)(WKNavigationResponsePolicy))decisionHandler {
    // Redirects receive the same URL policy as explicit commands and links.
    decisionHandler(!self.closed && BurfNavigationURL(response.response.URL, response.forMainFrame, self.popupWindow != nil)
        ? WKNavigationResponsePolicyAllow : WKNavigationResponsePolicyCancel);
}

- (void)webView:(WKWebView *)webView didCommitNavigation:(WKNavigation *)navigation {
    [self emit:0 data:webView.URL.absoluteString state:@"committed"];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    [self emit:0 data:webView.URL.absoluteString state:@"finished"];
}

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
        forNavigationAction:(WKNavigationAction *)action windowFeatures:(WKWindowFeatures *)features {
    BurfBrowserPane *root = [self eventRoot];
    if (root == nil || self.closed || action.targetFrame != nil || [root popupCount] >= BurfMaxPopups
        || (!BurfHTTPURL(action.request.URL) && !BurfBlankPopupURL(action.request.URL))) return nil;

    NSScreen *screen = self.webview.window.screen ?: NSScreen.mainScreen;
    NSRect available = screen != nil ? screen.visibleFrame : NSMakeRect(0, 0, 1280, 800);
    CGFloat width = features.width != nil ? features.width.doubleValue : 800;
    CGFloat height = features.height != nil ? features.height.doubleValue : 600;
    if (!isfinite(width)) width = 800;
    if (!isfinite(height)) height = 600;
    width = MIN(MAX(200, width), available.size.width);
    height = MIN(MAX(160, height), MAX(160, available.size.height - 40));
    NSRect frame = NSMakeRect(NSMidX(available) - width / 2, NSMidY(available) - height / 2, width, height);
    NSWindowStyleMask style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable;
    if (features.allowsResizing == nil || features.allowsResizing.boolValue) style |= NSWindowStyleMaskResizable;

    BurfBrowserPane *popup = [[BurfBrowserPane alloc] init];
    popup.owner = self;
    popup.lastURL = @"";
    popup.popupWindow = [[NSWindow alloc] initWithContentRect:frame styleMask:style backing:NSBackingStoreBuffered defer:NO];
    popup.popupWindow.releasedWhenClosed = NO;
    popup.popupWindow.title = @"Browser";
    popup.popupWindow.delegate = popup;
    popup.parent = popup.popupWindow.contentView;
    // WebKit requires its supplied configuration and loads the request itself.
    // It is a copy of this raw view's configuration, preserving the opener and
    // storage without introducing any trusted Wails handlers or runtime.
    popup.webview = [[WKWebView alloc] initWithFrame:popup.parent.bounds configuration:configuration];
    if (popup.webview == nil) {
        [popup close];
        return nil;
    }
    if (@available(macOS 13.3, *)) popup.webview.inspectable = YES;
    popup.webview.navigationDelegate = popup;
    popup.webview.UIDelegate = popup;
    popup.webview.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    [popup.parent addSubview:popup.webview];
    [self.popups addObject:popup];
    [popup startPolling];
    [popup.popupWindow makeKeyAndOrderFront:nil];
    return popup.webview;
}

- (void)webViewDidClose:(WKWebView *)webView {
    if (self.popupWindow != nil) [self close];
}

- (BOOL)windowShouldClose:(NSWindow *)sender {
    [self close];
    return NO;
}

- (void)windowWillClose:(NSNotification *)notification {
    [self close];
}

- (void)poll {
    if (self.closed) return;
    NSString *url = self.webview.URL.absoluteString ?: @"";
    if (self.popupWindow != nil) {
        NSString *title = self.webview.title;
        self.popupWindow.title = title.length > 0 && title.length <= 1024 ? title : @"Browser";
    }
    if (![url isEqualToString:self.lastURL]) {
        if (self.lastURL.length > 0 && BurfHTTPURL(self.webview.URL)) {
            [self emit:0 data:url state:@"moved"];
        }
        self.lastURL = url;
    }
    if (self.consolePending) return;
    self.consolePending = YES;
    // The block retains this wrapper until WebKit finishes. Close clears its
    // native handle and releases its view, so a late callback never enters Go.
    [self.webview evaluateJavaScript:BurfDrain completionHandler:^(id result, NSError *error) {
        self.consolePending = NO;
        if (self.closed || error != nil || ![result isKindOfClass:NSString.class]) return;
        NSString *data = result;
        if (data.length == 0 || [data lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > BurfMaxDiagnosticBytes) return;
        [self emit:2 data:data state:@""];
    }];
}

- (void)close {
    if (self.closed) return;
    __attribute__((objc_precise_lifetime)) BurfBrowserPane *keepAlive = self;
    (void)keepAlive;
    self.closed = YES;
    self.handle = 0;
    for (BurfBrowserPane *popup in self.popups.copy) [popup close];
    [self.popups removeAllObjects];
    [self.timer invalidate];
    self.timer = nil;
    if (self.resizeObserver != nil) {
        [NSNotificationCenter.defaultCenter removeObserver:self.resizeObserver];
        self.resizeObserver = nil;
    }
    // Only the inspector uses private selectors, matching the previous shell.
    // Do not let an inspector window retain a pane after its tab closes.
    SEL inspectorSelector = NSSelectorFromString(@"_inspector");
    if ([self.webview respondsToSelector:inspectorSelector]) {
        id inspector = ((id (*)(id, SEL))objc_msgSend)(self.webview, inspectorSelector);
        SEL closeSelector = NSSelectorFromString(@"close");
        if ([inspector respondsToSelector:closeSelector]) {
            ((void (*)(id, SEL))objc_msgSend)(inspector, closeSelector);
        }
    }
    self.webview.navigationDelegate = nil;
    self.webview.UIDelegate = nil;
    [self.webview stopLoading];
    // Popup configurations may share the raw parent's content controller.
    // Closing one must not remove diagnostics from the opener's next document.
    [self.webview removeFromSuperview];
    self.inspectorAttachment = nil;
    self.webview = nil;
    self.parent = nil;
    self.popupWindow.delegate = nil;
    [self.popupWindow close];
    self.popupWindow = nil;
    [self.owner.popups removeObjectIdenticalTo:self];
    self.owner = nil;
}
@end

static char *BurfReady(BurfBrowserPane *pane) {
    if (![NSThread isMainThread]) return BurfError(@"native browser operation requires the UI thread");
    if (pane == nil || pane.closed || pane.parent == nil || pane.webview == nil) {
        return BurfError(@"native browser view is closed");
    }
    return NULL;
}

static char *BurfInspect(BurfBrowserPane *pane) {
    SEL attachmentSelector = NSSelectorFromString(@"_setInspectorAttachmentView:");
    SEL inspectorSelector = NSSelectorFromString(@"_inspector");
    if (![pane.webview respondsToSelector:inspectorSelector]) {
        return BurfError(@"WebKit inspector is unavailable on this macOS version");
    }
    if ([pane.webview respondsToSelector:attachmentSelector]) {
        if (pane.inspectorAttachment == nil) {
            pane.inspectorAttachment = [[NSView alloc] initWithFrame:NSZeroRect];
            pane.inspectorAttachment.hidden = YES;
            [pane.webview addSubview:pane.inspectorAttachment];
        }
        ((void (*)(id, SEL, id))objc_msgSend)(pane.webview, attachmentSelector, pane.inspectorAttachment);
    }
    id inspector = ((id (*)(id, SEL))objc_msgSend)(pane.webview, inspectorSelector);
    SEL showSelector = NSSelectorFromString(@"show");
    if (![inspector respondsToSelector:showSelector]) {
        return BurfError(@"WebKit inspector cannot be opened on this macOS version");
    }
    ((void (*)(id, SEL))objc_msgSend)(inspector, showSelector);
    return NULL;
}

void *burf_mac_browser_open(void *parent, uintptr_t handle, const char *rawURL,
        const char *diagnostics, double x, double y, double width, double height, char **error) {
    @autoreleasepool {
        *error = NULL;
        if (![NSThread isMainThread]) {
            *error = BurfError(@"native browser creation requires the UI thread");
            return NULL;
        }
        NSWindow *window = (__bridge NSWindow *)parent;
        if (![window isKindOfClass:NSWindow.class] || window.contentView == nil) {
            *error = BurfError(@"the main native window is unavailable");
            return NULL;
        }
        NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:rawURL]];
        if (!BurfHTTPURL(url)) {
            *error = BurfError(@"browser URLs must be HTTP or HTTPS without credentials");
            return NULL;
        }
        // This configuration has no Wails content handlers, runtime scripts,
        // custom URL schemes or app token. Default storage stays app-owned and
        // can retain the previous WKWebView cookies under the same bundle ID.
        WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
        config.userContentController = [[WKUserContentController alloc] init];
        config.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
        NSString *script = [NSString stringWithUTF8String:diagnostics];
        if (script.length > 0) {
            [config.userContentController addUserScript:[[WKUserScript alloc] initWithSource:script
                injectionTime:WKUserScriptInjectionTimeAtDocumentStart forMainFrameOnly:YES]];
        }
        // Older WebKit requires this preference for Inspect Element. macOS
        // 13.3 and later also expose the public inspectable property below.
        @try {
            [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];
        } @catch (NSException *exception) {
            // Browsing remains usable when this optional inspector hook moves.
        }
        BurfBrowserPane *pane = [[BurfBrowserPane alloc] init];
        pane.handle = handle;
        pane.parent = window.contentView;
        pane.lastURL = @"";
        pane.logicalBounds = NSMakeRect(x, y, width, height);
        pane.webview = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:config];
        if (pane.webview == nil) {
            *error = BurfError(@"WebKit did not create the browser view");
            return NULL;
        }
        if (@available(macOS 13.3, *)) pane.webview.inspectable = YES;
        pane.webview.navigationDelegate = pane;
        pane.webview.UIDelegate = pane;
        [pane.parent addSubview:pane.webview positioned:NSWindowAbove relativeTo:nil];
        [pane place];
        __weak BurfBrowserPane *weakPane = pane;
        pane.resizeObserver = [NSNotificationCenter.defaultCenter addObserverForName:NSWindowDidResizeNotification
            object:window queue:nil usingBlock:^(NSNotification *notification) { [weakPane place]; }];
        [pane startPolling];
        [pane.webview loadRequest:[NSURLRequest requestWithURL:url]];
        return (__bridge_retained void *)pane;
    }
}

char *burf_mac_browser_bounds(void *browser, double x, double y, double width, double height) {
    @autoreleasepool {
        BurfBrowserPane *pane = (__bridge BurfBrowserPane *)browser;
        char *error = BurfReady(pane);
        if (error != NULL) return error;
        if (!isfinite(x) || !isfinite(y) || !isfinite(width) || !isfinite(height) || width < 0 || height < 0) {
            return BurfError(@"browser bounds must be finite and nonnegative in size");
        }
        pane.logicalBounds = NSMakeRect(x, y, width, height);
        [pane place];
        return NULL;
    }
}

char *burf_mac_browser_visible(void *browser, int visible) {
    @autoreleasepool {
        BurfBrowserPane *pane = (__bridge BurfBrowserPane *)browser;
        char *error = BurfReady(pane);
        if (error != NULL) return error;
        pane.webview.hidden = !visible;
        return NULL;
    }
}

char *burf_mac_browser_navigate(void *browser, const char *rawURL) {
    @autoreleasepool {
        BurfBrowserPane *pane = (__bridge BurfBrowserPane *)browser;
        char *error = BurfReady(pane);
        if (error != NULL) return error;
        NSURL *url = [NSURL URLWithString:[NSString stringWithUTF8String:rawURL]];
        if (!BurfHTTPURL(url)) return BurfError(@"browser URLs must be HTTP or HTTPS without credentials");
        [pane.webview loadRequest:[NSURLRequest requestWithURL:url]];
        return NULL;
    }
}

char *burf_mac_browser_action(void *browser, int action) {
    @autoreleasepool {
        BurfBrowserPane *pane = (__bridge BurfBrowserPane *)browser;
        char *error = BurfReady(pane);
        if (error != NULL) return error;
        switch (action) {
        case 0: [pane.webview goBack]; return NULL;
        case 1: [pane.webview goForward]; return NULL;
        case 2: [pane.webview reload]; return NULL;
        case 3: return BurfInspect(pane);
        default: return BurfError(@"unknown native browser action");
        }
    }
}

char *burf_mac_browser_eval(void *browser, uint64_t request, const char *script) {
    @autoreleasepool {
        BurfBrowserPane *pane = (__bridge BurfBrowserPane *)browser;
        char *error = BurfReady(pane);
        if (error != NULL) return error;
        NSString *source = [NSString stringWithUTF8String:script];
        if (source == nil) return BurfError(@"browser script must be UTF-8");
        [pane.webview evaluateJavaScript:source completionHandler:^(id result, NSError *failure) {
            if (pane.closed || pane.handle == 0) return;
            if (failure != nil) {
                NSString *message = failure.localizedDescription ?: @"WebKit evaluation failed";
                if ([message lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > BurfMaxURLBytes) message = @"WebKit evaluation failed";
                burfMacBrowserEvalResult(pane.handle, request, "", (char *)message.UTF8String);
                return;
            }
            NSError *serializationError;
            NSData *json = [NSJSONSerialization dataWithJSONObject:result ?: NSNull.null
                options:NSJSONWritingFragmentsAllowed error:&serializationError];
            if (json == nil || json.length > BurfMaxDiagnosticBytes) {
                burfMacBrowserEvalResult(pane.handle, request, "", "browser evaluation result is not bounded JSON");
                return;
            }
            NSString *encoded = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
            burfMacBrowserEvalResult(pane.handle, request, (char *)encoded.UTF8String, "");
        }];
        return NULL;
    }
}

char *burf_mac_browser_close(void *browser) {
    @autoreleasepool {
        if (![NSThread isMainThread]) return BurfError(@"native browser close requires the UI thread");
        // Transfer the C-owned retain only after reaching the main thread.
        BurfBrowserPane *pane = (__bridge_transfer BurfBrowserPane *)browser;
        [pane close];
        return NULL;
    }
}
