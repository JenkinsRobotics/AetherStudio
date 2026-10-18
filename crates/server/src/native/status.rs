//! Existing browser status envelope backed by native identity and app authority.
use super::{
    NativeHost,
    boundary::{Result, optional_token},
};
use axum::{Json, extract::State, http::HeaderMap};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Application {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) description: String,
    pub(super) admin_only: bool,
    pub(super) coming_soon: bool,
}
pub(super) fn catalog() -> Vec<Application> {
    serde_json::from_str(include_str!(
        "../../../../core/host/application-catalog.json"
    ))
    .expect("build-time application catalog")
}
pub(super) async fn status(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let token = optional_token(&headers)?;
    let token = token.as_ref().map(|t| t.as_str());
    let (session, allowed) = if let Some(documents) = &host.documents {
        let candidates: Vec<&str> = host.catalog.iter().map(|app| app.id.as_str()).collect();
        documents.application_status(token, &candidates).await?
    } else {
        (host.identity.session_status(token).await?, Vec::new())
    };
    let apps = applications(&host, &allowed, session.user.as_ref());
    // Readiness describes configured dependencies for this user's visible apps.
    // It is not release certification or a substitute for current request ACLs.
    let applications_ready =
        !apps.is_empty() && apps.iter().all(|app| app["runtime_ready"] == true);
    let ready = session.ready;
    let user = session.display_user();
    let presentation = match &host.settings {
        Some(settings) => settings.snapshot().await?.presentation,
        None => host.presentation.clone(),
    };
    let installation = if !ready && host.setup.is_some() {
        json!({
            "setup_instructions":"Open the private link created with aether-native-host setup-link on this server. The link expires after 15 minutes.",
        "host_ready":true,"storage_ready":host.documents.is_some() && host.settings.is_some(),
            "setup_authorized":host.setup.as_ref().is_some_and(|s|s.authorized(&headers)),
            "packages":host.catalog.iter().map(|a|json!({"id":a.id,"name":a.name,"description":a.description,"installed":host.frontends.as_ref().is_some_and(|w|w.installed(&a.id))})).collect::<Vec<_>>()
        })
    } else {
        Value::Null
    };
    let email_recovery_available = match &host.mail {
        Some(mail) => mail.available().await.unwrap_or(false),
        None => false,
    };
    Ok(Json(json!({
        "ready":ready,"name":presentation.name,
        "theme":presentation.theme,"user":user,"apps":apps,
        "installation":installation,"email_recovery_available":email_recovery_available,
        "applications_ready":applications_ready,
        "capabilities":{"document_changes":if host.documents.is_some() { 1 } else { 0 },"frontend_hosting":host.frontends.is_some(),"browser_setup":host.setup.is_some(),"server_settings":host.network.is_some(),"server_presentation":host.settings.is_some()}
    })))
}

pub(super) fn applications(
    host: &NativeHost,
    allowed: &[String],
    user: Option<&aether_identity::User>,
) -> Vec<Value> {
    host.catalog
        .iter()
        .filter(|app| allowed.contains(&app.id))
        .filter(|app| {
            !app.admin_only || user.is_some_and(|u| u.role == aether_identity::Role::Admin)
        })
        .map(|app| application(host, app, true))
        .collect()
}

/// One catalog projection for both the launcher and admin application controls.
pub(super) fn application(host: &NativeHost, app: &Application, enabled: bool) -> Value {
    let installed = host
        .frontends
        .as_ref()
        .is_some_and(|web| web.installed(&app.id));
    let mut missing = Vec::new();
    if !installed {
        missing.push("frontend");
    }
    if host.documents.is_none() {
        missing.push("document_storage");
    }
    match app.id.as_str() {
        "drive" | "map" if host.attachments.is_none() => missing.push("media_storage"),
        "cad"
            if !host
                .documents
                .as_ref()
                .is_some_and(|d| d.cad_browser_configured()) =>
        {
            missing.push("cad_runtime");
        }
        "animation" if host.animation.is_none() => missing.push("animation_runtime"),
        _ => (),
    }
    if app.id == "map" && host.map_distribution.is_none() {
        missing.push("player_distribution");
    }
    if app.id == "animation" && host.workspace_assets.is_none() {
        missing.push("workspace_storage");
    }
    json!({
        "id":app.id,"name":app.name,"description":app.description,
        "enabled":enabled,"installed":installed,"url":format!("/{}/",app.id),
        "admin_only":app.admin_only,"coming_soon":app.coming_soon,
        "runtime_ready":missing.is_empty(),"runtime_missing":missing,"preview":app.coming_soon,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn canonical_catalog_has_unique_known_safe_ids() {
        let apps = catalog();
        let ids: Vec<&str> = apps.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "drive",
                "io",
                "cad",
                "animation",
                "ui",
                "map",
                "sketch",
                "vector"
            ]
        );
        assert!(
            apps.iter()
                .all(|a| !a.name.is_empty() && !a.description.is_empty())
        );
        assert_eq!(apps.iter().filter(|a| a.admin_only).count(), 1);
        assert!(apps.iter().find(|a| a.id == "ui").unwrap().admin_only);
    }
}
