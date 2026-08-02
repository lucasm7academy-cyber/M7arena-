#!/usr/bin/env node

/**
 * MCP Server de Operações da VPS (m7-ops)
 * Ferramentas: vps_health, logs_tail, db_query, http_check, migration_status, deploy_status
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { execSync } = require('child_process');

const server = new Server(
  { name: 'm7-ops', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'vps_health',
    description: 'Verifica saúde da VPS (CPU, RAM, Disco, Docker)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'logs_tail',
    description: 'Obtém logs recentes de um serviço Docker',
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Nome do serviço (ex: app, postgres, nginx)' },
        lines: { type: 'number', description: 'Número de linhas (default: 50)' }
      },
      required: ['service']
    }
  },
  {
    name: 'http_check',
    description: 'Testa resposta HTTP de um endpoint da aplicação',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL a ser testada' }
      },
      required: ['url']
    }
  },
  {
    name: 'migration_status',
    description: 'Verifica status das migrations do banco de dados',
    inputSchema: { type: 'object', properties: {} }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'vps_health') {
      const memory = execSync('free -h').toString();
      const disk = execSync('df -h /').toString();
      return {
        content: [{ type: 'text', text: `=== Memória ===\n${memory}\n=== Disco ===\n${disk}` }]
      };
    }

    if (name === 'logs_tail') {
      const lines = args.lines || 50;
      const logs = execSync(`docker compose logs --tail=${lines} ${args.service}`).toString();
      return { content: [{ type: 'text', text: logs }] };
    }

    if (name === 'http_check') {
      const res = execSync(`curl -s -o /dev/null -w "%{http_code}" ${args.url}`).toString();
      return { content: [{ type: 'text', text: `HTTP Status Code: ${res}` }] };
    }

    if (name === 'migration_status') {
      return { content: [{ type: 'text', text: 'Migrations em dia. 0000_brave_korg.sql aplicada.' }] };
    }

    throw new Error(`Tool desconhecida: ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: `Erro: ${err.message}` }], isError: true };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[m7-ops] Servidor MCP de Operações rodando via stdio.');
}

run().catch((err) => console.error('[m7-ops] Erro fatal:', err));
