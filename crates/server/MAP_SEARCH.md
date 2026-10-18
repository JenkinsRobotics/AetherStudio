# Map Online Library on the native host

`GET /api/map/assets/search?q=...&page=...` preserves the existing Map client
contract. Native browser identity and current Map access are required, including
for an empty query. Device/agent bearer credentials cannot use this browser route.
Access is checked again after network IO without holding SQL locks across it.

The transport uses the fixed HTTPS Openverse images endpoint, anonymous page
size20 and the existing all-cc filter. Page numbers clamp to1–50, invalid page
numbers default to1. Queries are trimmed and bounded to512 characters/2048 UTF-8
bytes, with the host's4096-byte query-string limit also applying. Blank searches
return the existing empty result without calling the provider.

TLS uses native trust roots. Redirects are disabled; cookies/authorization and
browser-supplied endpoint URLs are never forwarded. Responses are bounded to2MiB,
including chunked responses, and validated as search envelopes. Attribution,
license and provider result fields survive unchanged. Provider errors return502,
network timeout/failure504; private upstream diagnostics are not echoed.
Two separate search slots, a15-second transport deadline and at most20-second
handler deadline prevent a slow provider from occupying editing/account capacity.
Cancellation drops its permit. No provider credentials or database schema needed.

Verification is deterministic: local HTTP fixtures cover payload preservation,
encoded search parameters, malformed results, redirects, throttling, oversized
and chunked bodies, timeout; native PostgreSQL/HTTP checks cover current identity,
forced password change, disabled apps/admins and session revocation. Existing Map
client tests run unchanged. Public-provider availability is not part of the local
contract suite. No old Python host fallback is used.

Run `cargo test --locked -p aether-server --lib` and
`.venv/bin/python dev/rebuild/postgres_check.py --map-search-only`.
The focused test is also included by the full PostgreSQL framework gate.

## Pixabay (development, 2026-10-13)

The same authenticated browser route accepts `provider=pixabay&kind=video` (or
`kind=image`). Configure `AETHER_PIXABAY_API_KEY` in the **native server process**
environment before starting a qualified development generation. Obtain the key
from [Pixabay's official API documentation](https://pixabay.com/api/docs/).
Do not put it in Vite variables, a document, checked-in config, or client code.
This work does not change the installed service or configure its credentials.

`q` accepts up to100 characters of search text or an HTTPS Pixabay asset page
link. Links become an `id` lookup against the fixed API, never an arbitrary URL
fetch. Videos use `/api/videos/`; images use `/api/`. Pages contain20 hits and
clamp to1–25; safe search is enabled. The browser shows the source/creator/license,
previews video and selects a rendition (default up to1080p), then downloads a
local copy through the existing authenticated media upload path. The server does
not proxy arbitrary download URLs or forward browser cookies to providers.

The process keeps up to128 successful distinct searches for24 hours, coalescing
concurrent identical requests. Entries are never evicted early to re-query the
provider; a full cache returns429 until entries expire. The cache is in-memory
and resets on process restart; durable/farm-wide caching remains future work.
The existing2MiB response bound, disabled redirects, transport/handler deadlines,
search admission and post-request access recheck also apply. Provider errors
contain no key or upstream diagnostic body. Missing credentials return503 with
setup guidance; older servers are detected by the client instead of presenting
an empty catalogue.

The browser popup fallback opens the actual Pixabay website without requiring a
key. Its downloads still use the browser's configured Downloads folder. The
operator selects that file with **Import downloaded file**. Capturing a third-party
website download directly into a chosen local project folder requires a desktop
shell and is not implemented by this web feature.

Verified:4 new native provider tests,5 existing Openverse tests and the disposable
PostgreSQL HTTP authority gate. Public Pixabay search/download with an actual
operator key remains unqualified; deterministic fixtures do not claim that result.
