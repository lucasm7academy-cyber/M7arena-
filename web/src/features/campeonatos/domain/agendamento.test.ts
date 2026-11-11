import { strictEqual } from "node:assert";
import { test } from "node:test";
import { semHorario } from "./agendamento.ts";

const casos: {
  nome: string;
  data?: string;
  hora?: string;
  esperado: boolean;
}[] = [
  { nome: "ambos ausentes", esperado: true },
  { nome: "data ausente", hora: "20:00", esperado: true },
  { nome: "hora ausente", data: "2026-11-10", esperado: true },
  { nome: "data vazia", data: "", hora: "20:00", esperado: true },
  { nome: "hora vazia", data: "2026-11-10", hora: "", esperado: true },
  { nome: "data a combinar", data: "A COMBINAR", hora: "20:00", esperado: true },
  { nome: "hora a combinar", data: "2026-11-10", hora: "--:--", esperado: true },
  { nome: "ambos a combinar", data: "A COMBINAR", hora: "--:--", esperado: true },
  { nome: "horário definido", data: "2026-11-10", hora: "20:00", esperado: false },
  { nome: "meia-noite definida", data: "2026-11-10", hora: "00:00", esperado: false },
  { nome: "sem normalização de espaços", data: " ", hora: " ", esperado: false },
  { nome: "sentinela mantém comparação literal", data: "a combinar", hora: "20:00", esperado: false },
  { nome: "não valida formato de calendário", data: "data legada", hora: "hora legada", esperado: false },
];

for (const { nome, data, hora, esperado } of casos) {
  test(`semHorario: ${nome}`, () => {
    strictEqual(semHorario(data, hora), esperado);
  });
}
