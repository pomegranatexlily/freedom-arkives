# Freedom Arkives — Data Collection & Privacy Audit

**Audit date:** October 13, 2026  
**Scope:** Homepage/article catalog, Workshop landing page, Publishing Engine, NURAH Protocols, Strategic Mechanism Registry, consent script, privacy notice, static assets, and article-sync automation on `main`.  
**Method:** Static repository-source audit and GitHub source/deployment checks. **Not** a live-browser network capture, vendor assessment, penetration test, or legal opinion.

## Visitor data inventory

| Feature | Data | Destination | Necessary? |
| --- | --- | --- | --- |
| GitHub Pages | Standard request metadata, including possible IP/browser details | GitHub hosting infrastructure | Required for website delivery |
| Consent choice (`fa.privacy.v1`) | Opt-in to optional external fonts/thumbnails, timestamp | Browser local storage | Remembers a choice |
| Workshop Publishing Engine (`workavism_engine_v01`) | Research topics and drafts entered by user | Browser local storage | Functional autosave |
| Homepage content and local assets | No direct application user profile capture seen | Local static files via GitHub Pages | Functional |
| Google Fonts | Standard requests and connection metadata | Google Fonts | **Optional:** link injected only when visitor allows external media |
| Medium-hosted article thumbnails | Image URLs and connection metadata | Medium CDN | **Optional:** local placeholder before permission; image links re-render on permission changes |
| External link clicks | Visitors choose outbound links (Amazon, Medium, Linktree, and other websites) | Respective site | Voluntary navigation, separate privacy practices |
| Medium article synchronization | Public RSS feed fetched by GitHub Actions | GitHub automation to Medium | **Not visitor tracking**; server-side publication synchronization |

## Verified in current source

- No Google Analytics, Tag Manager, ad pixels, marketing trackers, account forms, contact forms, or user-profile database observed.
- Consent notice defaults optional external assets off and offers **Accept all / Reject optional / Manage choices**.
- The former floating Privacy Choices button has been replaced by an ordinary **Settings** control in site navigation / Workshop headers.
- Google Fonts no longer preconnects or downloads from homepage HTML before permission.
- Optional Medium thumbnail image requests use a first-party fallback before permission, and cards re-render on choice changes.
- Homepage, privacy policy, and all four Workshop pages set `<meta name="referrer" content="no-referrer">` to reduce information forwarded to external services.
- Publishing Engine local data does not have an application upload endpoint in the reviewed client code.
- Article catalog has 60 article entries and 13 book entries at audit time; automated Medium sync preserves the application shell and updates article catalog data.

## Residual risks / next actions

1. **Shared origin:** Python Atelier and Freedom Arkives are paths under the same `pomegranatexlily.github.io` origin. Browser local storage is **not** isolated by path. Separate custom subdomains/origins before collecting account data or sensitive private material.
2. **GitHub hosting:** Essential connection metadata is still processed by hosting, regardless of optional consent.
3. **External content:** If a visitor opts in, Google and Medium can receive connection data. Removing the optional content later cannot undo a prior request.
4. **External links:** Opening third-party sites voluntarily invokes their policies. Sensitive text may be shared through explicit clipboard/share actions in the Publishing Engine.
5. **Local draft exposure:** Same-origin scripts, browser extensions, shared devices, and local browser access can expose saved drafts. Do not use local storage for secrets.
6. **Automation monitoring:** Any future edits to Medium feed synchronization or new embedded media should be checked so they do not bypass the consent gate.
7. **Missing live verification:** Network interception and real-device tests should validate no Medium CDN or Google Fonts requests before consent. Verify all pages after deployments.
8. **Legal review:** Documentation is an implementation inventory, not a guarantee of legal compliance.

## Manual acceptance tests

1. Visit each page in a private browser window and verify first-run notice and ordinary **Settings** entry afterward.
2. On **Reject optional**, browse 60 article cards and verify no Google Fonts or Medium CDN requests appear in the network log; fallback thumbnails should remain visible.
3. On **Accept all**, verify the external assets load; reverse the decision and confirm new thumbnails stop using the external URLs.
4. Create a draft in Publishing Engine, refresh, verify local autosave; inspect `workavism_engine_v01`.
5. Confirm no tracker cookies or cross-site requests are introduced by future changes; verify hosting requests separately.
6. Validate every Workshop page and homepage on a real phone and desktop browser.

**Change rule:** If adding email capture, subscriptions, accounts, comments, embeds, analytics, ad pixels, or downloadable tools with new networking behavior, repeat this audit and seek jurisdiction-appropriate legal review before release.

## Offline functionality added October 13, 2026

- A first-party scoped service worker (`sw.js`) supports offline Freedom Arkives reading.
- The worker is registered after a visitor makes a privacy choice, including Reject optional; essential caching does not enable any optional tracker.
- HTML navigation is network-first to prefer newly synced daily article-catalog content when online, with cached page / dedicated offline-page fallback on disconnection.
- First-party assets are cache-first. The service-worker `VERSION` must be advanced when static, privacy, or security assets change so outdated files expire.
- Other GitHub Pages applications and third-party Medium/Google requests are explicitly outside the service-worker scope and cache policy.
- Offline storage occupies device space and is erased by browser clearing/site storage; it does not back up the user's locally authored Workshop drafts.
- **Manual QA required:** iPhone Safari and standalone PWA offline/online behavior, cache invalidation after daily sync, Workshop tools, consent flow, and repeat visits.
