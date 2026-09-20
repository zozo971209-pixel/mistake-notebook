use tauri::Manager;

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  let parsed = tauri::Url::parse(&url).map_err(|_| "網址格式無效".to_string())?;
  let host = parsed.host_str().ok_or_else(|| "網址缺少網域".to_string())?;
  let allowed = parsed.scheme() == "https"
    && matches!(host, "aistudio.google.com" | "ai.google.dev");
  if !allowed {
    return Err("只允許開啟 Google AI Studio 與 Gemini 官方說明".to_string());
  }

  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("rundll32.exe")
      .arg("url.dll,FileProtocolHandler")
      .arg(parsed.as_str())
      .spawn()
      .map_err(|error| format!("無法開啟系統瀏覽器：{error}"))?;
    Ok(())
  }

  #[cfg(not(target_os = "windows"))]
  {
    Err("此平台請使用網頁版開啟外部連結".to_string())
  }
}

#[tauri::command]
fn save_json_backup(app: tauri::AppHandle, contents: String, file_name: String) -> Result<String, String> {
  let safe_name: String = file_name
    .chars()
    .filter(|character| character.is_alphanumeric() || matches!(character, '-' | '_' | '.'))
    .collect();
  if safe_name.is_empty() || !safe_name.ends_with(".json") {
    return Err("備份檔名無效".to_string());
  }
  let downloads = app.path().download_dir().map_err(|error| format!("找不到下載資料夾：{error}"))?;
  std::fs::create_dir_all(&downloads).map_err(|error| format!("無法建立下載資料夾：{error}"))?;
  let path = downloads.join(safe_name);
  std::fs::write(&path, contents).map_err(|error| format!("無法寫入備份檔：{error}"))?;
  Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_external_url, save_json_backup])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
