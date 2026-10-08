use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use std::os::windows::process::CommandExt;

const PATH_SCRIPT: &str = include_str!("../windows/cli-path.ps1");

#[derive(Clone, Copy)]
enum PathAction { Status, Add, Remove }

fn path_command(action: PathAction, dir: &std::path::Path) -> String {
    let action = match action { PathAction::Status => "Status", PathAction::Add => "Add", PathAction::Remove => "Remove" };
    let directory = dir.to_string_lossy().replace('\'', "''");
    format!("& {{\n{PATH_SCRIPT}\n}} -Action '{action}' -CliDirectory '{directory}'")
}

#[derive(Serialize)]
pub struct CliLink {
    link: String,
    bundled: Option<String>,
    blocked: Option<String>,
    state: &'static str,
    target: Option<String>,
}

// A copy started with a state folder of its own (BERTH_HOME) is not the one
// a plain `burf` in a terminal reaches: that command would start a second,
// empty client. Its folder is not added to PATH.
fn own_state(home: Option<std::ffi::OsString>) -> Option<String> {
    home.filter(|h| !h.is_empty()).map(|_| {
        "This copy of Burf keeps its state in a folder of its own (BERTH_HOME), so a burf command in a terminal would not reach it.".to_string()
    })
}

fn cli_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(exe.parent().ok_or("no application directory")?.join("cli"))
}

fn path_action(action: PathAction) -> Result<String, String> {
    if cfg!(debug_assertions) {
        return Err("PATH integration is only available in an installed build".into());
    }
    let dir = cli_dir()?;
    if matches!(action, PathAction::Add) && !dir.join("burf.exe").is_file() {
        return Err("this build carries no command to add to PATH".into());
    }
    let root = std::env::var_os("SystemRoot").ok_or("Windows system directory is unavailable")?;
    let out = Command::new(PathBuf::from(root).join("System32/WindowsPowerShell/v1.0/powershell.exe"))
        .creation_flags(0x08000000)
        .args(["-NoProfile", "-NonInteractive", "-Command"])
        .arg(path_command(action, &dir))
        .output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[tauri::command]
pub fn cli_link_status() -> Result<CliLink, String> {
    let dir = cli_dir()?;
    let bundled = !cfg!(debug_assertions) && dir.join("burf.exe").is_file();
    let state = if !bundled { "missing" } else {
        match path_action(PathAction::Status)?.as_str() {
            "linked" => "linked",
            "external" => "file",
            _ => "missing",
        }
    };
    Ok(CliLink {
        link: dir.display().to_string(),
        bundled: bundled.then(|| dir.join("burf.exe").display().to_string()),
        blocked: own_state(std::env::var_os("BERTH_HOME")),
        state,
        target: None,
    })
}

#[tauri::command]
pub fn install_cli_link() -> Result<CliLink, String> {
    if let Some(why) = own_state(std::env::var_os("BERTH_HOME")) {
        return Err(why);
    }
    path_action(PathAction::Add)?;
    cli_link_status()
}

#[tauri::command]
pub fn remove_cli_link() -> Result<CliLink, String> {
    path_action(PathAction::Remove)?;
    cli_link_status()
}

pub fn remove_for_installer() -> Result<(), String> {
    path_action(PathAction::Remove).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_command_keeps_directory_literal() {
        let command = path_command(PathAction::Add, std::path::Path::new(r"C:\Burf's & $Tools\cli"));
        assert!(command.ends_with(r"-Action 'Add' -CliDirectory 'C:\Burf''s & $Tools\cli'"));
        assert!(!command.contains("ExecutionPolicy"));
    }

    #[test]
    fn a_copy_with_its_own_state_folder_is_not_added_to_path() {
        assert!(own_state(None).is_none());
        assert!(own_state(Some("".into())).is_none());
        assert!(own_state(Some(r"C:\Temp\qa-home".into())).expect("blocked").contains("BERTH_HOME"));
    }
}
