/// Win32 hit-test codes. A frameless shadowed window puts a child HWND over
/// the top strip and returns `HTTOP` there, so those pixels resize the window
/// instead of clicking the project tabs.
pub const HT_CLIENT: i32 = 1;
pub const HT_TRANSPARENT: i32 = -1;
pub const HT_TOP: i32 = 12;
pub const HT_TOPLEFT: i32 = 13;
pub const HT_TOPRIGHT: i32 = 14;

/// Keep a resize hit only above the client area. Inside the client, return
/// `HTCLIENT` so the top of the project tabs receives the click.
pub fn client_area_click_hit(next_hit: i32, client_y: Option<i32>) -> i32 {
    match client_y {
        Some(y) if next_hit == HT_TOP && y >= 0 => HT_CLIENT,
        _ => next_hit,
    }
}

/// The shadow resize strip covers the top of the tab bar. Let that hit fall
/// through to the webview instead of starting a resize.
pub fn passthrough_top_border(hit: i32) -> i32 {
    match hit {
        HT_TOP | HT_TOPLEFT | HT_TOPRIGHT => HT_TRANSPARENT,
        other => other,
    }
}

#[cfg(windows)]
const SUBCLASS_ID: usize = 0x4250_5442;

#[cfg(windows)]
pub fn install_clickable_top_client(hwnd: windows::Win32::Foundation::HWND) {
    unsafe {
        let _ = windows::Win32::UI::Shell::SetWindowSubclass(
            hwnd,
            Some(top_client_subclass),
            SUBCLASS_ID,
            0,
        );
        if let Ok(drag) = find_drag_resize_window(hwnd) {
            let _ = windows::Win32::UI::Shell::SetWindowSubclass(
                drag,
                Some(drag_border_subclass),
                DRAG_SUBCLASS_ID,
                0,
            );
        }
    }
}

#[cfg(windows)]
const DRAG_SUBCLASS_ID: usize = 0x4250_5443;

#[cfg(windows)]
fn find_drag_resize_window(
    parent: windows::Win32::Foundation::HWND,
) -> windows::core::Result<windows::Win32::Foundation::HWND> {
    use windows::Win32::UI::WindowsAndMessaging::FindWindowExW;
    unsafe {
        FindWindowExW(
            Some(parent),
            None,
            windows::core::w!("TAURI_DRAG_RESIZE_BORDERS"),
            windows::core::w!("TAURI_DRAG_RESIZE_WINDOW"),
        )
    }
}

#[cfg(windows)]
unsafe extern "system" fn drag_border_subclass(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::WM_NCHITTEST;

    if msg == WM_NCHITTEST {
        let result = unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
        let hit = passthrough_top_border(result.0 as i32);
        if hit != result.0 as i32 {
            return LRESULT(hit as isize);
        }
        return result;
    }

    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

#[cfg(windows)]
unsafe extern "system" fn top_client_subclass(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::{LRESULT, POINT};
    use windows::Win32::Graphics::Gdi::ScreenToClient;
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::WM_NCHITTEST;

    if msg == WM_NCHITTEST {
        let result = unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
        let packed = lparam.0 as u32;
        let mut point = POINT {
            x: (packed & 0xffff) as i16 as i32,
            y: (packed >> 16) as i16 as i32,
        };
        let client_y = unsafe { ScreenToClient(hwnd, &mut point) }
            .as_bool()
            .then_some(point.y);
        let next = result.0 as i32;
        let hit = client_area_click_hit(next, client_y);
        if hit == next {
            return result;
        }
        return LRESULT(hit as isize);
    }

    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

#[cfg(test)]
mod tests {
    use super::{
        client_area_click_hit, passthrough_top_border, HT_CLIENT, HT_TOP, HT_TOPLEFT, HT_TOPRIGHT,
        HT_TRANSPARENT,
    };

    #[test]
    fn top_resize_inside_the_client_becomes_a_click() {
        assert_eq!(client_area_click_hit(HT_TOP, Some(0)), HT_CLIENT);
        assert_eq!(client_area_click_hit(HT_TOP, Some(8)), HT_CLIENT);
    }

    #[test]
    fn top_resize_above_the_client_still_resizes() {
        assert_eq!(client_area_click_hit(HT_TOP, Some(-1)), HT_TOP);
        assert_eq!(client_area_click_hit(HT_TOP, None), HT_TOP);
    }

    #[test]
    fn other_hits_are_unchanged() {
        assert_eq!(client_area_click_hit(HT_CLIENT, Some(0)), HT_CLIENT);
        assert_eq!(client_area_click_hit(HT_TOPLEFT, Some(2)), HT_TOPLEFT);
    }

    #[test]
    fn the_shadow_top_strip_passes_clicks_to_the_tabs() {
        assert_eq!(passthrough_top_border(HT_TOP), HT_TRANSPARENT);
        assert_eq!(passthrough_top_border(HT_TOPLEFT), HT_TRANSPARENT);
        assert_eq!(passthrough_top_border(HT_TOPRIGHT), HT_TRANSPARENT);
        assert_eq!(passthrough_top_border(HT_CLIENT), HT_CLIENT);
    }
}
