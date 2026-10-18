//! Legacy scrypt remains verifiable; new credentials use a versioned stronger cost.
use crate::{Error, Result};
use scrypt::{Params, scrypt};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use zeroize::Zeroizing;

pub(crate) fn sha256(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}
pub(crate) fn random_hex<const N: usize>() -> Result<String> {
    let mut bytes = Zeroizing::new([0u8; N]);
    getrandom::fill(bytes.as_mut()).map_err(|_| Error::Unavailable)?;
    Ok(hex(bytes.as_ref()))
}
fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        write!(out, "{byte:02x}").expect("writing a String");
    }
    out
}
fn unhex(value: &str) -> Option<Vec<u8>> {
    if !value.len().is_multiple_of(2)
        || !value
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        return None;
    }
    (0..value.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).ok())
        .collect()
}
pub(crate) fn validate(password: &str) -> Result<()> {
    if password.len() > 1024 || !(12..=256).contains(&password.chars().count()) {
        return Err(Error::InvalidInput);
    }
    Ok(())
}
fn derive(password: &str, salt: &[u8], cost: u8) -> Zeroizing<[u8; 64]> {
    let mut output = Zeroizing::new([0u8; 64]);
    let params = Params::new(cost, 8, 1, 64).expect("fixed supported scrypt parameters");
    scrypt(password.as_bytes(), salt, &params, output.as_mut()).expect("fixed output length");
    output
}
pub(crate) fn hash(password: &str) -> Result<String> {
    validate(password)?;
    let salt = random_hex::<16>()?;
    let digest = derive(password, &unhex(&salt).expect("generated hex"), 17);
    Ok(format!("scrypt-v1$17$8$1${salt}${}", hex(digest.as_ref())))
}
pub(crate) fn matches(password: &str, encoded: &str) -> bool {
    if validate(password).is_err() {
        return false;
    }
    let (salt, digest, cost) = if let Some(rest) = encoded.strip_prefix("scrypt-v1$17$8$1$") {
        let Some((salt, digest)) = rest.split_once('$') else {
            return false;
        };
        (salt, digest, 17)
    } else {
        let Some((salt, digest)) = encoded.split_once(':') else {
            return false;
        };
        (salt, digest, 14)
    };
    if salt.len() != 32 || digest.len() != 128 {
        return false;
    }
    let (Some(salt), Some(expected)) = (unhex(salt), unhex(digest)) else {
        return false;
    };
    bool::from(derive(password, &salt, cost).as_ref().ct_eq(&expected))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_python_scrypt_and_unicode_length_are_compatible() {
        // Produced independently by Python hashlib.scrypt(n=16384,r=8,p=1,dklen=64).
        let expected = include_str!("../tests/legacy-hash.txt").trim();
        assert!(matches("account-test-password-2026", expected));
        assert!(!matches("wrong-password", expected));
        assert!(validate(&"é".repeat(256)).is_ok());
        assert!(validate(&"é".repeat(257)).is_err());
        for invalid in ["", "00:ff", "scrypt-v1$30$8$1$00$ff", "éé:ff"] {
            assert!(!matches("account-test-password-2026", invalid));
        }
    }
    #[test]
    fn fresh_hash_uses_stronger_versioned_cost_and_random_salt() {
        let digest = hash("account-test-password-2026").unwrap();
        assert!(digest.starts_with("scrypt-v1$17$8$1$"));
        assert!(matches("account-test-password-2026", &digest));
        assert!(!matches("different-password", &digest));
        assert_ne!(random_hex::<32>().unwrap(), random_hex::<32>().unwrap());
    }
}
