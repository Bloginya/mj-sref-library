# Style Index — Midjourney `--sref` library

Personal library of Midjourney style reference codes (`--sref`) and personalization profiles (`--p`) by **daryakruk.ai**, each with example images.

**Live page:** enable GitHub Pages (Settings → Pages → Deploy from branch → `main` / root) and open `https://<username>.github.io/<repo>/`.

## Features
- Grid of every style code with 3–4 example images (click to open all + the original Midjourney jobs)
- One-click copy of `--sref CODE` / `--p CODE`
- Search by name, tag or code; filter by tags; filter by account
- Builder: add several srefs + profiles, set `--sw`, copy the full parameter string
- Saved (♥) list, stored in your browser

## Adding / editing codes
All data lives in `data.js`. Each entry:

```js
{ "code": "3681152159", "name": "Platinum Fur Beauty", "kind": "sref",
  "account": "darya_kruk", "tags": ["portrait","beauty"],
  "ex": ["<midjourney-job-id>/0_0", "<job-id>/0_1"] }
```

`ex` = example images: the job id from a Midjourney URL (`midjourney.com/jobs/<job-id>?index=N`) plus `/0_N` (N = image 0–3).

Images are loaded from Midjourney's CDN, so if an image is deleted in Midjourney it disappears here too.
