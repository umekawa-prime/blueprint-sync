use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub fn is_camera_image_name(_name: &str) -> bool {
    false
}

pub fn images_modified_after(_dir: &Path, _since: SystemTime) -> Result<Vec<PathBuf>, String> {
    Ok(Vec::new())
}

pub fn unix_ms_to_system_time(ms: u64) -> SystemTime {
    UNIX_EPOCH + Duration::from_millis(ms)
}

pub fn system_time_to_unix_ms(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

pub fn launch_system_camera() -> Result<u64, String> {
    Err("not implemented".into())
}

pub fn list_new_camera_roll_images(_since_unix_ms: u64) -> Result<Vec<PathBuf>, String> {
    Err("not implemented".into())
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, SystemTime};

    use super::{images_modified_after, is_camera_image_name};

    #[test]
    fn accepts_camera_roll_image_extensions() {
        assert!(is_camera_image_name("WIN_20260928.jpg"));
        assert!(is_camera_image_name("photo.JPEG"));
        assert!(is_camera_image_name("shot.png"));
        assert!(!is_camera_image_name(".hidden.jpg"));
        assert!(!is_camera_image_name("note.txt"));
        assert!(!is_camera_image_name("partial.tmp"));
    }

    #[test]
    fn returns_only_images_written_after_the_watch_started() {
        let dir = std::env::temp_dir().join(format!(
            "blueprint-sync-camera-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("old.jpg"), b"old").unwrap();
        std::thread::sleep(Duration::from_millis(40));
        let since = SystemTime::now();
        std::thread::sleep(Duration::from_millis(40));
        std::fs::write(dir.join("WIN_new.jpg"), b"new").unwrap();
        std::fs::write(dir.join("empty.jpg"), b"").unwrap();
        std::fs::write(dir.join("notes.txt"), b"nope").unwrap();

        let found = images_modified_after(&dir, since).unwrap();
        let names: Vec<_> = found
            .iter()
            .map(|path| path.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["WIN_new.jpg".to_string()]);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
