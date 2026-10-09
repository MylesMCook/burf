// The interface is selected once per process. Verified bytes stay in memory,
// so a CLI swap or later disk damage cannot mix two interfaces in one session.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{borrow::Cow, collections::BTreeMap, fs, io::Read, path::Path};
use tauri::{
    utils::assets::{AssetKey, AssetsIter, CspHash},
    Assets, Runtime,
};

// The shared contract is documented beside shell.txt. Bump it when native
// commands, events or capabilities used by the frontend change.
const SHELL: &str = include_str!("../../../internal/uicontract/shell.txt");
pub const BUILTIN_ENV: &str = "BERTH_UI_BUILTIN";
const MAX_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Deserialize)]
struct Manifest {
    shell: String,
    version: String,
    files: BTreeMap<String, String>,
}

#[derive(Clone, Serialize)]
pub struct InterfaceInfo {
    pub version: String,
    pub source: &'static str,
    pub shell: String,
    pub reason: String,
}

pub struct InterfaceAssets<R: Runtime> {
    embedded: Box<dyn Assets<R>>,
    files: Option<BTreeMap<String, Vec<u8>>>,
    hashes: BTreeMap<String, Vec<String>>,
    pub info: InterfaceInfo,
}

fn valid_path(path: &str) -> bool {
    !path.is_empty()
        && !path.contains(['\\', ':'])
        && path
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

// Reject links and special files, including links in parent components. Only
// these validated relative names are ever joined to the interface directory.
fn regular_tree(root: &Path, prefix: &str, out: &mut Vec<String>) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| "non-UTF8 asset path")?;
        let name = format!("{prefix}{name}");
        if !valid_path(&name) {
            return Err(format!("invalid asset path: {name}"));
        }
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        if kind.is_dir() {
            regular_tree(&entry.path(), &format!("{name}/"), out)?;
        } else if kind.is_file() {
            out.push(name);
        } else {
            return Err(format!("asset is not a regular file: {name}"));
        }
    }
    Ok(())
}

fn read_bounded(path: &Path, remaining: u64) -> Result<Vec<u8>, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(remaining + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > remaining {
        return Err("interface exceeds 512 MiB".into());
    }
    Ok(bytes)
}

fn load(root: &Path) -> Result<(Manifest, BTreeMap<String, Vec<u8>>), String> {
    if !fs::symlink_metadata(root)
        .map_err(|e| e.to_string())?
        .is_dir()
    {
        return Err("interface folder is not a directory".into());
    }
    let mut names = Vec::new();
    regular_tree(root, "", &mut names)?;
    let bytes = read_bounded(&root.join("manifest.json"), MAX_BYTES)?;
    let mut total = bytes.len() as u64;
    let manifest: Manifest = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    if manifest.shell != SHELL.trim() {
        return Err("interface shell contract does not match".into());
    }
    if manifest.version.trim().is_empty() || !manifest.files.contains_key("index.html") {
        return Err("interface version or index.html is missing".into());
    }
    names.retain(|name| name != "manifest.json");
    names.sort();
    if names != manifest.files.keys().cloned().collect::<Vec<_>>() {
        return Err("interface file list does not match manifest".into());
    }
    let mut files = BTreeMap::new();
    for (name, hash) in &manifest.files {
        if !valid_path(name) {
            return Err(format!("invalid asset path: {name}"));
        }
        let path = root.join(name);
        let bytes = read_bounded(&path, MAX_BYTES - total)?;
        total += bytes.len() as u64;
        if format!("{:x}", Sha256::digest(&bytes)) != *hash {
            return Err(format!("interface checksum does not match: {name}"));
        }
        files.insert(format!("/{name}"), bytes);
    }
    Ok((manifest, files))
}

impl<R: Runtime> InterfaceAssets<R> {
    pub fn select(
        embedded: Box<dyn Assets<R>>,
        root: Result<&Path, String>,
        builtin: bool,
        version: &str,
    ) -> Self {
        let selected = if builtin {
            Err(format!("{BUILTIN_ENV} is set"))
        } else {
            root.and_then(load)
        };
        let mut result = Self {
            embedded,
            files: None,
            hashes: BTreeMap::new(),
            info: InterfaceInfo {
                version: version.into(),
                source: "built-in",
                shell: SHELL.trim().into(),
                reason: String::new(),
            },
        };
        match selected {
            Ok((manifest, mut files)) => {
                // Match Tauri's codegen HTML processing, including import maps.
                // Never reuse the compiled index's inline hashes for folder HTML.
                for (key, bytes) in &mut files {
                    if key.ends_with(".html") {
                        let html = match String::from_utf8(bytes.clone()) {
                            Ok(html) => html,
                            Err(_) => {
                                result.info.reason = format!("invalid UTF-8 HTML: {key}");
                                return result;
                            }
                        };
                        let doc = tauri::utils::html2::parse_doc(html);
                        let hashes = doc
                            .select("script:not(:empty)")
                            .iter()
                            .map(|element| {
                                let text = element.text();
                                let script =
                                    tauri::utils::html2::normalize_script_for_csp(text.as_bytes());
                                format!("'sha256-{}'", STANDARD.encode(Sha256::digest(script)))
                            })
                            .collect();
                        result.hashes.insert(key.clone(), hashes);
                        tauri::utils::html2::inject_nonce_token(&doc, &Default::default());
                        *bytes = tauri::utils::html2::serialize_doc(&doc);
                    }
                }
                result.info.version = manifest.version;
                result.info.source = "folder";
                result.info.reason = "whole interface with matching shell contract".into();
                result.files = Some(files);
            }
            Err(reason) => result.info.reason = reason,
        }
        result
    }
}

impl<R: Runtime> Assets<R> for InterfaceAssets<R> {
    fn setup(&self, app: &tauri::App<R>) {
        self.embedded.setup(app);
    }
    fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        // AssetKey has one leading slash by Tauri's contract. Strip only that
        // slash; absolute filesystem paths and traversal never reach the disk.
        let path = key.as_ref().strip_prefix('/')?;
        if !valid_path(path) {
            return None;
        }
        match &self.files {
            Some(files) => files
                .get(key.as_ref())
                .map(|bytes| Cow::Borrowed(bytes.as_slice())),
            None => self.embedded.get(key),
        }
    }
    fn iter(&self) -> Box<AssetsIter<'_>> {
        match &self.files {
            Some(files) => Box::new(files.iter().map(|(name, bytes)| {
                (
                    Cow::Borrowed(name.as_str()),
                    Cow::Borrowed(bytes.as_slice()),
                )
            })),
            None => self.embedded.iter(),
        }
    }
    fn csp_hashes(&self, path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        if self.files.is_none() {
            return self.embedded.csp_hashes(path);
        }
        // An absent HTML key gives only Tauri's global hashes, not the compiled
        // index's hashes. Keep them for native initialization/isolation scripts.
        let globals = self
            .embedded
            .csp_hashes(&AssetKey::from("/__burf_ui_globals__"));
        let local = self
            .hashes
            .get(path.as_ref())
            .into_iter()
            .flatten()
            .map(|h| CspHash::Script(h.as_str()));
        Box::new(globals.chain(local))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    struct Folder(std::path::PathBuf);
    impl Folder {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "burf-ui-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(path.join("assets/nested")).unwrap();
            let f = Self(path);
            f.write(
                "index.html",
                b"<html><script type=importmap>{\"imports\":{}}</script></html>",
            );
            f.write("assets/nested/app.js", b"export default 'new';");
            f.manifest(SHELL.trim());
            f
        }
        fn write(&self, name: &str, bytes: &[u8]) {
            fs::write(self.0.join(name), bytes).unwrap();
        }
        fn manifest(&self, shell: &str) {
            let mut files = BTreeMap::new();
            for name in ["index.html", "assets/nested/app.js"] {
                files.insert(
                    name,
                    format!("{:x}", Sha256::digest(fs::read(self.0.join(name)).unwrap())),
                );
            }
            self.write(
                "manifest.json",
                &serde_json::to_vec(
                    &serde_json::json!({"shell": shell, "version": "new-version", "files": files}),
                )
                .unwrap(),
            );
        }
        fn assets(&self, builtin: bool) -> InterfaceAssets<tauri::Wry> {
            InterfaceAssets::select(Box::new(Compiled), Ok(&self.0), builtin, "compiled-version")
        }
    }
    impl Drop for Folder {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    struct Compiled;
    impl Assets<tauri::Wry> for Compiled {
        fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
            match key.as_ref() {
                "/index.html" => Some(Cow::Borrowed(b"compiled index")),
                "/assets/nested/app.js" => Some(Cow::Borrowed(b"compiled script")),
                _ => None,
            }
        }
        fn iter(&self) -> Box<AssetsIter<'_>> {
            Box::new(std::iter::empty())
        }
        fn csp_hashes(&self, key: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
            if key.as_ref() == "/index.html" {
                Box::new([CspHash::Script("compiled inline hash")].into_iter())
            } else {
                Box::new([CspHash::Script("native global hash")].into_iter())
            }
        }
    }
    fn assert_compiled(a: &InterfaceAssets<tauri::Wry>) {
        assert_eq!(a.info.source, "built-in");
        assert_eq!(a.info.version, "compiled-version");
        assert_eq!(
            a.get(&AssetKey::from("index.html")).unwrap().as_ref(),
            b"compiled index"
        );
        assert_eq!(
            a.get(&AssetKey::from("assets/nested/app.js"))
                .unwrap()
                .as_ref(),
            b"compiled script"
        );
    }
    #[test]
    fn whole_folder_and_nested_assets_with_its_own_inline_hashes() {
        let f = Folder::new();
        let a = f.assets(false);
        assert_eq!(a.info.source, "folder");
        assert_eq!(a.info.version, "new-version");
        assert!(a
            .get(&AssetKey::from("index.html"))
            .unwrap()
            .starts_with(b"<html>"));
        assert_eq!(
            a.get(&AssetKey::from("assets/nested/app.js"))
                .unwrap()
                .as_ref(),
            b"export default 'new';"
        );
        let expected = format!(
            "'sha256-{}'",
            STANDARD.encode(Sha256::digest(b"{\"imports\":{}}"))
        );
        let hashes: Vec<_> = a
            .csp_hashes(&AssetKey::from("index.html"))
            .map(|h| h.hash().to_owned())
            .collect();
        assert_eq!(hashes, vec!["native global hash".to_string(), expected]);
        f.write("assets/nested/app.js", b"damage after startup");
        assert_eq!(
            a.get(&AssetKey::from("assets/nested/app.js"))
                .unwrap()
                .as_ref(),
            b"export default 'new';"
        );
    }
    #[test]
    fn missing_changed_unlisted_or_unreadable_folder_falls_back_for_everything() {
        let f = Folder::new();
        f.write("assets/nested/app.js", b"damaged");
        assert_compiled(&f.assets(false));
        fs::remove_file(f.0.join("assets/nested/app.js")).unwrap();
        assert_compiled(&f.assets(false));
        fs::remove_file(f.0.join("manifest.json")).unwrap();
        assert_compiled(&f.assets(false));
        let f = Folder::new();
        f.write("extra.js", b"unlisted");
        assert_compiled(&f.assets(false));
        assert_compiled(&InterfaceAssets::select(
            Box::new(Compiled),
            Err("no state folder".into()),
            false,
            "compiled-version",
        ));
    }
    #[test]
    fn wrong_shell_or_launch_override_falls_back() {
        let f = Folder::new();
        assert_compiled(&f.assets(true));
        assert!(f.assets(true).info.reason.contains(BUILTIN_ENV));
        f.manifest("wrong-shell");
        assert_compiled(&f.assets(false));
    }
    #[test]
    fn traversal_and_absolute_paths_are_refused() {
        let f = Folder::new();
        let a = f.assets(false);
        for name in [
            "../index.html",
            "assets/../../index.html",
            "//index.html",
            "/etc/passwd",
            "C:\\index.html",
        ] {
            assert!(a.get(&AssetKey::from(name)).is_none(), "{name}");
        }
        for name in [
            "../index.html",
            "/etc/passwd",
            "C:/index.html",
            "assets/../index.html",
        ] {
            assert!(!valid_path(name));
        }
    }
    #[cfg(unix)]
    #[test]
    fn links_and_parent_links_are_refused() {
        let f = Folder::new();
        fs::remove_file(f.0.join("assets/nested/app.js")).unwrap();
        std::os::unix::fs::symlink(f.0.join("index.html"), f.0.join("assets/nested/app.js"))
            .unwrap();
        assert_compiled(&f.assets(false));
        fs::remove_dir_all(f.0.join("assets")).unwrap();
        std::os::unix::fs::symlink(&f.0, f.0.join("assets")).unwrap();
        assert_compiled(&f.assets(false));
    }
}
