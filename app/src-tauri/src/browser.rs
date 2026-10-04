// Browser panes are child webviews laid over the main webview, one per pane,
// so any page works (no iframe restrictions) and a box's dev server behaves as
// it would in a real browser. The React pane owns the rectangle; these
// commands keep the native view on top of it.
//
// Commands that create webviews are async: Window::add_child waits for the
// main thread, which a synchronous command would already be holding.

use serde::Serialize;
use tauri::webview::{PageLoadEvent, WebviewBuilder};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewUrl};

// Labels are namespaced so a pane id can never name the app's own webview.
fn label(id: &str) -> Result<String, String> {
    if id.is_empty() || id.len() > 64 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(format!("invalid browser pane id {id:?}"));
    }
    Ok(format!("browser-{id}"))
}

fn parse(url: &str) -> Result<Url, String> {
    let u = Url::parse(url).map_err(|e| format!("{url} is not a URL: {e}"))?;
    match u.scheme() {
        "http" | "https" => Ok(u),
        s => Err(format!("browser panes open http and https pages, not {s}:")),
    }
}

fn find(app: &AppHandle, id: &str) -> Result<Webview, String> {
    app.get_webview(&label(id)?)
        .ok_or_else(|| format!("no browser pane {id}"))
}

#[derive(Clone, Serialize)]
struct Navigated {
    id: String,
    url: String,
    // "started" or "finished"
    state: &'static str,
}

const EVENT: &str = "berth://browser";

// The element picker reports a pick by navigating to berth-pick://pick?d=…,
// which is cancelled here and handed to the app; the page never leaves.
const PICK_EVENT: &str = "berth://browser-pick";

#[derive(Clone, Serialize)]
struct Picked {
    id: String,
    url: String,
}

#[tauri::command]
pub async fn browser_open(app: AppHandle, id: String, url: String, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    let label = label(&id)?;
    let url = parse(&url)?;
    if let Some(existing) = app.get_webview(&label) {
        existing.navigate(url).map_err(|e| e.to_string())?;
        return place(&existing, x, y, w, h);
    }
    let window = app.get_window("main").ok_or("the main window is gone")?;
    let nav_app = app.clone();
    let nav_id = id.clone();
    let pick_app = app.clone();
    let pick_id = id.clone();
    let load_id = id.clone();
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(url))
        .on_navigation(move |u| {
            if u.scheme() == "berth-pick" {
                let _ = pick_app.emit(PICK_EVENT, Picked { id: pick_id.clone(), url: u.to_string() });
                return false;
            }
            let _ = nav_app.emit(EVENT, Navigated { id: nav_id.clone(), url: u.to_string(), state: "started" });
            true
        })
        .on_page_load(move |wv, payload| {
            let state = match payload.event() {
                PageLoadEvent::Started => "started",
                PageLoadEvent::Finished => "finished",
            };
            let _ = wv.app_handle().emit(EVENT, Navigated { id: load_id.clone(), url: payload.url().to_string(), state });
        });
    window
        .add_child(builder, LogicalPosition::new(x, y), LogicalSize::new(w.max(1.0), h.max(1.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn place(wv: &Webview, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    wv.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    wv.set_size(LogicalSize::new(w.max(1.0), h.max(1.0))).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_set_bounds(app: AppHandle, id: String, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    place(&find(&app, &id)?, x, y, w, h)
}

#[tauri::command]
pub async fn browser_show(app: AppHandle, id: String) -> Result<(), String> {
    find(&app, &id)?.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_hide(app: AppHandle, id: String) -> Result<(), String> {
    find(&app, &id)?.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_navigate(app: AppHandle, id: String, url: String) -> Result<(), String> {
    find(&app, &id)?.navigate(parse(&url)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_back(app: AppHandle, id: String) -> Result<(), String> {
    find(&app, &id)?.eval("history.back()").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_forward(app: AppHandle, id: String) -> Result<(), String> {
    find(&app, &id)?.eval("history.forward()").map_err(|e| e.to_string())
}

// browser_pick runs the element picker in a pane's page. The script is the
// app's own (src/lib/picker.ts); a pick comes back as PICK_EVENT.
#[tauri::command]
pub async fn browser_pick(app: AppHandle, id: String, script: String) -> Result<(), String> {
    if script.len() > 64 * 1024 {
        return Err("picker script too large".into());
    }
    find(&app, &id)?.eval(&script).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_reload(app: AppHandle, id: String) -> Result<(), String> {
    find(&app, &id)?.reload().map_err(|e| e.to_string())
}

// Closing a pane that is already gone is not an error: unmounting races
// window teardown.
#[tauri::command]
pub async fn browser_close(app: AppHandle, id: String) -> Result<(), String> {
    match app.get_webview(&label(&id)?) {
        Some(wv) => wv.close().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}
