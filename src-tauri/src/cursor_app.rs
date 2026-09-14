use std::path::{Path, PathBuf};

pub fn cursor_launch_folder(path: &str) -> Result<&str, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("プロジェクトが開いていません".into());
    }
    if trimmed == "/demo" || trimmed.starts_with("/demo/") {
        return Err("ローカルのプロジェクトフォルダのみ Cursor で開けます".into());
    }
    Ok(trimmed)
}

pub fn cursor_exe_candidates(local_app_data: Option<&Path>) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(local) = local_app_data {
        paths.push(local.join(r"Programs\cursor\Cursor.exe"));
        paths.push(local.join(r"Programs\Cursor\Cursor.exe"));
        paths.push(local.join(r"cursor\Cursor.exe"));
    }
    paths.push(PathBuf::from(r"/Applications/Cursor.app/Contents/MacOS/Cursor"));
    paths
}

pub fn resolve_cursor_exe(
    candidates: &[PathBuf],
    exists: impl Fn(&Path) -> bool,
) -> Option<PathBuf> {
    candidates.iter().find(|path| exists(path)).cloned()
}

pub fn open_folder_in_cursor(path: String) -> Result<(), String> {
    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        let _ = path;
        Err("Cursor で開くのはデスクトップ版で使えます".into())
    }
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        open_on_desktop(&path)
    }
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn open_on_desktop(path: &str) -> Result<(), String> {
    let folder = cursor_launch_folder(path)?;
    let folder_path = PathBuf::from(folder);
    if !folder_path.is_dir() {
        return Err("フォルダが見つかりません".into());
    }
    let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let exe = resolve_cursor_exe(&cursor_exe_candidates(local.as_deref()), |candidate| {
        candidate.is_file()
    });
    let mut command = match &exe {
        Some(path) => std::process::Command::new(path),
        None => std::process::Command::new("cursor"),
    };
    command.arg(&folder_path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    command
        .spawn()
        .map_err(|error| format!("Cursor を起動できませんでした: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn rejects_empty_and_in_memory_demo_folders() {
        assert_eq!(
            cursor_launch_folder("").unwrap_err(),
            "プロジェクトが開いていません"
        );
        assert_eq!(
            cursor_launch_folder("   ").unwrap_err(),
            "プロジェクトが開いていません"
        );
        assert_eq!(
            cursor_launch_folder("/demo").unwrap_err(),
            "ローカルのプロジェクトフォルダのみ Cursor で開けます"
        );
        assert_eq!(
            cursor_launch_folder("/demo/図面").unwrap_err(),
            "ローカルのプロジェクトフォルダのみ Cursor で開けます"
        );
        assert_eq!(
            cursor_launch_folder(r"C:\projects\現場A").unwrap(),
            r"C:\projects\現場A"
        );
    }

    #[test]
    fn prefers_local_app_cursor_exe() {
        let local = PathBuf::from(r"C:\Users\me\AppData\Local");
        let preferred = local.join(r"Programs\cursor\Cursor.exe");
        let candidates = cursor_exe_candidates(Some(&local));
        assert_eq!(candidates[0], preferred);
        let found = resolve_cursor_exe(&candidates, |path| path == preferred);
        assert_eq!(found, Some(preferred));
    }

    #[test]
    fn skips_missing_candidates() {
        let local = PathBuf::from(r"C:\Users\me\AppData\Local");
        let fallback = local.join(r"cursor\Cursor.exe");
        let found = resolve_cursor_exe(&cursor_exe_candidates(Some(&local)), |path| {
            path == fallback
        });
        assert_eq!(found, Some(fallback));
    }
}
