/**
 * Auto-sync the "Fresh from the channel" strip on derilmbarika.com.
 *
 * Fetches the latest uploads from Deril's YouTube channel feed and rewrites the
 * block between the <!-- LATEST:START --> and <!-- LATEST:END --> markers in
 * index.html. Runs in CI (see .github/workflows/sync-videos.yml) and can be run
 * by hand:  node scripts/sync-videos.mjs
 *
 * No dependencies: Node 18+ has global fetch, and the feed is parsed with small
 * regexes rather than a full XML library.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const CHANNEL_ID = "UCiNk0ioqmhaeCyBbqyY_nCw";
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const COUNT = 4;

const here = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(here, "..", "index.html");

const START = "<!-- LATEST:START -->";
const END = "<!-- LATEST:END -->";

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Escape a string for safe insertion into an HTML attribute or text node. */
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseEntries(xml) {
  const entries = [];
  const blocks = xml.split("<entry>").slice(1);
  for (const block of blocks) {
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const rawTitle = block.match(/<title>([^<]*)<\/title>/)?.[1];
    if (!id || !rawTitle) continue;
    entries.push({ id, title: decode(rawTitle) });
  }
  return entries;
}

/** Trim long upload titles to a clean card length without cutting mid-word. */
function tidy(title, max = 72) {
  const clean = title.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).trim() + "…";
}

function tile(v) {
  const url = `https://www.youtube.com/watch?v=${v.id}`;
  const thumb = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title = esc(tidy(v.title));
  return (
    `      <a class="ltile" href="${url}" target="_blank" rel="noopener">\n` +
    `        <img loading="lazy" src="${thumb}" alt="" width="320" height="180">\n` +
    `        <span class="ltile-title">${title}</span>\n` +
    `      </a>`
  );
}

async function main() {
  const res = await fetch(FEED, { headers: { "Accept-Language": "en-US" } });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  const all = parseEntries(xml);
  if (all.length === 0) throw new Error("No entries parsed from feed");

  // Long-form only: a Short returns 200 at /shorts/{id}; a regular video
  // 3xx-redirects to /watch. Skip Shorts, keep the newest COUNT long-form.
  const entries = [];
  for (const v of all) {
    if (entries.length >= COUNT) break;
    let isShort = false;
    try {
      const r = await fetch("https://www.youtube.com/shorts/" + v.id, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      isShort = r.status === 200;
    } catch { /* on error, keep the video rather than drop it */ }
    if (!isShort) entries.push(v);
  }
  if (entries.length === 0) throw new Error("No long-form entries found");

  const block = `${START}\n${entries.map(tile).join("\n")}\n      ${END}`;

  const html = await readFile(INDEX, "utf8");
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (!re.test(html)) throw new Error("Markers not found in index.html");

  const next = html.replace(re, block);
  if (next === html) {
    console.log("No change: latest videos already in sync.");
    return;
  }
  await writeFile(INDEX, next);
  console.log(`Updated ${COUNT} latest videos:`);
  for (const e of entries) console.log(` - ${tidy(e.title)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
