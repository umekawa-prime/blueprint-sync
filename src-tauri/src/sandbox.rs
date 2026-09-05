use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct RecentProject {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub name: String,
    pub path: String,
}

pub fn is_packable_name(name: &str) -> bool {
    name == ".blueprint-sync" || (!name.starts_with('.') && name != "__MACOSX" && name != "..")
}

pub fn sandbox_projects_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("projects");
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn sandbox_projects_dir(app: AppHandle) -> Result<String, String> {
    Ok(sandbox_projects_path(&app)?.to_string_lossy().into_owned())
}

fn collect_project_files(root: &Path, dir: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.to_string()),
    };
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_packable_name(&name) {
            continue;
        }
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_dir() {
            collect_project_files(root, &path, out)?;
        } else if file_type.is_file() {
            let rel = path
                .strip_prefix(root)
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            out.push(rel);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_project_files(folder: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&folder);
    let mut names = Vec::new();
    collect_project_files(&root, &root, &mut names)?;
    names.sort();
    Ok(names)
}

#[tauri::command]
pub fn remove_dir_all(path: String) -> Result<(), String> {
    let dest = Path::new(&path);
    if dest.exists() {
        std::fs::remove_dir_all(dest).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_sandbox_projects(app: AppHandle) -> Result<Vec<RecentProject>, String> {
    let root = sandbox_projects_path(&app)?;
    let entries = match std::fs::read_dir(&root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };
    let mut items = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            continue;
        }
        let path = entry.path();
        let json = path.join(".blueprint-sync").join("project.json");
        if !json.is_file() {
            continue;
        }
        let raw = std::fs::read_to_string(&json).map_err(|error| error.to_string())?;
        let parsed: serde_json::Value =
            serde_json::from_str(&raw).map_err(|_| "Invalid project.json".to_string())?;
        let id = parsed
            .get("id")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string();
        let name = parsed
            .get("name")
            .and_then(|value| value.as_str())
            .unwrap_or("無題プロジェクト")
            .to_string();
        if id.is_empty() {
            continue;
        }
        items.push(RecentProject {
            id: Some(id),
            name,
            path: path.to_string_lossy().into_owned(),
        });
    }
    items.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::is_packable_name;

    #[test]
    fn allows_blueprint_sync_and_visible_files() {
        assert!(is_packable_name(".blueprint-sync"));
        assert!(is_packable_name("図面"));
        assert!(is_packable_name("1F.pdf"));
        assert!(!is_packable_name(".DS_Store"));
        assert!(!is_packable_name("__MACOSX"));
        assert!(!is_packable_name(".."));
    }
}
