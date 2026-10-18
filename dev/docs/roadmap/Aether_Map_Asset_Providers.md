# Asset providers — a plugin boundary for Aether Map

**Status: planned.** Openverse is integrated and is the worked example. Nothing
in the "Plugin" sections below is built. This document exists so the second
provider does not invent a second shape.

Jonathan, 2026-09-21: *"maybe setup a plugin framework for Aether Map where
people can make a plugin for their website to allow a searchable database for
assets."*

## Why a boundary at all

The Assets tab searches openly-licensed content and imports it into the show.
Openverse was first because it needs no API key, so it works on a fresh install
with nothing configured. Every other source we looked at fails that test in one
of two ways, and the split is what the plugin boundary has to serve:

| Source | Why it is not integrated |
|---|---|
| Pexels, Pixabay | Real search APIs, but each needs a key |
| VJ Loops Farm, Video Mapping Store, StageLoops | No API at all — download sites |

The second group cannot be a plugin, and a plugin framework will not change
that. They are hyperlinks in the Assets tab and that is the honest answer.

The first group is exactly what a plugin is for — and so is the case Jonathan
raised: someone with their own library who wants it searchable from inside Map.

## Three constraints, learned the hard way

**A key never reaches the browser.** A key in a browser bundle is a published
key. Provider search is therefore proxied by the Studio host
(`/api/map/assets/search`), which is where a key would live. This is already
true for Openverse, which needs no key — it is proxied anyway, because the same
request that succeeds from a server is answered `401` from a page.

**An import is a download, not a link.** A show runs in a venue, often on a
paired Pi, often with no network. An asset left as a URL is a black surface on
the night. Every provider's results must resolve to bytes Map can copy into the
show's media store.

**Licence travels with the file.** `MediaRef.credit` carries provider, creator,
licence and source URL into the document, because most open licences require
credit and a show that travels without its attribution cannot legally be
projected. A provider that cannot state a licence per result cannot be a
provider.

## The contract

A provider answers two questions. The shapes already exist in
`aether-map/src/assets/openverse.ts` — this is that module's interface, named.

```ts
interface AssetProvider {
  id: string;                    // "openverse", "pexels", "my-library"
  name: string;                  // shown in the source picker
  homepage: string;              // where a human goes to read the terms
  media: ("image" | "video")[];  // what it can return
  needsKey: boolean;             // drives the "not configured" state
  search(query: string, page: number): Promise<AssetSearch>;
}

interface AssetResult {
  id: string;
  title: string;
  url: string;          // the file to download
  thumbnail: string;    // a preview safe to put in an <img>
  creator: string;
  license: string;      // short code: "by", "cc0", "pexels"
  licenseVersion: string;
  sourceUrl: string;    // the page a human can check
  attribution: string;  // ready-made credit line
  width: number;
  height: number;
}
```

`AssetResult` is the normalisation point. Providers differ wildly in field
names; the panel should never learn any of them. Openverse's adapter is 40
lines and is the reference.

## Plugin shape (planned)

A plugin is a **manifest the host reads**, not code the browser loads. That
keeps keys server-side and means a plugin cannot execute in an operator's page.

```json
{
  "id": "my-library",
  "name": "My Library",
  "homepage": "https://example.com",
  "media": ["image", "video"],
  "search": {
    "url": "https://example.com/api/search?q={query}&page={page}&per_page=20",
    "auth": { "kind": "header", "name": "Authorization", "value": "Bearer {key}" }
  },
  "map": {
    "results": "data",
    "id": "uuid",
    "title": "name",
    "url": "files.original",
    "thumbnail": "files.thumb",
    "creator": "author.name",
    "license": "license.code",
    "sourceUrl": "permalink",
    "width": "dimensions.w",
    "height": "dimensions.h"
  }
}
```

`map` is dotted-path extraction, deliberately declarative: a plugin that cannot
be expressed as field mapping probably wants a real adapter in the repo instead,
and that is a pull request rather than a plugin.

Manifests live in the Studio host's data directory; keys are entered in Map's
settings and stored host-side, never in the manifest.

### What the host must enforce

A plugin is a URL an operator pasted, so the proxy is the trust boundary:

- **HTTPS only**, and refuse private, loopback and link-local addresses — a
  manifest pointing at `169.254.169.254` is an SSRF, not an asset library.
- **Response and download size caps**, and a timeout. A provider that stalls
  must not hold a host thread.
- **Content-type check on download.** The Openverse adapter already refuses a
  blob that is not an image; that check belongs in the shared path.
- **No `{key}` interpolation into the URL path or query unless the manifest
  says so** — header auth is the default so keys stay out of logs.
- **Pass the upstream's own error text through.** Openverse answers `401` for
  `page_size > 20`, an auth status for a paging problem; swallowing its
  `detail` body turned a one-line fix into a long hunt. Providers explain
  themselves — let them.

### Rate limits are the provider's, not ours

Openverse's anonymous tier caps `page_size` at 20 and rate limits by IP. A
self-hosted Studio is one IP for a whole venue. Per-provider limits and a
visible "try again shortly" state are part of the plugin contract, not an
afterthought.

## Order of work

1. **Pexels** as the second provider, in-repo, not as a plugin. It is the
   cheapest way to prove the interface survives contact with a second shape —
   and it brings video, which is what projection work actually wants.
2. **Source picker** in the Assets tab once there is more than one.
3. **Key storage** in Map settings, host-side.
4. **Manifest plugins** only after the in-repo interface has held for two
   providers. A plugin API published before that is a guess.

Deliberately not planned: loading plugin JavaScript in the page, plugins that
write to the document, and plugins that are not asset search. Each is a much
larger trust conversation than "where do I find a texture".
