use super::*;
use serde_json::json;
fn fixture() -> (tempfile::TempDir, PathBuf) {
    let temp = tempfile::tempdir().unwrap();
    let p = temp.path();
    for dir in ["studio", "map", "session", "icons", "branding"] {
        std::fs::create_dir(p.join(dir)).unwrap();
    }
    for app in ["studio", "map"] {
        std::fs::write(
            p.join(app).join("index.html"),
            "<html><head></head><body>APP</body></html>",
        )
        .unwrap();
    }
    std::fs::write(p.join("branding/map.png"), b"PNG fixture").unwrap();
    std::fs::write(p.join("session/account.js"), "export {};").unwrap();
    std::fs::write(p.join("session/account.css"), "body{}").unwrap();
    let path = p.join("frontends.json");
    std::fs::write(&path,serde_json::to_vec(&json!({"schema":1,"studio":"studio","session":"session","icons":"icons","branding":"branding","apps":{"map":"map"}})).unwrap()).unwrap();
    (temp, path)
}
#[test]
fn snapshot_is_immutable_with_bounded_known_public_paths() {
    let (temp, path) = fixture();
    let p = temp.path();
    for (name, body) in [
        (".env", "secret"),
        ("source.ts", "secret"),
        ("bundle.js.map", "secret"),
        ("key.pem", "secret"),
        ("main.js", "export {}"),
        ("gallery.html", "<div id=\"root\"></div>"),
        ("some icon.svg", "<svg/>"),
    ] {
        std::fs::write(p.join("map").join(name), body).unwrap();
    }
    let web = Frontends::load(&path).unwrap();
    for path in [
        "/",
        "/map",
        "/map/",
        "/map/index.html",
        "/map/main.js",
        "/icons/map.png",
        "/map/some%20icon.svg",
    ] {
        assert!(web.accepts_path(path), "{path}");
    }
    for path in [
        "/api/status",
        "/map/.env",
        "/map/source.ts",
        "/map/bundle.js.map",
        "/map/key.pem",
        "/map/../index.html",
        "/map/%2e%2e/index.html",
        "/map/%00",
        "/map/%xx",
        "//map/",
        "/map/%5cindex.html",
    ] {
        assert!(!web.accepts_path(path), "{path}");
    }
    std::fs::write(p.join("map/main.js"), "changed").unwrap();
    assert_eq!(web.0.files["/map/main.js"].bytes, "export {}");
    assert!(
        std::str::from_utf8(&web.0.files["/map/index.html"].bytes)
            .unwrap()
            .contains("content=\"map\"")
    );
    assert!(
        web.0.files["/suite/account.js"]
            .mime
            .starts_with("text/javascript")
    );
    assert!(
        std::str::from_utf8(&web.0.files["/map/gallery.html"].bytes)
            .unwrap()
            .starts_with("<head><meta name=\"aether-app\"")
    );
    drop(temp);
    assert!(web.installed("map")); // no request-time filesystem dependency
}
#[test]
fn configuration_and_size_limits_fail_before_exposure() {
    let (temp, path) = fixture();
    let good = std::fs::read(&path).unwrap();
    for patch in [
        json!({"schema":2}),
        json!({"password":"secret"}),
        json!({"apps":{"unknown":"map"}}),
        json!({"apps":{"map":"absent"}}),
    ] {
        let mut value: serde_json::Value = serde_json::from_slice(&good).unwrap();
        for (key, value2) in patch.as_object().unwrap() {
            value[key] = value2.clone();
        }
        std::fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
        assert!(Frontends::load(&path).is_err());
    }
    std::fs::write(&path, vec![b' '; 16 * 1024 + 1]).unwrap();
    assert!(Frontends::load(&path).is_err());
    std::fs::write(&path, good).unwrap();
    let file = std::fs::File::create(temp.path().join("map/too-big.wasm")).unwrap();
    file.set_len(MAX_FILE as u64 + 1).unwrap();
    assert!(Frontends::load(&path).is_err());
    let mut snapshot = Snapshot {
        total: MAX_TOTAL,
        ..Snapshot::default()
    };
    assert!(
        snapshot
            .insert("/asset.js".into(), vec![0], "text/javascript")
            .is_err()
    );
}
#[cfg(unix)]
#[test]
fn snapshot_refuses_symlink_files_directories_and_special_files() {
    use std::os::unix::fs::symlink;
    let (temp, path) = fixture();
    let p = temp.path();
    symlink(p.join("session/account.js"), p.join("map/escape.js")).unwrap();
    assert!(Frontends::load(&path).is_err());
    std::fs::remove_file(p.join("map/escape.js")).unwrap();
    symlink(p.join("session"), p.join("map/escape")).unwrap();
    assert!(Frontends::load(&path).is_err());
    std::fs::remove_file(p.join("map/escape")).unwrap();
    let _socket = std::os::unix::net::UnixListener::bind(p.join("map/pipe.js")).unwrap();
    assert!(Frontends::load(&path).is_err());
}
