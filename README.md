# tezera-ui

Version history of the tezera wireframes. Figma keeps no history for these exports, so this repo does,
and GitHub Pages serves a dashboard (`index.html`) to browse them.

## Adding a version

1. Name it `NN_YYYY-MM-DD_short-name` (next number in that folder, date of the export).
2. Put it in `lowfids/<role>/` or `highfids/<role>/`. Roles: `attendee`, `org`, `vendor`, `freelancer`, `shared`.
3. Push to `main`. The Pages workflow rebuilds `versions.json` and deploys.

What the dashboard does with each shape:

| You add | Shown as |
|---|---|
| `NN_..._name.html` | Flow, opens in the viewer |
| folder with `index.html` (up to 2 levels deep) | Multi-page prototype, every `.html` beside it is a page |
| folder with `*.dc.html` + `support.js` | Component set, every `.dc.html` is a component |
| folder with `manifest.json` (up to 2 levels deep) | Figma plugin, download + files |
| `NN_..._name.zip` beside a folder of the same name | Download button on that folder's version |

Files that do not follow the naming are skipped (the build prints a warning). Log renames in
`highfids/rename-log.csv`.

## Preview locally

```sh
node scripts/build-manifest.mjs
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk does not work, because the
page fetches `versions.json`.

## Hosting

`.github/workflows/pages.yml` deploys on every push to `main`. One-time setup: repo
**Settings → Pages → Build and deployment → Source: GitHub Actions**. The site is public.
