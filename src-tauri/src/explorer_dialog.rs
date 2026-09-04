use std::path::PathBuf;
use std::process::Command;

pub fn windows_path_to_wsl(path: &str) -> String {
    let trimmed = path.trim().trim_matches('"');
    let stripped = trimmed
        .strip_prefix(r"\\?\")
        .or_else(|| trimmed.strip_prefix("//?/"))
        .unwrap_or(trimmed);

    let normalized = stripped.replace('\\', "/");
    let bytes = normalized.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        let drive = (bytes[0] as char).to_ascii_lowercase();
        if drive.is_ascii_alphabetic() {
            let rest = normalized[2..].trim_start_matches('/');
            if rest.is_empty() {
                return format!("/mnt/{drive}");
            }
            return format!("/mnt/{drive}/{rest}");
        }
    }
    normalized
}

pub fn looks_like_windows_path(path: &str) -> bool {
    let trimmed = path.trim().trim_matches('"');
    let stripped = trimmed
        .strip_prefix(r"\\?\")
        .or_else(|| trimmed.strip_prefix("//?/"))
        .unwrap_or(trimmed);
    let bytes = stripped.as_bytes();
    (bytes.len() >= 2 && bytes[1] == b':') || stripped.starts_with(r"\\") || stripped.starts_with("//")
}

pub fn to_local_fs_path(path: &str) -> String {
    if !looks_like_windows_path(path) {
        return path.trim().replace('\\', "/");
    }
    if let Some(converted) = wslpath_to_unix(path) {
        return converted;
    }
    windows_path_to_wsl(path)
}

fn wslpath_to_unix(path: &str) -> Option<String> {
    let output = Command::new("wslpath")
        .arg("-u")
        .arg(path.trim())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let converted = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if converted.is_empty() {
        None
    } else {
        Some(converted)
    }
}

pub fn is_wsl() -> bool {
    std::env::var("WSL_DISTRO_NAME").is_ok()
        || std::fs::read_to_string("/proc/version")
            .map(|version| version.to_ascii_lowercase().contains("microsoft"))
            .unwrap_or(false)
}

#[derive(Debug, PartialEq, Eq)]
pub enum ExplorerDialogResult {
    Picked(String),
    Cancelled,
    Failed,
}

fn parse_dialog_output(status_ok: bool, stdout: &str, stderr: &str) -> ExplorerDialogResult {
    if !status_ok {
        return ExplorerDialogResult::Failed;
    }
    let path = stdout.trim();
    if path.is_empty() {
        if stderr.to_ascii_lowercase().contains("error") {
            return ExplorerDialogResult::Failed;
        }
        return ExplorerDialogResult::Cancelled;
    }
    ExplorerDialogResult::Picked(path.to_string())
}

fn powershell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn powershell_binaries() -> Vec<&'static str> {
    vec![
        "powershell.exe",
        "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
        "/mnt/c/Windows/Sysnative/WindowsPowerShell/v1.0/powershell.exe",
    ]
}

fn run_powershell(script: &str) -> ExplorerDialogResult {
    let mut last = ExplorerDialogResult::Failed;
    for binary in powershell_binaries() {
        let output = Command::new(binary)
            .args([
                "-NoProfile",
                "-STA",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                script,
            ])
            .output();
        match output {
            Ok(output) => {
                last = parse_dialog_output(
                    output.status.success(),
                    &String::from_utf8_lossy(&output.stdout),
                    &String::from_utf8_lossy(&output.stderr),
                );
                if last != ExplorerDialogResult::Failed {
                    return last;
                }
            }
            Err(_) => continue,
        }
    }
    last
}

const EXPLORER_DIALOG_PRELUDE: &str = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
"#;

fn explorer_open_script(title: &str, filter: Option<&str>, folder_mode: bool) -> String {
    let mut script = String::from(EXPLORER_DIALOG_PRELUDE);
    script.push_str("$dialog = New-Object System.Windows.Forms.OpenFileDialog\n");
    script.push_str("$dialog.AutoUpgradeEnabled = $true\n");
    script.push_str(&format!("$dialog.Title = {}\n", powershell_single_quote(title)));
    script.push_str("$dialog.Multiselect = $false\n");
    script.push_str("$dialog.DereferenceLinks = $true\n");
    if folder_mode {
        script.push_str("$dialog.CheckFileExists = $false\n");
        script.push_str("$dialog.CheckPathExists = $true\n");
        script.push_str("$dialog.ValidateNames = $false\n");
        script.push_str("$dialog.FileName = 'このフォルダーを選択'\n");
    } else if let Some(filter) = filter {
        script.push_str(&format!("$dialog.Filter = {}\n", powershell_single_quote(filter)));
    }
    script.push_str("$result = $dialog.ShowDialog($form)\n");
    script.push_str("$form.Dispose()\n");
    script.push_str("if ($result -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }\n");
    if folder_mode {
        script.push_str(
            r#"
$selected = $dialog.FileName
if (Test-Path -LiteralPath $selected -PathType Container) {
  Write-Output $selected
} else {
  Write-Output (Split-Path -LiteralPath $selected)
}
"#,
        );
    } else {
        script.push_str("Write-Output $dialog.FileName\n");
    }
    script
}

fn explorer_save_script(title: &str, default_name: &str, default_dir: Option<&str>) -> String {
    let mut script = String::from(EXPLORER_DIALOG_PRELUDE);
    script.push_str("$dialog = New-Object System.Windows.Forms.SaveFileDialog\n");
    script.push_str("$dialog.AutoUpgradeEnabled = $true\n");
    script.push_str(&format!("$dialog.Title = {}\n", powershell_single_quote(title)));
    script.push_str("$dialog.Filter = 'PDF (*.pdf)|*.pdf'\n");
    script.push_str("$dialog.AddExtension = $true\n");
    script.push_str("$dialog.DefaultExt = 'pdf'\n");
    script.push_str("$dialog.OverwritePrompt = $true\n");
    script.push_str(&format!(
        "$dialog.FileName = {}\n",
        powershell_single_quote(default_name)
    ));
    if let Some(dir) = default_dir {
        script.push_str(&format!(
            "$dialog.InitialDirectory = {}\n",
            powershell_single_quote(dir)
        ));
    }
    script.push_str("$result = $dialog.ShowDialog($form)\n");
    script.push_str("$form.Dispose()\n");
    script.push_str("if ($result -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }\n");
    script.push_str("Write-Output $dialog.FileName\n");
    script
}

pub fn pick_explorer_folder() -> ExplorerDialogResult {
    run_powershell(&explorer_open_script("フォルダーを選択", None, true))
}

pub fn pick_explorer_pdf_or_zip() -> ExplorerDialogResult {
    run_powershell(&explorer_open_script(
        "PDF または ZIP を選択",
        Some("PDF / ZIP (*.pdf;*.zip)|*.pdf;*.zip|すべてのファイル (*.*)|*.*"),
        false,
    ))
}

pub fn pick_explorer_save(default_name: &str, default_dir: Option<&str>) -> ExplorerDialogResult {
    let windows_dir = default_dir.and_then(unix_path_to_windows);
    run_powershell(&explorer_save_script(
        "PDF を保存",
        default_name,
        windows_dir.as_deref(),
    ))
}

fn map_mnt_to_windows(path: &str) -> Option<String> {
    let trimmed = path.trim().replace('\\', "/");
    trimmed.strip_prefix("/mnt/").and_then(|rest| {
        let mut chars = rest.chars();
        let drive = chars.next()?.to_ascii_uppercase();
        let remainder = chars.as_str();
        if !drive.is_ascii_alphabetic() {
            return None;
        }
        if remainder.is_empty() {
            return Some(format!("{drive}:\\"));
        }
        if !remainder.starts_with('/') {
            return None;
        }
        Some(format!("{drive}:{}", remainder.replace('/', "\\")))
    })
}

fn unix_path_to_windows(path: &str) -> Option<String> {
    if looks_like_windows_path(path) {
        return Some(path.replace('/', "\\"));
    }
    if let Some(mapped) = map_mnt_to_windows(path) {
        return Some(mapped);
    }
    if let Ok(output) = Command::new("wslpath").arg("-w").arg(path).output() {
        if output.status.success() {
            let converted = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !converted.is_empty() {
                return Some(converted);
            }
        }
    }
    None
}

#[derive(Debug, PartialEq, Eq)]
enum NativePickAction {
    UsePath(String),
    Cancel,
    FallbackRfd,
}

fn native_pick_action(is_wsl: bool, windows: Option<ExplorerDialogResult>) -> NativePickAction {
    match windows {
        Some(ExplorerDialogResult::Picked(path)) => {
            NativePickAction::UsePath(to_local_fs_path(&path))
        }
        Some(ExplorerDialogResult::Cancelled) => NativePickAction::Cancel,
        Some(ExplorerDialogResult::Failed) if is_wsl => NativePickAction::Cancel,
        Some(ExplorerDialogResult::Failed) | None => NativePickAction::FallbackRfd,
    }
}

fn finish_native_pick(
    is_wsl: bool,
    windows: Option<ExplorerDialogResult>,
    fallback: impl FnOnce() -> Option<PathBuf>,
) -> Option<PathBuf> {
    match native_pick_action(is_wsl, windows) {
        NativePickAction::UsePath(path) => Some(PathBuf::from(path)),
        NativePickAction::Cancel => None,
        NativePickAction::FallbackRfd => fallback(),
    }
}

pub fn pick_explorer_image() -> ExplorerDialogResult {
    run_powershell(&explorer_open_script(
        "画像を選択",
        Some("画像 (*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp)|*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp|すべてのファイル (*.*)|*.*"),
        false,
    ))
}

pub fn pick_folder_native() -> Option<PathBuf> {
    let wsl = is_wsl();
    finish_native_pick(
        wsl,
        wsl.then(pick_explorer_folder),
        || rfd::FileDialog::new().pick_folder(),
    )
}

pub fn pick_file_native() -> Option<PathBuf> {
    let wsl = is_wsl();
    finish_native_pick(
        wsl,
        wsl.then(pick_explorer_pdf_or_zip),
        || {
            rfd::FileDialog::new()
                .add_filter("PDF / ZIP", &["pdf", "zip"])
                .pick_file()
        },
    )
}

pub fn pick_image_native() -> Option<PathBuf> {
    let wsl = is_wsl();
    finish_native_pick(
        wsl,
        wsl.then(pick_explorer_image),
        || {
            rfd::FileDialog::new()
                .add_filter("Images", &["png", "jpg", "jpeg", "webp", "gif", "bmp"])
                .pick_file()
        },
    )
}

pub fn save_file_native(default_name: &str, default_dir: Option<&str>) -> Option<PathBuf> {
    let wsl = is_wsl();
    finish_native_pick(
        wsl,
        wsl.then(|| pick_explorer_save(default_name, default_dir)),
        || {
            let mut dialog = rfd::FileDialog::new()
                .add_filter("PDF", &["pdf"])
                .set_file_name(default_name);
            if let Some(dir) = default_dir {
                dialog = dialog.set_directory(dir);
            }
            dialog.save_file()
        },
    )
}

#[cfg(test)]
mod tests {
    use super::{
        looks_like_windows_path, map_mnt_to_windows, native_pick_action, parse_dialog_output,
        powershell_binaries, unix_path_to_windows, windows_path_to_wsl, ExplorerDialogResult,
        NativePickAction,
    };

    #[test]
    fn converts_drive_letter_windows_paths_to_wsl() {
        assert_eq!(
            windows_path_to_wsl(r"C:\Users\me\現場A"),
            "/mnt/c/Users/me/現場A"
        );
        assert_eq!(windows_path_to_wsl("D:/data/proj"), "/mnt/d/data/proj");
        assert_eq!(windows_path_to_wsl(r"\\?\C:\Users\me"), "/mnt/c/Users/me");
        assert_eq!(windows_path_to_wsl("E:\\"), "/mnt/e");
    }

    #[test]
    fn leaves_unix_paths_unchanged() {
        assert_eq!(
            windows_path_to_wsl("/home/umekawa/proj"),
            "/home/umekawa/proj"
        );
    }

    #[test]
    fn detects_windows_paths() {
        assert!(looks_like_windows_path(r"C:\Users\me"));
        assert!(looks_like_windows_path("C:/Users/me"));
        assert!(!looks_like_windows_path("/home/umekawa/proj"));
    }

    #[test]
    fn converts_wsl_mounts_back_to_windows() {
        assert_eq!(
            map_mnt_to_windows("/mnt/c/Users/me/現場A").as_deref(),
            Some(r"C:\Users\me\現場A")
        );
        assert_eq!(map_mnt_to_windows("/mnt/d").as_deref(), Some(r"D:\"));
        assert_eq!(map_mnt_to_windows("/home/me"), None);
        assert_eq!(
            unix_path_to_windows("/mnt/c/Users/me/現場A").as_deref(),
            Some(r"C:\Users\me\現場A")
        );
        assert_eq!(unix_path_to_windows("/mnt/d").as_deref(), Some(r"D:\"));
        let home = unix_path_to_windows("/home/me");
        if let Some(path) = home {
            assert!(
                path.contains("wsl") || path.starts_with(r"\\"),
                "linux home paths must not be invented as a drive letter, got {path}"
            );
        }
    }

    #[test]
    fn treats_empty_success_as_cancel_and_nonzero_as_failure() {
        assert_eq!(
            parse_dialog_output(true, "  \n", ""),
            ExplorerDialogResult::Cancelled
        );
        assert_eq!(
            parse_dialog_output(false, "", "boom"),
            ExplorerDialogResult::Failed
        );
        assert_eq!(
            parse_dialog_output(true, "C:\\Users\\me\\現場A\n", ""),
            ExplorerDialogResult::Picked(r"C:\Users\me\現場A".to_string())
        );
    }

    #[test]
    fn never_falls_back_to_gtk_file_dialog_on_wsl() {
        assert_eq!(
            native_pick_action(true, Some(ExplorerDialogResult::Failed)),
            NativePickAction::Cancel
        );
        assert_eq!(
            native_pick_action(true, Some(ExplorerDialogResult::Cancelled)),
            NativePickAction::Cancel
        );
        assert_eq!(
            native_pick_action(false, Some(ExplorerDialogResult::Failed)),
            NativePickAction::FallbackRfd
        );
        assert_eq!(
            native_pick_action(false, None),
            NativePickAction::FallbackRfd
        );
    }

    #[test]
    fn uses_windows_explorer_path_when_powershell_succeeds() {
        assert_eq!(
            native_pick_action(
                true,
                Some(ExplorerDialogResult::Picked("/mnt/c/Users/me/a.pdf".into())),
            ),
            NativePickAction::UsePath("/mnt/c/Users/me/a.pdf".into())
        );
    }

    #[test]
    fn lists_windows_powershell_candidates_for_wsl() {
        let bins = powershell_binaries();
        assert!(bins.iter().any(|bin| bin.contains("powershell.exe")));
        assert!(bins.iter().any(|bin| bin.contains("/mnt/c/Windows")));
    }
}
