import { WEEK_DAYS } from "./constants";
import type { AvailabilityWindow } from "./types";

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Máscara visual de WhatsApp brasileiro; o estado guarda só os dígitos. */
export function maskWhatsapp(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatAvailability(windows: AvailabilityWindow[]): string {
  return [...windows]
    .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio))
    .map((janela) => {
      const dia = WEEK_DAYS.find((d) => d.value === janela.diaSemana)?.label ?? String(janela.diaSemana);
      return `${dia} ${janela.horaInicio}–${janela.horaFim}`;
    })
    .join(" · ");
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Aceita janelas normais e a janela 22:00–00:00 (meia-noite). */
export function isValidAvailabilityWindow(janela: AvailabilityWindow): boolean {
  if (!TIME_RE.test(janela.horaInicio) || !TIME_RE.test(janela.horaFim)) return false;
  if (janela.horaFim === "00:00") return janela.horaInicio !== "00:00";
  return janela.horaInicio < janela.horaFim;
}

