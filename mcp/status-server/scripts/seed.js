/**
 * Gera o estado inicial do projeto a partir do inventário levantado no
 * mapeamento do M7AcademySite (48 migrations + dump + 29.420 linhas de front).
 *
 * Rodar de novo SOBRESCREVE o progresso. Só use para recriar do zero.
 *   node mcp/status-server/scripts/seed.js --force
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_VERSION } from "../lib/schema.js";
import { render } from "../lib/render.js";
import { phaseOf } from "../lib/plan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.M7_PROJECT_ROOT || path.resolve(__dirname, "..", "..", "..");
const STATE_PATH = path.join(ROOT, "docs", "project-state.json");
const MD_PATH = path.join(ROOT, "statusdoprojeto.md");
const LOG_PATH = path.join(ROOT, "docs", "status-log.jsonl");

const NOW = new Date().toISOString();
const AGENT = "claude";

/**
 * c(id, area, name, status, notes, evidence)
 * A fase vem de lib/plan.js — que é a fonte única da estrutura do plano.
 */
const c = (id, area, name, status = "todo", notes = "", evidence = "") => {
  const phase = phaseOf(id);
  if (!phase) {
    throw new Error(`Componente "${id}" não tem fase em lib/plan.js. Adicione lá antes de semear.`);
  }
  return {
    id,
    phase,
    area,
    name,
    status,
    notes,
    evidence,
    owner: status === "todo" ? "" : AGENT,
    createdAt: NOW,
    updatedAt: NOW,
  };
};

const components = [
  // ---------------------------------------------------------- governança
  c("gov.mcp.status", "governanca", "MCP m7-status (este servidor)", "done",
    "Tools tipadas sobre project-state.json; statusdoprojeto.md é renderizado, nunca escrito à mão.",
    "mcp/status-server/index.js"),
  c("gov.agents", "governanca", "AGENTS.md — regras vinculantes para todo agente", "done",
    "Fonte única. CLAUDE.md e GEMINI.md são ponteiros de uma linha para ele.", "AGENTS.md"),
  c("gov.mcp.registro", "governanca", "Registro do MCP nos clientes", "done",
    ".mcp.json (Claude Code) + opencode.json + instruções para Gemini CLI.", ".mcp.json"),
  c("gov.docs.arquitetura", "governanca", "ARQUITETURA.md", "done",
    "Modelo de domínio, camadas, invariantes e o que preservar do app atual.", "docs/ARQUITETURA.md"),
  c("gov.docs.plano", "governanca", "PLANO_MIGRACAO.md", "done",
    "Documento central: fases, ordem de execução, mapeamento de dados e cutover.", "docs/PLANO_MIGRACAO.md"),
  c("gov.repo", "governanca", "Repositório git inicializado", "todo",
    "Necessário para o build no CI. Confirmar .gitignore antes do primeiro commit."),

  // ---------------------------------------------------------------- banco
  c("db.setup", "banco", "Drizzle + migrations versionadas", "todo",
    "Invariante: as migrations reconstroem o banco INTEIRO. Hoje ~15 tabelas em produção nunca tiveram CREATE TABLE versionado."),
  c("db.identidade", "banco", "Núcleo de identidade unificado", "todo",
    "users + user_identities + user_roles(N:N) + user_wallets + user_payout_info. Resolve a fragmentação em 8 tabelas sem FK entre si."),
  c("db.games", "banco", "Multi-jogo: games + game_accounts", "todo",
    "Substitui contas_riot. Já aceita um 2º jogo sem migration grande depois."),
  c("db.teams", "banco", "teams + team_members + team_stats", "todo",
    "team_stats separada porque recalcular_pdl_global hoje faz UPDATE na tabela times inteira. Ganha season_id."),
  c("db.tournaments", "banco", "tournaments normalizado (mata o JSONB gigante)", "todo",
    "tournament_teams/groups/matches substituem cronograma+bracket_data+classificacao+times_inscritos. Resolve o campeonatos_audit que duplica 5 blobs por update."),
  c("db.matches", "banco", "matches + match_players + match_results + match_codes", "todo",
    "Sem snapshot desnormalizado em match_players — hoje quem troca de nick fica com o antigo em todo o histórico."),
  c("db.economia", "banco", "Ledger: wallet_transactions + payments + referral_events", "todo",
    "Saldo vira derivável e auditável (balance_after). Hoje wallets é um número solto sem rastro."),
  c("db.conteudo", "banco", "news + highlights + broadcasts + recruitment_posts + notifications", "todo"),
  c("db.indices", "banco", "Índices a partir das queries reais", "todo",
    "Não especulativos: game_accounts(game_id,external_id), tournament_matches(tournament_id,phase,scheduled_at), wallet_transactions(user_id,created_at DESC), teams(game_id,LOWER(tag)) único."),
  c("db.retencao", "banco", "Retenção: audit_log particionado + jobs de purge", "todo",
    "A limpeza de 30 dias prometida em 20260527000002:322 e nunca implementada."),
  c("db.descarte", "banco", "Não migrar as 15 tabelas mortas", "todo",
    "drafts, scrims, sala_chat, transacoes, admin_logs, campeonato_times, campeonato_jogadores, vip_assinaturas, screens, campeonatos_audit, twitch_lives_ativas, votos_jogos, edge_function_logs, discord_oauth_state + 5 views."),

  // ---------------------------------------------------------------- infra
  c("infra.vps", "infra", "VPS contratada e acessível", "todo",
    "2 vCPU / 8GB / 100GB NVMe. Pendente do usuário. Bloqueia tudo que roda remoto."),
  c("infra.compose", "infra", "docker-compose.yml (7 serviços)", "todo",
    "postgres, pgbouncer, app, realtime, nginx, backup, mcp-ops."),
  c("infra.postgres", "infra", "postgresql.conf tunado para 8GB / 2 vCPU", "todo",
    "shared_buffers=2GB, effective_cache_size=4GB, work_mem=16MB, random_page_cost=1.1 (NVMe)."),
  c("infra.pgbouncer", "infra", "PgBouncer em transaction mode", "todo",
    "Duas armadilhas: quebra prepared statements (client precisa prepare:false) e mata LISTEN/NOTIFY (realtime conecta direto no Postgres)."),
  c("infra.nginx", "infra", "Nginx: proxy reverso + TLS + estáticos", "todo",
    "Headers de segurança portados de vercel.json:14-18, que já estão corretos."),
  c("infra.backup", "infra", "Backup com restore testado e cópia off-site", "todo",
    "Backup dentro da própria VPS morre junto com ela. Restore não testado não é backup."),
  c("infra.ci", "infra", "Build da imagem no CI (não na VPS)", "todo",
    "2 vCPU não aguenta build de Next.js com folga."),

  // --------------------------------------------------------------- design
  c("design.tokens", "design", "Tokens, utilities, keyframes e scrollbar", "todo",
    "Cópia literal de index.css:4-118 — 13 cores, 6 utilities, 2 keyframes, scrollbar dourada 4px.",
    "M7AcademySite/src/index.css:4-118"),
  c("design.fontes", "design", "Inter + Outfit via next/font", "todo",
    "Mesma renderização, sem request externo e sem FOUC."),
  c("design.libs", "design", "motion v12 + lucide-react + react-icons", "todo",
    "Mesmas libs e versões — 78 imports em 35 arquivos. Todas rodam em Next 15."),
  c("design.assets", "design", "public/ portado (40 imagens, lanes, ranks, sounds)", "todo",
    "45,7 MB. Mesmos arquivos e caminhos; next/image entrega WebP/AVIF a partir do mesmo PNG."),
  c("design.ui", "design", "ElectricBorder + VipBadge/VipCrown", "todo",
    "Copiados literais. VipBadge já tem 'use client'."),
  c("design.regressao", "design", "Regressão visual antigo vs novo", "todo",
    "Reaproveitar o MCP de browser com Playwright do projeto atual para screenshot comparado, desktop e mobile."),

  // ------------------------------------------------------------------ app
  c("app.setup", "app", "Next.js 15 App Router + Tailwind 4", "todo"),
  c("app.auth", "app", "Auth.js v5 (Google + credenciais)", "todo",
    "Hashes bcrypt do GoTrue continuam válidos. Some o patch de OAuth espalhado em 4 arquivos + loop de retry de 15s."),
  c("app.data", "app", "Camada de dados (features/*/server)", "todo",
    "Hoje 18 dos 61 arquivos importam supabase direto dentro de componentes de UI."),
  c("app.perfil-context", "app", "PerfilContext portado", "todo",
    "Preservar: query agregadora + Provider acima do Router + invalidação por push. Corrigir: catch vazio em PerfilContext.tsx:148 deixa o perfil null para sempre."),
  c("app.realtime", "app", "Serviço WebSocket + NOTIFY", "todo",
    "Escopo: salas/lobbies apenas, como hoje. Existe exatamente 1 canal realtime em todo o produto."),
  c("app.workers", "app", "Workers: Twitch cron, webhook MP, sync Riot", "todo",
    "Substituem as Edge Functions. update-sala-team NÃO é portada (sem auth, service role, updates arbitrário)."),
  c("app.riot-proxy", "app", "Proxy /api/riot/* com cache", "todo"),

  c("app.port.lobby", "app", "Port: Lobby / home", "todo",
    "1.726 linhas, 10 cards inline, 4 caches manuais. fetchUpcoming baixa TODOS os campeonatos inteiros para montar um carrossel."),
  c("app.port.perfil", "app", "Port: Perfil", "todo", "713 linhas."),
  c("app.port.players", "app", "Port: Players / ranking", "todo", "1.026 linhas."),
  c("app.port.times", "app", "Port: Times (listagem + página do time)", "todo",
    "TimePage 1.943 linhas com 40 useState e 5 modais embutidos. handleSairTime faz 6 writes não-transacionais."),
  c("app.port.campeonatos", "app", "Port: Campeonatos", "todo",
    "CampeonatoDetalhes 5.856 linhas (4.482 num componente, 2.674 de JSX num return) + createCampPage 2.044. Recorte em ~15 arquivos, JSX movido como está."),
  c("app.port.salas", "app", "Port: Jogar / Sala / Lobby de partida", "todo",
    "Preservar a arquitetura do useSalaSimples: servidor como única autoridade, timers derivados, tick idempotente. É o melhor código do projeto."),
  c("app.port.recrutamento", "app", "Port: Recrutamento", "todo",
    "Única feature com separação page/api/types limpa hoje."),
  c("app.port.streamers", "app", "Port: Streamers / transmissões", "todo"),
  c("app.port.carteira", "app", "Port: Carteira, depósito e VIP", "todo"),
  c("app.port.vincular", "app", "Port: Vincular Riot + Discord", "todo"),
  c("app.port.admin", "app", "Port: Admin (saldos, ranking, notícias, cargos)", "todo",
    "1.940 linhas. Já é o melhor estruturado dos monstros — 6 abas separadas."),
  c("app.port.institucional", "app", "Port: Quem Somos, Políticas, Tutorial, Minhas Partidas", "todo"),

  // -------------------------------------------------------------- mcp-ops
  c("mcpops.server", "mcp-ops", "MCP de operações da VPS", "todo",
    "vps_health, logs_tail, db_query (read-only), http_check, migration_status, deploy/rollback, metrics."),
  c("mcpops.seguranca", "mcp-ops", "Blindagem do MCP de ops", "todo",
    "Bearer token + bind 127.0.0.1 + acesso por túnel SSH/Tailscale. Role Postgres read-only com statement_timeout. Isso é um shell remoto — nunca exposto na internet."),

  // ------------------------------------------------------------- migração
  c("mig.extract", "migracao", "Extract do Supabase", "todo"),
  c("mig.identidade", "migracao", "Transform: identidade", "todo",
    "auth.users + profiles + contas_riot + wallets + platform_roles + discord_links → users e satélites."),
  c("mig.campeonatos", "migracao", "Transform: explodir o JSONB de campeonatos", "todo",
    "cronograma/bracket_data/classificacao → tournament_matches. O passo mais difícil; exige relatório de divergências, não conversão cega."),
  c("mig.load", "migracao", "Load no Postgres da VPS", "todo"),
  c("mig.verify", "migracao", "verify-migration.sql", "todo",
    "Contagens e somas de controle origem vs destino. Só aceita com divergência zero."),
  c("mig.cutover", "migracao", "Cutover: re-sync + DNS + TLS", "todo",
    "Registro A de m7arena.pro na Hostinger. m7academy.pro fica no ar intacto como fallback."),

  // ------------------------------------------------------------ segurança
  c("sec.riot-key", "seguranca", "Tirar a chave da Riot do bundle", "todo",
    "Hoje qualquer visitante extrai a key do JS.", "M7AcademySite/src/api/riot.ts:5"),
  c("sec.pix", "seguranca", "Remover o PIX pessoal de fallback", "todo",
    "Se a função de pagamento cai, o usuário paga numa conta pessoal sem registro.",
    "M7AcademySite/src/components/modals/vip/VipModal.tsx:143"),
  c("sec.regras-servidor", "seguranca", "Mover regras de negócio para o servidor", "todo",
    "Payout de aposta, quórum que decide o vencedor da partida, classificação e desempate de campeonato."),
  c("sec.upload", "seguranca", "Upload restrito por dono", "todo",
    "Hoje qualquer usuário logado sobrescreve a logo de qualquer time."),
  c("sec.rotacao", "seguranca", "Rotacionar segredos antes do cutover", "todo",
    "Chave Riot (exposta no bundle), token Mercado Livre (commitado em opencode.json:15), e confirmar rotação das credenciais Supabase compartilhadas na migração US→BR."),
];

const decisions = [
  ["Stack: Next.js 15 + serviço WS separado",
   "Next.js 15 App Router serve front e rotas de API; um processo Node separado cuida do WebSocket das salas e dos workers.",
   "Unifica front e back num deploy, resolve a chave Riot no cliente via route handlers e dá SSR/SEO. Next não hospeda WebSocket bem, por isso o segundo processo. Build roda no CI porque 2 vCPU não aguenta."],
  ["Auth: Auth.js v5 no Postgres próprio",
   "Autenticação própria com Auth.js v5, sem GoTrue.",
   "Os hashes do GoTrue são bcrypt e continuam válidos, então nenhum dos 117 usuários precisa resetar senha; o Google OAuth reconecta pelo mesmo email. Sai 100% do Supabase e economiza um container."],
  ["Migração: import inicial + re-sync no cutover",
   "Importar o snapshot agora para desenvolver com dados reais, e rodar re-sync incremental do delta na virada do DNS.",
   "Permite testar com os dados de verdade desde o dia 1, em vez de descobrir problemas na virada. m7academy.pro não é tocado."],
  ["Extensibilidade: schema multi-jogo desde o v1",
   "Tabelas games e game_accounts, com game_id em campeonato, sala e time. Features continuam só de LoL. Afiliados entra como referred_by + referral_events, sem UI.",
   "O custo de generalizar agora é baixo; fazer retrofit disso depois, com dados em produção, é caro."],
  ["Design: paridade visual total",
   "O site novo é visualmente indistinguível do atual. Mesmas cores, fontes, ícones, imagens, espaçamentos e layout. Só o motor muda.",
   "O produto visual já está pronto e validado. Redesenhar seria retrabalho e risco sem retorno. Quebrar arquivo grande é recorte de JSX, não redesign."],
  ["ORM: Drizzle",
   "Drizzle ORM com migrations SQL versionadas.",
   "Leve, SQL-first e compatível com PgBouncer em transaction mode usando prepare:false."],
  ["Storage: disco local servido pelo Nginx",
   "Uploads em volume Docker, servidos pelo Nginx. Sem MinIO.",
   "O volume de imagens de usuário é da ordem de 50 MB. MinIO seria um serviço a mais consumindo RAM em 2 vCPU sem ganho."],
  ["Governança: MCP com operações tipadas, não markdown livre",
   "O statusdoprojeto.md é renderizado a partir de docs/project-state.json. Agentes só escrevem via tools tipadas.",
   "Markdown livre editado por vários agentes vira, em semanas, um arquivo com formatos divergentes e conflitos de escrita. Operações tipadas garantem formato idêntico entre Claude, Gemini e DeepSeek."],
];

const state = {
  schemaVersion: SCHEMA_VERSION,
  project: "M7Arena",
  goal:
    "Migrar o M7Academy (React+Vite+Supabase+Vercel, m7academy.pro) para VPS própria com PostgreSQL e Next.js, sob o domínio m7arena.pro, mantendo o design idêntico e trocando só o motor.",
  updatedAt: NOW,
  updatedBy: AGENT,
  invariants: [
    "DESIGN: o visual é cópia 1:1 do site atual. Nunca reescreva um className, nunca 'melhore' o layout sem o usuário pedir.",
    "m7academy.pro (Supabase+Vercel) NÃO se toca. Continua no ar, intacto, durante toda a migração.",
    "Nenhuma regra de negócio no cliente: pagamento, resultado de partida, saldo e classificação são decididos no servidor.",
    "Nenhum segredo no bundle do cliente. Chave de API só em rota de servidor.",
    "Toda mudança de schema entra como migration versionada, e as migrations reconstroem o banco do zero.",
    "Nenhum arquivo passa de ~400 linhas. Se passou, é hora de recortar.",
    "Todo agente chama status_brief ao iniciar e log_session ao terminar.",
  ],
  components,
  decisions: decisions.map(([title, decision, rationale], i) => ({
    id: `ADR-${String(i + 1).padStart(3, "0")}`,
    date: NOW,
    author: AGENT,
    title,
    decision,
    rationale,
    supersedes: null,
  })),
  blockers: [],
  sessions: [],
};

// ---------------------------------------------------------------- escrita

const force = process.argv.includes("--force");
try {
  await fs.access(STATE_PATH);
  if (!force) {
    console.error(
      `ABORTADO: ${STATE_PATH} já existe. Rodar o seed sobrescreve todo o progresso.\n` +
        `Se é isso mesmo que você quer, use: node mcp/status-server/scripts/seed.js --force`
    );
    process.exit(1);
  }
} catch {
  /* não existe, seguir */
}

await fs.mkdir(path.join(ROOT, "docs"), { recursive: true });
await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
await fs.writeFile(MD_PATH, render(state), "utf8");
await fs.appendFile(
  LOG_PATH,
  JSON.stringify({ at: NOW, agent: AGENT, event: "seed", components: components.length }) + "\n",
  "utf8"
);

console.log(`Estado inicial gerado:`);
console.log(`  ${STATE_PATH}  (${components.length} componentes, ${state.decisions.length} ADRs)`);
console.log(`  ${MD_PATH}`);
