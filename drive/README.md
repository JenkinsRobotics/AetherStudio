# Aether Drive — built into Studio

Drive is Aether Studio's server-backed file workspace. Its frontend lives here;
accounts, file storage, sharing and history live in the Studio server. It is
built and shipped with Studio, not released as a separate standalone app.

From this directory, use `npm ci`, `npm test` and `npm run build`.
`npm run dev` serves the development UI on port 5185 and proxies the Studio
server at port 8781 (`AETHER_DEV_SERVER` can override it). The existing Drive URL
and file data are unchanged. See `../LOCAL_DEVELOPMENT.md` for suite setup.

`SOURCE_HISTORY.json` records the preserved sibling repository and source commit.
That repository is retained only as a history backup. No production cutover or
user-data migration occurred during this source integration.
