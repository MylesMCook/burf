use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

// The app is only a view over the laptop agent. When the agent is not
// running, the "not running" screen offers to start it with the berth CLI:
// the copy bundled inside Berth.app, or in a debug build (pnpm tauri dev)
// the repository's bin/berth, or one installed in the usual places.

// The bundled CLI's name. It cannot be "berth": that is the app's own
// executable in Contents/MacOS (and target/debug), and macOS file names
// ignore case, so "Berth" would collide too.
pub const SIDECAR: &str = "berth-cli";

#[derive(Serialize)]
pub struct AgentBinary {
    path: String,
    // How it was found: "bundled", "repository" or "installed".
    source: &'static str,
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata()
            .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

// find_berth looks for the berth CLI. BERTH_CLI, when set, wins.
pub fn find_berth() -> Option<(PathBuf, &'static str)> {
    if let Some(p) = std::env::var_os("BERTH_CLI").filter(|p| !p.is_empty()) {
        let p = PathBuf::from(p);
        return is_executable(&p).then_some((p, "installed"));
    }
    if let Some(dir) = std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) {
        let p = dir.join(SIDECAR);
        if is_executable(&p) {
            return Some((p, "bundled"));
        }
    }
    #[cfg(debug_assertions)]
    {
        // app/src-tauri is two levels below the repository; make puts berth in bin/.
        let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../bin/berth");
        if is_executable(&p) {
            return Some((p.canonicalize().unwrap_or(p), "repository"));
        }
    }
    // An app started from Finder has a bare PATH, so look where berth is
    // usually installed rather than on it.
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".local/bin/berth"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/berth"));
    candidates.push(PathBuf::from("/usr/local/bin/berth"));
    candidates
        .into_iter()
        .find(|p| is_executable(p))
        .map(|p| (p, "installed"))
}

// run runs berth with args and returns what it printed, or why it failed.
// The agent it starts writes to its own log, not to these pipes, so this
// returns as soon as berth does.
pub fn run(bin: &Path, args: &[&str]) -> Result<String, String> {
    let out = Command::new(bin)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("could not run {}: {e}", bin.display()))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() {
        return Ok(stdout);
    }
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("berth {} exited with {}", args.join(" "), out.status)
    })
}

#[tauri::command]
pub fn agent_binary() -> Option<AgentBinary> {
    find_berth().map(|(p, source)| AgentBinary {
        path: p.display().to_string(),
        source,
    })
}

// start_agent starts the agent now (`berth agent start`, which outlives the
// app), or with at_login installs it as a login service that starts it now
// and at every login (`berth agent install`). The screen asks first: nothing
// is installed unless the person ticks "Start at login".
#[tauri::command]
pub async fn start_agent(at_login: bool) -> Result<String, String> {
    let (bin, _) = find_berth().ok_or("Berth could not find its berth command")?;
    let args: &'static [&'static str] = if at_login {
        &["agent", "install"]
    } else {
        &["agent", "start"]
    };
    tauri::async_runtime::spawn_blocking(move || run(&bin, args))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    // In a debug build the repository's bin/berth is found (make build puts
    // it there), and `berth agent start` starts an agent that outlives the
    // call. It runs in its own BERTH_HOME so it cannot touch a real agent.
    #[test]
    fn starts_the_agent_from_the_repository() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../bin/berth");
        if !is_executable(&repo) {
            eprintln!("skipped: no bin/berth (run make build)");
            return;
        }
        let (bin, source) = find_berth().expect("bin/berth is found");
        assert_eq!(source, "repository");
        assert_eq!(bin, repo.canonicalize().unwrap());

        // Unix socket paths are short; a temp dir under /tmp keeps it so.
        let home = PathBuf::from(format!("/tmp/bt.{}", std::process::id()));
        std::fs::create_dir_all(&home).unwrap();
        std::env::set_var("BERTH_HOME", &home);
        std::env::set_var("BERTH_USER_DIR", home.join("user"));
        let started = run(&bin, &["agent", "start"]);
        let status = run(&bin, &["agent", "status", "--json"]);
        let stopped = run(&bin, &["stop"]);
        let _ = std::fs::remove_dir_all(&home);
        assert_eq!(started.unwrap(), "The berth agent is running.");
        let status: String = status.unwrap().split_whitespace().collect();
        assert!(status.contains("\"running\":true"), "{status}");
        assert_eq!(stopped.unwrap(), "Stopped the berth agent.");
    }

    #[test]
    fn run_reports_why_berth_failed() {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../bin/berth");
        if !is_executable(&repo) {
            return;
        }
        let err = run(&repo, &["agent", "nope"]).unwrap_err();
        assert!(err.contains("usage: berth agent"), "{err}");
    }
}
