// Builds data/topic-distribution.json from YOUR privately tagged list of reference problems.
// Input: a CSV in the problem bank's format (header optional):
//   contest,year,number,answer,topic,techniques[,status]     (tags separated by ";")
// Only aggregate shares are written: no problem text, contest names, years or numbers.
//   node scripts/build-topic-distribution.mjs path/to/tagged.csv
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/build-topic-distribution.mjs <tagged.csv>");
  process.exit(1);
}
const bucket = (n) => (n <= 10 ? "1-10" : n <= 20 ? "11-20" : "21-25");
const tags = (s) => s.split(";").map((t) => t.trim().toLowerCase().replace(/[\s-]+/g, "_")).filter(Boolean);
const rows = readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim())).filter((r) => r.length >= 6 && /^\d+$/.test(r[2]));
if (!rows.length) {
  console.error("No usable rows found.");
  process.exit(1);
}
const topics = {};
const techniques = {};
const perBucket = {};
for (const r of rows) {
  const b = bucket(Number(r[2]));
  perBucket[b] = (perBucket[b] ?? 0) + 1;
  for (const t of tags(r[4])) {
    topics[t] ??= { count: 0, byPosition: {} };
    topics[t].count++;
    topics[t].byPosition[b] = (topics[t].byPosition[b] ?? 0) + 1;
  }
  for (const t of tags(r[5])) techniques[t] = (techniques[t] ?? 0) + 1;
}
const round = (x) => Math.round(x * 1000) / 1000;
const totalTopicTags = Object.values(topics).reduce((s, t) => s + t.count, 0);
const out = {
  _meta: { provisional: false, note: "Built from privately tagged reference problems. Aggregate shares only.", problemsTagged: rows.length, generatedBy: "scripts/build-topic-distribution.mjs" },
  topics: Object.fromEntries(Object.entries(topics).map(([t, x]) => [t, {
    weight: round(x.count / totalTopicTags),
    byPosition: Object.fromEntries(["1-10", "11-20", "21-25"].map((b) => [b, round((x.byPosition[b] ?? 0) / (perBucket[b] || 1))])),
  }])),
  techniques: Object.fromEntries(Object.entries(techniques).sort((a, b) => b[1] - a[1]).map(([t, c]) => [t, round(c / rows.length)])),
};
const target = new URL("../data/topic-distribution.json", import.meta.url);
writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote data/topic-distribution.json from ${rows.length} tagged problems.`);
