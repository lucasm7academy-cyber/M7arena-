/**
 * Renderiza o statusdoprojeto.md a partir do project-state.json.
 *
 * Este é o único lugar do sistema que escreve markdown. Nenhum agente formata
 * nada à mão — é o que garante que o arquivo tenha o mesmo formato
 * independente de quem trabalhou (Claude, Gemini, DeepSeek...).
 */

import {
  AREA_LABEL,
  AREA_ORDER,
  STATUS,
  STATUS_ICON,
  STATUS_LABEL,
} from "./schema.js";

const BANNER = `<!--
  ============================================================================
  ARQUIVO GERADO AUTOMATICAMENTE — NÃO EDITE À MÃO.
  Qualquer edição manual é perdida na próxima escrita via MCP.

  Para alterar o status do projeto use as tools do MCP "m7-status":
    status_brief          → ler (primeira coisa de toda sessão)
    set_component_status  → mudar o status de um componente
    add_decision          → registrar uma decisão (ADR)
    add_blocker           → registrar um impedimento
    log_session           → registrar o que você fez (última coisa da sessão)

  Fonte da verdade: docs/project-state.json
  Histórico:        docs/status-log.jsonl
  ============================================================================
-->`;

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function progressBar(done, total, width = 20) {
  if (total === 0) return "—";
  const filled = Math.round((done / total) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${done}/${total}`;
}

function countsByArea(components) {
  const map = new Map();
  for (const c of components) {
    if (!map.has(c.area)) {
      map.set(c.area, Object.fromEntries(STATUS.map((s) => [s, 0])));
    }
    map.get(c.area)[c.status]++;
  }
  return map;
}

export function render(state) {
  const out = [];
  const components = state.components || [];
  const decisions = state.decisions || [];
  const blockers = state.blockers || [];
  const sessions = state.sessions || [];
  const openBlockers = blockers.filter((b) => !b.resolvedAt);

  out.push(BANNER, "");
  out.push(`# Status do Projeto ${state.project || "M7Arena"}`, "");
  out.push(
    `**Última atualização:** ${fmtDate(state.updatedAt)} — por \`${
      state.updatedBy || "?"
    }\``
  );
  if (state.goal) out.push("", `**Objetivo:** ${state.goal}`);
  out.push("");

  // ------------------------------------------------------------ resumo
  const counts = countsByArea(components);
  const totalDone = components.filter((c) => c.status === "done").length;
  const totalActive = components.filter((c) => c.status !== "deprecated").length;

  out.push("## Panorama", "");
  out.push(`\`${progressBar(totalDone, totalActive, 28)}\` concluído`, "");
  out.push("| Área | Progresso | Em andamento | Bloqueado |");
  out.push("|---|---|---|---|");
  for (const area of AREA_ORDER) {
    const c = counts.get(area);
    if (!c) continue;
    const active = c.todo + c.doing + c.done + c.blocked;
    out.push(
      `| ${AREA_LABEL[area]} | ${progressBar(c.done, active, 12)} | ${
        c.doing || "—"
      } | ${c.blocked || "—"} |`
    );
  }
  out.push("");

  // --------------------------------------------------------- bloqueios
  if (openBlockers.length) {
    out.push("## ⚠️ Bloqueios abertos", "");
    for (const b of openBlockers) {
      out.push(
        `- **${b.id}** ${b.component ? `(\`${b.component}\`) ` : ""}— ${
          b.description
        }`
      );
      out.push(
        `  <br>_aberto por ${b.openedBy} em ${fmtDate(b.openedAt)}_`
      );
    }
    out.push("");
  }

  // ----------------------------------------------------- em andamento
  const doing = components.filter((c) => c.status === "doing");
  if (doing.length) {
    out.push("## Em andamento agora", "");
    for (const c of doing) {
      out.push(
        `- \`${c.id}\` **${c.name}** — ${c.owner || "sem dono"}${
          c.notes ? ` · ${c.notes}` : ""
        }`
      );
    }
    out.push("");
  }

  // ------------------------------------------------------- componentes
  out.push("## Componentes", "");
  out.push(
    `Legenda: ${STATUS.map((s) => `\`${STATUS_ICON[s]}\` ${STATUS_LABEL[s]}`).join(
      " · "
    )}`,
    ""
  );

  for (const area of AREA_ORDER) {
    const items = components.filter((c) => c.area === area);
    if (!items.length) continue;

    out.push(`### ${AREA_LABEL[area]}`, "");
    for (const c of items) {
      let line = `- \`${STATUS_ICON[c.status]}\` **${c.name}** \`${c.id}\``;
      if (c.notes) line += `<br>  ${c.notes}`;
      if (c.evidence) line += `<br>  _evidência:_ \`${c.evidence}\``;
      if (c.status === "done" && c.updatedAt) {
        line += `<br>  _concluído ${fmtDate(c.updatedAt)} por ${c.owner || "?"}_`;
      }
      out.push(line);
    }
    out.push("");
  }

  // ---------------------------------------------------------- decisões
  if (decisions.length) {
    out.push("## Decisões (ADR)", "");
    for (const d of decisions) {
      const revogada = decisions.find((x) => x.supersedes === d.id);
      out.push(
        `### ${d.id} — ${d.title}${revogada ? ` ⛔ _(revogada por ${revogada.id})_` : ""}`
      );
      out.push("");
      out.push(`**Decisão:** ${d.decision}`);
      if (d.rationale) out.push("", `**Por quê:** ${d.rationale}`);
      out.push("", `_${fmtDate(d.date)} — ${d.author || "?"}_`, "");
    }
  }

  // ------------------------------------------------- bloqueios resolvidos
  const closed = blockers.filter((b) => b.resolvedAt);
  if (closed.length) {
    out.push("## Bloqueios resolvidos", "");
    for (const b of closed) {
      out.push(`- ~~**${b.id}** — ${b.description}~~ → ${b.resolution}`);
    }
    out.push("");
  }

  // ---------------------------------------------------------- sessões
  if (sessions.length) {
    out.push("## Histórico de sessões", "");
    out.push("| Quando | Agente | O que fez |");
    out.push("|---|---|---|");
    for (const s of [...sessions].reverse().slice(0, 15)) {
      const touched = s.touched?.length
        ? ` <br>_tocou: ${s.touched.map((t) => `\`${t}\``).join(", ")}_`
        : "";
      out.push(
        `| ${fmtDate(s.at)} | ${s.agent} | ${s.summary}${touched} |`
      );
    }
    out.push("");
  }

  out.push("---", "");
  out.push(
    "_Gerado pelo MCP `m7-status`. Regras para agentes: veja `AGENTS.md` na raiz._"
  );

  return out.join("\n") + "\n";
}
