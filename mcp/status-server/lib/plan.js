/**
 * Mapa do plano: a qual fase cada componente pertence e do que ele depende.
 *
 * Isto é o que permite a um agente responder com precisão a "execute a Fase 1"
 * e a "posso começar isso agora?" — sem ter que interpretar prosa de documento.
 *
 * Formato: id → [fase, ...dependências]
 */

export const PLAN = {
  // ---- Fase 0 — governança
  "gov.mcp.status": ["fase-0"],
  "gov.agents": ["fase-0"],
  "gov.mcp.registro": ["fase-0", "gov.mcp.status"],
  "gov.docs.arquitetura": ["fase-0"],
  "gov.docs.plano": ["fase-0"],
  "gov.repo": ["fase-0"],

  // ---- Fase 1 — schema
  "db.setup": ["fase-1"],
  "db.identidade": ["fase-1", "db.setup"],
  "db.games": ["fase-1", "db.setup"],
  "db.teams": ["fase-1", "db.identidade", "db.games"],
  "db.tournaments": ["fase-1", "db.teams"],
  "db.matches": ["fase-1", "db.identidade", "db.games"],
  "db.economia": ["fase-1", "db.identidade"],
  "db.conteudo": ["fase-1", "db.identidade"],
  "db.indices": [
    "fase-1",
    "db.identidade",
    "db.games",
    "db.teams",
    "db.tournaments",
    "db.matches",
    "db.economia",
    "db.conteudo",
  ],
  "db.retencao": ["fase-1", "db.setup"],
  "db.descarte": ["fase-1"],

  // ---- Fase 2 — infra
  "infra.vps": ["fase-2"], // bloqueio externo: depende do usuário contratar
  "infra.compose": ["fase-2"],
  "infra.postgres": ["fase-2"],
  "infra.pgbouncer": ["fase-2", "infra.compose", "infra.postgres"],
  "infra.nginx": ["fase-2", "infra.compose"],
  "infra.backup": ["fase-2", "infra.compose", "infra.postgres"],
  "infra.ci": ["fase-2", "gov.repo"],

  // ---- Fase 3 — aplicação (design system primeiro, é gate)
  "app.setup": ["fase-3"],
  "design.tokens": ["fase-3", "app.setup"],
  "design.fontes": ["fase-3", "app.setup"],
  "design.libs": ["fase-3", "app.setup"],
  "design.assets": ["fase-3", "app.setup"],
  "design.ui": ["fase-3", "design.tokens"],
  "design.regressao": ["fase-3", "design.tokens"],

  "app.auth": ["fase-3", "app.setup", "db.identidade"],
  "app.data": ["fase-3", "app.setup", "db.setup"],
  "app.perfil-context": ["fase-3", "app.data", "app.auth"],
  "app.realtime": ["fase-3", "db.matches", "infra.pgbouncer"],
  "app.workers": ["fase-3", "app.data"],
  "app.riot-proxy": ["fase-3", "app.data"],

  // ports — todos exigem o design system pronto (design.tokens) e a camada de dados
  "app.port.institucional": ["fase-3", "design.tokens", "app.setup"],
  "app.port.perfil": ["fase-3", "design.tokens", "app.perfil-context"],
  "app.port.players": ["fase-3", "design.tokens", "app.data", "db.games"],
  "app.port.recrutamento": ["fase-3", "design.tokens", "app.data"],
  "app.port.streamers": ["fase-3", "design.tokens", "app.data"],
  "app.port.carteira": ["fase-3", "design.tokens", "app.data", "db.economia"],
  "app.port.vincular": ["fase-3", "design.tokens", "app.riot-proxy"],
  "app.port.times": ["fase-3", "design.tokens", "app.data", "db.teams"],
  "app.port.admin": ["fase-3", "design.tokens", "app.data"],
  "app.port.lobby": ["fase-3", "design.tokens", "app.data", "db.conteudo"],
  "app.port.salas": ["fase-3", "design.tokens", "app.realtime", "db.matches"],
  "app.port.campeonatos": ["fase-3", "design.tokens", "app.data", "db.tournaments"],

  // segurança acompanha a peça que ela corrige
  "sec.riot-key": ["fase-3", "app.riot-proxy"],
  "sec.pix": ["fase-3", "app.port.carteira"],
  "sec.regras-servidor": ["fase-3", "app.data"],
  "sec.upload": ["fase-3", "app.data"],

  // ---- Fase 4 — MCP de operações
  "mcpops.server": ["fase-4", "infra.vps"],
  "mcpops.seguranca": ["fase-4", "mcpops.server"],

  // ---- Fase 5 — migração e cutover
  "mig.extract": ["fase-5"],
  "mig.identidade": ["fase-5", "mig.extract", "db.identidade"],
  "mig.campeonatos": ["fase-5", "mig.extract", "db.tournaments"],
  "mig.load": ["fase-5", "mig.identidade", "mig.campeonatos"],
  "mig.verify": ["fase-5", "mig.load"],
  "sec.rotacao": ["fase-5"],
  "mig.cutover": ["fase-5", "mig.verify", "infra.vps", "sec.rotacao"],
};

export const phaseOf = (id) => PLAN[id]?.[0] ?? null;
export const depsOf = (id) => PLAN[id]?.slice(1) ?? [];

/**
 * Um componente está liberado quando todas as suas dependências estão done
 * (ou deprecated, que também não bloqueia).
 */
export function blockingDeps(id, components) {
  const byId = new Map(components.map((c) => [c.id, c]));
  return depsOf(id).filter((d) => {
    const dep = byId.get(d);
    return dep && dep.status !== "done" && dep.status !== "deprecated";
  });
}
