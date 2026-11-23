#!/usr/bin/env node
// Scans lowfids/ and highfids/ and writes versions.json for the dashboard (index.html).
//
// Naming convention (anything else is ignored, with a warning):
//   <fidelity-folder>/<role>/NN_YYYY-MM-DD_name.html   -> single-file flow
//   <fidelity-folder>/<role>/NN_YYYY-MM-DD_name/        -> folder version
//   <fidelity-folder>/<role>/NN_YYYY-MM-DD_name.zip     -> download for the folder of the same name
//
// Folder versions are classified by content:
//   manifest.json (depth <= 2)          -> Figma plugin (download)
//   index.html (depth <= 2)             -> multi-page prototype, every *.html beside it is a page
//   *.dc.html + support.js              -> component set, every *.dc.html is a component

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIDELITIES = [
  { dir: 'lowfids', id: 'lo', label: 'Lo-fi' },
  { dir: 'highfids', id: 'hi', label: 'Hi-fi' },
];
const ROLES = [
  { id: 'attendee', label: 'Attendee' },
  { id: 'org', label: 'Organiser' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'freelancer', label: 'Freelancer' },
  { id: 'shared', label: 'All accounts' },
];
const NAME_RE = /^(\d+)_(\d{4}-\d{2}-\d{2})_(.+?)(\.html|\.zip)?$/;

const warnings = [];
const posix = (p) => relative(ROOT, p).split('\\').join('/');
const isDir = (p) => statSync(p).isDirectory();

function humanLabel(slug) {
  const s = slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\blofi\b/gi, 'lo-fi').replace(/\bfigma\b/gi, 'Figma');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function htmlTitle(file) {
  const m = readFileSync(file, 'utf8').slice(0, 4000).match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].split('·')[0].trim() : null;
}

// Finds the first directory (depth <= 2) that contains `name`.
function findDirWith(dir, name, depth = 2) {
  if (existsSync(join(dir, name))) return dir;
  if (depth === 0) return null;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (isDir(p)) {
      const hit = findDirWith(p, name, depth - 1);
      if (hit) return hit;
    }
  }
  return null;
}

function pagesIn(dir, suffix, first) {
  const seen = new Set();
  const files = readdirSync(dir).filter((f) => f.endsWith(suffix) && !isDir(join(dir, f)));
  files.sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
  const pages = [];
  for (const f of files) {
    const label = htmlTitle(join(dir, f)) || f.replace(suffix, '');
    if (seen.has(label)) continue; // e.g. index.html and Main.html are the same dashboard
    seen.add(label);
    pages.push({ label, file: posix(join(dir, f)) });
  }
  return pages;
}

function describeFolder(dir) {
  const pluginDir = findDirWith(dir, 'manifest.json');
  if (pluginDir) {
    let pluginName = null;
    try { pluginName = JSON.parse(readFileSync(join(pluginDir, 'manifest.json'), 'utf8')).name; } catch {}
    const files = readdirSync(pluginDir).filter((f) => !isDir(join(pluginDir, f)));
    return { kind: 'plugin', pluginName, files: files.map((f) => posix(join(pluginDir, f))) };
  }
  if (existsSync(join(dir, 'support.js')) && readdirSync(dir).some((f) => f.endsWith('.dc.html'))) {
    const pages = pagesIn(dir, '.dc.html', 'Main.dc.html');
    return { kind: 'components', entry: pages[0].file, pages };
  }
  const siteDir = findDirWith(dir, 'index.html');
  if (siteDir) {
    const pages = pagesIn(siteDir, '.html', 'index.html');
    return { kind: 'site', entry: pages[0].file, pages };
  }
  return null;
}

const roles = new Map(ROLES.map((r) => [r.id, { ...r, versions: [] }]));

for (const fid of FIDELITIES) {
  const fidDir = join(ROOT, fid.dir);
  if (!existsSync(fidDir)) continue;
  for (const roleId of readdirSync(fidDir)) {
    const roleDir = join(fidDir, roleId);
    if (!isDir(roleDir)) continue;
    if (!roles.has(roleId)) roles.set(roleId, { id: roleId, label: humanLabel(roleId), versions: [] });
    const role = roles.get(roleId);
    const entries = readdirSync(roleDir);

    for (const entry of entries) {
      const m = entry.match(NAME_RE);
      const full = join(roleDir, entry);
      if (!m) { warnings.push(`skipped (name does not match NN_YYYY-MM-DD_name): ${posix(full)}`); continue; }
      const [, num, date, slug, ext] = m;
      const id = `${fid.id}-${num}_${date}_${slug}`;
      const base = { id, fid: fid.id, num: Number(num), date, slug, label: humanLabel(slug) };

      if (ext === '.zip') {
        if (entries.includes(entry.slice(0, -4))) continue; // attached to its folder below
        role.versions.push({ ...base, kind: 'download', download: posix(full), size: statSync(full).size });
      } else if (ext === '.html') {
        role.versions.push({ ...base, kind: 'flow', entry: posix(full), size: statSync(full).size });
      } else if (isDir(full)) {
        const info = describeFolder(full);
        if (!info) { warnings.push(`skipped (no index.html, *.dc.html or manifest.json): ${posix(full)}`); continue; }
        const zip = entries.includes(`${entry}.zip`) ? posix(join(roleDir, `${entry}.zip`)) : null;
        const size = info.entry ? statSync(join(ROOT, info.entry)).size : zip ? statSync(join(ROOT, zip)).size : null;
        role.versions.push({ ...base, ...info, download: zip, size });
      }
    }
  }
}

const order = { lo: 0, hi: 1 };
for (const role of roles.values()) {
  role.versions.sort((a, b) => order[a.fid] - order[b.fid] || a.date.localeCompare(b.date) || a.num - b.num);
}

const links = [];
for (const f of readdirSync(ROOT)) {
  if (!f.endsWith('.txt')) continue;
  const url = readFileSync(join(ROOT, f), 'utf8').match(/https:\/\/(www\.)?figma\.com\/\S+/);
  if (url) links.push({ label: 'Figma first draft', url: url[0] });
}

const out = {
  generated: new Date().toISOString(),
  fidelities: FIDELITIES.map(({ id, label }) => ({ id, label })),
  roles: [...roles.values()].filter((r) => r.versions.length),
  links,
};
writeFileSync(join(ROOT, 'versions.json'), JSON.stringify(out, null, 2) + '\n');

const total = out.roles.reduce((n, r) => n + r.versions.length, 0);
console.log(`versions.json: ${total} versions across ${out.roles.length} roles`);
for (const w of warnings) console.warn(`warn: ${w}`);
