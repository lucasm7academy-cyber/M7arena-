// scripts/gerar-posicoes-campeoes.mjs — gera o mapa de posições do filtro de
// rota do draft (web/src/components/draft/championPositions.ts).
//
// Fonte: Meraki Analytics (posições recomendadas por campeão, as mesmas que o
// client do LoL usa no filtro de rota). Roda UMA vez e o resultado é commitado —
// o draft não depende de API externa em runtime para filtrar.
//
// Uso (da raiz do repo): node scripts/gerar-posicoes-campeoes.mjs
import { writeFileSync } from "node:fs";

const MERAKI = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json";
const posMap = { TOP: "TOP", JUNGLE: "JG", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUP", SUPPORT: "SUP" };

// O DDragon é a MESMA lista que o draft carrega (data keyed pelo id "Aatrox").
const vs = await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json();
const dd = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${vs[0]}/data/pt_BR/champion.json`)).json();

const mer = await (await fetch(MERAKI)).json();
const mapa = {};
const desconhecidas = new Set();
const semDdragon = [];
for (const c of Object.values(mer)) {
  const entrada = dd.data[c.key]; // casa pelo id do DDragon ("Aatrox", "KSante", ...)
  if (!entrada) { semDdragon.push(c.key); continue; }
  const pos = (c.positions || []).map((p) => {
    if (!posMap[p]) desconhecidas.add(p);
    return posMap[p];
  }).filter(Boolean);
  mapa[entrada.key] = pos;
}
if (desconhecidas.size) console.log(`posições desconhecidas no meraki: ${[...desconhecidas].join(",")}`);
if (semDdragon.length) console.log(`sem par no ddragon (ignorados): ${semDdragon.join(",")}`);

// Campeões novos que ainda não estão na base do Meraki na data da geração —
// posição definida pelo roles/tacticalInfo do próprio client (CommunityDragon).
// Ao regenerar: se o Meraki já tiver o campeão, remova a entrada daqui.
const OVERRIDES = {
  "805": ["MID"], // Locke — assassino/mago (client: assassin,mage)
  "904": ["TOP"], // Zaahen — lutador (client: fighter)
};
for (const [k, v] of Object.entries(OVERRIDES)) {
  if (Object.values(dd.data).some((c) => c.key === k)) mapa[k] = v;
}

const ddKeys = new Set(Object.values(dd.data).map((c) => c.key));
const faltam = [...ddKeys].filter((k) => !(k in mapa));
const sobra = Object.keys(mapa).filter((k) => !ddKeys.has(k));

const cnt = {};
Object.values(mapa).forEach((a) => a.forEach((p) => (cnt[p] = (cnt[p] || 0) + 1)));
console.log(`ddragon ${vs[0]}: ${ddKeys.size} campeões | meraki: ${Object.keys(mapa).length}`);
console.log(`sem posição no meraki: ${faltam.length}${faltam.length ? " -> " + faltam.join(",") : ""}`);
console.log(`no meraki e fora do ddragon: ${sobra.length}${sobra.length ? " -> " + sobra.join(",") : ""}`);
console.log(`por rota: ${JSON.stringify(cnt)}`);

const linhas = Object.keys(mapa)
  .sort((a, b) => Number(a) - Number(b))
  .map((k) => `  "${k}": [${mapa[k].map((p) => `'${p}'`).join(", ")}],`)
  .join("\n");

const out = `// GERADO por scripts/gerar-posicoes-campeoes.mjs — NÃO editar à mão.
// Posições reais dos campeões (as do filtro de rota do client do LoL), chave =
// id numérico do campeão (o \`key\` do DDragon). Fonte: Meraki Analytics.
export type RoleFiltro = 'TOP' | 'JG' | 'MID' | 'ADC' | 'SUP';

export const CHAMPION_POSITIONS: Record<string, RoleFiltro[]> = {
${linhas}
};
`;
writeFileSync("web/src/components/draft/championPositions.ts", out);
console.log(`arquivo gerado: web/src/components/draft/championPositions.ts (${out.length} bytes)`);
