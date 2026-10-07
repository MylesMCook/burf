use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;

#[derive(Serialize)]
pub struct CliLink {
    link: String,
    bundled: Option<String>,
    blocked: Option<String>,
    state: &'static str,
    target: Option<String>,
}

fn cli_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe.parent().ok_or("no application directory")?.join("cli"))
}

fn path_action(action: &str) -> Result<String, String> {
    if cfg!(debug_assertions) {
        return Err("PATH integration is only available in an installed build".into());
    }
    let dir = cli_dir()?;
    let script = dir.parent().ok_or("no application directory")?.join("cli-path.ps1");
    if !script.is_file() || !dir.join("berth.exe").is_file() {
        return Err("this build carries no command to add to PATH".into());
    }
    let root = std::env::var_os("SystemRoot").ok_or("Windows system directory is unavailable")?;
    let out = Command::new(PathBuf::from(root).join("System32/WindowsPowerShell/v1.0/powershell.exe"))
        .creation_flags(0x08000000)
        .args(["-NoProfile", "-NonInteractive", "-File"])
        .arg(script).args(["-Action", action]).arg("-CliDirectory").arg(&dir)
        .output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[tauri::command]
pub fn cli_link_status() -> Result<CliLink, String> {
    let dir = cli_dir()?;
    let bundled = !cfg!(debug_assertions) && dir.join("berth.exe").is_file();
    let state = if !bundled { "missing" } else {
        match path_action("Status")?.as_str() {
            "linked" => "linked",
            "external" => "file",
            _ => "missing",
        }
    };
    Ok(CliLink {
        link: dir.display().to_string(),
        bundled: bundled.then(|| dir.join("berth.exe").display().to_string()),
        blocked: None,
        state,
        target: None,
    })
}

#[tauri::command]
pub fn install_cli_link() -> Result<CliLink, String> {
    path_action("Add")?;
    cli_link_status()
}

#[tauri::command]
pub fn remove_cli_link() -> Result<CliLink, String> {
    path_action("Remove")?;
    cli_link_status()
}
