# Universal Links / App Links

These files are served from the web build root (`public/` → `/.well-known/...`). The iOS
association covers invite URLs and folder and link detail URLs (`/folders/*`, `/links/*`).
The `/folders` and `/links` list URLs open on the web. Android App Links cover invite URLs.

Keep `paths` and `components` in sync in both `apple-app-site-association` and
`apple-app-site-association.json`. The web
deployment serves the `.json` copy at `/.well-known/apple-app-site-association`. Updating
its paths takes a web deployment. Existing iOS installations also need the OTA update for
public reading and the `applinks:<web-host>` entitlement already present in the installed build.

Activation checklist (none of this requires a paid Expo plan):

1. Set `EXPO_PUBLIC_WEB_APP_HOST` (e.g. `app.archivelink.app`) so `app.config.ts` emits
   `ios.associatedDomains` + `android.intentFilters`.
2. `apple-app-site-association` — replace `TEAMID` with the Apple Developer Team ID
   (Membership page). Must be served at `https://<host>/.well-known/apple-app-site-association`
   with `Content-Type: application/json` and **no** redirect.
3. `assetlinks.json` — replace `REPLACE_WITH_SHA256_FINGERPRINT` with the release signing
   key's SHA-256 fingerprint (`keytool -list -v -keystore <release.keystore>`, or from
   `eas credentials`). Multiple fingerprints (debug + release) can be listed.
4. Rebuild the native app (EAS Build free tier or `expo prebuild`) so the new
   entitlements/intent-filters ship.

Until then, the web invite page falls back to the custom-scheme "앱에서 열기" interstitial
(`qlinkchannel://invite?...`).
