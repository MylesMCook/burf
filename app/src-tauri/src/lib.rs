use serde::Serialize;
use std::path::PathBuf;
#[cfg(target_os = "linux")]
use tauri::Manager;

mod agent;
mod browser;
#[cfg(not(target_os = "windows"))]
mod cli_link;
#[cfg(target_os = "windows")]
#[path = "cli_path_windows.rs"]
mod cli_link;
#[cfg(target_os = "linux")]
mod linux;
mod menu;
mod ui_assets;

// The app is a view over the laptop agent (`burf agent`), which serves it on
// loopback. The agent writes a token to its state directory; this shell reads
// it and hands it to the webview, which sends it with every request.

const AGENT_URL: &str = "http://127.0.0.1:1378";

#[derive(Serialize)]
struct Endpoint {
    url: String,
    token: String,
}

// The state directory: $BERTH_HOME when set, otherwise the
// OS config directory's berth (~/Library/Application Support on macOS),
// matching statefile.Home in the Go code.
fn state_home() -> Result<PathBuf, String> {
    if let Ok(home) = std::env::var("BERTH_HOME") {
        if !home.is_empty() {
            let home = PathBuf::from(home);
            if !home.is_absolute() {
                return Err("BERTH_HOME must be an absolute path".into());
            }
            return Ok(home);
        }
    }
    let base = dirs::config_dir().ok_or("no config directory on this system")?;
    Ok(base.join("berth"))
}

fn token_path() -> Result<PathBuf, String> {
    Ok(state_home()?.join("client").join("ui-token"))
}

#[tauri::command]
fn ui_interface(info: tauri::State<ui_assets::InterfaceInfo>) -> ui_assets::InterfaceInfo {
    info.inner().clone()
}

#[tauri::command]
fn ui_endpoint() -> Result<Endpoint, String> {
    let path = token_path()?;
    let token = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "the Burf agent has not started yet ({}: {e})",
            path.display()
        )
    })?;
    Ok(Endpoint {
        url: AGENT_URL.to_string(),
        token: token.trim().to_string(),
    })
}

// Developer tools for the page that asked, from Settings → Developer. The
// "devtools" feature (Cargo.toml) keeps them in release builds too, for the
// Browser tab's Web Inspector.
#[tauri::command]
fn open_devtools(webview: tauri::Webview) -> Result<(), String> {
    webview.open_devtools();
    Ok(())
}

// restart_app relaunches Burf, after the webview has installed a
// downloaded update (Settings → About, or the status bar's "Restart to
// update"). Only ever on that click: agents run on their boxes, so a
// restart stops none of them, but it still closes the window.
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.request_restart();
}

// open_terminal brings up Terminal on this Mac, for a card that copied a
// command to paste there (installing tmux for this Mac's box, whose own
// terminals need tmux). It never types or runs anything: the person pastes
// the command, reads it and presses Enter.
#[tauri::command]
fn open_terminal() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open")
            .args(["-a", "Terminal"])
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("couldn't open Terminal: {e}"))
    }
    #[cfg(target_os = "windows")]
    {
        let root =
            std::env::var_os("SystemRoot").ok_or("Windows system directory is unavailable")?;
        std::process::Command::new(PathBuf::from(root).join("System32/cmd.exe"))
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("couldn't open Command Prompt: {e}"))
    }
    #[cfg(target_os = "linux")]
    {
        linux::open_terminal()
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("opening a terminal is only for macOS, Windows and Linux".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    if std::env::args_os().nth(1).as_deref() == Some(std::ffi::OsStr::new("--remove-cli-path")) {
        if let Err(error) = cli_link::remove_for_installer() {
            eprintln!("burf: {error}");
            std::process::exit(1);
        }
        return;
    }
    #[cfg(target_os = "linux")]
    linux::prefer_compatible_rendering();
    let mut context = tauri::generate_context!();
    let embedded = context.set_assets(Box::new(tauri::utils::assets::EmbeddedAssets::new(
        Default::default(),
        &[],
        Default::default(),
    )));
    let folder = state_home().map(|home| home.join("ui/current"));
    let assets = ui_assets::InterfaceAssets::select(
        embedded,
        folder.as_deref().map_err(Clone::clone),
        std::env::var_os(ui_assets::BUILTIN_ENV).is_some(),
        env!("CARGO_PKG_VERSION"),
    );
    eprintln!(
        "burf: interface {} {}: {}",
        assets.info.source, assets.info.version, assets.info.reason
    );
    let info = assets.info.clone();
    context.set_assets(Box::new(assets));
    let builder = tauri::Builder::default().manage(info);
    // On Linux a berth:// link starts the app again with the link as its
    // argument: one already running takes it instead (and comes to the
    // front), and the deep-link plugin hands it to the webview. Registered
    // first, as the plugin asks.
    #[cfg(target_os = "linux")]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
    }));
    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        // berth://kit?src=… links someone shares open a kit's review.
        .plugin(tauri_plugin_deep_link::init())
        // The updater API stays available for a future signed Burf feed.
        // tauri.conf.json keeps its key and endpoints empty until then.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // The menu bar carries every shortcut (menu.rs), so macOS cannot
        // take one first; each item tells the webview as berth://menu. The
        // Linux app has none: GTK would put a menu bar inside the window,
        // and its accelerators would take Ctrl+W, Ctrl+D and the rest from
        // terminals before the page sees them. The webview handles the keys
        // there (hooks/use-shortcuts.ts).
        .setup(|app| {
            #[cfg(not(target_os = "linux"))]
            {
                let menu = menu::build(app.handle())?;
                app.set_menu(menu)?;
            }
            #[cfg(target_os = "linux")]
            linux::setup(app.handle());
            Ok(())
        })
        .on_menu_event(|app, event| menu::on_event(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![
            ui_endpoint,
            ui_interface,
            open_devtools,
            restart_app,
            open_terminal,
            cli_link::cli_link_status,
            cli_link::install_cli_link,
            cli_link::remove_cli_link,
            agent::agent_binary,
            agent::start_agent,
            agent::restart_stale_agent,
            agent::prepare_app_update,
            browser::browser_open,
            browser::browser_set_bounds,
            browser::browser_show,
            browser::browser_hide,
            browser::browser_navigate,
            browser::browser_back,
            browser::browser_forward,
            browser::browser_reload,
            browser::browser_pick,
            browser::browser_inspect,
            browser::browser_close,
        ])
        .run(context)
        .expect("error while running tauri application");
}

#[cfg(test)]
mod config_tests {
    #[test]
    fn fork_updater_config_loads_without_an_upstream_feed() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let updater: tauri_plugin_updater::Config =
            serde_json::from_value(config["plugins"]["updater"].clone()).unwrap();
        assert!(updater.endpoints.is_empty());
        assert!(updater.pubkey.is_empty());
    }
}
