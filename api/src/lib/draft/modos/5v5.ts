/**
 * 5v5 — draft completo (tournament draft).
 *
 * 20 turnos: 6 bans (3 por lado) → 6 picks (3 por lado) → 4 bans (2 por lado)
 * → 4 picks (2 por lado). Total: 5 bans e 5 picks por lado (os slots da tela).
 *
 * CAPITÃO: na sala 5v5 personalizada o MID de cada time é quem bane/escolhe
 * (decisão do usuário 2026-10-19). A regra é aplicada no SERVIDOR
 * (`aplicarAcaoDraft`) e publicada no shape para a UI desabilitar o botão dos
 * demais jogadores — as outras roles só assistem.
 */
import type { DraftRules } from "../tipos.js";

export const RULES_5V5: DraftRules = {
  ativo: true,
  turnOrder: [
    { team: "blue", phase: "ban" }, // 0
    { team: "red", phase: "ban" }, // 1
    { team: "blue", phase: "ban" }, // 2
    { team: "red", phase: "ban" }, // 3
    { team: "blue", phase: "ban" }, // 4
    { team: "red", phase: "ban" }, // 5
    { team: "blue", phase: "pick" }, // 6
    { team: "red", phase: "pick" }, // 7
    { team: "red", phase: "pick" }, // 8
    { team: "blue", phase: "pick" }, // 9
    { team: "blue", phase: "pick" }, // 10
    { team: "red", phase: "pick" }, // 11
    { team: "red", phase: "ban" }, // 12
    { team: "blue", phase: "ban" }, // 13
    { team: "red", phase: "ban" }, // 14
    { team: "blue", phase: "ban" }, // 15
    { team: "red", phase: "pick" }, // 16
    { team: "blue", phase: "pick" }, // 17
    { team: "blue", phase: "pick" }, // 18
    { team: "red", phase: "pick" }, // 19
  ],
  maxBansPorLado: 5,
  maxPicksPorLado: 5,
  esconderPicksAdversario: false,
  roleControladora: "MID",
  apenasRoleControladora: true,
};
