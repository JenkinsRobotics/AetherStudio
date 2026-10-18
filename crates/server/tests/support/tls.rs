use std::path::PathBuf;
pub fn certificate() -> (tempfile::TempDir, PathBuf, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let cert = dir.path().join("certificate.pem");
    let key = dir.path().join("private.pem");
    let cfg = dir.path().join("request.cnf");
    std::fs::write(&cfg,"[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n").unwrap();
    let result = std::process::Command::new("openssl")
        .args([
            "req", "-new", "-x509", "-nodes", "-days", "1", "-newkey", "rsa:2048", "-config",
        ])
        .arg(cfg)
        .arg("-out")
        .arg(&cert)
        .arg("-keyout")
        .arg(&key)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "Could not generate disposable TLS fixture."
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&key, std::fs::Permissions::from_mode(0o600)).unwrap();
    }
    (dir, cert, key)
}
