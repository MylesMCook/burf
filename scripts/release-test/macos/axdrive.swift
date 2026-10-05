// axdrive drives a running Mac app through the accessibility API, for the
// release tests (scripts/fresh-user-test.sh). It reads what the app's
// webviews show and presses their buttons without moving the mouse, typing
// on the keyboard or bringing the app to the front, so it works on the real
// signed app, with nothing compiled into it for testing. The one thing it
// needs from the person is to leave the app's window in front: WebKit pauses
// a covered window's page (raise brings it back).
//
//   axdrive check                        is this process trusted for accessibility and screen capture
//   axdrive window PID                   the CGWindowID of PID's largest window (for screencapture -l)
//   axdrive dump PID [--depth N]         the element tree: role, name, value
//   axdrive text PID                     every piece of text on screen, one per line
//   axdrive wait PID TEXT [--gone] [--timeout S]
//                                        wait until some element shows TEXT (or none does)
//   axdrive press PID NAME [--role R] [--exact] [--nth K] [--timeout S]
//                                        AXPress the element named NAME (title, description, value or label)
//   axdrive set PID NAME VALUE [--timeout S]
//                                        put VALUE into the text field named NAME (placeholder, label or title)
//   axdrive key PID KEY                  post a key (return, escape, tab, down, up, or cmd+K style) to PID
//   axdrive webareas PID                 each web area: its URL and the start of its text
//   axdrive count PID NAME [--role R]    how many elements are named NAME
//   axdrive raise PID                    bring the app's windows to the front
//   axdrive focus PID NAME               give the element named NAME the keyboard
//
// Names match case-insensitively, as a substring unless --exact. Exit status
// is 0 on success, 1 when the element or text never appeared, 2 for usage.
import AppKit
import ApplicationServices
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)

func die(_ msg: String, _ code: Int32 = 1) -> Never {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
  exit(code)
}

var args = Array(CommandLine.arguments.dropFirst())
func flag(_ name: String) -> Bool {
  if let i = args.firstIndex(of: name) { args.remove(at: i); return true }
  return false
}
func option(_ name: String) -> String? {
  if let i = args.firstIndex(of: name), i + 1 < args.count {
    let v = args[i + 1]
    args.removeSubrange(i...(i + 1))
    return v
  }
  return nil
}

struct Node {
  let el: AXUIElement
  let role: String
  let subrole: String
  let title: String
  let desc: String
  let value: String
  let placeholder: String
  let help: String
  let url: String
  let depth: Int
  // name is what a person would call it: its title, description, value or
  // placeholder, whichever is set.
  var names: [String] { [title, desc, value, placeholder, help].filter { !$0.isEmpty } }
}

func str(_ v: AnyObject?) -> String {
  guard let v else { return "" }
  if let s = v as? String { return s }
  if let a = v as? NSAttributedString { return a.string }
  if let n = v as? NSNumber { return n.stringValue }
  if CFGetTypeID(v) == CFURLGetTypeID() { return (v as! URL).absoluteString }
  return ""
}

let attrs = [kAXRoleAttribute, kAXSubroleAttribute, kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute,
             kAXPlaceholderValueAttribute, kAXHelpAttribute, kAXChildrenAttribute, "AXURL"] as CFArray

// walk visits every element under root, depth first, up to maxDepth.
func walk(_ root: AXUIElement, maxDepth: Int = 400, _ visit: (Node) -> Bool) {
  var stack: [(AXUIElement, Int)] = [(root, 0)]
  var seen = 0
  while let (el, d) = stack.popLast() {
    seen += 1
    if seen > 60000 { return }
    var values: CFArray?
    guard AXUIElementCopyMultipleAttributeValues(el, attrs, AXCopyMultipleAttributeOptions(rawValue: 0), &values) == .success,
          let vs = values as? [AnyObject], vs.count == 9 else { continue }
    func get(_ i: Int) -> AnyObject? {
      let v = vs[i]
      // A missing attribute comes back as an AXValue holding an error.
      if CFGetTypeID(v) == AXValueGetTypeID() { return nil }
      return v
    }
    let n = Node(el: el, role: str(get(0)), subrole: str(get(1)), title: str(get(2)), desc: str(get(3)), value: str(get(4)),
                 placeholder: str(get(5)), help: str(get(6)), url: str(get(8)), depth: d)
    if !visit(n) { return }
    if d < maxDepth, let kids = get(7) as? [AXUIElement] {
      for k in kids.reversed() { stack.append((k, d + 1)) }
    }
  }
}

func appElement(_ pidArg: String?) -> (pid_t, AXUIElement) {
  guard let s = pidArg, let pid = pid_t(s) else { die("need a PID", 2) }
  let app = AXUIElementCreateApplication(pid)
  AXUIElementSetMessagingTimeout(app, 5)
  return (pid, app)
}

// windows are the app's windows; walking from the application element also
// reaches its menu bar, which has nothing to test.
func windows(_ app: AXUIElement) -> [AXUIElement] {
  var v: AnyObject?
  if AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &v) == .success, let ws = v as? [AXUIElement] {
    return ws
  }
  return []
}

func eachNode(_ app: AXUIElement, _ visit: (Node) -> Bool) {
  var stop = false
  for w in windows(app) where !stop {
    walk(w) { n in
      if !visit(n) { stop = true; return false }
      return true
    }
  }
}

func matches(_ n: Node, _ want: String, exact: Bool, role: String?) -> Bool {
  if let role, n.role != role && n.subrole != role { return false }
  let w = want.lowercased()
  for name in n.names {
    let l = name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    if exact ? l == w : l.contains(w) { return true }
  }
  return false
}

func find(_ app: AXUIElement, _ want: String, exact: Bool, role: String?, nth: Int) -> Node? {
  var hits: [Node] = []
  eachNode(app) { n in
    if matches(n, want, exact: exact, role: role) { hits.append(n) }
    return hits.count <= nth
  }
  // An exact match beats a containing one when both are there.
  return hits.count > nth ? hits[nth] : nil
}

func poll<T>(_ timeout: Double, _ body: () -> T?) -> T? {
  let end = Date().addingTimeInterval(timeout)
  repeat {
    if let v = body() { return v }
    usleep(300_000)
  } while Date() < end
  return nil
}

func keyCode(_ k: String) -> (CGKeyCode, CGEventFlags) {
  var flags: CGEventFlags = []
  var parts = k.lowercased().split(separator: "+").map(String.init)
  let key = parts.removeLast()
  for p in parts {
    switch p {
    case "cmd", "command": flags.insert(.maskCommand)
    case "shift": flags.insert(.maskShift)
    case "alt", "option": flags.insert(.maskAlternate)
    case "ctrl", "control": flags.insert(.maskControl)
    default: die("unknown modifier \(p)", 2)
    }
  }
  let named: [String: CGKeyCode] = ["return": 36, "enter": 36, "tab": 48, "space": 49, "escape": 53, "esc": 53, "delete": 51,
                                    "left": 123, "right": 124, "down": 125, "up": 126]
  if let c = named[key] { return (c, flags) }
  let letters: [Character: CGKeyCode] = ["a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12,
                                         "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23,
                                         "9": 25, "7": 26, "8": 28, "0": 29, "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40,
                                         "n": 45, "m": 46, ",": 43, ".": 47, "/": 44, "\\": 42, "[": 33, "]": 30]
  if key.count == 1, let c = letters[key.first!] { return (c, flags) }
  die("unknown key \(key)", 2)
}

guard !args.isEmpty else { die("usage: axdrive check|window|dump|text|wait|press|set|key|webareas|count …", 2) }
let cmd = args.removeFirst()
let timeout = Double(option("--timeout") ?? "20") ?? 20
let role = option("--role")
let nth = Int(option("--nth") ?? "0") ?? 0
let depth = Int(option("--depth") ?? "400") ?? 400
let exact = flag("--exact")
let gone = flag("--gone")

switch cmd {
case "check":
  let trusted = AXIsProcessTrusted()
  let screen = CGPreflightScreenCaptureAccess()
  print("accessibility: \(trusted)\nscreen capture: \(screen)")
  exit(trusted && screen ? 0 : 1)

case "window":
  guard let s = args.first, let pid = Int(s) else { die("need a PID", 2) }
  let list = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
  var best: (Int, Double)?
  for w in list {
    guard (w[kCGWindowOwnerPID as String] as? Int) == pid, (w[kCGWindowLayer as String] as? Int) == 0,
          let b = w[kCGWindowBounds as String] as? [String: Any], let id = w[kCGWindowNumber as String] as? Int else { continue }
    let area = ((b["Width"] as? Double) ?? 0) * ((b["Height"] as? Double) ?? 0)
    if area > 10000, best == nil || area > best!.1 { best = (id, area) }
  }
  guard let best else { die("no window for \(pid)") }
  print(best.0)

case "dump":
  let (_, app) = appElement(args.first)
  for w in windows(app) {
    walk(w, maxDepth: depth) { n in
      let pad = String(repeating: "  ", count: n.depth)
      var line = "\(pad)\(n.role)"
      if !n.subrole.isEmpty { line += "/\(n.subrole)" }
      for (k, v) in [("title", n.title), ("desc", n.desc), ("value", n.value), ("placeholder", n.placeholder), ("help", n.help), ("url", n.url)] where !v.isEmpty {
        let short = v.count > 120 ? String(v.prefix(120)) + "…" : v
        line += " \(k)=\(short.debugDescription)"
      }
      print(line)
      return true
    }
  }

case "text":
  let (_, app) = appElement(args.first)
  eachNode(app) { n in
    for s in n.names where !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { print(s.replacingOccurrences(of: "\n", with: " ")) }
    return true
  }

case "wait":
  let (_, app) = appElement(args.first)
  guard args.count >= 2 else { die("usage: axdrive wait PID TEXT [--gone]", 2) }
  let want = args[1]
  let ok = poll(timeout) { () -> Bool? in
    let found = find(app, want, exact: exact, role: role, nth: 0) != nil
    return found != gone ? true : nil
  }
  if ok == nil { die(gone ? "still showing \(want.debugDescription) after \(Int(timeout))s" : "never showed \(want.debugDescription) in \(Int(timeout))s") }

case "count":
  let (_, app) = appElement(args.first)
  guard args.count >= 2 else { die("usage: axdrive count PID NAME", 2) }
  var c = 0
  eachNode(app) { n in
    if matches(n, args[1], exact: exact, role: role) { c += 1 }
    return true
  }
  print(c)

case "press":
  let (_, app) = appElement(args.first)
  guard args.count >= 2 else { die("usage: axdrive press PID NAME", 2) }
  let want = args[1]
  guard let n = poll(timeout, { find(app, want, exact: exact, role: role, nth: nth) }) else {
    die("no element named \(want.debugDescription)\(role.map { " (\($0))" } ?? "") in \(Int(timeout))s")
  }
  let err = AXUIElementPerformAction(n.el, kAXPressAction as CFString)
  if err != .success {
    // Some web elements answer to a click only once focused.
    AXUIElementSetAttributeValue(n.el, kAXFocusedAttribute as CFString, kCFBooleanTrue)
    let again = AXUIElementPerformAction(n.el, kAXPressAction as CFString)
    if again != .success { die("pressing \(want.debugDescription) failed: \(again.rawValue)") }
  }
  print("pressed \(n.role) \(n.names.first?.debugDescription ?? "")")

case "raise":
  // WebKit stops a page's timers and marks it hidden while its window is
  // covered, so the app's window must be in front for what polls to run.
  let (pid, app) = appElement(args.first)
  // Setting AXFrontmost is what System Events does; macOS lets it through
  // where a background process's activate() is refused.
  AXUIElementSetAttributeValue(app, kAXFrontmostAttribute as CFString, kCFBooleanTrue)
  NSRunningApplication(processIdentifier: pid)?.activate(options: [])
  for w in windows(app) { AXUIElementPerformAction(w, kAXRaiseAction as CFString) }
  usleep(300_000)

case "focus":
  let (_, app) = appElement(args.first)
  guard args.count >= 2 else { die("usage: axdrive focus PID NAME", 2) }
  guard let n = poll(timeout, { find(app, args[1], exact: exact, role: role, nth: nth) }) else {
    die("no element named \(args[1].debugDescription) in \(Int(timeout))s")
  }
  let err = AXUIElementSetAttributeValue(n.el, kAXFocusedAttribute as CFString, kCFBooleanTrue)
  if err != .success { die("focusing \(args[1].debugDescription) failed: \(err.rawValue)") }
  print("focused \(n.role) \(n.names.first?.debugDescription ?? "")")

case "set":
  let (_, app) = appElement(args.first)
  guard args.count >= 3 else { die("usage: axdrive set PID NAME VALUE", 2) }
  let want = args[1], value = args[2]
  let fieldRoles: Set<String> = ["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"]
  guard let n = poll(timeout, { () -> Node? in
    var hit: Node?
    eachNode(app) { n in
      if fieldRoles.contains(n.role) || fieldRoles.contains(n.subrole), matches(n, want, exact: exact, role: nil) { hit = n; return false }
      return true
    }
    return hit
  }) else { die("no text field named \(want.debugDescription) in \(Int(timeout))s") }
  AXUIElementSetAttributeValue(n.el, kAXFocusedAttribute as CFString, kCFBooleanTrue)
  let err = AXUIElementSetAttributeValue(n.el, kAXValueAttribute as CFString, value as CFString)
  if err != .success { die("setting \(want.debugDescription) failed: \(err.rawValue)") }
  print("set \(n.role) \(want.debugDescription)")

case "key":
  guard args.count >= 2, let pid = pid_t(args[0]) else { die("usage: axdrive key PID KEY", 2) }
  let (code, flags) = keyCode(args[1])
  let src = CGEventSource(stateID: .privateState)
  for down in [true, false] {
    let e = CGEvent(keyboardEventSource: src, virtualKey: code, keyDown: down)!
    e.flags = flags
    e.postToPid(pid)
    usleep(30_000)
  }

case "webareas":
  let (_, app) = appElement(args.first)
  for w in windows(app) {
    walk(w) { n in
      guard n.role == "AXWebArea" else { return true }
      var text: [String] = []
      walk(n.el, maxDepth: 60) { c in
        if c.role == "AXStaticText", !c.value.isEmpty { text.append(c.value) }
        return text.count < 40
      }
      print("\(n.url.isEmpty ? "-" : n.url)\t\(text.joined(separator: " ").replacingOccurrences(of: "\n", with: " ").prefix(400))")
      return true
    }
  }

default:
  die("unknown command \(cmd)", 2)
}
