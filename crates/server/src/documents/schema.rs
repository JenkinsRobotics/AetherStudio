//! Explicit, transactional migrations. Serving never upgrades a database.
use super::{Documents, Error, Result, commit, db};
use sha2::{Digest, Sha256};
use tokio_postgres::Transaction;
const V1: &str = include_str!("schema.sql");
const V2: &str = include_str!("002-directory.sql");
const V3: &str = include_str!("003-folders.sql");
const V4: &str = include_str!("004-resource-lifecycle.sql");
const V5: &str = include_str!("005-library-recents.sql");
const V23: &str = include_str!("023-map-device-kind.sql");
const V22: &str = include_str!("022-live-editors.sql");
const V21: &str = include_str!("021-workspace-files.sql");
const V20: &str = include_str!("020-admin-teams.sql");
const V19: &str = include_str!("019-map-media.sql");
const V18: &str = include_str!("018-map-devices.sql");
const V17: &str = include_str!("017-automation-receipts.sql");
const V16: &str = include_str!("016-branch-metadata.sql");
const V15: &str = include_str!("015-link-credentials.sql");
const V14: &str = include_str!("014-uploads.sql");
const V13: &str = include_str!("013-legacy-drive-events.sql");
const V12: &str = include_str!("012-sharing-provenance.sql");
const V11: &str = include_str!("011-file-favorites.sql");
const V10: &str = include_str!("010-legacy-file-metadata.sql");
const V9: &str = include_str!("009-workspace-preferences.sql");
const V8: &str = include_str!("008-collaboration.sql");
const V7: &str = include_str!("007-named-versions.sql");
const V6: &str = include_str!("006-legacy-history.sql");
fn checksum(version: i32) -> String {
    let mut hash = Sha256::new();
    hash.update(V1.as_bytes());
    if version >= 2 {
        hash.update(V2.as_bytes());
    }
    if version >= 3 {
        hash.update(V3.as_bytes());
    }
    if version >= 4 {
        hash.update(V4.as_bytes());
    }
    if version >= 5 {
        hash.update(V5.as_bytes());
    }
    if version >= 6 {
        hash.update(V6.as_bytes());
    }
    if version >= 7 {
        hash.update(V7.as_bytes());
    }
    if version >= 8 {
        hash.update(V8.as_bytes());
    }
    if version >= 9 {
        hash.update(V9.as_bytes());
    }
    if version >= 10 {
        hash.update(V10.as_bytes());
    }
    if version >= 11 {
        hash.update(V11.as_bytes());
    }
    if version >= 12 {
        hash.update(V12.as_bytes());
    }
    if version >= 13 {
        hash.update(V13.as_bytes());
    }
    if version >= 14 {
        hash.update(V14.as_bytes());
    }
    if version >= 15 {
        hash.update(V15.as_bytes());
    }
    if version >= 16 {
        hash.update(V16.as_bytes());
    }
    if version >= 17 {
        hash.update(V17.as_bytes());
    }
    if version >= 18 {
        hash.update(V18.as_bytes());
    }
    if version >= 19 {
        hash.update(V19.as_bytes());
    }
    if version >= 20 {
        hash.update(V20.as_bytes());
    }
    if version >= 21 {
        hash.update(V21.as_bytes());
    }
    if version >= 22 {
        hash.update(V22.as_bytes());
    }
    if version >= 23 {
        hash.update(V23.as_bytes());
    }
    format!("{:x}", hash.finalize())
}
async fn version(tx: &Transaction<'_>) -> Result<i32> {
    let exists: bool = tx
        .query_one(
            "SELECT to_regclass('aether_access.schema_state') IS NOT NULL",
            &[],
        )
        .await
        .map_err(db)?
        .get(0);
    if !exists {
        return Err(Error::Incompatible);
    }
    let rows = tx
        .query(
            "SELECT version,checksum FROM aether_access.schema_state",
            &[],
        )
        .await
        .map_err(db)?;
    if rows.len() != 1 {
        return Err(Error::Incompatible);
    }
    let version: i32 = rows[0].get(0);
    if !matches!(version, 1..=23) || rows[0].get::<_, String>(1) != checksum(version) {
        return Err(Error::Incompatible);
    }
    Ok(version)
}
impl Documents {
    pub async fn migrate(&self) -> Result<()> {
        self.identity.check_schema().await?;
        self.store.migrate().await?;
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        tx.batch_execute("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'")
            .await
            .map_err(db)?;
        tx.execute("SELECT pg_advisory_xact_lock(1095062604)", &[])
            .await
            .map_err(db)?;
        let exists: bool = tx
            .query_one("SELECT to_regnamespace('aether_access') IS NOT NULL", &[])
            .await
            .map_err(db)?
            .get(0);
        let current = if exists {
            version(&tx).await?
        } else {
            tx.batch_execute(V1).await.map_err(db)?;
            tx.execute(
                "INSERT INTO aether_access.schema_state VALUES(true,1,$1)",
                &[&checksum(1)],
            )
            .await
            .map_err(db)?;
            1
        };
        if current == 1 {
            tx.batch_execute(V2).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=2,checksum=$1",
                &[&checksum(2)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 2 {
            tx.batch_execute(V3).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=3,checksum=$1",
                &[&checksum(3)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 3 {
            tx.batch_execute(V4).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=4,checksum=$1",
                &[&checksum(4)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 4 {
            tx.batch_execute(V5).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=5,checksum=$1",
                &[&checksum(5)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 5 {
            tx.batch_execute(V6).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=6,checksum=$1",
                &[&checksum(6)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 6 {
            tx.batch_execute(V7).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=7,checksum=$1",
                &[&checksum(7)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 7 {
            tx.batch_execute(V8).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=8,checksum=$1",
                &[&checksum(8)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 8 {
            tx.batch_execute(V9).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=9,checksum=$1",
                &[&checksum(9)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 9 {
            tx.batch_execute(V10).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=10,checksum=$1",
                &[&checksum(10)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 10 {
            tx.batch_execute(V11).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=11,checksum=$1",
                &[&checksum(11)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 11 {
            tx.batch_execute(V12).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=12,checksum=$1",
                &[&checksum(12)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 12 {
            tx.batch_execute(V13).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=13,checksum=$1",
                &[&checksum(13)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 13 {
            tx.batch_execute(V14).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=14,checksum=$1",
                &[&checksum(14)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 14 {
            tx.batch_execute(V15).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=15,checksum=$1",
                &[&checksum(15)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 15 {
            tx.batch_execute(V16).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=16,checksum=$1",
                &[&checksum(16)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 16 {
            tx.batch_execute(V17).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=17,checksum=$1",
                &[&checksum(17)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 17 {
            tx.batch_execute(V18).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=18,checksum=$1",
                &[&checksum(18)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 18 {
            tx.batch_execute(V19).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=19,checksum=$1",
                &[&checksum(19)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 19 {
            tx.batch_execute(V20).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=20,checksum=$1",
                &[&checksum(20)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 20 {
            tx.batch_execute(V21).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=21,checksum=$1",
                &[&checksum(21)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 21 {
            tx.batch_execute(V22).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=22,checksum=$1",
                &[&checksum(22)],
            )
            .await
            .map_err(db)?;
        }
        if current <= 22 {
            tx.batch_execute(V23).await.map_err(db)?;
            tx.execute(
                "UPDATE aether_access.schema_state SET version=23,checksum=$1",
                &[&checksum(23)],
            )
            .await
            .map_err(db)?;
        }
        commit(tx).await
    }
    pub async fn check_schema(&self) -> Result<()> {
        self.identity.check_schema().await?;
        self.store.check_schema().await?;
        let mut c = self.client().await?;
        let tx = c
            .build_transaction()
            .isolation_level(tokio_postgres::IsolationLevel::ReadCommitted)
            .start()
            .await
            .map_err(db)?;
        tx.batch_execute("SET LOCAL statement_timeout='5s'")
            .await
            .map_err(db)?;
        if version(&tx).await? != 23 {
            return Err(Error::Incompatible);
        }
        commit(tx).await
    }
}
