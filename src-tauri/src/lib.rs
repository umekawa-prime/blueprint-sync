mod sync_server;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod explorer_dialog;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::sync_server::{ServerInfo, SyncServer, DEFAULT_PORT};

#[derive(Serialize)]
struct PdfFile {
    name: String,
    path: String,
    bytes: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct RecentProject {
    name: String,
    path: String,
}

fn is_visible_pdf_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".pdf") && !name.starts_with('.')
}

enum CopyIntoFolderDecision {
    SkipSamePath,
    NameCollision,
    Proceed,
}

fn decide_copy_into_folder(
    source_canon: &Path,
    dest_canon: &Path,
    dest_exists: bool,
) -> CopyIntoFolderDecision {
    if source_canon == dest_canon {
        CopyIntoFolderDecision::SkipSamePath
    } else if dest_exists {
        CopyIntoFolderDecision::NameCollision
    } else {
        CopyIntoFolderDecision::Proceed
    }
}

#[tauri::command]
async fn start_sync_server(
    state: State<'_, Arc<SyncServer>>,
    port: Option<u16>,
) -> Result<ServerInfo, String> {
    state.start(port.unwrap_or(DEFAULT_PORT)).await
}

#[tauri::command]
async fn stop_sync_server(state: State<'_, Arc<SyncServer>>) -> Result<(), String> {
    state.stop().await;
    Ok(())
}

#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let dest = Path::new(&path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(dest, bytes).map_err(|error| error.to_string())
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn pick_pdf_file() -> Result<Option<PdfFile>, String> {
    let Some(path) = explorer_dialog::pick_file_native() else {
        return Ok(None);
    };

    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document.pdf")
        .to_string();
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    Ok(Some(PdfFile {
        name,
        path: path.to_string_lossy().into_owned(),
        bytes,
    }))
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn pick_pdf_file() -> Result<Option<PdfFile>, String> {
    Err("モバイルでは HTML のファイル選択を使ってください".to_string())
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    Ok(explorer_dialog::pick_folder_native().map(|path| path.to_string_lossy().into_owned()))
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    Err("モバイルではフォルダ選択ダイアログを使えません".to_string())
}

#[tauri::command]
fn init_project_dir(folder: String) -> Result<(), String> {
    let root = Path::new(&folder);
    let annotations = root.join(".blueprint-sync").join("annotations");
    std::fs::create_dir_all(annotations).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join("図面")).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join("工程表")).map_err(|error| error.to_string())?;
    Ok(())
}

fn collect_visible_pdfs(
    dir: &Path,
    prefix: Option<&str>,
    names: &mut Vec<String>,
) -> Result<(), String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.to_string()),
    };
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if !file_type.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(rel) = project_pdf_rel_name(prefix, &name) {
            names.push(rel);
        }
    }
    Ok(())
}

fn project_pdf_rel_name(prefix: Option<&str>, name: &str) -> Option<String> {
    if !is_visible_pdf_name(name) {
        return None;
    }
    match prefix {
        Some(dir) if dir == "図面" || dir == "工程表" => Some(format!("{dir}/{name}")),
        None => Some(name.to_string()),
        _ => None,
    }
}

#[tauri::command]
fn list_project_pdfs(folder: String) -> Result<Vec<String>, String> {
    let root = Path::new(&folder);
    let mut names = Vec::new();
    collect_visible_pdfs(root, None, &mut names)?;
    collect_visible_pdfs(&root.join("図面"), Some("図面"), &mut names)?;
    collect_visible_pdfs(&root.join("工程表"), Some("工程表"), &mut names)?;
    names.sort();
    Ok(names)
}

#[tauri::command]
fn copy_file_into_folder(source: String, folder: String) -> Result<String, String> {
    let source_path = PathBuf::from(&source);
    let name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "ファイル名を取得できません".to_string())?;
    let dest = Path::new(&folder).join(name);
    let source_canon = source_path.canonicalize().unwrap_or(source_path.clone());
    let dest_canon = dest.canonicalize().unwrap_or(dest.clone());
    let dest_exists = dest.exists();

    match decide_copy_into_folder(&source_canon, &dest_canon, dest_exists) {
        CopyIntoFolderDecision::SkipSamePath => Ok(dest.to_string_lossy().into_owned()),
        CopyIntoFolderDecision::NameCollision => {
            Err("同じ名前のPDFが既にあります".to_string())
        }
        CopyIntoFolderDecision::Proceed => {
            std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
            std::fs::copy(&source_path, &dest).map_err(|error| error.to_string())?;
            Ok(dest.to_string_lossy().into_owned())
        }
    }
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpGetPayload {
    status: u16,
    content_type: String,
    content_disposition: String,
    bytes: Vec<u8>,
}

const MAX_DOWNLOAD_BYTES: usize = 80 * 1024 * 1024;

#[tauri::command]
async fn http_get(url: String) -> Result<HttpGetPayload, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|error| error.to_string())?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("http または https の URL だけダウンロードできます".to_string());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .user_agent("BlueprintSync/0.1")
        .build()
        .map_err(|error| error.to_string())?;
    let response = client.get(parsed).send().await.map_err(|error| error.to_string())?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .map(|value| String::from_utf8_lossy(value.as_bytes()).into_owned())
        .unwrap_or_default();
    let content_disposition = response
        .headers()
        .get(reqwest::header::CONTENT_DISPOSITION)
        .map(|value| String::from_utf8_lossy(value.as_bytes()).into_owned())
        .unwrap_or_default();
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    if bytes.len() > MAX_DOWNLOAD_BYTES {
        return Err("ファイルが大きすぎます（80MBまで）".to_string());
    }
    Ok(HttpGetPayload {
        status,
        content_type,
        content_disposition,
        bytes: bytes.to_vec(),
    })
}

fn recent_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("recent-projects.json"))
}

fn parse_recent_projects_json(raw: &str) -> Vec<RecentProject> {
    serde_json::from_str(raw).unwrap_or_default()
}

#[tauri::command]
fn load_recent_projects(app: AppHandle) -> Result<Vec<RecentProject>, String> {
    let path = recent_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(parse_recent_projects_json(&raw))
}

#[tauri::command]
fn save_recent_projects(app: AppHandle, items: Vec<RecentProject>) -> Result<(), String> {
    let path = recent_path(&app)?;
    let raw = serde_json::to_string_pretty(&items).map_err(|error| error.to_string())?;
    std::fs::write(path, raw).map_err(|error| error.to_string())
}

#[tauri::command]
fn path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn save_pdf_file(
    default_name: String,
    bytes: Vec<u8>,
    default_dir: Option<String>,
) -> Result<bool, String> {
    let Some(path) = explorer_dialog::save_file_native(&default_name, default_dir.as_deref()) else {
        return Ok(false);
    };

    std::fs::write(path, bytes).map_err(|error| error.to_string())?;
    Ok(true)
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn save_pdf_file(
    _default_name: String,
    _bytes: Vec<u8>,
    _default_dir: Option<String>,
) -> Result<bool, String> {
    Err("モバイルでは HTML のダウンロードを使ってください".to_string())
}

#[cfg(windows)]
fn allow_webview_camera(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|platform| {
        unsafe {
            let Ok(webview) = platform.controller().CoreWebView2() else {
                return;
            };
            let mut token = 0_i64;
            let handler = webview2_com::PermissionRequestedEventHandler::create(Box::new(
                |_, args| {
                    let Some(args) = args else {
                        return Ok(());
                    };
                    let mut kind = webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_KIND::default();
                    args.PermissionKind(&mut kind)?;
                    if kind
                        == webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_KIND_CAMERA
                    {
                        args.SetState(
                            webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                        )?;
                    }
                    Ok(())
                },
            ));
            let _ = webview.add_PermissionRequested(&handler, &mut token);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            #[cfg(windows)]
            if let Some(window) = _app.get_webview_window("main") {
                allow_webview_camera(&window);
            }
            Ok(())
        })
        .manage(Arc::new(SyncServer::default()))
        .invoke_handler(tauri::generate_handler![
            start_sync_server,
            stop_sync_server,
            read_file_bytes,
            write_file_bytes,
            pick_pdf_file,
            pick_folder,
            init_project_dir,
            list_project_pdfs,
            copy_file_into_folder,
            delete_file,
            http_get,
            load_recent_projects,
            save_recent_projects,
            path_exists,
            save_pdf_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        decide_copy_into_folder, is_visible_pdf_name, parse_recent_projects_json,
        project_pdf_rel_name, CopyIntoFolderDecision, RecentProject,
    };

    #[test]
    fn accepts_pdf_and_rejects_hidden_and_other_types() {
        assert!(is_visible_pdf_name("a.pdf"));
        assert!(is_visible_pdf_name("B.PDF"));
        assert!(!is_visible_pdf_name(".hidden.pdf"));
        assert!(!is_visible_pdf_name("notes.txt"));
        assert!(!is_visible_pdf_name(".blueprint-sync"));
    }

    #[test]
    fn copy_decision_skips_same_canonical_path() {
        let path = Path::new("/tmp/same.pdf");
        assert!(matches!(
            decide_copy_into_folder(path, path, true),
            CopyIntoFolderDecision::SkipSamePath
        ));
    }

    #[test]
    fn copy_decision_errors_when_dest_exists_and_paths_differ() {
        let source = Path::new("/tmp/a/source.pdf");
        let dest = Path::new("/tmp/a/dest.pdf");
        assert!(matches!(
            decide_copy_into_folder(source, dest, true),
            CopyIntoFolderDecision::NameCollision
        ));
    }

    #[test]
    fn lists_root_and_kind_prefixed_pdf_names() {
        assert_eq!(project_pdf_rel_name(None, "A.pdf").as_deref(), Some("A.pdf"));
        assert_eq!(
            project_pdf_rel_name(Some("図面"), "1F.pdf").as_deref(),
            Some("図面/1F.pdf")
        );
        assert_eq!(
            project_pdf_rel_name(Some("工程表"), "週間工程.pdf").as_deref(),
            Some("工程表/週間工程.pdf")
        );
        assert_eq!(project_pdf_rel_name(Some("other"), "A.pdf"), None);
        assert_eq!(project_pdf_rel_name(None, ".hidden.pdf"), None);
    }

    #[test]
    fn copy_decision_proceeds_when_dest_missing() {
        let source = Path::new("/tmp/a/source.pdf");
        let dest = Path::new("/tmp/a/dest.pdf");
        assert!(matches!(
            decide_copy_into_folder(source, dest, false),
            CopyIntoFolderDecision::Proceed
        ));
    }

    #[test]
    fn invalid_recent_projects_json_returns_empty_list() {
        assert_eq!(parse_recent_projects_json("{not json}"), Vec::<RecentProject>::new());
    }
}
