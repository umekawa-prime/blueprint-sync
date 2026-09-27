use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub fn is_camera_image_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    !name.starts_with('.')
        && (lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".png")
            || lower.ends_with(".heic")
            || lower.ends_with(".heif"))
}

pub fn images_modified_after(dir: &Path, since: SystemTime) -> Result<Vec<PathBuf>, String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };

    let mut found = Vec::new();
    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        if !is_camera_image_name(name) {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if !meta.is_file() || meta.len() == 0 {
            continue;
        }
        let Ok(modified) = meta.modified() else {
            continue;
        };
        if modified > since {
            found.push((modified, entry.path()));
        }
    }
    found.sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    Ok(found.into_iter().map(|(_, path)| path).collect())
}

pub fn unix_ms_to_system_time(ms: u64) -> SystemTime {
    UNIX_EPOCH + Duration::from_millis(ms)
}

pub fn system_time_to_unix_ms(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(windows)]
pub fn open_system_camera() -> Result<(), String> {
    if shell_execute("microsoft.windows.camera:").is_ok() {
        return Ok(());
    }
    shell_execute("shell:AppsFolder\\Microsoft.WindowsCamera_8wekyb3d8bbwe!App")
}

#[cfg(not(windows))]
pub fn open_system_camera() -> Result<(), String> {
    Err("この環境では OS のカメラを使えません".into())
}

#[cfg(windows)]
pub fn list_new_camera_roll_images(since_unix_ms: u64) -> Result<Vec<PathBuf>, String> {
    let dir = camera_roll_dir()?;
    images_modified_after(&dir, unix_ms_to_system_time(since_unix_ms))
}

#[cfg(not(windows))]
pub fn list_new_camera_roll_images(_since_unix_ms: u64) -> Result<Vec<PathBuf>, String> {
    Ok(Vec::new())
}

#[cfg(windows)]
fn shell_execute(target: &str) -> Result<(), String> {
    let operation = wide("open");
    let file = wide(target);
    let code = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    };
    if code <= 32 {
        return Err("Windows のカメラを起動できませんでした".into());
    }
    Ok(())
}

#[cfg(windows)]
fn camera_roll_dir() -> Result<PathBuf, String> {
    #[repr(C)]
    struct Guid {
        data1: u32,
        data2: u16,
        data3: u16,
        data4: [u8; 8],
    }

    const FOLDERID_CAMERA_ROLL: Guid = Guid {
        data1: 0xAB5FB87B,
        data2: 0x7CE2,
        data3: 0x4F83,
        data4: [0x91, 0x5D, 0x55, 0x08, 0x46, 0xC9, 0x53, 0x7B],
    };
    const KF_FLAG_DONT_VERIFY: u32 = 0x0000_4000;

    let mut raw = std::ptr::null_mut();
    let hr = unsafe {
        SHGetKnownFolderPath(
            std::ptr::from_ref(&FOLDERID_CAMERA_ROLL).cast(),
            KF_FLAG_DONT_VERIFY,
            std::ptr::null_mut(),
            &mut raw,
        )
    };
    if hr == 0 && !raw.is_null() {
        let mut len = 0usize;
        unsafe {
            while len < 32_768 && *raw.add(len) != 0 {
                len += 1;
            }
        }
        let path = unsafe {
            let slice = std::slice::from_raw_parts(raw, len);
            use std::os::windows::ffi::OsStringExt;
            std::ffi::OsString::from_wide(slice)
        };
        unsafe { CoTaskMemFree(raw.cast()) };
        return Ok(PathBuf::from(path));
    }

    let profile = std::env::var_os("USERPROFILE").ok_or("カメラロールの場所が分かりません")?;
    Ok(PathBuf::from(profile).join("Pictures").join("Camera Roll"))
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

#[cfg(windows)]
#[link(name = "shell32")]
extern "system" {
    fn SHGetKnownFolderPath(
        rfid: *const std::ffi::c_void,
        flags: u32,
        token: *mut std::ffi::c_void,
        path: *mut *mut u16,
    ) -> i32;

    fn ShellExecuteW(
        hwnd: *mut std::ffi::c_void,
        operation: *const u16,
        file: *const u16,
        parameters: *const u16,
        directory: *const u16,
        show_cmd: i32,
    ) -> isize;
}

#[cfg(windows)]
#[link(name = "ole32")]
extern "system" {
    fn CoTaskMemFree(ptr: *mut std::ffi::c_void);
}

#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::time::{Duration, SystemTime};

    use super::{images_modified_after, is_camera_image_name};

    #[test]
    fn accepts_camera_roll_image_extensions() {
        assert!(is_camera_image_name("WIN_20260928.jpg"));
        assert!(is_camera_image_name("photo.JPEG"));
        assert!(is_camera_image_name("shot.png"));
        assert!(is_camera_image_name("iphone.heic"));
        assert!(!is_camera_image_name(".hidden.jpg"));
        assert!(!is_camera_image_name("notes.txt"));
        assert!(!is_camera_image_name("partial.tmp"));
    }

    #[test]
    fn returns_only_images_written_after_the_watch_started() {
        let dir = std::env::temp_dir().join(format!("blueprint-sync-camera-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let old_path = dir.join("old.jpg");
        std::fs::write(&old_path, b"old").unwrap();
        File::options()
            .write(true)
            .open(&old_path)
            .unwrap()
            .set_modified(SystemTime::now() - Duration::from_secs(60))
            .unwrap();

        let since = SystemTime::now();
        let new_path = dir.join("WIN_new.jpg");
        std::fs::write(&new_path, b"new").unwrap();
        File::options()
            .write(true)
            .open(&new_path)
            .unwrap()
            .set_modified(since + Duration::from_secs(5))
            .unwrap();
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
