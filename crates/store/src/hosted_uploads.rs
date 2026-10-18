//! Private, tenant-separated immutable upload chunks. Authorization belongs to
//! Studio. Acknowledgements follow durability and readback verification.
use super::*;
pub const UPLOAD_CHUNK_BYTES: usize = 1024 * 1024;
impl HostedStore {
    pub async fn put_upload_chunk(
        &self,
        scope: &AuthorizedScope,
        bytes: Vec<u8>,
    ) -> Result<String> {
        if bytes.is_empty() || bytes.len() > UPLOAD_CHUNK_BYTES {
            return Err(corrupt("Invalid upload chunk size."));
        }
        let digest = hash(&bytes);
        let key = chunk_key(scope, &digest);
        let size = bytes.len();
        let result = tokio::time::timeout(
            OBJECT_TIMEOUT,
            self.content.objects.put_opts(
                &key,
                bytes.into(),
                PutOptions {
                    mode: PutMode::Create,
                    ..Default::default()
                },
            ),
        )
        .await
        .map_err(|_| object_error())?;
        match result {
            Ok(_) | Err(object_store::Error::AlreadyExists { .. }) => {
                self.content.flush(&key).await?
            }
            Err(_) => return Err(object_error()),
        }
        self.read_upload_chunk(scope, &digest, size).await?;
        Ok(digest)
    }
    pub async fn read_upload_chunk(
        &self,
        scope: &AuthorizedScope,
        digest: &str,
        size: usize,
    ) -> Result<Vec<u8>> {
        if size == 0
            || size > UPLOAD_CHUNK_BYTES
            || digest.len() != 64
            || !digest
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(corrupt("Invalid upload chunk reference."));
        }
        tokio::time::timeout(OBJECT_TIMEOUT, async {
            let result = self
                .content
                .objects
                .get(&chunk_key(scope, digest))
                .await
                .map_err(|_| object_error())?;
            if result.meta.size != size as u64 {
                return Err(corrupt("Upload chunk length mismatch."));
            }
            let bytes = result.bytes().await.map_err(|_| object_error())?;
            if hash(&bytes) != digest {
                return Err(corrupt("Upload chunk checksum mismatch."));
            }
            Ok(bytes.to_vec())
        })
        .await
        .map_err(|_| object_error())?
    }
}
fn chunk_key(scope: &AuthorizedScope, digest: &str) -> ObjectPath {
    ObjectPath::from(format!(
        "uploads-v1/{}/{digest}",
        hash(scope.tenant.as_bytes())
    ))
}
