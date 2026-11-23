# CLAUDE.md

Guidance for Claude Code (and people) working in this repo.

## What this repo is

Version history for the tezera wireframes: lo-fi and hi-fi HTML flow exports, multi-page prototypes,
component sets and Figma importer plugins, by account type. Figma's version history covers its own
files, but these exports and plugins live outside Figma, so this repo keeps their history.

A static dashboard (`index.html`) browses them and is deployed to GitHub Pages:
https://tezera-lk.github.io/tezera-ui/ (public, although the repo is private).

See `HANDOFF.md` for the decisions behind the build and the open items.

## Layout

```
index.html                  dashboard shell (vanilla HTML, no framework, no build step)
assets/app.css              brand tokens + layout (light and dark)
assets/app.js               reads versions.json, renders overview, sidebar, viewer, routing
scripts/build-manifest.mjs  scans lowfids/ and highfids/, writes versions.json
.github/workflows/pages.yml builds versions.json and deploys Pages on every push to main
lowfids/<role>/             lo-fi versions
highfids/<role>/            hi-fi versions
highfids/rename-log.csv     every rename of an archived file (folder,old,new)
```

Roles (folder names): `attendee`, `org` (shown as Organiser), `vendor`, `freelancer`,
`shared` (shown as All accounts). An unknown folder name becomes a new role automatically.

## Rules

- **Naming is the API.** Every version is `NN_YYYY-MM-DD_short-name` (`.html` file, folder, or
  `.zip` beside a folder of the same name). Anything else is skipped with a build warning.
- **Archived versions are read-only.** Never edit a file inside a version folder or a versioned
  `.html`. Add a new version instead. If you must rename, append the rename to
  `highfids/rename-log.csv`.
- **`versions.json` is generated and gitignored.** Do not commit it. CI builds it.
- **Pages source must stay "GitHub Actions"** (`build_type: workflow`). In "Deploy from a branch"
  mode, GitHub's built-in deploy runs after ours and publishes a site without `versions.json`.
- **No build tooling for the UI.** Keep the dashboard dependency-free (plain JS, CSS, one Google Fonts
  link). Node is only used for the manifest script.
- Build DOM with the `h()` helper in `app.js` (text goes through `textContent`). Only static SVG
  icon strings use `innerHTML`.

## How the manifest classifies a version

| Shape | Kind | Viewer |
|---|---|---|
| `NN_..._name.html` | `flow` | iframe |
| folder with `manifest.json` (depth <= 2) | `plugin` | detail panel + zip / file downloads |
| folder with `*.dc.html` + `support.js` | `components` | iframe + component picker |
| folder with `index.html` (depth <= 2) | `site` | iframe + page picker (dedupes pages by `<title>`) |
| `NN_..._name.zip` with no folder | `download` | download only |

Within a role, versions sort lo-fi first, then by date, then by number.

## Design rules (from the hi-fi flows)

- Palette tokens on `:root` in `app.css`, copied from the hi-fi flows, with dark pairs under
  `prefers-color-scheme` and `[data-theme="dark"]`.
- Bricolage Grotesque throughout, rounded corners everywhere, no outlines on boxes (colour separates
  them). Cards use the asymmetric radius `20px 20px 6px 20px`.
- Motion: ease-out `cubic-bezier(.23, 1, .32, 1)`, 200 to 260 ms, interruptible, and skipped under
  `prefers-reduced-motion`. The sidebar accordion (`toggleRole` in `app.js`) is the reference.

## Commands

```sh
node scripts/build-manifest.mjs     # regenerate versions.json (prints warnings for skipped files)
python -m http.server 8000          # preview at http://localhost:8000 (file:// will not work)
node --check assets/app.js          # quick syntax check
```

## Testing notes

- There are no automated tests. Verify with headless Chrome screenshots against the local server.
- Headless Chrome on Windows has a 500px minimum window width. To test phone widths, load the page
  in a 390px-wide iframe inside a wrapper page.
- With `--virtual-time-budget`, headless Chrome does not advance Web Animations or fire `onfinish`.
  Test animations by pausing them and seeking `animation.currentTime`, and use `animation.finished`
  (a promise), not `onfinish`, in app code.
- After deploying, check `https://tezera-lk.github.io/tezera-ui/versions.json` returns 200.
