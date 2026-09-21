# Style Index — Midjourney `--sref` library

A library of Midjourney style reference codes (`--sref`), personalization profiles (`--p`) and code combinations, each with example images.

## Features
- Every style code with up to 4 example images; hover to flip through them, click to open all
- One-click copy of `--sref CODE` / `--p CODE` / full combo strings
- Search by name, tag or code; filter by tags
- Builder: stack several srefs + profiles, set `--sw`, copy the full parameter string
- Saved (♥) list, stored in your browser
- Images that were generated with several codes at once are marked **mix +N**

## Adding / editing codes
All data lives in `data.js`. Each entry:

```js
{ "code": "3681152159", "name": "Platinum Fur Beauty", "kind": "sref",
  "tags": ["portrait","beauty"],
  "ex": ["<image-id>/0_0", "<image-id>/0_1"] }
```

`ex` = example images on Midjourney's CDN (`<id>/0_N`, N = image 0–3).
