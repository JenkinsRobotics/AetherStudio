//! Validated server display metadata and operator seed. No credentials or paths.
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, io::Read, path::Path};
const APPS: [&str; 9] = [
    "studio",
    "drive",
    "io",
    "cad",
    "animation",
    "ui",
    "map",
    "sketch",
    "vector",
];

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Theme {
    base: String,
    #[serde(default)]
    apps: BTreeMap<String, String>,
}
impl Theme {
    pub(crate) fn normalized(&self) -> Result<Self, &'static str> {
        if self.base.chars().count() > 64
            || self
                .apps
                .iter()
                .any(|(k, v)| !APPS.contains(&k.as_str()) || v.chars().count() > 64)
        {
            return Err("Invalid theme.");
        }
        Ok(Self {
            base: self.base.trim().into(),
            apps: self
                .apps
                .iter()
                .filter(|(_, v)| !v.trim().is_empty())
                .map(|(k, v)| (k.clone(), v.trim().into()))
                .collect(),
        })
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Presentation {
    schema: u8,
    pub(crate) name: String,
    pub(crate) theme: Theme,
}
impl Default for Presentation {
    fn default() -> Self {
        Self {
            schema: 1,
            name: "Aether Studio".into(),
            theme: Theme {
                base: "aether-default".into(),
                apps: BTreeMap::new(),
            },
        }
    }
}
impl Presentation {
    pub fn name(&self) -> &str {
        &self.name
    }
    pub fn load(path: &Path) -> Result<Self, &'static str> {
        let file = std::fs::File::open(path)
            .map_err(|_| "Cannot read native presentation configuration.")?;
        let mut bytes = Vec::new();
        file.take(16 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Cannot read native presentation configuration.")?;
        Self::parse(&bytes)
    }
    pub(crate) fn parse(bytes: &[u8]) -> Result<Self, &'static str> {
        const INVALID: &str = "Invalid native presentation configuration.";
        if bytes.len() > 16 * 1024 {
            return Err(INVALID);
        }
        let value: Self = serde_json::from_slice(bytes).map_err(|_| INVALID)?;
        let token = |s: &str| {
            !s.is_empty()
                && s.len() <= 64
                && s.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        };
        if value.schema != 1
            || value.name.trim().is_empty()
            || value.name.chars().count() > 80
            || value.name.chars().any(char::is_control)
            || !token(&value.theme.base)
            || value
                .theme
                .apps
                .iter()
                .any(|(app, theme)| !APPS.contains(&app.as_str()) || !token(theme))
        {
            return Err(INVALID);
        }
        Ok(value)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn validated_operator_metadata_and_bounded_input() {
        let good = json!({"schema":1,"name":"Workshop","theme":{"base":"aether-dark","apps":{"cad":"aether-light"}}});
        assert_eq!(
            Presentation::parse(&serde_json::to_vec(&good).unwrap())
                .unwrap()
                .name,
            "Workshop"
        );
        for bad in [
            json!({"password":"secret"}),
            json!({"schema":2}),
            json!({"name":""}),
            json!({"name":"\n"}),
            json!({"name":"a".repeat(81)}),
            json!({"theme":{"base":"https://example.invalid","apps":{}}}),
            json!({"theme":{"base":"default","apps":{"unknown":"default"}}}),
        ] {
            let mut input = good.clone();
            for (key, value) in bad.as_object().unwrap() {
                input[key] = value.clone();
            }
            assert!(Presentation::parse(&serde_json::to_vec(&input).unwrap()).is_err());
        }
        assert!(Presentation::parse(&vec![b' '; 16 * 1024 + 1]).is_err());
    }
}
