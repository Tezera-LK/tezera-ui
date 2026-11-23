# Handoff: tezera wireframe history dashboard

**Date:** 23 Nov 2026
**Live site:** https://tezera-lk.github.io/tezera-ui/
**Repo:** Tezera-LK/tezera-ui (private repo, public Pages site)

## Summary

The repo held version history of the tezera wireframes (lo-fi and hi-fi HTML exports, vendor portal
prototypes, Figma importer plugins) with no way to browse it. It now has a static dashboard,
deployed to GitHub Pages, that lists every version by account type and date and opens each one in
an embedded viewer.

Adding a version is: name it `NN_YYYY-MM-DD_short-name`, drop it in `lowfids/<role>/` or
`highfids/<role>/`, push to `main`. CI rebuilds the version list and redeploys.

## Decisions

| Question | Decision | Why |
|---|---|---|
| Public or private site? | Public GitHub Pages | Confirmed acceptable. The repo itself stays private. |
| How to move between versions | Sidebar timeline per role + embedded viewer, prev/next, shareable hash URLs | Recommended option. Side-by-side compare was not chosen. |
| How new versions get listed | Auto-scan by filename in CI | No hand-maintained list to forget. |
| Figma plugins | Listed as downloads with a detail page | Keeps them in the timeline next to the flows they import. |
| Lo-fi dates | All set to 2026-10-20 | Real dates unknown. Placed just before the earliest hi-fi (21 Oct). |
| `Dashboard-html.zip` | Moved to vendor version 00 and extracted | It is an earlier vendor dashboard component set (Main, Sidebar, Topbar) with its own runtime, so it renders. |
| Visual style | Tezera branded | Uses the palette and type from the hi-fi flows, light and dark. |
| Deploy method | Custom GitHub Actions workflow, Pages source "GitHub Actions" | Branch mode cannot run the manifest script, so it would publish without `versions.json`. |

## What was done

| Commit | Change |
|---|---|
| `a2461a4` | Dashboard (`index.html`, `assets/`), manifest script, Pages workflow, README. Renamed lo-fi files into `lowfids/<role>/`, moved and extracted `Dashboard-html.zip`, logged renames in `highfids/rename-log.csv`. |
| `3822c63` | Corrected copy: Figma does have version history for its own files; these exports and plugins live outside it. |
| this commit | `CLAUDE.md` and this handoff. |

Repo settings changed: Pages source switched from "Deploy from a branch" to "GitHub Actions"
(`build_type: workflow`), then the deploy was re-run.

### Dashboard features

- Overview: role cards (version counts, lo-fi/hi-fi bar strip, latest version) and a dated timeline.
- Sidebar: roles as collapsible sections (animated, interruptible, respects reduced motion), lo-fi and
  hi-fi groups, numbered versions with dates. On narrow screens it becomes a drawer.
- Viewer: iframe loaded on demand with a loading state (files are up to 3.7 MB), prev/next and
  arrow-key stepping within a role, page picker for multi-page prototypes and component sets,
  "Open in tab", zip download.
- Plugin page: plugin name, export date, zip and file downloads, steps to import into Figma.
- Light and dark mode, following the system with a manual toggle.
- Header link to the Figma first draft (read from the `.txt` file in the repo root).

## Current state

- Live, deploying from `main` via `.github/workflows/pages.yml`. Last deploy verified: `versions.json`
  returns 200 with 29 versions, and the live page renders 29 sidebar entries.
- Content: 5 roles, 29 versions (Attendee 10, Organiser 9, Vendor 6, Freelancer 3, All accounts 1).

### How it was verified

- Headless Chrome screenshots of overview, flow, multi-page site, component set and plugin views at
  1440px, light and dark.
- 390px phone layout: no horizontal overflow, drawer works.
- Every path in `versions.json` returned 200 from a local server.
- Accordion animation sampled frame by frame: collapse, mid-way reversal without a jump, final heights
  match.

## Known issues and open items

1. **Vendor portal `canvas-source/*.dc.html` files do not render.** They load `./support.js`, which is
   not in those folders. They are left out of the page picker; the rendered `.html` pages are listed
   instead. Fix if wanted: add a new version that includes the runtime (do not edit the archived one).
2. **Lo-fi dates are placeholders** (2026-10-20). If the real dates are known, rename the files and
   log it in `highfids/rename-log.csv`.
3. **Site is public.** Anyone with the URL can see the wireframes. Restricting access needs GitHub
   Enterprise Cloud private Pages or a different host.
4. **No compare view.** A side-by-side view of two versions of the same role was offered but not
   built.
5. **No automated tests.** Verification so far is manual (see `CLAUDE.md` testing notes).
6. `05_..._attendee-flow-v4.html` and `09_..._attendee-flow-v4-new-dark.html` are the same size but
   different content. Both are listed.

## Pointers

- Repo conventions and testing tips: `CLAUDE.md`
- Adding versions and local preview: `README.md`
- Version detection logic: `scripts/build-manifest.mjs`
- Rename history: `highfids/rename-log.csv`
