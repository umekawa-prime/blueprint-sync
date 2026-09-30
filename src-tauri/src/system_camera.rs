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

/// Executable of the Windows Camera app. UWP windows are hosted by
/// ApplicationFrameHost, so the camera window is found through this process.
pub const CAMERA_EXE_NAME: &str = "WindowsCamera.exe";

pub fn is_camera_exe_path(path: &str) -> bool {
    path.rsplit(['\\', '/'])
        .next()
        .is_some_and(|name| name.eq_ignore_ascii_case(CAMERA_EXE_NAME))
}

#[cfg(windows)]
const CAMERA_AUMID: &str = "Microsoft.WindowsCamera_8wekyb3d8bbwe!App";

/// Launch the Windows Camera app and keep pushing it to the foreground until
/// Windows actually shows it there. Must be called while this app is the
/// foreground process (i.e. right after the user clicked), otherwise Windows
/// refuses to hand over the foreground.
#[cfg(windows)]
pub fn open_system_camera() -> Result<(), String> {
    foreground::allow_any_process();
    let pid = match foreground::activate_package_app(CAMERA_AUMID) {
        Ok(pid) => Some(pid),
        Err(_) => {
            if shell_execute("microsoft.windows.camera:").is_err() {
                shell_execute(&format!("shell:AppsFolder\\{CAMERA_AUMID}"))?;
            }
            None
        }
    };
    std::thread::spawn(move || foreground::bring_camera_to_front(pid));
    Ok(())
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
mod foreground {
    use std::collections::HashMap;
    use std::time::{Duration, Instant};

    use windows::core::{BOOL, HSTRING, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_LOCAL_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::System::Threading::{
        AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
        PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
        KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC, VK_LMENU, VK_MENU,
    };
    use windows::Win32::UI::Shell::{
        ApplicationActivationManager, IApplicationActivationManager, AO_NONE,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        AllowSetForegroundWindow, BringWindowToTop, EnumChildWindows, EnumWindows, GetClassNameW,
        GetForegroundWindow, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        SetForegroundWindow, SetWindowPos, ShowWindow, ASFW_ANY, HWND_NOTOPMOST, HWND_TOPMOST,
        SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_RESTORE,
    };

    use super::is_camera_exe_path;

    const FIND_TIMEOUT: Duration = Duration::from_secs(10);
    const POLL_INTERVAL: Duration = Duration::from_millis(100);
    /// The camera app shows a splash first and may re-activate itself; keep
    /// checking a little while after it first reaches the foreground.
    const STABLE_CHECKS: u32 = 5;

    pub fn allow_any_process() {
        unsafe {
            let _ = AllowSetForegroundWindow(ASFW_ANY);
        }
    }

    /// Activate a packaged (UWP) app by AUMID. Unlike ShellExecute of a
    /// protocol URI this activates the app window directly and returns its pid.
    pub fn activate_package_app(aumid: &str) -> Result<u32, String> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let manager: IApplicationActivationManager =
                CoCreateInstance(&ApplicationActivationManager, None, CLSCTX_LOCAL_SERVER)
                    .map_err(|error| error.to_string())?;
            manager
                .ActivateApplication(&HSTRING::from(aumid), &HSTRING::new(), AO_NONE)
                .map_err(|error| error.to_string())
        }
    }

    pub fn bring_camera_to_front(pid: Option<u32>) {
        let started = Instant::now();
        let mut stable = 0;
        while started.elapsed() < FIND_TIMEOUT && stable < STABLE_CHECKS {
            match find_camera_window(pid) {
                Some(hwnd) if unsafe { GetForegroundWindow() } == hwnd => stable += 1,
                Some(hwnd) => {
                    stable = 0;
                    unsafe { force_foreground(hwnd) };
                }
                None => {}
            }
            std::thread::sleep(POLL_INTERVAL);
        }
    }

    struct Search {
        pid: Option<u32>,
        names: HashMap<u32, bool>,
        found: Option<HWND>,
    }

    impl Search {
        fn is_camera_pid(&mut self, pid: u32) -> bool {
            if pid == 0 {
                return false;
            }
            if self.pid == Some(pid) {
                return true;
            }
            *self
                .names
                .entry(pid)
                .or_insert_with(|| process_path(pid).is_some_and(|path| is_camera_exe_path(&path)))
        }
    }

    fn find_camera_window(pid: Option<u32>) -> Option<HWND> {
        let mut search = Search {
            pid,
            names: HashMap::new(),
            found: None,
        };
        unsafe {
            let _ = EnumWindows(Some(visit_top_level), LPARAM(&mut search as *mut Search as isize));
        }
        search.found
    }

    unsafe extern "system" fn visit_top_level(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let search = &mut *(lparam.0 as *mut Search);
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }
        if search.is_camera_pid(window_pid(hwnd)) {
            search.found = Some(hwnd);
            return BOOL(0);
        }
        if class_name(hwnd) == "ApplicationFrameWindow" {
            // The UWP content (CoreWindow) is a child owned by the app process.
            let mut child_match = false;
            let mut context = (&mut *search, &mut child_match);
            let _ = EnumChildWindows(
                Some(hwnd),
                Some(visit_frame_child),
                LPARAM(&mut context as *mut (&mut Search, &mut bool) as isize),
            );
            if child_match {
                search.found = Some(hwnd);
                return BOOL(0);
            }
        }
        BOOL(1)
    }

    unsafe extern "system" fn visit_frame_child(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let (search, matched) = &mut *(lparam.0 as *mut (&mut Search, &mut bool));
        if search.is_camera_pid(window_pid(hwnd)) {
            **matched = true;
            return BOOL(0);
        }
        BOOL(1)
    }

    unsafe fn window_pid(hwnd: HWND) -> u32 {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        pid
    }

    unsafe fn class_name(hwnd: HWND) -> String {
        let mut buffer = [0u16; 64];
        let len = GetClassNameW(hwnd, &mut buffer).max(0) as usize;
        String::from_utf16_lossy(&buffer[..len])
    }

    fn process_path(pid: u32) -> Option<String> {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buffer = [0u16; 1024];
            let mut len = buffer.len() as u32;
            let result = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut len,
            );
            let _ = CloseHandle(handle);
            result.ok()?;
            Some(String::from_utf16_lossy(&buffer[..len as usize]))
        }
    }

    /// Windows blocks SetForegroundWindow from a background process. Attach
    /// to the foreground thread's input queue, and as a last resort use the
    /// same Alt-key trick tao uses for `set_focus`.
    unsafe fn force_foreground(hwnd: HWND) {
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }

        let current_thread = GetCurrentThreadId();
        let foreground_thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
        let attached = foreground_thread != 0
            && foreground_thread != current_thread
            && AttachThreadInput(current_thread, foreground_thread, true).as_bool();
        let _ = BringWindowToTop(hwnd);
        let _ = SetForegroundWindow(hwnd);
        if attached {
            let _ = AttachThreadInput(current_thread, foreground_thread, false);
        }
        if GetForegroundWindow() == hwnd {
            return;
        }

        let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW;
        let _ = SetWindowPos(hwnd, Some(HWND_TOPMOST), 0, 0, 0, 0, flags);
        let _ = SetWindowPos(hwnd, Some(HWND_NOTOPMOST), 0, 0, 0, 0, flags);
        tap_alt_key();
        let _ = SetForegroundWindow(hwnd);
    }

    unsafe fn tap_alt_key() {
        let scan = MapVirtualKeyW(u32::from(VK_MENU.0), MAPVK_VK_TO_VSC) as u16;
        let key = |flags: KEYBD_EVENT_FLAGS| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_LMENU,
                    wScan: scan,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        let inputs = [
            key(KEYEVENTF_EXTENDEDKEY),
            key(KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP),
        ];
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
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

    use super::{images_modified_after, is_camera_exe_path, is_camera_image_name};

    #[test]
    fn recognizes_the_windows_camera_executable() {
        assert!(is_camera_exe_path(
            r"C:\Program Files\WindowsApps\Microsoft.WindowsCamera_2025.2505.2.0_x64__8wekyb3d8bbwe\WindowsCamera.exe"
        ));
        assert!(is_camera_exe_path("windowscamera.EXE"));
        assert!(!is_camera_exe_path(r"C:\Windows\System32\ApplicationFrameHost.exe"));
        assert!(!is_camera_exe_path(r"C:\Tools\NotWindowsCamera.exe"));
    }

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
