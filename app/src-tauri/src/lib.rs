use serde::Serialize;
use std::path::PathBuf;

mod agent;
mod browser;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        // berth://kit?src=… links someone shares open a kit's review.
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            ui_endpoint,
            open_devtools,
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
            browser::browser_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
