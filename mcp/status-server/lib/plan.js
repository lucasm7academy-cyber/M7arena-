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
  // ADR-010: o Nginx passa a servir o build estático do Vite e o serviço `app`
  // deixa de ser Next para virar a API Node.
  "infra.nginx.spa": ["fase-2", "infra.nginx", "app.fork.build"],
  "infra.app.imagem": ["fase-2", "infra.compose", "app.api.server"],

  // ---- Fase 3 — aplicação (ADR-010: fork do React/Vite, não reescrita em Next)
  //
  // ETAPA A — o site em React rodando, com o visual intacto, SEM tocar em banco.
  // É o portão de tudo: nenhuma peça de dados abre antes de o fork buildar.
  "app.fork.copia": ["fase-3"],
  "app.fork.build": ["fase-3", "app.fork.copia"],
  "design.assets": ["fase-3", "app.fork.copia"],
  "design.regressao": ["fase-3", "app.fork.build"],

  // ETAPA B — camada de dados própria, atrás do portão do fork.
  "app.api.server": ["fase-3", "app.fork.build", "db.setup"],
  "app.auth.sessao": ["fase-3", "app.api.server", "db.identidade"],
  "app.sdk": ["fase-3", "app.api.server", "app.auth.sessao"],

  "app.realtime": ["fase-3", "app.api.server", "db.matches", "infra.pgbouncer"],
  "app.workers": ["fase-3", "app.api.server"],
  "app.riot-proxy": ["fase-3", "app.api.server"],

  // Os swaps: cada um troca um domínio de supabase.* por chamada ao app.sdk.
  // Todos dependem de app.auth.sessao: enquanto o front usar supabase.auth para
  // a sessão, nenhuma chamada à API própria consegue se autenticar. Auth primeiro,
  // sempre. E nenhum deles fecha sem `node scripts/verify-swap.js <dominio>` em 0.
  "app.swap.identidade": ["fase-3", "app.sdk", "app.auth.sessao", "db.identidade"],
  "app.swap.times": ["fase-3", "app.sdk", "app.auth.sessao", "db.teams"],
  "app.swap.campeonatos": ["fase-3", "app.sdk", "app.auth.sessao", "db.tournaments"],
  "app.swap.salas": ["fase-3", "app.sdk", "app.auth.sessao", "app.realtime", "db.matches"],
  "app.swap.carteira": ["fase-3", "app.sdk", "app.auth.sessao", "db.economia"],
  "app.swap.conteudo": ["fase-3", "app.sdk", "app.auth.sessao", "db.conteudo"],
  "app.swap.rpc": ["fase-3", "app.sdk", "app.auth.sessao"],
  "app.storage.uploads": ["fase-3", "app.api.server", "app.auth.sessao"],
  // As 6 edge functions do Supabase (fonte em M7AcademySite/supabase/functions/).
  // Não estavam no plano original e bloqueiam o pagamento e parte dos workers.
  "app.edge-functions": ["fase-3", "app.api.server", "app.auth.sessao"],
  "app.env": ["fase-3", "app.fork.build"],

  // segurança acompanha a peça que ela corrige
  "sec.riot-key": ["fase-3", "app.riot-proxy", "app.env"],
  // O PIX de fallback vive dentro de create-mercado-pago-order, então tirar ele
  // do cliente exige a edge function migrada, não só a carteira trocada.
  "sec.pix": ["fase-3", "app.swap.carteira", "app.edge-functions"],
  "sec.regras-servidor": ["fase-3", "app.swap.carteira", "app.swap.salas"],
  "sec.upload": ["fase-3", "app.storage.uploads"],

  // ---- Salas apostadas (ADR-019, design v3) — P1: escrow + máquina de estados
  "app.apostas.schema": ["fase-3", "db.matches", "db.economia", "db.identidade"],
  "app.apostas.escrow": ["fase-3", "app.apostas.schema"],
  "app.apostas.machine": ["fase-3", "app.apostas.escrow"],
  "app.apostas.revisao": ["fase-3", "app.apostas.machine"],
  "app.apostas.cron": ["fase-3", "app.apostas.machine"],
  "app.apostas.realtime": ["fase-3", "app.api.server", "db.matches", "infra.compose"],
  "app.apostas.elegibilidade": ["fase-3", "app.apostas.machine"],
  "app.apostas.prints": ["fase-3", "app.apostas.machine", "app.apostas.revisao", "app.storage.uploads"],
  "app.apostas.smoke": ["fase-3", "app.apostas.revisao", "app.apostas.cron", "app.apostas.realtime", "app.apostas.elegibilidade", "app.apostas.prints"],

  // ---- descartados pela ADR-010 (o port em Next). Mantidos só para histórico:
  // o grafo não os usa mais, mas remover quebraria phaseOf() de estado antigo.
  "app.setup": ["fase-3"],
  "design.tokens": ["fase-3"],
  "design.fontes": ["fase-3"],
  "design.libs": ["fase-3"],
  "design.ui": ["fase-3"],
  "app.auth": ["fase-3"],
  "app.data": ["fase-3"],
  "app.perfil-context": ["fase-3"],
  "app.port.shell": ["fase-3"],
  "app.port.notificacoes": ["fase-3"],
  "app.port.institucional": ["fase-3"],
  "app.port.perfil": ["fase-3"],
  "app.port.players": ["fase-3"],
  "app.port.recrutamento": ["fase-3"],
  "app.port.streamers": ["fase-3"],
  "app.port.carteira": ["fase-3"],
  "app.port.vincular": ["fase-3"],
  "app.port.times": ["fase-3"],
  "app.port.admin": ["fase-3"],
  "app.port.lobby": ["fase-3"],
  "app.port.salas": ["fase-3"],
  "app.port.campeonatos": ["fase-3"],

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
  // ADR-010: o cutover só abre com o app novo de pé — paridade visual conferida,
  // regras de negócio no servidor e o Nginx servindo a SPA.
  "mig.cutover": [
    "fase-5",
    "mig.verify",
    "infra.vps",
    "sec.rotacao",
    "design.regressao",
    "sec.regras-servidor",
    "infra.nginx.spa",
  ],
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
