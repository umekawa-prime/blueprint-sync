use std::path::{Path, PathBuf};

const PROGRAMDATA_LNK: &str =
    r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Jw_cad\Jw_cad.lnk";
const FALLBACK_JW_WIN: &str = r"C:\jww\Jw_win.exe";
const FALLBACK_JWW: &str = r"C:\jww\jww.exe";

pub fn is_cad_file_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    (lower.ends_with(".jww") || lower.ends_with(".jwc")) && !path.trim().is_empty()
}

pub fn exe_from_lnk_bytes(bytes: &[u8]) -> Option<PathBuf> {
    let mut preferred: Option<PathBuf> = None;
    let mut other: Option<PathBuf> = None;
    let mut i = 0;
    while i + 4 < bytes.len() {
        if bytes[i].eq_ignore_ascii_case(&b'c') && bytes[i + 1] == b':' && bytes[i + 2] == b'\\' {
            let rest = &bytes[i..];
            let end = rest.iter().position(|&b| b == 0).unwrap_or(rest.len());
            if let Ok(text) = std::str::from_utf8(&rest[..end]) {
                if text.to_ascii_lowercase().ends_with(".exe") {
                    let path = PathBuf::from(text);
                    let name = path
                        .file_name()
                        .and_then(|value| value.to_str())
                        .unwrap_or("")
                        .to_ascii_lowercase();
                    if name == "jw_win.exe" || name == "jww.exe" {
                        preferred = Some(path);
                        break;
                    }
                    if other.is_none() {
                        other = Some(path);
                    }
                }
            }
            i += end.max(1);
            continue;
        }
        i += 1;
    }
    preferred.or(other)
}

pub fn jwcad_exe_candidates(app_data: Option<&Path>) -> Vec<PathBuf> {
    let mut paths = vec![PathBuf::from(PROGRAMDATA_LNK)];
    if let Some(app_data) = app_data {
        paths.push(
            app_data
                .join(r"Microsoft\Windows\Start Menu\Programs\Jw_cad\Jw_cad.lnk"),
        );
    }
    paths.push(PathBuf::from(FALLBACK_JW_WIN));
    paths.push(PathBuf::from(FALLBACK_JWW));
    paths
}

pub fn resolve_jwcad_exe(
    candidates: &[PathBuf],
    exists: impl Fn(&Path) -> bool,
    read: impl Fn(&Path) -> Option<Vec<u8>>,
) -> Option<PathBuf> {
    for candidate in candidates {
        if !exists(candidate) {
            continue;
        }
        let name = candidate
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if name == "lnk" {
            if let Some(bytes) = read(candidate) {
                if let Some(exe) = exe_from_lnk_bytes(&bytes) {
                    if exists(&exe) {
                        return Some(exe);
                    }
                }
            }
            continue;
        }
        return Some(candidate.clone());
    }
    None
}

pub fn open_cad_in_jwcad(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        open_on_windows(&path)
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("Jw_cad は Windows のデスクトップ版で開けます".into())
    }
}

#[cfg(windows)]
fn open_on_windows(path: &str) -> Result<(), String> {
    if !is_cad_file_path(path) {
        return Err("JWW/JWCファイルではありません".into());
    }
    let file = PathBuf::from(path);
    if !file.is_file() {
        return Err("ファイルが見つかりません".into());
    }
    let app_data = std::env::var_os("APPDATA").map(PathBuf::from);
    let exe = resolve_jwcad_exe(
        &jwcad_exe_candidates(app_data.as_deref()),
        |candidate| candidate.exists(),
        |candidate| std::fs::read(candidate).ok(),
    )
    .ok_or_else(|| "Jw_cad が見つかりません".to_string())?;
    let mut command = std::process::Command::new(&exe);
    command.arg(&file);
    if let Some(dir) = exe.parent() {
        command.current_dir(dir);
    }
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x0800_0000);
    command
        .spawn()
        .map_err(|error| format!("Jw_cad を起動できませんでした: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::path::PathBuf;

    #[test]
    fn accepts_jww_and_jwc_paths() {
        assert!(is_cad_file_path(r"C:\proj\図面JWW\1F.jww"));
        assert!(is_cad_file_path(r"C:\proj\図面JWW\旧.JWC"));
        assert!(!is_cad_file_path(r"C:\proj\図面\1F.pdf"));
        assert!(!is_cad_file_path(""));
    }

    #[test]
    fn reads_jw_win_from_shortcut_bytes() {
        let mut bytes = b"XXXX".to_vec();
        bytes.extend_from_slice(br"C:\jww\Jw_win.exe");
        bytes.push(0);
        bytes.extend_from_slice(br"C:\Windows\System32\notepad.exe");
        bytes.push(0);
        assert_eq!(
            exe_from_lnk_bytes(&bytes),
            Some(PathBuf::from(r"C:\jww\Jw_win.exe"))
        );
    }

    #[test]
    fn prefers_start_menu_shortcut_over_fallback() {
        let lnk = PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Jw_cad\Jw_cad.lnk");
        let fallback = PathBuf::from(r"C:\jww\Jw_win.exe");
        let resolved = PathBuf::from(r"C:\cad\Jw_win.exe");
        let mut files = HashMap::new();
        let mut lnk_bytes = b"pad".to_vec();
        lnk_bytes.extend_from_slice(br"C:\cad\Jw_win.exe");
        lnk_bytes.push(0);
        files.insert(lnk.clone(), lnk_bytes);
        files.insert(resolved.clone(), vec![]);
        files.insert(fallback.clone(), vec![]);
        let found = resolve_jwcad_exe(
            &[lnk, fallback],
            |path| files.contains_key(path),
            |path| files.get(path).cloned(),
        );
        assert_eq!(found, Some(resolved));
    }

    #[test]
    fn reads_installed_jwcad_shortcut_when_present() {
        let path = PathBuf::from(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Jw_cad\Jw_cad.lnk");
        if !path.exists() {
            return;
        }
        let bytes = std::fs::read(&path).expect("read Jw_cad.lnk");
        assert_eq!(
            exe_from_lnk_bytes(&bytes),
            Some(PathBuf::from(r"C:\jww\Jw_win.exe"))
        );
    }

    #[test]
    fn falls_back_to_jww_exe_when_shortcut_missing() {
        let fallback = PathBuf::from(r"C:\jww\jww.exe");
        let found = resolve_jwcad_exe(
            &[
                PathBuf::from(r"C:\missing\Jw_cad.lnk"),
                PathBuf::from(r"C:\jww\Jw_win.exe"),
                fallback.clone(),
            ],
            |path| path == fallback,
            |_| None,
        );
        assert_eq!(found, Some(fallback));
    }
}
