#!/usr/bin/env node
/**
 * CLI do status do projeto — alternativa ao MCP.
 *
 * Existe porque nem todo agente/harness carrega MCP. Sem isto, um agente sem
 * MCP acaba lendo o código-fonte do servidor e chamando funções por fora com
 * `node -e`, o que pula o lock de escrita e as validações.
 *
 * Passa exatamente pelas mesmas validações e pelo mesmo lock que o MCP.
 *
 *   node mcp/status-server/scripts/cli.js brief
 *   node mcp/status-server/scripts/cli.js next fase-1
 *   node mcp/status-server/scripts/cli.js set db.setup doing --agent gemini --notes "..."
 *   node mcp/status-server/scripts/cli.js decision --agent gemini --title "..." --decision "..."
 *   node mcp/status-server/scripts/cli.js blocker --agent gemini --desc "..." [--component db.setup]
 *   node mcp/status-server/scripts/cli.js session --agent gemini --summary "..." [--touched a,b]
 *   node mcp/status-server/scripts/cli.js history [20]
 */

import { loadState, mutateState, readLog, nextId, PROJECT_ROOT } from "../lib/state.js";
import { verificarPortao } from "../lib/gates.js";
import { PHASES, PHASE_LABEL, STATUS, STATUS_ICON } from "../lib/schema.js";
import { blockingDeps } from "../lib/plan.js";

// Erro de validação é informação útil, não crash: mostra só a mensagem,
// sem stack trace, para não poluir o contexto de quem estiver lendo.
const onErro = (err) => {
  console.error(`ERRO: ${err?.message || err}`);
  process.exit(1);
};
process.on("uncaughtException", onErro);
process.on("unhandledRejection", onErro);

const argv = process.argv.slice(2);
const cmd = argv[0];

/** Lê --flag valor de qualquer posição. */
function flag(name, required = false) {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (required && !v) {
    console.error(`ERRO: faltou --${name}`);
    process.exit(1);
  }
  return v;
}

const die = (msg) => {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
};

switch (cmd) {
  case "brief": {
    const s = await loadState();
    const comps = s.components;
    const open = s.blockers.filter((b) => !b.resolvedAt);
    const doing = comps.filter((c) => c.status === "doing");
    const todo = comps.filter((c) => c.status === "todo");
    const done = comps.filter((c) => c.status === "done");
    const ativos = comps.filter((c) => c.status !== "deprecated");

    console.log(`# ${s.project} — brief`);
    console.log(`Objetivo: ${s.goal}`);
    console.log(`Progresso: ${done.length}/${ativos.length} concluídos. Atualizado por ${s.updatedBy} em ${s.updatedAt}.`);

    console.log(`\n## Progresso por fase`);
    for (const p of PHASES) {
      const inP = comps.filter((c) => c.phase === p && c.status !== "deprecated");
      if (!inP.length) continue;
      const d = inP.filter((c) => c.status === "done").length;
      console.log(`- ${PHASE_LABEL[p]} — ${d}/${inP.length}${d === inP.length ? " OK" : ""}`);
    }

    console.log(`\n## Em andamento (${doing.length})`);
    console.log(doing.map((c) => `- ${c.id} ${c.name} (${c.owner})`).join("\n") || "- nada");

    console.log(`\n## Bloqueios abertos (${open.length})`);
    console.log(open.map((b) => `- ${b.id}: ${b.description}`).join("\n") || "- nenhum");

    const livres = todo.filter((c) => blockingDeps(c.id, comps).length === 0);
    console.log(`\n## Pode pegar agora (${livres.length})`);
    console.log(livres.slice(0, 10).map((c) => `- ${c.id} [${c.phase}] ${c.name}`).join("\n") || "- nada liberado");

    // Não listar ADR já revogada por outra — ver comentário em index.js.
    const revogadas = new Set(s.decisions.map((d) => d.supersedes).filter(Boolean));
    const vigentes = s.decisions.filter((d) => !revogadas.has(d.id));
    console.log(`\n## Decisões vigentes (${vigentes.length})`);
    console.log(vigentes.map((d) => `- ${d.id}: ${d.title} -> ${d.decision}`).join("\n"));

    console.log(`\n## Invariantes`);
    console.log(s.invariants.map((i) => `- ${i}`).join("\n"));

    if (s.sessions.length) {
      const u = s.sessions[s.sessions.length - 1];
      console.log(`\n## Última sessão\n- ${u.at} [${u.agent}] ${u.summary}`);
    }
    break;
  }

  case "next": {
    const phase = argv[1];
    if (phase && !PHASES.includes(phase)) die(`fase inválida. Use uma de: ${PHASES.join(", ")}`);
    const s = await loadState();
    const scope = phase ? s.components.filter((c) => c.phase === phase) : s.components;
    const pend = scope.filter((c) => c.status === "todo" || c.status === "blocked");
    const ready = [];
    const waiting = [];
    for (const c of pend) {
      const b = blockingDeps(c.id, s.components);
      (b.length ? waiting : ready).push({ c, b });
    }

    if (phase) {
      const ativos = scope.filter((c) => c.status !== "deprecated");
      console.log(`# ${PHASE_LABEL[phase]}`);
      console.log(`Progresso: ${scope.filter((c) => c.status === "done").length}/${ativos.length}\n`);
    }
    console.log(`## Pode pegar agora (${ready.length})`);
    console.log(ready.map(({ c }) => `- ${c.id} — ${c.name}${c.notes ? `\n    ${c.notes}` : ""}`).join("\n") || "- nada liberado");

    if (waiting.length) {
      console.log(`\n## Aguardando dependência (${waiting.length})`);
      console.log(waiting.map(({ c, b }) => `- ${c.id} ${c.name} — espera: ${b.join(", ")}`).join("\n"));
    }
    const doing = scope.filter((c) => c.status === "doing");
    if (doing.length) {
      console.log(`\n## Já em andamento — não pegue (${doing.length})`);
      console.log(doing.map((c) => `- ${c.id} (${c.owner})`).join("\n"));
    }
    break;
  }

  case "set": {
    const [, id, status] = argv;
    if (!id || !status) die("uso: set <id> <status> --agent <nome> [--notes ...] [--evidence ...]");
    if (!STATUS.includes(status)) die(`status inválido "${status}". Use: ${STATUS.join(" | ")}`);
    const agent = flag("agent", true);
    const notes = flag("notes");
    const evidence = flag("evidence");

    if (status === "done") {
      const ev = (evidence || "").trim();
      if (ev.length < 12) {
        die(
          `Para marcar "${id}" como done, passe --evidence com o COMANDO que você rodou e que passou.\n` +
            `  Ex.: --evidence "npx drizzle-kit generate -> 0000_init.sql, 29 tabelas"\n` +
            `  Se você só escreveu o arquivo e não executou nada, o status correto é "doing".`
        );
      }
      // Mesmo portão automático do MCP: o CLI não pode ser a porta dos fundos.
      try {
        verificarPortao(id, PROJECT_ROOT);
      } catch (e) {
        die(e.message);
      }
    }

    const { result } = await mutateState(agent, (s) => {
      const c = s.components.find((x) => x.id === id);
      if (!c) {
        const near = s.components.map((x) => x.id).filter((x) => x.startsWith(id.split(".")[0])).slice(0, 8);
        throw new Error(`Componente "${id}" não existe.${near.length ? ` Parecidos: ${near.join(", ")}` : ""}`);
      }
      const from = c.status;
      let aviso = "";
      if (status === "doing" || status === "done") {
        const b = blockingDeps(id, s.components);
        if (b.length) aviso = `\nATENÇÃO: depende de ${b.join(", ")}, ainda não concluído. Se é intencional, registre com "decision".`;
      }
      c.status = status;
      c.owner = agent;
      c.updatedAt = new Date().toISOString();
      if (notes !== undefined) c.notes = notes;
      if (evidence !== undefined) c.evidence = evidence;
      return {
        event: "set_component_status",
        detail: { id, from, to: status, notes, evidence },
        result: `${id} ${STATUS_ICON[from]} ${from} -> ${STATUS_ICON[status]} ${status}${aviso}`,
      };
    });
    console.log(result);
    break;
  }

  case "decision": {
    const agent = flag("agent", true);
    const title = flag("title", true);
    const decision = flag("decision", true);
    const rationale = flag("rationale") || "";
    const supersedes = flag("supersedes") || null;
    const { result } = await mutateState(agent, (s) => {
      if (supersedes && !s.decisions.some((d) => d.id === supersedes)) throw new Error(`ADR "${supersedes}" não existe.`);
      const id = nextId(s.decisions, "ADR");
      s.decisions.push({ id, date: new Date().toISOString(), author: agent, title, decision, rationale, supersedes });
      return { event: "add_decision", detail: { id, title }, result: id };
    });
    console.log(`Decisão registrada como ${result}.`);
    break;
  }

  case "blocker": {
    const agent = flag("agent", true);
    const description = flag("desc", true);
    const component = flag("component") || null;
    const { result } = await mutateState(agent, (s) => {
      const id = nextId(s.blockers, "BLK");
      s.blockers.push({
        id, description, component,
        openedBy: agent, openedAt: new Date().toISOString(),
        resolvedAt: null, resolution: null,
      });
      if (component) {
        const c = s.components.find((x) => x.id === component);
        if (c) c.status = "blocked";
      }
      return { event: "add_blocker", detail: { id, component }, result: id };
    });
    console.log(`Bloqueio ${result} registrado.`);
    break;
  }

  case "resolve": {
    const agent = flag("agent", true);
    const id = argv[1] || flag("id", true);
    const resolution = flag("resolution", true);
    await mutateState(agent, (s) => {
      const b = s.blockers.find((x) => x.id === id);
      if (!b) throw new Error(`Bloqueio "${id}" não existe.`);
      b.resolvedAt = new Date().toISOString();
      b.resolution = resolution;
      return { event: "resolve_blocker", detail: { id } };
    });
    console.log(`Bloqueio ${id} resolvido.`);
    break;
  }

  case "session": {
    const agent = flag("agent", true);
    const summary = flag("summary", true);
    const touched = (flag("touched") || "").split(",").map((x) => x.trim()).filter(Boolean);
    await mutateState(agent, (s) => {
      s.sessions.push({ at: new Date().toISOString(), agent, summary, touched });
      return { event: "log_session", detail: { summary } };
    });
    console.log("Sessão registrada. statusdoprojeto.md atualizado.");
    break;
  }

  case "history": {
    const entries = await readLog(Number(argv[1]) || 20);
    console.log(
      entries
        .map(({ at, agent, event, ...d }) => {
          const extra = Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ");
          return `${at} [${agent}] ${event}${extra ? ` · ${extra}` : ""}`;
        })
        .join("\n") || "Log vazio."
    );
    break;
  }

  default:
    console.log(`Status do projeto M7Arena — CLI

  brief                                  panorama (chame ao iniciar)
  next [fase]                            o que dá para pegar agora
  set <id> <status> --agent X            muda status (--notes, --evidence)
  decision --agent X --title T --decision D [--rationale R] [--supersedes ADR-00N]
  blocker  --agent X --desc D [--component id]
  resolve  <BLK-00N> --agent X --resolution R
  session  --agent X --summary S [--touched a,b,c]
  history [n]

Fases: ${PHASES.join(", ")}
Status: ${STATUS.join(", ")}

Prefira o MCP m7-status quando ele estiver disponível na sua sessão.`);
}
