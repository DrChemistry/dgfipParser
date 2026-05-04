// Tauri shell for DGFIP Parser. We only register the filesystem and dialog
// plugins; all PDF parsing happens in the webview (PDF.js) so this stays
// minimal and easy to audit.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
