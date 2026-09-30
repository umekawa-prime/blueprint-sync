mod cad_dxf;
mod cad_font;
mod cad_pdf;
mod cursor_app;
mod window_hit;
mod dxf_read;
mod jwcad;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod explorer_dialog;
mod sandbox;
mod share;
mod sync_server;
mod system_camera;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::Serialize;
use tauri::ipc::Response;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::sandbox::{
    list_project_files, list_sandbox_projects, remove_dir_all, sandbox_projects_dir, RecentProject,
};
use crate::share::share_file;
use crate::sync_server::{ServerInfo, SyncServer, DEFAULT_PORT};

#[derive(Serialize)]
struct PdfFile {
    name: String,
    path: String,
    bytes: Vec<u8>,
}

#[derive(Serialize)]
struct PickedPath {
    name: String,
    path: String,
}

fn is_visible_pdf_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".pdf") && !name.starts_with('.')
}

fn is_visible_cad_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    !name.starts_with('.')
        && (lower.ends_with(".jww")
            || lower.ends_with(".jwc")
            || lower.ends_with(".dxf")
            || lower.ends_with(".dfx"))
}

enum CopyIntoFolderDecision {
    SkipSamePath,
    NameCollision,
    Proceed,
}

enum RenameFileDecision {
    SamePath,
    DifferentParent,
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
fn parse_cad_to_dxf(bytes: Vec<u8>) -> Result<serde_json::Value, String> {
    cad_dxf::cad_bytes_to_dxf_json(&bytes)
}

#[tauri::command]
fn open_cad_in_jwcad(path: String) -> Result<(), String> {
    jwcad::open_cad_in_jwcad(path)
}

#[tauri::command]
fn open_folder_in_cursor(path: String) -> Result<(), String> {
    cursor_app::open_folder_in_cursor(path)
}

#[tauri::command]
async fn convert_cad_to_pdf(bytes: Vec<u8>) -> Result<Response, String> {
    let pdf = tauri::async_runtime::spawn_blocking(move || cad_dxf::cad_bytes_to_pdf(&bytes))
        .await
        .map_err(|error| error.to_string())??;
    Ok(Response::new(pdf))
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
    Ok(None)
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn pick_pdf_files() -> Result<Vec<PickedPath>, String> {
    Ok(explorer_dialog::pick_files_native()
        .into_iter()
        .map(|path| {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("document.pdf")
                .to_string();
            PickedPath {
                name,
                path: path.to_string_lossy().into_owned(),
            }
        })
        .collect())
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn pick_pdf_files() -> Result<Vec<PickedPath>, String> {
    Ok(Vec::new())
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    Ok(explorer_dialog::pick_folder_native().map(|path| path.to_string_lossy().into_owned()))
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn pdf_file_from_path(path: PathBuf, fallback_name: &str) -> Result<PdfFile, String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(fallback_name)
        .to_string();
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    Ok(PdfFile {
        name,
        path: path.to_string_lossy().into_owned(),
        bytes,
    })
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn pick_image_file() -> Result<Option<PdfFile>, String> {
    explorer_dialog::pick_image_native()
        .map(|path| pdf_file_from_path(path, "image.jpg"))
        .transpose()
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn pick_image_file() -> Result<Option<PdfFile>, String> {
    Ok(None)
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn pick_image_files() -> Result<Vec<PdfFile>, String> {
    explorer_dialog::pick_images_native()
        .into_iter()
        .map(|path| pdf_file_from_path(path, "image.jpg"))
        .collect()
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn pick_image_files() -> Result<Vec<PdfFile>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn launch_system_camera(app: AppHandle) -> Result<u64, String> {
    let since = std::time::SystemTime::now();
    let (sender, receiver) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(system_camera::open_system_camera());
    })
    .map_err(|error| error.to_string())?;
    receiver
        .recv()
        .map_err(|_| "カメラを起動できませんでした".to_string())??;
    Ok(system_camera::system_time_to_unix_ms(since))
}

/// After the OS camera took a shot, return the user to the drawing.
#[tauri::command]
fn focus_main_window(app: AppHandle) {
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    #[cfg(any(target_os = "ios", target_os = "android"))]
    let _ = app;
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
#[tauri::command]
fn list_new_camera_roll_images(since_unix_ms: u64) -> Result<Vec<PdfFile>, String> {
    let mut files = Vec::new();
    for path in system_camera::list_new_camera_roll_images(since_unix_ms)? {
        let Ok(file) = pdf_file_from_path(path, "photo.jpg") else {
            continue;
        };
        files.push(file);
    }
    Ok(files)
}

#[cfg(any(target_os = "ios", target_os = "android"))]
#[tauri::command]
fn list_new_camera_roll_images(_since_unix_ms: u64) -> Result<Vec<PdfFile>, String> {
    Ok(Vec::new())
}

#[tauri::command]
fn init_project_dir(folder: String) -> Result<(), String> {
    let root = Path::new(&folder);
    let annotations = root.join(".blueprint-sync").join("annotations");
    std::fs::create_dir_all(annotations).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join("図面")).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join("工程表")).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root.join("図面JWW")).map_err(|error| error.to_string())?;
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
        if let Some(rel) = project_listed_rel_name(prefix, &name) {
            names.push(rel);
        }
    }
    Ok(())
}

fn project_listed_rel_name(prefix: Option<&str>, name: &str) -> Option<String> {
    if let Some(rel) = project_pdf_rel_name(prefix, name) {
        return Some(rel);
    }
    if prefix == Some("図面JWW") && is_visible_cad_name(name) {
        return Some(format!("図面JWW/{name}"));
    }
    None
}

fn project_pdf_rel_name(prefix: Option<&str>, name: &str) -> Option<String> {
    if !is_visible_pdf_name(name) {
        return None;
    }
    match prefix {
        Some(dir) if dir == "図面" || dir == "工程表" || dir == "図面JWW" => {
            Some(format!("{dir}/{name}"))
        }
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
    collect_visible_pdfs(&root.join("図面JWW"), Some("図面JWW"), &mut names)?;
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
        CopyIntoFolderDecision::NameCollision => Err("同じ名前のPDFが既にあります".to_string()),
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

fn decide_rename_file(from: &Path, to: &Path, dest_exists: bool) -> RenameFileDecision {
    if from == to {
        return RenameFileDecision::SamePath;
    }
    match (from.parent(), to.parent()) {
        (Some(from_parent), Some(to_parent)) if from_parent == to_parent => {
            if dest_exists {
                RenameFileDecision::NameCollision
            } else {
                RenameFileDecision::Proceed
            }
        }
        _ => RenameFileDecision::DifferentParent,
    }
}

#[tauri::command]
fn rename_file(from: String, to: String) -> Result<(), String> {
    let from_path = PathBuf::from(&from);
    let to_path = PathBuf::from(&to);
    let dest_exists = to_path.exists();
    match decide_rename_file(&from_path, &to_path, dest_exists) {
        RenameFileDecision::SamePath => Ok(()),
        RenameFileDecision::DifferentParent => {
            Err("同じフォルダ内でのみ名前を変更できます".to_string())
        }
        RenameFileDecision::NameCollision => Err("同じ名前のファイルが既にあります".to_string()),
        RenameFileDecision::Proceed => {
            std::fs::rename(&from_path, &to_path).map_err(|error| error.to_string())
        }
    }
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
    let response = client
        .get(parsed)
        .send()
        .await
        .map_err(|error| error.to_string())?;
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
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("recent-projects.json"))
}

fn parse_recent_projects_json(raw: &str) -> Vec<RecentProject> {
    serde_json::from_str(raw).unwrap_or_default()
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
struct OpenSession {
    #[serde(default)]
    folders: Vec<String>,
    #[serde(default)]
    active_folder: Option<String>,
}

fn open_session_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("open-session.json"))
}

fn parse_open_session_json(raw: &str) -> OpenSession {
    serde_json::from_str(raw).unwrap_or_default()
}

#[tauri::command]
fn load_open_session(app: AppHandle) -> Result<OpenSession, String> {
    let path = open_session_path(&app)?;
    if !path.exists() {
        return Ok(OpenSession::default());
    }
    let raw = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(parse_open_session_json(&raw))
}

#[tauri::command]
fn save_open_session(app: AppHandle, session: OpenSession) -> Result<(), String> {
    let path = open_session_path(&app)?;
    let raw = serde_json::to_string_pretty(&session).map_err(|error| error.to_string())?;
    std::fs::write(path, raw).map_err(|error| error.to_string())
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
    let Some(path) = explorer_dialog::save_file_native(&default_name, default_dir.as_deref())
    else {
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
    Ok(false)
}

#[cfg(windows)]
fn allow_webview_camera(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|platform| {
        unsafe {
            let controller = platform.controller();
            let Ok(webview) = controller.CoreWebView2() else {
                return;
            };
            // Trackpad pinch arrives as synthetic ctrl+wheel. Tauri leaves
            // IsZoomControlEnabled=false, which swallows that gesture.
            if let Ok(settings) = webview.Settings() {
                let _ = settings.SetIsZoomControlEnabled(true);
            }
            let mut zoom_token = 0_i64;
            let zoom_handler = webview2_com::ZoomFactorChangedEventHandler::create(Box::new(
                |changed, _| {
                    let Some(changed) = changed else {
                        return Ok(());
                    };
                    let mut factor = 0.0;
                    changed.ZoomFactor(&mut factor)?;
                    if (factor - 1.0).abs() > 0.001 {
                        changed.SetZoomFactor(1.0)?;
                    }
                    Ok(())
                },
            ));
            let _ = controller.add_ZoomFactorChanged(&zoom_handler, &mut zoom_token);
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

#[cfg(any(
    target_os = "linux",
    target_os = "dragonfly",
    target_os = "freebsd",
    target_os = "netbsd",
    target_os = "openbsd"
))]
fn allow_webview_camera(window: &tauri::WebviewWindow) {
    use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

    let _ = window.with_webview(|platform| {
        let webview = platform.inner();
        if let Some(settings) = webview.settings() {
            settings.set_enable_media_stream(true);
        }
        webview.connect_permission_request(|_, request| {
            request.allow();
            true
        });
    });
}

#[cfg(not(any(
    windows,
    target_os = "linux",
    target_os = "dragonfly",
    target_os = "freebsd",
    target_os = "netbsd",
    target_os = "openbsd"
)))]
fn allow_webview_camera(_window: &tauri::WebviewWindow) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(not(any(target_os = "ios", target_os = "android")))]
                {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.center();
                    let _ = window.set_focus();
                }
                allow_webview_camera(&window);
                #[cfg(windows)]
                if let Ok(hwnd) = window.hwnd() {
                    window_hit::install_clickable_top_client(hwnd);
                }
            }
            let incoming: Vec<String> = std::env::args()
                .skip(1)
                .filter(|arg| {
                    let lower = arg.to_ascii_lowercase();
                    lower.ends_with(".pdf") || lower.ends_with(".zip")
                })
                .collect();
            if !incoming.is_empty() {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(400)).await;
                    let _ = handle.emit("incoming-files", incoming);
                });
            }
            Ok(())
        })
        .manage(Arc::new(SyncServer::default()))
        .invoke_handler(tauri::generate_handler![
            start_sync_server,
            stop_sync_server,
            read_file_bytes,
            write_file_bytes,
            parse_cad_to_dxf,
            convert_cad_to_pdf,
            open_cad_in_jwcad,
            open_folder_in_cursor,
            pick_pdf_file,
            pick_pdf_files,
            pick_folder,
            pick_image_file,
            pick_image_files,
            launch_system_camera,
            list_new_camera_roll_images,
            focus_main_window,
            init_project_dir,
            list_project_pdfs,
            copy_file_into_folder,
            delete_file,
            rename_file,
            http_get,
            load_recent_projects,
            save_recent_projects,
            load_open_session,
            save_open_session,
            path_exists,
            save_pdf_file,
            sandbox_projects_dir,
            list_project_files,
            remove_dir_all,
            list_sandbox_projects,
            share_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        decide_copy_into_folder, decide_rename_file, is_visible_pdf_name,
        parse_open_session_json, parse_recent_projects_json, project_listed_rel_name, project_pdf_rel_name,
        CopyIntoFolderDecision, OpenSession, RecentProject, RenameFileDecision,
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
        assert_eq!(
            project_pdf_rel_name(None, "A.pdf").as_deref(),
            Some("A.pdf")
        );
        assert_eq!(
            project_pdf_rel_name(Some("図面"), "1F.pdf").as_deref(),
            Some("図面/1F.pdf")
        );
        assert_eq!(
            project_pdf_rel_name(Some("工程表"), "週間工程.pdf").as_deref(),
            Some("工程表/週間工程.pdf")
        );
        assert_eq!(
            project_pdf_rel_name(Some("図面JWW"), "1F.pdf").as_deref(),
            Some("図面JWW/1F.pdf")
        );
        assert_eq!(project_pdf_rel_name(Some("other"), "A.pdf"), None);
        assert_eq!(project_pdf_rel_name(None, ".hidden.pdf"), None);
        assert_eq!(
            project_listed_rel_name(Some("図面JWW"), "1F.jww").as_deref(),
            Some("図面JWW/1F.jww")
        );
        assert_eq!(
            project_listed_rel_name(Some("図面JWW"), "旧図.JWC").as_deref(),
            Some("図面JWW/旧図.JWC")
        );
        assert_eq!(
            project_listed_rel_name(Some("図面JWW"), "平面.dxf").as_deref(),
            Some("図面JWW/平面.dxf")
        );
        assert_eq!(
            project_listed_rel_name(Some("図面JWW"), "配管.DFX").as_deref(),
            Some("図面JWW/配管.DFX")
        );
        assert_eq!(project_listed_rel_name(Some("図面"), "1F.jww"), None);
        assert_eq!(project_listed_rel_name(None, "1F.jww"), None);
        assert_eq!(project_listed_rel_name(Some("図面"), "平面.dxf"), None);
    }

    #[test]
    fn rename_stays_in_the_same_folder() {
        let from = Path::new("/tmp/図面/1F.pdf");
        let to = Path::new("/tmp/図面/平面.pdf");
        let other = Path::new("/tmp/工程表/平面.pdf");
        assert!(matches!(
            decide_rename_file(from, to, false),
            RenameFileDecision::Proceed
        ));
        assert!(matches!(
            decide_rename_file(from, from, false),
            RenameFileDecision::SamePath
        ));
        assert!(matches!(
            decide_rename_file(from, to, true),
            RenameFileDecision::NameCollision
        ));
        assert!(matches!(
            decide_rename_file(from, other, false),
            RenameFileDecision::DifferentParent
        ));
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
        assert_eq!(
            parse_recent_projects_json("{not json}"),
            Vec::<RecentProject>::new()
        );
    }

    fn sample_open_session() -> OpenSession {
        OpenSession {
            folders: vec!["/a".into(), "/b".into()],
            active_folder: Some("/b".into()),
        }
    }

    #[test]
    fn parses_open_session_json() {
        assert_eq!(
            parse_open_session_json(r#"{"folders":["/a","/b"],"activeFolder":"/b"}"#),
            sample_open_session()
        );
    }

    #[test]
    fn invalid_open_session_json_returns_empty_session() {
        assert_eq!(parse_open_session_json("{not json}"), OpenSession::default());
        assert_eq!(parse_open_session_json("{}").folders, Vec::<String>::new());
        assert_eq!(parse_open_session_json("{}").active_folder, None);
    }
}
