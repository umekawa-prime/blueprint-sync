fn main() {
    // rustc passes -Wl,--as-needed; GNU ld defaults to --no-copy-dt-needed-entries
    // and --no-allow-shlib-undefined. pkg-config --libs webkit2gtk-4.1 does not
    // list WebKit's DT_NEEDED libs (gstreamer, webp, xslt, …), so the final
    // executable link fails even though those .so files exist at runtime.
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os == "linux" && target_env == "gnu" {
        println!("cargo:rustc-link-arg=-Wl,--allow-shlib-undefined");
    }

    tauri_build::build()
}

