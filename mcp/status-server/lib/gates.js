import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Portões automáticos de "done".
 *
 * Por que isto existe: a checagem antiga só media o TAMANHO da string de
 * evidência. Em 2026-08-02 um agente marcou 14 componentes como done passando
 * frases perfeitamente convincentes ("endpoints criados, npx tsc --noEmit exit
 * 0") — e o `tsc` passava mesmo, porque a API que ele escreveu compilava. Só que
 * nenhum arquivo do front tinha sido tocado. O painel dizia 58/58 com o app
 * inteiro ainda rodando no Supabase.
 *
 * A lição: evidência escrita pelo agente é a afirmação dele, não prova. Para
 * tarefa cujo sucesso é MENSURÁVEL, quem mede tem que ser o servidor.
 *
 * Aqui o MCP roda o verificador ele mesmo e recusa o done se o número não bateu.
 * Não dá para contornar com redação melhor.
 */

/** componente → domínio que o verify-swap.js entende */
const PORTOES_DE_SWAP = {
  "app.swap.identidade": "identidade",
  "app.swap.times": "times",
  "app.swap.campeonatos": "campeonatos",
  "app.swap.salas": "salas",
  "app.swap.carteira": "carteira",
  "app.swap.conteudo": "conteudo",
  "app.swap.rpc": "rpc",
  "app.storage.uploads": "storage",
  "app.auth.sessao": "auth",
  "app.edge-functions": "edge",
};

/**
 * Roda o portão do componente, se houver um.
 * Lança com a saída real do verificador quando ainda há pendência.
 */
export function verificarPortao(id, projectRoot) {
  const dominio = PORTOES_DE_SWAP[id];
  if (!dominio) return null; // sem portão automático: segue com a checagem textual

  const script = path.join(projectRoot, "scripts", "verify-swap.js");
  if (!existsSync(script)) return null; // verificador ausente não pode virar bloqueio cego

  let saida;
  try {
    saida = execFileSync(process.execPath, [script, dominio], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 60_000,
    });
  } catch (err) {
    // exit != 0 ainda traz stdout útil; se nem isso, o erro sobe como está
    saida = err?.stdout || "";
    if (!saida) {
      throw new Error(
        `Não consegui executar o verificador de "${id}" (scripts/verify-swap.js): ${err?.message}. ` +
          `Conserte o verificador antes de marcar done.`
      );
    }
  }

  const m = saida.match(/Pendente:\s*(\d+)/);
  if (!m) {
    throw new Error(
      `O verificador rodou mas não devolveu a linha "Pendente: N". Saída:\n${saida.slice(0, 500)}`
    );
  }

  const pendente = Number(m[1]);
  if (pendente > 0) {
    throw new Error(
      `RECUSADO: "${id}" não pode ser done — ainda existem ${pendente} chamada(s) ao Supabase neste domínio.\n\n` +
        saida.trim() +
        `\n\nEscrever o endpoint na API NÃO é fazer o swap. O swap só existe quando o front deixa de chamar o Supabase. ` +
        `Enquanto o contador não zerar, o status correto é "doing".`
    );
  }

  return `verify-swap.js ${dominio} → 0 pendente (verificado pelo servidor)`;
}
