use serde::Serialize;
use std::path::PathBuf;

mod agent;
mod browser;
mod cli_link;

// The app is a view over the laptop agent (`berth agent`), which serves it on
// loopback. The agent writes a token to its state directory; this shell reads
// it and hands it to the webview, which sends it with every request.

const AGENT_URL: &str = "http://127.0.0.1:1378";

#[derive(Serialize)]
struct Endpoint {
    url: String,
    token: String,
}

// The agent's state directory: $BERTH_HOME/client when set, otherwise the
// OS config directory's berth/client (~/Library/Application Support on macOS),
// matching statefile.Home in the Go code.
fn token_path() -> Result<PathBuf, String> {
    if let Ok(home) = std::env::var("BERTH_HOME") {
        if !home.is_empty() {
            return Ok(PathBuf::from(home).join("client").join("ui-token"));
        }
    }
    let base = dirs::config_dir().ok_or("no config directory on this system")?;
    Ok(base.join("berth").join("client").join("ui-token"))
}

#[tauri::command]
fn ui_endpoint() -> Result<Endpoint, String> {
    let path = token_path()?;
    let token = std::fs::read_to_string(&path)
        .map_err(|e| format!("the Berth agent has not started yet ({}: {e})", path.display()))?;
    Ok(Endpoint {
        url: AGENT_URL.to_string(),
        token: token.trim().to_string(),
    })
}

// Developer tools for the page that asked, from Settings → Developer. Tauri
// only includes them in debug builds.
#[tauri::command]
fn open_devtools(webview: tauri::Webview) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        webview.open_devtools();
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = webview;
        Err("developer tools are only in debug builds of Berth".into())
    }
}

// restart_app relaunches Berth, after the webview has installed a
// downloaded update (Settings → About, or the status bar's "Restart to
// update"). Only ever on that click: agents run on their boxes, so a
// restart stops none of them, but it still closes the window.
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.request_restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        // berth://kit?src=… links someone shares open a kit's review.
        .plugin(tauri_plugin_deep_link::init())
        // Updates come from the latest GitHub release's latest.json and must
        // carry a signature from the key in tauri.conf.json. The webview
        // checks, downloads and installs (lib/updater.ts); see restart_app.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // The menu bar is macOS's default plus View → Zen on ⌘. A menu
        // shortcut is matched before the window sees the key, so ⌘. reaches
        // Berth instead of being taken for "cancel" (and ⌘⇧/ stays Help's).
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem, MenuItemKind, Submenu};
            let handle = app.handle();
            let menu = Menu::default(handle)?;
            let zen = MenuItem::with_id(handle, "zen", "Zen", true, Some("CmdOrCtrl+."))?;
            let mut placed = false;
            for item in menu.items()? {
                if let MenuItemKind::Submenu(sub) = item {
                    if sub.text()? == "View" {
                        sub.append(&zen)?;
                        placed = true;
                    }
                }
            }
            if !placed {
                menu.append(&Submenu::with_items(handle, "View", true, &[&zen])?)?;
            }
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::Emitter;
            if event.id() == "zen" {
                let _ = app.emit("berth://zen", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            ui_endpoint,
            open_devtools,
            restart_app,
            cli_link::cli_link_status,
            cli_link::install_cli_link,
            agent::agent_binary,
            agent::start_agent,
            browser::browser_open,
            browser::browser_set_bounds,
            browser::browser_show,
            browser::browser_hide,
            browser::browser_navigate,
            browser::browser_back,
            browser::browser_forward,
            browser::browser_reload,
            browser::browser_pick,
            browser::browser_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
