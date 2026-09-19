#!/usr/bin/env node
// Splits the mewcodex source DBs into compact tuple JSON under public/data/.
//
// Source of truth: ../archive/mewcodex.github.io/{items_db.json,set_bonuses_db.json}
// (the sibling archive/ folder contains a clone of mewcodex.github.io).
//
// Compact tuple format (documented in src/types.ts):
//   item:  [code, name, kind, rarity, setIdx[], flags, frame]
//          flags bitfield: 1=consumable, 2=cursed
//          frame = icon ID (matches public/icons/<kind>/<frame>.png)
//          setIdx contains positional indices into the sets array; -1 = wildcard
//   set:   [code, desc]
//
// Item kinds we emit: head, face, neck, trinket, weapon. The source also has
// "modifier" — those are mod consumables, not equippable, so we drop them
// (the tracker's whole storage model is around 5 equip slots).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const codexRoot = resolve(projectRoot, "..", "archive", "mewcodex.github.io");

const itemsSrc = resolve(codexRoot, "items_db.json");
const setsSrc = resolve(codexRoot, "set_bonuses_db.json");
const itemsOut = resolve(projectRoot, "public/data/items.json");
const setsOut = resolve(projectRoot, "public/data/sets.json");

const EQUIP_KINDS = new Set(["head", "face", "neck", "trinket", "weapon"]);

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(
      `Failed to parse ${label} (${path}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

const itemsRaw = readJson(itemsSrc, "items_db.json");
const setsRaw = readJson(setsSrc, "set_bonuses_db.json");
if (!Array.isArray(itemsRaw))
  throw new Error("items_db.json: expected array root");
if (!Array.isArray(setsRaw?.set_bonuses))
  throw new Error("set_bonuses_db.json: expected { set_bonuses: [...] }");

// Build set tuples + a code → idx map.
const sets = setsRaw.set_bonuses.map((s) => {
  const desc = s?.desc_texts?.en ?? "";
  return [s.set_code, desc];
});
const setCodeToIdx = new Map();
for (const [idx, [code]] of sets.entries()) setCodeToIdx.set(code, idx);

// Build item tuples; skip non-equippable kinds (modifiers).
const items = [];
let droppedKinds = 0;
let missingFrame = 0;
for (const it of itemsRaw) {
  if (!EQUIP_KINDS.has(it.kind)) {
    droppedKinds++;
    continue;
  }
  if (typeof it.frame !== "number") {
    missingFrame++;
    continue;
  }
  const setIdx = [];
  for (const code of it.sets ?? []) {
    if (code === "Wildcard") {
      setIdx.push(-1);
      continue;
    }
    const idx = setCodeToIdx.get(code);
    if (typeof idx === "number") setIdx.push(idx);
  }
  // Preserve the wildcard semantics from the legacy dataset:
  // RuneofPerthro is the only wildcard; mewcodex source records it via the
  // sets array, but in case the field shape changes, keep an explicit fallback.
  if (it.item_code === "RuneofPerthro" && !setIdx.includes(-1)) {
    setIdx.length = 0;
    setIdx.push(-1);
  }
  let flags = 0;
  if (it.is_consumable) flags |= 1;
  if (it.cursed) flags |= 2;
  items.push([
    it.item_code,
    it.item_name,
    it.kind,
    it.rarity ?? "none",
    setIdx,
    flags,
    it.frame,
  ]);
}

for (const t of items) {
  if (t.length !== 7)
    throw new Error(`Item tuple length != 7: ${JSON.stringify(t)}`);
}
for (const s of sets) {
  if (s.length !== 2)
    throw new Error(`Set tuple length != 2: ${JSON.stringify(s)}`);
}

mkdirSync(dirname(itemsOut), { recursive: true });
writeFileSync(itemsOut, JSON.stringify(items));
writeFileSync(setsOut, JSON.stringify(sets));

console.log(
  `Items: ${items.length} written (dropped ${droppedKinds} non-equip kinds, ${missingFrame} missing frame)`,
);
console.log(`Sets: ${sets.length} written`);
console.log(`→ ${itemsOut}`);
console.log(`→ ${setsOut}`);
