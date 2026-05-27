use std::sync::Arc;

use axum::extract::rejection::JsonRejection;
use axum::extract::{ConnectInfo, Multipart, Query, State};
use axum::routing::{delete, get, patch, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::app_state::AppState;
use super::middleware::RequireSession;
use crate::auth::is_local_addr;
use crate::error::AppError;
use crate::git::GitDiffScope;
use crate::git::GitFileAction;
use crate::types::{
    CreateTerminalBody, CreateWorktreeBody, GitCommitBody, GitFileActionsBody,
    RegisterProjectBody, UpdateTerminalBody, WriteFileBody,
};
use crate::workspace::{
    drop_assets::DropAssetUpload, files, git_panel, pick_folder, projects, terminals, worktrees,
    UpdateTerminalPatch,
};


#[derive(Debug, Deserialize)]
struct FileContentQuery {
    path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitDiffQuery {
    scope: Option<String>,
    path: Option<String>,
}

fn parse_diff_scope(value: Option<&str>) -> GitDiffScope {
    match value {
        Some("staged") => GitDiffScope::Staged,
        Some("unstaged") => GitDiffScope::Unstaged,
        Some("untracked") => GitDiffScope::Untracked,
        _ => GitDiffScope::All,
    }
}

async fn list_projects(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = projects::list_projects(&state.db)?;
    Ok(Json(json!({ "projects": rows })))
}

async fn pick_folder_route(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer): ConnectInfo<std::net::SocketAddr>,
) -> Result<Json<serde_json::Value>, AppError> {
    if !is_local_addr(&peer.ip().to_string()) {
        return Err(AppError::Forbidden(
            "Folder picker is only available on localhost".into(),
        ));
    }
    match pick_folder::pick_folder() {
        None => Ok(Json(json!({ "cancelled": true }))),
        Some(repo_path) => {
            let project = projects::register_project(&state.db, &repo_path)?;
            Ok(Json(json!({ "project": project })))
        }
    }
}

async fn register_project(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    Json(body): Json<RegisterProjectBody>,
) -> Result<(axum::http::StatusCode, Json<serde_json::Value>), AppError> {
    let project = projects::register_project(&state.db, &body.repo_path)?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({ "project": project })),
    ))
}

async fn delete_project(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    projects::delete_project(&state.db, &id)?;
    Ok(Json(json!({ "ok": true })))
}

async fn list_branches(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let project = projects::get_project(&state.db, &id)?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;
    let branches = crate::git::worktree_list::list_branches(&project.repo_path)
        .map_err(|e| AppError::BadRequest(e.message))?;
    let default_branch = crate::git::worktree_list::get_default_branch(&project.repo_path);
    Ok(Json(json!({ "branches": branches, "defaultBranch": default_branch })))
}

async fn list_worktrees_route(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = worktrees::list_worktrees_by_project(&state.db, &id)?;
    Ok(Json(json!({ "worktrees": rows })))
}

async fn create_worktree(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<CreateWorktreeBody>,
) -> Result<(axum::http::StatusCode, Json<serde_json::Value>), AppError> {
    let wt = worktrees::create_worktree_for_project(
        &state.db,
        &id,
        &body.branch,
        body.base_branch.as_deref(),
        body.path.as_deref(),
        body.is_new_branch,
    )?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({ "worktree": wt })),
    ))
}

async fn get_worktree(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let wt = worktrees::get_worktree(&state.db, &id)?
        .ok_or_else(|| AppError::NotFound("Worktree not found".into()))?;
    Ok(Json(json!({ "worktree": wt })))
}

async fn list_files(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let wt = worktrees::get_worktree(&state.db, &id)?
        .ok_or_else(|| AppError::NotFound("Worktree not found".into()))?;
    let paths = files::list_files_for_worktree(&wt.path)?;
    Ok(Json(json!({ "paths": paths })))
}

async fn read_file(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Query(q): Query<FileContentQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let wt = worktrees::get_worktree(&state.db, &id)?
        .ok_or_else(|| AppError::NotFound("Worktree not found".into()))?;
    let path = q
        .path
        .filter(|p| !p.is_empty())
        .ok_or_else(|| AppError::BadRequest("path query parameter is required".into()))?;
    let file = files::read_file_for_worktree(&wt.path, &path)?;
    Ok(Json(serde_json::to_value(file).unwrap()))
}

async fn write_file(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<WriteFileBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let wt = worktrees::get_worktree(&state.db, &id)?
        .ok_or_else(|| AppError::NotFound("Worktree not found".into()))?;
    files::write_file_for_worktree(&wt.path, &body.path, &body.content)?;
    Ok(Json(json!({ "ok": true })))
}

async fn drop_assets_route(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    let _wt = worktrees::get_worktree(&state.db, &id)?
        .ok_or_else(|| AppError::NotFound("Worktree not found".into()))?;

    let mut uploads = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        if field.name() != Some("files") {
            continue;
        }
        let file_name = field.file_name().unwrap_or("upload").to_string();
        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(e.to_string()))?;
        uploads.push(DropAssetUpload {
            name: file_name,
            data: data.to_vec(),
        });
    }
    if uploads.is_empty() {
        return Err(AppError::BadRequest("No files provided".into()));
    }
    let paths = crate::workspace::save_workbench_drop_assets(&uploads, None)?;
    Ok(Json(json!({ "paths": paths })))
}

async fn git_status(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let status = git_panel::get_git_status_for_worktree(&state.db, &id)?;
    Ok(Json(serde_json::to_value(status).unwrap()))
}

async fn git_diff(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Query(q): Query<GitDiffQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let scope = parse_diff_scope(q.scope.as_deref());
    let diff = git_panel::get_git_diff_for_worktree(&state.db, &id, scope, q.path.as_deref())?;
    Ok(Json(serde_json::to_value(diff).unwrap()))
}

async fn git_actions(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<GitFileActionsBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let action = GitFileAction::parse(&body.action)
        .ok_or_else(|| AppError::BadRequest("Invalid git action".into()))?;
    git_panel::apply_git_file_actions_for_worktree(&state.db, &id, action, &body.paths)?;
    Ok(Json(json!({ "ok": true })))
}

async fn git_commit(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<GitCommitBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    git_panel::commit_git_for_worktree(&state.db, &id, &body.message)?;
    Ok(Json(json!({ "ok": true })))
}

async fn delete_worktree(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    worktrees::delete_worktree(&state.db, &id)?;
    Ok(Json(json!({ "ok": true })))
}

async fn list_terminals(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = terminals::list_terminals(&state.db, &id)?;
    Ok(Json(json!({ "terminals": rows })))
}

async fn create_terminal(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    body: Result<Json<CreateTerminalBody>, JsonRejection>,
) -> Result<(axum::http::StatusCode, Json<serde_json::Value>), AppError> {
    let title = body.ok().and_then(|Json(b)| b.title);
    let terminal = terminals::create_terminal(&state.db, &id, title.as_deref())?;
    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({ "terminal": terminal })),
    ))
}

async fn update_terminal(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<UpdateTerminalBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let patch = UpdateTerminalPatch {
        title: body.title,
        sort_order: body.sort_order,
        resume_command: body.resume_command.map(Some),
        resume_trusted: body.resume_trusted,
    };
    let terminal = terminals::update_terminal(&state.db, &id, &patch)?;
    Ok(Json(json!({ "terminal": terminal })))
}

async fn delete_terminal(
    _: RequireSession,
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.pty_registry.kill(&id);
    terminals::delete_terminal(&state.db, &id)?;
    Ok(Json(json!({ "ok": true })))
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/projects", get(list_projects).post(register_project))
        .route("/projects/pick-folder", post(pick_folder_route))
        .route("/projects/{id}", delete(delete_project))
        .route("/projects/{id}/branches", get(list_branches))
        .route("/projects/{id}/worktrees", get(list_worktrees_route).post(create_worktree))
        .route("/worktrees/{id}", get(get_worktree).delete(delete_worktree))
        .route("/worktrees/{id}/files", get(list_files))
        .route(
            "/worktrees/{id}/files/content",
            get(read_file).put(write_file),
        )
        .route("/worktrees/{id}/drop-assets", post(drop_assets_route))
        .route("/worktrees/{id}/git/status", get(git_status))
        .route("/worktrees/{id}/git/diff", get(git_diff))
        .route("/worktrees/{id}/git/actions", post(git_actions))
        .route("/worktrees/{id}/git/commit", post(git_commit))
        .route("/worktrees/{id}/terminals", get(list_terminals).post(create_terminal))
        .route("/terminals/{id}", patch(update_terminal).delete(delete_terminal))
}
