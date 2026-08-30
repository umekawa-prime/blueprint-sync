mod sync_server;

use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::sync_server::{ServerInfo, SyncServer, DEFAULT_PORT};

#[derive(Serialize)]
struct PdfFile {
    name: String,
    bytes: Vec<u8>,
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
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn pick_pdf_file() -> Result<Option<PdfFile>, String> {
    let selected = rfd::FileDialog::new()
        .add_filter("PDF", &["pdf"])
        .pick_file();

    let Some(path) = selected else {
        return Ok(None);
    };

    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document.pdf")
        .to_string();
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    Ok(Some(PdfFile { name, bytes }))
}

#[tauri::command]
fn save_pdf_file(default_name: String, bytes: Vec<u8>) -> Result<bool, String> {
    let selected = rfd::FileDialog::new()
        .add_filter("PDF", &["pdf"])
        .set_file_name(&default_name)
        .save_file();

    let Some(path) = selected else {
        return Ok(false);
    };

    std::fs::write(path, bytes).map_err(|error| error.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Arc::new(SyncServer::default()))
        .invoke_handler(tauri::generate_handler![
            start_sync_server,
            stop_sync_server,
            read_file_bytes,
            write_file_bytes,
            pick_pdf_file,
            save_pdf_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
