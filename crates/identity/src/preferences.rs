//! Personal display preferences. Never part of the hot authorization projection.
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Preferences {
    pub theme: String,
    pub theme_id: String,
    pub avatar: String,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            theme_id: String::new(),
            avatar: String::new(),
        }
    }
}
#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreferencePatch {
    #[serde(default, deserialize_with = "provided")]
    pub theme: Option<String>,
    #[serde(default, deserialize_with = "provided")]
    pub theme_id: Option<String>,
    #[serde(default, deserialize_with = "provided")]
    pub avatar: Option<String>,
}
fn provided<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> std::result::Result<Option<String>, D::Error> {
    String::deserialize(d).map(Some)
}
#[derive(Debug, Serialize)]
pub struct DisplayUser {
    #[serde(flatten)]
    pub account: User,
    #[serde(flatten)]
    pub preferences: Preferences,
}
impl Preferences {
    pub fn validate(&self) -> Result<()> {
        if !matches!(self.theme.as_str(), "dark" | "light" | "system")
            || self.theme_id.contains('\0')
            || self.theme_id.chars().count() > 64
            || self.avatar.len() > 350_000
        {
            return Err(Error::InvalidInput);
        }
        if !self.avatar.is_empty() {
            let (prefix, content) = self.avatar.split_once(',').ok_or(Error::InvalidInput)?;
            let raw = STANDARD.decode(content).map_err(|_| Error::InvalidInput)?;
            if raw.len() > 262_144
                || !((prefix == "data:image/png;base64" && raw.starts_with(b"\x89PNG\r\n\x1a\n"))
                    || (prefix == "data:image/jpeg;base64" && raw.starts_with(b"\xff\xd8\xff")))
            {
                return Err(Error::InvalidInput);
            }
        }
        Ok(())
    }
}
impl Identity {
    pub(crate) async fn preferences_in(
        &self,
        tx: &Transaction<'_>,
        user: &str,
    ) -> Result<Preferences> {
        let row = tx.query_opt("SELECT theme,theme_id,avatar FROM aether_identity.preferences WHERE tenant=$1 AND user_id=$2", &[&self.tenant,&user]).await.map_err(pg)?;
        let value = row
            .map(|r| Preferences {
                theme: r.get(0),
                theme_id: r.get(1),
                avatar: r.get(2),
            })
            .unwrap_or_default();
        value.validate().map_err(|_| Error::Incompatible)?;
        Ok(value)
    }
    pub async fn session_profile(&self, token: &str) -> Result<DisplayUser> {
        self.session_status(Some(token))
            .await?
            .display_user()
            .ok_or(Error::Unauthorized)
    }
    /// Serialize partial updates with account/session revocation. No target user
    /// can be supplied. An audit failure rolls back the entire preference change.
    pub async fn update_preferences(&self, token: &str, patch: &PreferencePatch) -> Result<()> {
        let mut client = self.client().await?;
        let tx = client.transaction().await.map_err(pg)?;
        self.lock(&tx).await?;
        let user = self.user(&*tx, token).await?;
        if user.must_change {
            return Err(Error::Forbidden);
        }
        let mut value = self.preferences_in(&tx, &user.id).await?;
        if let Some(theme) = &patch.theme {
            value.theme = theme.clone();
        }
        if let Some(theme_id) = &patch.theme_id {
            if theme_id.chars().count() > 64 {
                return Err(Error::InvalidInput);
            }
            value.theme_id = theme_id.trim().to_owned();
        }
        if let Some(avatar) = &patch.avatar {
            value.avatar = avatar.clone();
        }
        value.validate()?;
        tx.execute("INSERT INTO aether_identity.preferences(tenant,user_id,theme,theme_id,avatar) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant,user_id) DO UPDATE SET theme=excluded.theme,theme_id=excluded.theme_id,avatar=excluded.avatar", &[&self.tenant,&user.id,&value.theme,&value.theme_id,&value.avatar]).await.map_err(pg)?;
        self.audit(&tx, &user.id, "preferences_updated", &user.id)
            .await?;
        commit(tx).await
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_bounded_legacy_raster_avatars_are_accepted() {
        for raw in [b"\x89PNG\r\n\x1a\n".as_slice(), b"\xff\xd8\xff".as_slice()] {
            let mime = if raw[0] == 137 { "png" } else { "jpeg" };
            let value = Preferences {
                avatar: format!("data:image/{mime};base64,{}", STANDARD.encode(raw)),
                ..Preferences::default()
            };
            value.validate().unwrap();
        }
        for avatar in [
            "https://example.test/p.png",
            "data:image/svg+xml;base64,PHN2Zz4=",
            "data:image/png;base64,eA==",
            "data:image/jpeg;base64,%%%",
        ] {
            assert!(
                Preferences {
                    avatar: avatar.into(),
                    ..Preferences::default()
                }
                .validate()
                .is_err()
            );
        }
        let mut raw = vec![0; 262_145];
        raw[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        assert!(
            Preferences {
                avatar: format!("data:image/png;base64,{}", STANDARD.encode(raw)),
                ..Preferences::default()
            }
            .validate()
            .is_err()
        );
    }
    #[test]
    fn patch_distinguishes_missing_clear_and_invalid_null() {
        let patch: PreferencePatch = serde_json::from_str(r#"{"avatar":""}"#).unwrap();
        assert_eq!(patch.avatar.as_deref(), Some(""));
        assert!(patch.theme.is_none());
        for value in [
            r#"{"theme":null}"#,
            r#"{"user_id":"other"}"#,
            r#"{"theme":2}"#,
            r#"{"theme":"light","theme":"dark"}"#,
        ] {
            assert!(serde_json::from_str::<PreferencePatch>(value).is_err());
        }
    }
}
