//! ZIP container plumbing with bounded producer/writer buffering and private
//! temporary files. No product rendering or archive-sized memory allocation.
use super::{
    NativeHost,
    boundary::{Result, token},
};
use crate::documents::{
    Error,
    map_exports::{MAX_BUNDLE, MapExport},
};
use axum::{
    body::{Body, Bytes},
    extract::{Path, State},
    http::HeaderMap,
    response::Response,
};
use futures_util::StreamExt;
use std::{io::Write, sync::Arc};
use tokio::{
    io::AsyncReadExt,
    sync::{OwnedSemaphorePermit, mpsc},
};

enum Part {
    Start(String),
    Bytes(Bytes),
    Finish,
}
async fn send(tx: &mpsc::Sender<Part>, value: Part) -> std::result::Result<(), Error> {
    tx.send(value).await.map_err(|_| Error::Unavailable)
}
async fn small_file(
    tx: &mpsc::Sender<Part>,
    name: String,
    bytes: &[u8],
) -> std::result::Result<(), Error> {
    send(tx, Part::Start(name)).await?;
    for chunk in bytes.chunks(1024 * 1024) {
        send(tx, Part::Bytes(Bytes::copy_from_slice(chunk))).await?;
    }
    Ok(())
}
async fn archive(
    export: MapExport,
    permit: Arc<OwnedSemaphorePermit>,
) -> std::result::Result<Arc<tempfile::NamedTempFile>, Error> {
    let file = Arc::new(tempfile::NamedTempFile::new().map_err(|_| Error::Unavailable)?);
    let destination = file.clone();
    let (tx, mut rx) = mpsc::channel::<Part>(2);
    // The writer owns a permit too: cancellation cannot admit new work until
    // its bounded pending disk writes have actually stopped.
    let writer = tokio::task::spawn_blocking(move || -> std::io::Result<()> {
        let _permit = permit;
        let mut zip = zip::ZipWriter::new(destination.reopen()?);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored)
            .unix_permissions(0o644);
        let mut bytes = 0usize;
        let mut files = 0usize;
        while let Some(part) = rx.blocking_recv() {
            match part {
                Part::Start(name) => {
                    files += 1;
                    if files > 4100 {
                        return Err(std::io::Error::other("Too many export files."));
                    }
                    zip.start_file(name, options)?;
                }
                Part::Bytes(value) => {
                    bytes = bytes
                        .checked_add(value.len())
                        .ok_or_else(|| std::io::Error::other("Export overflow."))?;
                    if bytes > MAX_BUNDLE {
                        return Err(std::io::Error::other("Export too large."));
                    }
                    zip.write_all(&value)?;
                }
                Part::Finish => {
                    zip.finish()?.sync_all()?;
                    return Ok(());
                }
            }
        }
        Err(std::io::Error::other("Export cancelled."))
    });
    let folder = &export.description.folder;
    for name in ["show.aethermap", "layout.json"] {
        small_file(&tx, format!("{folder}/{name}"), &export.document).await?;
    }
    small_file(
        &tx,
        format!("{folder}/wireframe.svg"),
        export.description.svg.as_bytes(),
    )
    .await?;
    small_file(
        &tx,
        format!("{folder}/README.txt"),
        export.description.readme.as_bytes(),
    )
    .await?;
    for (name, content) in export.media {
        send(&tx, Part::Start(format!("{folder}/media/{name}"))).await?;
        let expected = content.len();
        let mut read = 0;
        let mut stream = content.body(0, expected).into_data_stream();
        while let Some(bytes) = stream.next().await {
            let bytes = bytes.map_err(|_| Error::Unavailable)?;
            read += bytes.len();
            send(&tx, Part::Bytes(bytes)).await?;
        }
        if read != expected {
            return Err(Error::Unavailable);
        }
    }
    send(&tx, Part::Finish).await?;
    drop(tx);
    writer
        .await
        .map_err(|_| Error::Unavailable)?
        .map_err(|_| Error::Unavailable)?;
    Ok(file)
}
pub(super) async fn export(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<Response> {
    let (id, extension) = name.rsplit_once('.').ok_or(Error::Invalid)?;
    if !matches!(extension, "zip" | "svg") {
        return Err(Error::Invalid.into());
    }
    let session = token(&headers)?;
    let permit = Arc::new(
        host.map_exports
            .clone()
            .try_acquire_owned()
            .map_err(|_| Error::Unavailable)?,
    );
    let export = host
        .documents
        .as_ref()
        .ok_or(Error::Unavailable)?
        .map_export(&session, id, extension == "zip")
        .await?;
    let filename = if extension == "zip" {
        format!("{}.zip", export.description.folder)
    } else {
        format!("{}-wireframe.svg", export.description.folder)
    };
    let (body, size, mime) = if extension == "svg" {
        let size = export.description.svg.len();
        (
            Body::from(export.description.svg),
            size as u64,
            "image/svg+xml; charset=utf-8",
        )
    } else {
        let file = archive(export, permit.clone()).await?;
        let size = file
            .as_file()
            .metadata()
            .map_err(|_| Error::Unavailable)?
            .len();
        let reader = tokio::fs::File::from_std(file.reopen().map_err(|_| Error::Unavailable)?);
        let stream = futures_util::stream::try_unfold(
            (reader, file, permit),
            |(mut reader, file, permit)| async move {
                let mut buffer = vec![0; 64 * 1024];
                let read = reader.read(&mut buffer).await?;
                if read == 0 {
                    return Ok::<_, std::io::Error>(None);
                }
                buffer.truncate(read);
                Ok(Some((Bytes::from(buffer), (reader, file, permit))))
            },
        );
        (Body::from_stream(stream), size, "application/zip")
    };
    Response::builder()
        .header("content-type", mime)
        .header("content-length", size)
        .header(
            "content-disposition",
            format!("attachment; filename=\"{filename}\""),
        )
        .header("cache-control", "no-store")
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "sandbox; default-src 'none'")
        .body(body)
        .map_err(|_| Error::Unavailable.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::documents::map_exports::ExportDescription;
    #[tokio::test]
    async fn private_archive_preserves_bytes_and_cleans_up_with_its_owner() {
        let slots = Arc::new(tokio::sync::Semaphore::new(1));
        let permit = Arc::new(slots.clone().try_acquire_owned().unwrap());
        assert!(slots.clone().try_acquire_owned().is_err());
        let data = b"{\"scenes\": []}\n".to_vec();
        let export = MapExport {
            description: ExportDescription {
                folder: "Show".into(),
                svg: "<svg/>".into(),
                readme: "A show\n".into(),
                media: vec![],
            },
            document: data.clone(),
            media: vec![],
        };
        let file = archive(export, permit.clone()).await.unwrap();
        let path = file.path().to_owned();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                file.as_file().metadata().unwrap().permissions().mode() & 0o077,
                0
            );
        }
        let mut zip = zip::ZipArchive::new(file.reopen().unwrap()).unwrap();
        assert_eq!(zip.len(), 4);
        let mut bytes = Vec::new();
        std::io::Read::read_to_end(&mut zip.by_name("Show/show.aethermap").unwrap(), &mut bytes)
            .unwrap();
        assert_eq!(bytes, data);
        drop(zip);
        drop(file);
        drop(permit);
        assert!(!path.exists());
        assert!(slots.try_acquire_owned().is_ok());
    }
}
