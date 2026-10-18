fn main() -> std::io::Result<()> {
    let path = std::env::args()
        .nth(1)
        .expect("usage: export-types OUTPUT.ts");
    std::fs::write(path, aether_protocol_core::typescript())
}
