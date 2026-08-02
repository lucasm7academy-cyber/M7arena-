#!/usr/bin/env node
/**
 * MCP "m7-status" — cérebro compartilhado do projeto M7Arena.
 *
 * Existe para que qualquer agente (Claude, Gemini, DeepSeek, Codex...) consiga
 * entrar no projeto a qualquer momento, entender o que já foi feito e registrar
 * o que fez — sem trabalhar no escuro e sem refazer coisa pronta.
 *
 * Princípio de design: nenhum agente escreve markdown livre. As tools abaixo são
 * operações tipadas sobre docs/project-state.json, e o statusdoprojeto.md é
 * *renderizado* a partir dele. É isso que mantém o formato idêntico entre agentes.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadState, mutateState, readLog, nextId, MD_PATH, PROJECT_ROOT } from "./lib/state.js";
import { verificarPortao } from "./lib/gates.js";
import {
  AREAS,
  AREA_LABEL,
  MAX_NOTES,
  MAX_SUMMARY,
  PHASES,
  PHASE_LABEL,
  STATUS,
  STATUS_ICON,
  STATUS_LABEL,
} from "./lib/schema.js";
import { blockingDeps, depsOf, phaseOf } from "./lib/plan.js";

const server = new McpServer({ name: "m7-status", version: "1.0.0" });

const text = (s) => ({ content: [{ type: "text", text: s }] });
const fail = (s) => ({ content: [{ type: "text", text: `ERRO: ${s}` }], isError: true });

const agentArg = z
  .string()
  .min(1)
  .describe("Quem está escrevendo: claude, gemini, deepseek, codex, humano...");

// ============================================================== LEITURA

server.tool(
  "status_brief",
  "PRIMEIRA COISA DE TODA SESSÃO. Resumo compacto do projeto: o que está em andamento, bloqueios abertos, últimas decisões e próximo passo sugerido. Use esta em vez de status_read para economizar contexto.",
  {},
  async () => {
    try {
      const s = await loadState();
      const comps = s.components || [];
      const open = (s.blockers || []).filter((b) => !b.resolvedAt);
      const doing = comps.filter((c) => c.status === "doing");
      const todo = comps.filter((c) => c.status === "todo");
      const done = comps.filter((c) => c.status === "done");
      const active = comps.filter((c) => c.status !== "deprecated");
      const lastSessions = (s.sessions || []).slice(-3).reverse();

      const L = [];
      L.push(`# ${s.project} — brief`);
      L.push(`Objetivo: ${s.goal}`);
      L.push(
        `Progresso: ${done.length}/${active.length} componentes concluídos. Atualizado por \`${s.updatedBy}\` em ${s.updatedAt}.`
      );

      L.push(`\n## Em andamento (${doing.length})`);
      L.push(
        doing.length
          ? doing
              .map((c) => `- \`${c.id}\` ${c.name} (${c.owner || "sem dono"})${c.notes ? ` — ${c.notes}` : ""}`)
              .join("\n")
          : "- nada em andamento"
      );

      L.push(`\n## Bloqueios abertos (${open.length})`);
      L.push(
        open.length
          ? open.map((b) => `- ${b.id} ${b.component ? `(${b.component})` : ""}: ${b.description}`).join("\n")
          : "- nenhum"
      );

      L.push(`\n## Progresso por fase`);
      for (const p of PHASES) {
        const inPhase = comps.filter((c) => c.phase === p && c.status !== "deprecated");
        if (!inPhase.length) continue;
        const d = inPhase.filter((c) => c.status === "done").length;
        const marca = d === inPhase.length ? " ✅" : "";
        L.push(`- **${PHASE_LABEL[p]}** — ${d}/${inPhase.length}${marca}`);
      }

      const liberados = todo.filter((c) => blockingDeps(c.id, comps).length === 0);
      L.push(`\n## Pode pegar agora (${liberados.length} liberados de ${todo.length} pendentes)`);
      L.push(
        liberados
          .slice(0, 8)
          .map((c) => `- \`${c.id}\` [${PHASE_LABEL[c.phase]?.split("—")[0].trim() || "?"}] ${c.name}`)
          .join("\n") || "- nada liberado"
      );
      L.push(`\nUse \`next_task\` (com o parâmetro phase) para a lista completa e o que está travado.`);

      // Uma ADR revogada não pode aparecer como vigente: um agente que lesse
      // "ADR-001: use Next.js" depois da ADR-010 faria o oposto do plano.
      const revogadas = new Set(
        (s.decisions || []).map((d) => d.supersedes).filter(Boolean)
      );
      const vigentes = (s.decisions || []).filter((d) => !revogadas.has(d.id));
      L.push(`\n## Decisões vigentes (${vigentes.length})`);
      L.push(
        vigentes.map((d) => `- ${d.id}: ${d.title} → ${d.decision}`).join("\n") ||
          "- nenhuma"
      );

      if (lastSessions.length) {
        L.push(`\n## Últimas sessões`);
        L.push(lastSessions.map((x) => `- ${x.at} [${x.agent}] ${x.summary}`).join("\n"));
      }

      if (s.invariants?.length) {
        L.push(`\n## Invariantes (valem sempre, não negociáveis)`);
        L.push(s.invariants.map((i) => `- ${i}`).join("\n"));
      }

      L.push(
        `\n---\nAo terminar seu trabalho, chame \`log_session\` e atualize os componentes com \`set_component_status\`.`
      );
      return text(L.join("\n"));
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "next_task",
  "Diz o que você pode pegar AGORA: componentes com todas as dependências satisfeitas. Use quando o usuário pedir uma fase inteira ('execute a Fase 1') ou quando não souber por onde começar.",
  {
    phase: z
      .enum(PHASES)
      .optional()
      .describe("Limita a uma fase. Ex.: 'fase-1' para o schema do banco."),
  },
  async ({ phase }) => {
    try {
      const s = await loadState();
      const comps = s.components || [];
      const scope = phase ? comps.filter((c) => c.phase === phase) : comps;

      const pending = scope.filter((c) => c.status === "todo" || c.status === "blocked");
      const ready = [];
      const waiting = [];
      for (const c of pending) {
        const blocking = blockingDeps(c.id, comps);
        (blocking.length ? waiting : ready).push({ c, blocking });
      }

      const L = [];
      if (phase) {
        const inPhase = scope.filter((c) => c.status !== "deprecated");
        const donePhase = scope.filter((c) => c.status === "done");
        L.push(`# ${PHASE_LABEL[phase]}`);
        L.push(`Progresso: ${donePhase.length}/${inPhase.length} concluídos.\n`);
      }

      L.push(`## Pode pegar agora (${ready.length})`);
      L.push(
        ready.length
          ? ready
              .map(({ c }) => `- \`${c.id}\` **${c.name}**${c.notes ? `\n    ${c.notes}` : ""}`)
              .join("\n")
          : "- nada liberado" +
              (waiting.length ? " — tudo que resta depende de algo ainda não concluído." : " — fase concluída.")
      );

      if (waiting.length) {
        L.push(`\n## Aguardando dependência (${waiting.length})`);
        L.push(
          waiting
            .map(({ c, blocking }) => `- \`${c.id}\` ${c.name} — espera: ${blocking.join(", ")}`)
            .join("\n")
        );
      }

      const doing = scope.filter((c) => c.status === "doing");
      if (doing.length) {
        L.push(`\n## Já em andamento por outro agente (${doing.length}) — não pegue estes`);
        L.push(doing.map((c) => `- \`${c.id}\` ${c.name} (${c.owner})`).join("\n"));
      }

      L.push(
        `\n---\nAo escolher: \`set_component_status\` para \`doing\` com o seu nome, para outro agente não pegar o mesmo.`
      );
      return text(L.join("\n"));
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "status_read",
  "Estado completo do projeto, opcionalmente filtrado. Use quando precisar de detalhe que o status_brief não traz.",
  {
    phase: z.enum(PHASES).optional().describe("Filtra por fase do plano"),
    area: z.enum(AREAS).optional().describe("Filtra por área"),
    status: z.enum(STATUS).optional().describe("Filtra por status"),
    include_sessions: z.boolean().default(false).describe("Incluir histórico de sessões"),
  },
  async ({ phase, area, status, include_sessions }) => {
    try {
      const s = await loadState();
      let comps = s.components || [];
      if (phase) comps = comps.filter((c) => c.phase === phase);
      if (area) comps = comps.filter((c) => c.area === area);
      if (status) comps = comps.filter((c) => c.status === status);
      comps = comps.map((c) => ({ ...c, dependsOn: depsOf(c.id) }));

      const payload = {
        project: s.project,
        goal: s.goal,
        updatedAt: s.updatedAt,
        updatedBy: s.updatedBy,
        invariants: s.invariants,
        components: comps,
        decisions: s.decisions,
        blockers: s.blockers,
        ...(include_sessions ? { sessions: s.sessions } : {}),
      };
      return text(JSON.stringify(payload, null, 2));
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "status_history",
  "Últimas mudanças registradas no log append-only (docs/status-log.jsonl). Útil para entender o que mudou desde a sua última sessão.",
  { limit: z.number().int().min(1).max(200).default(20) },
  async ({ limit }) => {
    try {
      const entries = await readLog(limit);
      if (!entries.length) return text("Log vazio.");
      return text(
        entries
          .map(({ at, agent, event, ...detail }) => {
            const extra = Object.entries(detail)
              .filter(([, v]) => v !== undefined && v !== null && v !== "")
              .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
              .join(" ");
            return `${at} [${agent}] ${event}${extra ? ` · ${extra}` : ""}`;
          })
          .join("\n")
      );
    } catch (err) {
      return fail(err.message);
    }
  }
);

// ============================================================== ESCRITA

server.tool(
  "set_component_status",
  "Muda o status de um componente do projeto. Chame sempre que começar (doing) ou terminar (done) uma peça, ou quando descobrir que ela está travada (blocked).",
  {
    agent: agentArg,
    id: z.string().min(1).describe("ID do componente, ex.: db.schema.users"),
    status: z.enum(STATUS).describe(STATUS.map((s) => `${s}=${STATUS_LABEL[s]}`).join(", ")),
    notes: z.string().max(MAX_NOTES).optional().describe(`O que mudou, em até ${MAX_NOTES} chars. Seja específico.`),
    evidence: z
      .string()
      .max(300)
      .optional()
      .describe(
        "OBRIGATÓRIO para status=done. O COMANDO que você rodou e que passou — ex.: 'npx drizzle-kit generate → 0000_init.sql com 29 tabelas' ou 'npm test → 20 checks ok'. Não vale citar arquivo que você escreveu mas não executou."
      ),
  },
  async ({ agent, id, status, notes, evidence }) => {
    try {
      const { result } = await mutateState(agent, (state) => {
        // "done" exige prova executável. Escrever o arquivo não é terminar a peça:
        // um agente já marcou 11 componentes como done com schema que nem compilava.
        if (status === "done") {
          const ev = (evidence ?? "").trim();
          if (!ev) {
            throw new Error(
              `Para marcar "${id}" como done você precisa passar "evidence" com o COMANDO que você executou e que passou.\n` +
                `Exemplos válidos: "npx drizzle-kit generate → 0000_init.sql, 29 tabelas" | "npm test → 20 checks ok" | "docker compose up + psql \\dt → 29 tabelas".\n` +
                `Se você só escreveu o arquivo e não rodou nada, o status correto é "doing".`
            );
          }
          if (ev.length < 12) {
            throw new Error(
              `A evidência "${ev}" é curta demais para ser verificável. Descreva o comando e o resultado observado.`
            );
          }

          // Para componentes com sucesso mensurável, o SERVIDOR mede. Texto
          // convincente não passa daqui — ver mcp/status-server/lib/gates.js.
          const provaAutomatica = verificarPortao(id, PROJECT_ROOT);
          if (provaAutomatica) evidence = `${ev} | ${provaAutomatica}`;
        }
        const c = (state.components || []).find((x) => x.id === id);
        if (!c) {
          const ids = (state.components || []).map((x) => x.id);
          const near = ids.filter((x) => x.includes(id.split(".")[0])).slice(0, 8);
          throw new Error(
            `Componente "${id}" não existe. ${
              near.length ? `Parecidos: ${near.join(", ")}. ` : ""
            }Use add_component se for algo novo, ou status_read para listar.`
          );
        }
        const from = c.status;

        // Avisa (sem impedir) quando a peça está sendo iniciada ou concluída
        // antes das suas dependências. Não bloqueia: às vezes há motivo legítimo,
        // e nesse caso o registro fica no log para quem revisar depois.
        let aviso = "";
        if (status === "doing" || status === "done") {
          const blocking = blockingDeps(id, state.components);
          if (blocking.length) {
            aviso =
              `\n\nATENÇÃO: este componente depende de ${blocking.join(", ")}, ` +
              `que ainda não está concluído. Se isso é intencional, registre o motivo com add_decision.`;
          }
        }

        c.status = status;
        c.owner = agent;
        c.updatedAt = new Date().toISOString();
        if (notes !== undefined) c.notes = notes;
        if (evidence !== undefined) c.evidence = evidence;

        return {
          event: "set_component_status",
          detail: { id, from, to: status, notes, evidence },
          result: `\`${id}\` ${STATUS_ICON[from]} ${from} → ${STATUS_ICON[status]} ${status}${aviso}`,
        };
      });
      return text(`${result}\nstatusdoprojeto.md regenerado.`);
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "add_component",
  "Registra um componente que não estava previsto no plano. Use quando descobrir trabalho novo que outros agentes precisam saber que existe.",
  {
    agent: agentArg,
    id: z.string().min(1).regex(/^[a-z0-9.\-_]+$/, "Use minúsculas, pontos e hífens: ex. app.perfil.port"),
    phase: z.enum(PHASES).describe(PHASES.map((p) => `${p}=${PHASE_LABEL[p]}`).join(" | ")),
    area: z.enum(AREAS).describe(AREAS.map((a) => `${a}=${AREA_LABEL[a]}`).join(", ")),
    name: z.string().min(1).max(120),
    status: z.enum(STATUS).default("todo"),
    notes: z.string().max(MAX_NOTES).optional(),
  },
  async ({ agent, id, phase, area, name, status, notes }) => {
    try {
      await mutateState(agent, (state) => {
        state.components = state.components || [];
        if (state.components.some((c) => c.id === id)) {
          throw new Error(`Componente "${id}" já existe. Use set_component_status para atualizá-lo.`);
        }
        state.components.push({
          id,
          phase,
          area,
          name,
          status,
          notes: notes || "",
          evidence: "",
          owner: agent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return { event: "add_component", detail: { id, phase, area, name, status } };
      });
      return text(
        `Componente \`${id}\` criado em ${PHASE_LABEL[phase]} / ${AREA_LABEL[area]} com status ${status}.\n` +
          `Se ele depende de outro componente, registre isso em mcp/status-server/lib/plan.js.`
      );
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "add_decision",
  "Registra uma decisão de arquitetura (ADR) com o motivo. Use sempre que escolher entre alternativas — é o que impede outro agente de desfazer sua escolha sem saber por quê.",
  {
    agent: agentArg,
    title: z.string().min(1).max(120),
    decision: z.string().min(1).max(600).describe("O que foi decidido, em uma ou duas frases."),
    rationale: z.string().max(800).optional().describe("Por que essa e não a alternativa."),
    supersedes: z.string().optional().describe("ID de uma ADR anterior que esta revoga, ex.: ADR-003"),
  },
  async ({ agent, title, decision, rationale, supersedes }) => {
    try {
      const { result } = await mutateState(agent, (state) => {
        state.decisions = state.decisions || [];
        if (supersedes && !state.decisions.some((d) => d.id === supersedes)) {
          throw new Error(`ADR "${supersedes}" não existe, não dá para revogá-la.`);
        }
        const id = nextId(state.decisions, "ADR");
        state.decisions.push({
          id,
          date: new Date().toISOString(),
          author: agent,
          title,
          decision,
          rationale: rationale || "",
          supersedes: supersedes || null,
        });
        return { event: "add_decision", detail: { id, title, supersedes }, result: id };
      });
      return text(`Decisão registrada como \`${result}\`${supersedes ? ` (revoga ${supersedes})` : ""}.`);
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "add_blocker",
  "Registra um impedimento que outro agente precisa conhecer antes de mexer na mesma área. Use para problema real que trava o trabalho, não para tarefa pendente.",
  {
    agent: agentArg,
    description: z.string().min(1).max(MAX_NOTES),
    component: z.string().optional().describe("ID do componente afetado, se houver"),
  },
  async ({ agent, description, component }) => {
    try {
      const { result } = await mutateState(agent, (state) => {
        state.blockers = state.blockers || [];
        const id = nextId(state.blockers, "BLK");
        state.blockers.push({
          id,
          description,
          component: component || null,
          openedBy: agent,
          openedAt: new Date().toISOString(),
          resolvedAt: null,
          resolution: null,
        });
        if (component) {
          const c = (state.components || []).find((x) => x.id === component);
          if (c) c.status = "blocked";
        }
        return { event: "add_blocker", detail: { id, component, description }, result: id };
      });
      return text(`Bloqueio \`${result}\` registrado.${component ? ` Componente \`${component}\` marcado como blocked.` : ""}`);
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "resolve_blocker",
  "Fecha um impedimento, explicando como foi resolvido.",
  {
    agent: agentArg,
    id: z.string().min(1).describe("ID do bloqueio, ex.: BLK-001"),
    resolution: z.string().min(1).max(MAX_NOTES),
  },
  async ({ agent, id, resolution }) => {
    try {
      await mutateState(agent, (state) => {
        const b = (state.blockers || []).find((x) => x.id === id);
        if (!b) throw new Error(`Bloqueio "${id}" não existe.`);
        if (b.resolvedAt) throw new Error(`Bloqueio "${id}" já foi resolvido em ${b.resolvedAt}.`);
        b.resolvedAt = new Date().toISOString();
        b.resolution = resolution;
        return { event: "resolve_blocker", detail: { id, resolution } };
      });
      return text(`Bloqueio \`${id}\` resolvido.`);
    } catch (err) {
      return fail(err.message);
    }
  }
);

server.tool(
  "log_session",
  "ÚLTIMA COISA DE TODA SESSÃO. Registra o que você fez, para o próximo agente saber sem precisar reler o código.",
  {
    agent: agentArg,
    summary: z.string().min(1).max(MAX_SUMMARY).describe("O que você fez e o que ficou pendente."),
    touched: z.array(z.string()).default([]).describe("Arquivos ou componentes tocados."),
  },
  async ({ agent, summary, touched }) => {
    try {
      await mutateState(agent, (state) => {
        state.sessions = state.sessions || [];
        state.sessions.push({ at: new Date().toISOString(), agent, summary, touched });
        return { event: "log_session", detail: { summary, touched } };
      });
      return text(`Sessão registrada. statusdoprojeto.md atualizado em ${MD_PATH}.`);
    } catch (err) {
      return fail(err.message);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
