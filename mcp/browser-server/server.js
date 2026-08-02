import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { chromium } from "playwright";

let browser = null;
let page = null;
let consoleErrors = [];
let networkErrors = [];
let connectedMode = false;

function setupPageListeners(targetPage) {
  if (!targetPage) return;
  consoleErrors = [];
  networkErrors = [];
  targetPage.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() });
    }
  });
  targetPage.on("pageerror", (err) => {
    consoleErrors.push({ type: "pageerror", text: err.message, stack: err.stack, timestamp: new Date().toISOString() });
  });
  targetPage.on("requestfailed", (req) => {
    networkErrors.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText || "Unknown", timestamp: new Date().toISOString() });
  });
  targetPage.on("response", (res) => {
    if (res.status() >= 400) {
      networkErrors.push({ url: res.url(), method: res.request().method(), status: res.status(), statusText: res.statusText(), timestamp: new Date().toISOString() });
    }
  });
}

const server = new McpServer({ name: "m7arena-browser-mcp", version: "1.0.0" });

server.tool(
  "browser_start",
  "Inicia o navegador Chromium (ou conecta ao Chrome existente se connect=true)",
  {
    connect: z.boolean().describe("Conectar ao Chrome existente em vez de abrir novo").default(true),
    cdpPort: z.number().describe("Porta CDP do Chrome (padrao 9222)").default(9222),
  },
  async ({ connect, cdpPort }) => {
    if (browser) await browser.close();
    if (connect) {
      try {
        browser = await chromium.connectOverCDP(`http://localhost:${cdpPort}`);
        const pages = browser.contexts()[0]?.pages();
        page = pages?.length ? pages[0] : await browser.contexts()[0]?.newPage();
        if (page) setupPageListeners(page);
        connectedMode = true;
        return { content: [{ type: "text", text: `Conectado ao Chrome existente na porta ${cdpPort}.` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Falha ao conectar no Chrome (porta ${cdpPort}). Feche o Chrome e abra com: chrome.exe --remote-debugging-port=${cdpPort}\nErro: ${e.message}` }] };
      }
    }
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
    setupPageListeners(page);
    connectedMode = false;
    return { content: [{ type: "text", text: "Navegador iniciado com sucesso." }] };
  }
);

server.tool(
  "browser_navigate",
  "Navega para uma URL",
  { url: z.string().describe("URL completa para navegar") },
  async ({ url }) => {
    if (!page) return { content: [{ type: "text", text: "Erro: Navegador nao iniciado." }] };
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    return { content: [{ type: "text", text: `Navegou para: ${page.url()}\nTitulo: ${await page.title()}` }] };
  }
);

// ── Sessão própria (ADR-011) — cookie httpOnly emitido pela API do M7arena ──
// O M7Academy injetava o token do Supabase no localStorage. No M7arena a sessão
// é um cookie httpOnly (`m7_session`) que a API define no login. Esta tool loga
// na API própria e mantém o cookie no contexto do browser (persistente).
server.tool(
  "browser_login",
  "Loga na API propria do M7arena (cookie httpOnly) para o browser ficar autenticado",
  {
    email: z.string().describe("Email do usuario"),
    password: z.string().describe("Senha do usuario"),
    url: z.string().describe("URL base do app").default("https://dev.m7arena.pro"),
  },
  async ({ email, password, url }) => {
    if (!page) return { content: [{ type: "text", text: "Erro: Navegador nao iniciado." }] };
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const resp = await page.evaluate(async ([apiUrl, mail, pwd]) => {
      const r = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mail, password: pwd }),
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, user: data.user || null };
    }, [url, email, password]);
    if (!resp.ok) {
      return { content: [{ type: "text", text: `Login falhou (${resp.status}). Usuario: ${JSON.stringify(resp.user)}` }] };
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    return { content: [{ type: "text", text: `Login OK como ${resp.user?.displayName || resp.user?.email}. Cookie de sessao definido.` }] };
  }
);

server.tool(
  "browser_click",
  "Clica em um elemento CSS",
  { selector: z.string().describe("Seletor CSS") },
  async ({ selector }) => {
    if (!page) return { content: [{ type: "text", text: "Erro: Navegador nao iniciado." }] };
    await page.click(selector);
    return { content: [{ type: "text", text: `Clicou em: ${selector}` }] };
  }
);

server.tool(
  "browser_type",
  "Digita texto em um input",
  {
    selector: z.string().describe("Seletor CSS do input"),
    text: z.string().describe("Texto para digitar"),
  },
  async ({ selector, text }) => {
    if (!page) return { content: [{ type: "text", text: "Erro: Navegador nao iniciado." }] };
    await page.fill(selector, text);
    return { content: [{ type: "text", text: `Digitou em ${selector}` }] };
  }
);

server.tool("browser_errors", "Lista todos os erros de console e rede capturados", {}, async () => {
  if (!page) return { content: [{ type: "text", text: "Erro: Navegador nao iniciado." }] };
  const lines = [];
  lines.push("=== ERROS DE CONSOLE ===");
  if (consoleErrors.length === 0) {
    lines.push("(nenhum)");
  } else {
    for (const e of consoleErrors) {
      lines.push(`[${e.timestamp}] [${e.type}] ${e.text}`);
      if (e.stack) lines.push(`  Stack: ${e.stack}`);
    }
  }
  lines.push("\n=== ERROS DE REDE (4xx/5xx/FAIL) ===");
  if (networkErrors.length === 0) {
    lines.push("(nenhum)");
  } else {
    for (const e of networkErrors) {
      lines.push(`[${e.timestamp}] ${e.method} ${e.url} -> ${e.status || "FAIL"} ${e.statusText || e.failure || ""}`);
    }
  }
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

server.tool("browser_url", "Retorna URL e titulo atuais", {}, async () => {
  if (!page) return { content: [{ type: "text", text: "Erro: Navegador nao iniciado." }] };
  return { content: [{ type: "text", text: `${page.url()}\nTitulo: ${await page.title()}` }] };
});

server.tool(
  "browser_wait",
  "Espera N milissegundos",
  { ms: z.number().describe("Milissegundos").default(2000) },
  async ({ ms }) => {
    await new Promise((r) => setTimeout(r, ms));
    return { content: [{ type: "text", text: `Esperou ${ms}ms` }] };
  }
);

server.tool(
  "browser_evaluate",
  "Executa JavaScript na pagina e retorna o resultado",
  { expression: z.string().describe("Expressao JS") },
  async ({ expression }) => {
    if (!page) return { content: [{ type: "text", text: "Erro: Navegador nao iniciado." }] };
    const result = await page.evaluate((expr) => {
      // eslint-disable-next-line no-new-func
      return new Function(`return (async () => { return (${expr}) })()`)();
    }, expression);
    return { content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }] };
  }
);

server.tool("browser_close", "Fecha o navegador e limpa os erros", {}, async () => {
  if (browser) {
    if (!connectedMode) {
      await browser.close();
    }
    browser = null;
    page = null;
  }
  connectedMode = false;
  consoleErrors = []; networkErrors = [];
  return { content: [{ type: "text", text: connectedMode ? "Desconectado do Chrome (navegador mantido aberto)." : "Navegador fechado." }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
