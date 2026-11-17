#!/usr/bin/env node
/**
 * Downloads the Quran text variants the app ships for offline reading, from
 * the Quran.com API (api.quran.com/api/v4), into public/quran-text/<script>/<surah>.json.
 *
 *   uthmani  string[]   Uthmani (Madani) text, for the KFGQPC Uthmanic Hafs font
 *   indopak  string[]   IndoPak text, for the IndoPak Nastaleeq font
 *   tajweed  Segment[][] Uthmani text split into runs; a run is either plain
 *                        text or [rule, text] for a tajweed rule to colour
 *
 * The original Naskh text (public/quran-text/<surah>.json) is left untouched.
 *
 * Usage: node scripts/fetch-quran-text.mjs [uthmani|indopak|tajweed ...]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "quran-text");
const api = "https://api.quran.com/api/v4/quran/verses";

const variants = [
  { dir: "uthmani", endpoint: "uthmani", field: "text_uthmani", transform: (t) => t.trim() },
  { dir: "indopak", endpoint: "indopak_nastaleeq", field: "text_indopak_nastaleeq", transform: (t) => t.trim() },
  { dir: "tajweed", endpoint: "uthmani_tajweed", field: "text_uthmani_tajweed", transform: toSegments },
];

/**
 * "قُلْ <tajweed class=qalaqah>د</tajweed> <span class=end>١</span>" → ["قُلْ ", ["qalaqah", "د"]]
 * Tags can nest (a silent alif inside a madd); the innermost rule colours its letters.
 */
function toSegments(html) {
  const body = html.replace(/<span class=end>[^<]*<\/span>/g, "").trim();
  const segments = [];
  const stack = [];
  const push = (text) => {
    if (!text) return;
    const rule = stack[stack.length - 1];
    const prev = segments[segments.length - 1];
    if (!rule && typeof prev === "string") segments[segments.length - 1] = prev + text;
    else if (rule && Array.isArray(prev) && prev[0] === rule) prev[1] += text;
    else segments.push(rule ? [rule, text] : text);
  };
  const token = /<tajweed class=([a-z_]+)>|<\/tajweed>|[^<]+/g;
  let consumed = 0;
  for (const match of body.matchAll(token)) {
    if (match.index !== consumed) throw new Error(`Unparsed markup in: ${body}`);
    consumed += match[0].length;
    if (match[1]) stack.push(match[1]);
    else if (match[0] === "</tajweed>") stack.pop();
    else push(match[0]);
  }
  if (consumed !== body.length || stack.length) throw new Error(`Unparsed markup in: ${body}`);
  return keepClustersWhole(segments);
}

const leadingMarks = /^\p{M}+/u;
const lastCluster = /\P{M}\p{M}*$/u;

/**
 * A run that starts with a vowel or madd mark, cut off from its letter, renders
 * as a dotted circle. Keep every letter with its marks in one run: a coloured
 * run takes in the letter its first mark sits on, and marks that trail a
 * coloured run join it.
 */
function keepClustersWhole(segments) {
  const out = segments.map((s) => (typeof s === "string" ? s : [...s]));
  for (let i = 1; i < out.length; i++) {
    const text = (s) => (typeof s === "string" ? s : s[1]);
    const setText = (j, value) => (typeof out[j] === "string" ? (out[j] = value) : (out[j][1] = value));
    const marks = text(out[i]).match(leadingMarks)?.[0];
    if (!marks) continue;
    if (Array.isArray(out[i - 1])) {
      // Trailing marks join the coloured run before them.
      setText(i - 1, text(out[i - 1]) + marks);
      setText(i, text(out[i]).slice(marks.length));
      // A run that was only marks is now empty; drop it so the next run sees its real neighbour.
      if (!text(out[i])) out.splice(i--, 1);
    } else {
      // A coloured run starting with a mark takes in the letter before it.
      const cluster = text(out[i - 1]).match(lastCluster)?.[0];
      if (!cluster) continue;
      setText(i - 1, text(out[i - 1]).slice(0, -cluster.length));
      setText(i, cluster + text(out[i]));
    }
  }
  return out.filter((s) => text(s).length > 0);

  function text(s) {
    return typeof s === "string" ? s : s[1];
  }
}

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url);
  if (res.ok) return res.json();
  if (attempt < 4) {
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return fetchJson(url, attempt + 1);
  }
  throw new Error(`${res.status} ${url}`);
}

// Pass variant names to fetch only those, e.g. `node scripts/fetch-quran-text.mjs tajweed`.
const only = process.argv.slice(2);
for (const { dir, endpoint, field, transform } of variants.filter((v) => !only.length || only.includes(v.dir))) {
  await mkdir(join(root, dir), { recursive: true });
  for (let surah = 1; surah <= 114; surah++) {
    const { verses } = await fetchJson(`${api}/${endpoint}?chapter_number=${surah}`);
    const ayat = verses.map((v) => transform(v[field]));
    await writeFile(join(root, dir, `${surah}.json`), JSON.stringify(ayat));
  }
  console.log(`${dir}: 114 surahs`);
}
