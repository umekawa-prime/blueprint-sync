#[tauri::command]
pub fn share_file(path: String, mime: String) -> Result<(), String> {
    let _ = (path, mime);
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("共有シートを開けませんでした".to_string())
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        Ok(())
    }
}
