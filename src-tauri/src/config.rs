use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, KeyInit, OsRng},
};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Encryption error: {0}")]
    Encryption(String),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Base64 error: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("Config not initialized")]
    NotInitialized,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for ConfigError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub struct Config {
    db_path: PathBuf,
    conn: Option<Connection>,
    hwid_key: Option<[u8; 32]>,
}

impl Config {
    pub fn new(db_path: impl Into<PathBuf>) -> Self {
        Self {
            db_path: db_path.into(),
            conn: None,
            hwid_key: None,
        }
    }

    pub fn init(&mut self, hwid: &str) -> Result<bool, ConfigError> {
        let mut hasher = Sha256::new();
        hasher.update(hwid.as_bytes());
        let key_bytes: [u8; 32] = hasher.finalize().into();
        self.hwid_key = Some(key_bytes);

        let is_new = !self.db_path.exists();

        if let Some(parent) = self.db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&self.db_path)?;

        conn.execute_batch(
            "
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS config (
                key       TEXT PRIMARY KEY,
                value     TEXT NOT NULL,
                encrypted INTEGER NOT NULL DEFAULT 0
            );
        ",
        )?;

        self.conn = Some(conn);
        Ok(is_new)
    }

    pub fn get(&self, key: &str) -> Result<Option<Value>, ConfigError> {
        let conn = self.conn.as_ref().ok_or(ConfigError::NotInitialized)?;

        let mut stmt = conn.prepare("SELECT value, encrypted FROM config WHERE key = ?1")?;

        let row: Option<(String, bool)> = stmt
            .query_row(params![key], |r| Ok((r.get(0)?, r.get(1)?)))
            .optional()?;

        match row {
            None => Ok(None),
            Some((raw, false)) => Ok(Some(serde_json::from_str::<Value>(&raw)?)),
            Some((raw, true)) => {
                let plaintext = self
                    .decrypt_value(&raw)
                    .map_err(|_| ConfigError::Encryption(format!("failed to decrypt '{}'", key)))?;

                serde_json::from_str::<Value>(&plaintext)
                    .map(Some)
                    .map_err(|_| {
                        ConfigError::Encryption(format!("decrypted '{}' is not valid JSON", key))
                    })
            }
        }
    }

    pub fn exists(&self, key: &str) -> Result<bool, ConfigError> {
        let conn = self.conn.as_ref().ok_or(ConfigError::NotInitialized)?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM config WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )?;
        Ok(count > 0)
    }

    /// Return all key/value pairs (decrypting encrypted ones).
    pub fn all(&self) -> Result<Vec<(String, Value)>, ConfigError> {
        let conn = self.conn.as_ref().ok_or(ConfigError::NotInitialized)?;
        let mut stmt = conn.prepare("SELECT key, value, encrypted FROM config")?;

        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, bool>(2)?,
            ))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (k, raw, enc) = row?;
            let v: Value = if enc {
                let pt = self.decrypt_value(&raw)?;
                serde_json::from_str(&pt)?
            } else {
                serde_json::from_str(&raw)?
            };
            out.push((k, v));
        }
        Ok(out)
    }

    pub fn set<T: serde::Serialize>(
        &self,
        key: &str,
        value: T,
        encrypt: bool,
    ) -> Result<(), ConfigError> {
        let json = serde_json::to_string(&value)?;
        if encrypt {
            let blob = self.encrypt_value(&json)?;
            self.upsert(key, &blob, true)
        } else {
            self.upsert(key, &json, false)
        }
    }

    pub fn delete(&self, key: &str) -> Result<(), ConfigError> {
        let conn = self.conn.as_ref().ok_or(ConfigError::NotInitialized)?;
        conn.execute("DELETE FROM config WHERE key = ?1", params![key])?;
        Ok(())
    }

    pub fn clear(&self) -> Result<(), ConfigError> {
        let conn = self.conn.as_ref().ok_or(ConfigError::NotInitialized)?;
        conn.execute("DELETE FROM config", [])?;
        Ok(())
    }

    fn upsert(&self, key: &str, raw: &str, encrypted: bool) -> Result<(), ConfigError> {
        let conn = self.conn.as_ref().ok_or(ConfigError::NotInitialized)?;
        conn.execute(
            "INSERT INTO config (key, value, encrypted)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                            encrypted = excluded.encrypted",
            params![key, raw, encrypted as i32],
        )?;
        Ok(())
    }

    fn cipher(&self) -> Result<Aes256Gcm, ConfigError> {
        let key_bytes = self.hwid_key.ok_or(ConfigError::NotInitialized)?;
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        Ok(Aes256Gcm::new(key))
    }

    fn encrypt_value(&self, plaintext: &str) -> Result<String, ConfigError> {
        let cipher = self.cipher()?;
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| ConfigError::Encryption(e.to_string()))?;

        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        Ok(BASE64.encode(&combined))
    }

    fn decrypt_value(&self, blob: &str) -> Result<String, ConfigError> {
        let cipher = self.cipher()?;
        let combined = BASE64.decode(blob)?;

        if combined.len() < 12 {
            return Err(ConfigError::Encryption("blob too short".into()));
        }

        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| ConfigError::Encryption(e.to_string()))?;

        String::from_utf8(plaintext).map_err(|e| ConfigError::Encryption(e.to_string()))
    }
}
