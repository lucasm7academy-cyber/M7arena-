/**
 * Plano atual do M7Arena em produção.
 *
 * Só entram componentes que existem hoje. O histórico da migração antiga fica
 * no Git; não reintroduza `mig.*`, `app.swap.*` nem as fases mortas.
 *
 * Formato: id -> [fase, ...dependências]
 */

export const PLAN = {
  // ---- Fase 0 — governança
  "gov.agents": ["fase-0"],
  "gov.mcp.status": ["fase-0"],
  "gov.repo": ["fase-0"],

  // ---- Fase 1 — banco
  "db.postgres": ["fase-1"],

  // ---- Fase 2 — infraestrutura
  "infra.vps": ["fase-2"],
  "infra.backup": ["fase-2", "infra.vps"],

  // ---- Fase 3 — aplicação em produção
  "app.web": ["fase-3"],
  "app.api": ["fase-3", "db.postgres"],
  "app.realtime": ["fase-3", "app.api"],
  "app.supabase.zero": ["fase-3", "app.web", "app.api"],
  "app.payments": ["fase-3", "app.api"],
  "app.riot-proxy": ["fase-3", "app.api"],
  "sec.campeonato-permissoes": ["fase-3", "app.api"],

  // ---- Fase 4 — operações da VPS
  "mcpops.server": ["fase-4", "infra.vps"],
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
