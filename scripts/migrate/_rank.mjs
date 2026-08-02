import fs from "fs";

const times = JSON.parse(fs.readFileSync("dump/times.json", "utf8"));
const sorted = [...times].sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999));
console.log("=== ORDEM ORIGINAL (ranking asc) ===");
sorted.forEach((t) =>
  console.log(`${String(t.ranking ?? "?").padStart(3)} | PDL ${String(t.pdl).padStart(4)} | ${t.nome} (${t.tag})`)
);
