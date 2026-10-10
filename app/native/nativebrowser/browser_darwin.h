#ifndef BURF_BROWSER_DARWIN_H
#define BURF_BROWSER_DARWIN_H

#include <stdint.h>

int burf_mac_browser_is_main_thread(void);
void *burf_mac_browser_open(void *parent, uintptr_t handle, const char *url,
                           const char *diagnostics, double x, double y,
                           double width, double height, char **error);
char *burf_mac_browser_bounds(void *browser, double x, double y,
                              double width, double height);
char *burf_mac_browser_visible(void *browser, int visible);
char *burf_mac_browser_navigate(void *browser, const char *url);
char *burf_mac_browser_action(void *browser, int action);
char *burf_mac_browser_eval(void *browser, uint64_t request, const char *script);
char *burf_mac_browser_close(void *browser);

// Called on Cocoa's main thread. These callbacks only enqueue diagnostics or
// complete an evaluation; they never wait for Go to dispatch another UI call.
extern void burfMacBrowserEvent(uintptr_t handle, int kind, char *data, char *state);
extern void burfMacBrowserEvalResult(uintptr_t handle, uint64_t request,
                                   char *json, char *error);

#endif
