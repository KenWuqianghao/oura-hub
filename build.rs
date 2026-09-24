// rust-embed needs the folder at compile time. A checkout without a web build
// gets an empty folder, and the hub then serves a "not built" page.
fn main() {
    std::fs::create_dir_all("web/dist").expect("create web/dist");
    println!("cargo:rerun-if-changed=web/dist");
}
