// src/lib/salaSenhaStore.ts
// Guarda temporariamente a senha de sala privada digitada no lobby, para o
// SalaMod1 reutilizar no POST /api/matches/:id/join. A validação real acontece
// no SERVIDOR (MORPH-001) — aqui só transportamos a senha da tela onde o
// usuário digitou até a tela onde ele entra na vaga. Nunca em localStorage
// persistente: apenas memória da sessão (some ao fechar a aba).

const chave = (salaId: number) => `m7_sala_senha_${salaId}`;

export function guardarSenhaSala(salaId: number, senha: string) {
  if (senha) sessionStorage.setItem(chave(salaId), senha);
}

export function lerSenhaSala(salaId: number): string {
  return sessionStorage.getItem(chave(salaId)) || "";
}

export function limparSenhaSala(salaId: number) {
  sessionStorage.removeItem(chave(salaId));
}
