#!/usr/bin/env node
/**
 * Conta o que ainda fala com o Supabase dentro de web/src.
 *
 * Existe porque `tsc --noEmit exit 0` passa lindamente numa API que ninguém
 * importa: em 2026-08-02 os 8 app.swap.* foram marcados done com endpoints
 * escritos e ZERO call sites migrados. Este script torna a evidência um número
 * que não dá para fabricar — ou o contador caiu, ou o swap não aconteceu.
 *
 * Uso:
 *   node scripts/verify-swap.js              → relatório completo
 *   node scripts/verify-swap.js identidade   → só um domínio
 *   node scripts/verify-swap.js --strict     → exit 1 se sobrou qualquer coisa
 *
 * NÃO troque isto por `grep`/`rg`. A contagem é feita sobre o arquivo inteiro,
 * de propósito: a maior parte das chamadas é quebrada em duas linhas —
 *
 *     supabase
 *       .from('contas_riot')
 *
 * — e ferramenta line-based não enxerga essas. Em identidade, `rg` acha 14 onde
 * existem 35. Se o número aqui divergir de um grep seu, o grep é que está errado.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const WEB = join(ROOT, "web", "src");

/** Cada domínio de swap e as tabelas/APIs que ele é responsável por eliminar. */
const DOMINIOS = {
  "app.swap.identidade": {
    tabelas: ["profiles", "contas_riot", "discord_links", "discord_oauth_state"],
  },
  "app.swap.times": { tabelas: ["times", "time_membros", "time_convites"] },
  "app.swap.campeonatos": { tabelas: ["campeonatos"] },
  "app.swap.salas": { tabelas: ["salas", "sala_jogadores"] },
  "app.swap.carteira": { tabelas: ["wallets", "ganhos_plataforma"] },
  "app.swap.conteudo": { tabelas: ["noticias", "highlights", "player_stats"] },
  "app.auth.sessao": {
    padrao: /supabase\.auth\.\w+/g,
    rotulo: "supabase.auth.*",
    // DepositModal e VipModal chamam getSession() só para pegar um Bearer token
    // para as edge functions de pagamento. Isso não é gestão de sessão: é
    // encanamento do Mercado Pago, e some quando create-mercado-pago-order virar
    // rota da API. Contar em app.auth.sessao criaria um impasse — auth nunca
    // fecharia, e como todos os swaps dependem dele, nada andaria.
    // Estes arquivos são cobrados em app.edge-functions, abaixo.
    pularArquivosCom: /functions\/v1\//,
  },
  "app.swap.rpc": { padrao: /supabase\.rpc\(/g, rotulo: "supabase.rpc()" },
  "app.storage.uploads": { padrao: /supabase\.storage/g, rotulo: "supabase.storage" },
  "app.edge-functions": {
    // Conta a chamada à edge function E o getSession que existe só para
    // autenticá-la — os dois somem juntos quando a função virar rota da API.
    padrao: /functions\/v1\/|supabase\.auth\.getSession/g,
    rotulo: "functions/v1/ + o getSession que as alimenta",
    soEmArquivosCom: /functions\/v1\//,
  },
};

/** Coisas que não pertencem a nenhum swap mas também têm que sumir. */
const EXTRAS = {
  "client Supabase instanciado": /createClient\s*\(/g,
  "VITE_SUPABASE_*": /VITE_SUPABASE_\w+/g,
};

function arquivos(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === "dist") continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.(tsx?|jsx?)$/.test(nome)) out.push(p);
  }
  return out;
}

function contar(texto, regex) {
  return (texto.match(regex) || []).length;
}

// argv[0] é o executável do node e argv[1] este arquivo — só o resto é argumento.
const args = process.argv.slice(2);
const filtro = args.find((a) => !a.startsWith("-"));
const strict = args.includes("--strict");

if (!existsSync(WEB)) {
  console.error(`web/src não existe em ${WEB}. O fork (app.fork.copia) rodou?`);
  process.exit(2);
}

const lista = arquivos(WEB);
const fontes = lista.map((f) => ({ f, txt: readFileSync(f, "utf8") }));

console.log(`\nVarrendo ${lista.length} arquivos em web/src\n`);

let totalGeral = 0;
const pendentes = [];

for (const [componente, spec] of Object.entries(DOMINIOS)) {
  if (filtro && !componente.includes(filtro)) continue;

  let total = 0;
  const porArquivo = new Map();

  for (const { f, txt } of fontes) {
    // Um mesmo call site só pode pertencer a um dono, senão o total mente.
    if (spec.pularArquivosCom && spec.pularArquivosCom.test(txt)) continue;
    if (spec.soEmArquivosCom && !spec.soEmArquivosCom.test(txt)) continue;

    let n = 0;
    if (spec.padrao) {
      n = contar(txt, spec.padrao);
    } else {
      for (const t of spec.tabelas) {
        n += contar(txt, new RegExp(`supabase\\s*\\.\\s*from\\(\\s*['"\`]${t}['"\`]`, "g"));
      }
    }
    if (n > 0) porArquivo.set(relative(ROOT, f), n);
    total += n;
  }

  totalGeral += total;
  const alvo = spec.rotulo || spec.tabelas.join(", ");
  const marca = total === 0 ? "OK  " : "FALTA";
  console.log(`${marca} ${componente.padEnd(22)} ${String(total).padStart(3)}  (${alvo})`);

  if (total > 0) {
    pendentes.push(componente);
    for (const [arq, n] of [...porArquivo].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`        ${String(n).padStart(3)}  ${arq}`);
    }
  }
}

if (!filtro) {
  console.log("");
  for (const [rotulo, padrao] of Object.entries(EXTRAS)) {
    const n = fontes.reduce((acc, { txt }) => acc + contar(txt, padrao), 0);
    totalGeral += n;
    console.log(`${n === 0 ? "OK  " : "FALTA"} ${rotulo.padEnd(22)} ${String(n).padStart(3)}`);
  }
}

console.log(`\n${"─".repeat(52)}`);
console.log(`Pendente: ${totalGeral} ocorrência(s).`);

if (totalGeral === 0) {
  console.log("web/src não fala mais com o Supabase.\n");
} else {
  console.log(`Componentes que NÃO podem ser marcados done: ${pendentes.join(", ") || "—"}\n`);
}

process.exit(strict && totalGeral > 0 ? 1 : 0);
