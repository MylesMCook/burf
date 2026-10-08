use serde::Serialize;
use std::path::{Path, PathBuf};

// "Install the burf command" in Settings → General. Burf.app carries the
// burf CLI as Contents/MacOS/burf-cli; this links ~/.local/bin/burf to it,
// so a terminal gets the same burf the app runs, and it updates with the
// app. A new install links it once by itself, into an empty spot only
// (src/lib/cli-setup.ts). Replacing something that is already there happens
// only when the person asks, and the screen says first what will be replaced.

#[derive(Serialize)]
pub struct CliLink {
    // Where the link goes: ~/.local/bin/burf.
    link: String,
    // The CLI inside this copy of Burf.app, or None in a dev build, which
    // has none to link to.
    bundled: Option<String>,
    // Why the bundled CLI cannot be linked yet: Burf is running from the
    // disk image or from a quarantined copy macOS moved aside.
    blocked: Option<String>,
    // What is at the link now: "missing", "linked" (to this app's CLI),
    // "symlink" (to something else) or "file" (a burf from the release
    // archive, say).
    state: &'static str,
    // Where a symlink at the link points.
    target: Option<String>,
}

fn link_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("no home directory")?;
    Ok(home.join(".local/bin/burf"))
}

fn bundled() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    // Only a packaged app: Contents/MacOS/burf-cli.
    if !dir.ends_with("Contents/MacOS") {
        return None;
    }
    let p = dir.join(crate::agent::SIDECAR);
    p.is_file().then_some(p)
}

// A link into a mounted disk image or an App Translocation copy breaks as
// soon as the image is ejected or the app moved, so ask for the app to be
// in place first.
fn blocked(p: &Path) -> Option<String> {
    let s = p.to_string_lossy();
    if s.starts_with("/Volumes/") {
        return Some("Burf is running from its disk image. Drag it to Applications, open it from there, then install the command.".into());
    }
    if s.contains("/AppTranslocation/") {
        return Some("macOS is running Burf from a temporary copy. Move Burf to Applications, open it from there, then install the command.".into());
    }
    None
}

// A copy started with a state folder of its own (BERTH_HOME) is not the one
// a plain `burf` in a terminal reaches: that command would start a second,
// empty client. Its command is not linked.
fn own_state(home: Option<std::ffi::OsString>) -> Option<String> {
    home.filter(|h| !h.is_empty()).map(|_| {
        "This copy of Burf keeps its state in a folder of its own (BERTH_HOME), so a burf command in a terminal would not reach it.".to_string()
    })
}

fn status() -> Result<CliLink, String> {
    let link = link_path()?;
    let bundled = bundled();
    let target = std::fs::read_link(&link).ok();
    let state = match std::fs::symlink_metadata(&link) {
        Err(_) => "missing",
        Ok(m) if m.file_type().is_symlink() => {
            if bundled.is_some() && target.as_deref() == bundled.as_deref() {
                "linked"
            } else {
                "symlink"
            }
        }
        Ok(_) => "file",
    };
    Ok(CliLink {
        link: link.display().to_string(),
        blocked: own_state(std::env::var_os("BERTH_HOME")).or_else(|| bundled.as_deref().and_then(blocked)),
        bundled: bundled.map(|p| p.display().to_string()),
        state,
        target: target.map(|p| p.display().to_string()),
    })
}

#[tauri::command]
pub fn cli_link_status() -> Result<CliLink, String> {
    status()
}

// install_cli_link points ~/.local/bin/burf at this app's CLI. A symlink
// already there is replaced; a file (a burf from the release archive) is
// kept beside it as burf.previous, not deleted.
#[tauri::command]
pub fn install_cli_link() -> Result<CliLink, String> {
    let src = bundled().ok_or("this build of Burf carries no burf command to link to")?;
    if let Some(why) = own_state(std::env::var_os("BERTH_HOME")).or_else(|| blocked(&src)) {
        return Err(why);
    }
    let link = link_path()?;
    let dir = link.parent().ok_or("no folder for the link")?;
    std::fs::create_dir_all(dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    match std::fs::symlink_metadata(&link) {
        Ok(m) if m.file_type().is_symlink() => {
            std::fs::remove_file(&link).map_err(|e| format!("could not replace {}: {e}", link.display()))?;
        }
        Ok(m) if m.is_dir() => return Err(format!("{} is a folder; move it aside first", link.display())),
        Ok(_) => {
            let kept = link.with_file_name("burf.previous");
            std::fs::rename(&link, &kept).map_err(|e| format!("could not move {} aside: {e}", link.display()))?;
        }
        Err(_) => {}
    }
    symlink(&src, &link).map_err(|e| format!("could not link {}: {e}", link.display()))?;
    status()
}

#[tauri::command]
pub fn remove_cli_link() -> Result<CliLink, String> {
    let current = status()?;
    if current.state != "linked" {
        return Err("the burf link is not owned by this app".into());
    }
    std::fs::remove_file(link_path()?).map_err(|e| e.to_string())?;
    status()
}

#[cfg(unix)]
fn symlink(src: &Path, link: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(src, link)
}

#[cfg(not(unix))]
fn symlink(_: &Path, _: &Path) -> std::io::Result<()> {
    Err(std::io::Error::other("only on macOS and Linux"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_copy_with_its_own_state_folder_is_not_linked() {
        assert!(own_state(None).is_none());
        assert!(own_state(Some("".into())).is_none());
        let why = own_state(Some("/tmp/qa-home".into())).expect("blocked");
        assert!(why.contains("BERTH_HOME"));
    }
}
