use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::Path;

#[derive(Serialize)]
pub struct ProcessResult {
    new_file_name: String,
    target_directory: String,
}

#[tauri::command]
async fn process_video_hash(file_path: String) -> Result<ProcessResult, String> {
    let path = Path::new(&file_path);

    // 1. Validate file exists
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    if !path.is_file() {
        return Err(format!("Path is not a file: {}", file_path));
    }

    // 2. Extract directory, filename, extension
    let parent = path
        .parent()
        .ok_or_else(|| "Could not determine parent directory".to_string())?;

    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Could not determine file name".to_string())?;

    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    // 3. Strip any existing _rhsd suffix to prevent chaining (e.g., _rhsd_rhsd_rhsd)
    let mut clean_stem = stem;
    while clean_stem.ends_with("_rhsd") {
        clean_stem = &clean_stem[..clean_stem.len() - 5];
    }

    // 4. Construct new path with _rhsd suffix
    let new_file_name = if extension.is_empty() {
        format!("{}_rhsd", clean_stem)
    } else {
        format!("{}_rhsd.{}", clean_stem, extension)
    };

    let new_path = parent.join(&new_file_name);

    // 5. Copy original file to new path ONLY if paths are different
    if path != new_path {
        fs::copy(&path, &new_path).map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    // 5. Open new file in append mode and write a null byte
    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(&new_path)
        .map_err(|e| format!("Failed to open copied file: {}", e))?;

    file.write_all(&[0u8; 1])
        .map_err(|e| format!("Failed to write null byte: {}", e))?;

    file.flush()
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    // 6. Return success
    let target_directory = parent
        .to_str()
        .unwrap_or("unknown")
        .to_string();

    Ok(ProcessResult {
        new_file_name,
        target_directory,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![process_video_hash])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
