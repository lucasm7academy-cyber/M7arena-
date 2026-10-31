import { useRef, useState } from "react";
import { WEEK_DAYS } from "../constants";
import type { AvailabilityWindow } from "../types";

const PERIODOS = [
  { id: "19-22", label: "19:00 às 22:00", horaInicio: "19:00", horaFim: "22:00" },
  { id: "22-00", label: "22:00 às 00:00", horaInicio: "22:00", horaFim: "00:00" },
] as const;

type PeriodoId = (typeof PERIODOS)[number]["id"];

function detectarPeriodo(windows: AvailabilityWindow[]): PeriodoId {
  const primeiro = windows[0];
  return primeiro?.horaInicio === "22:00" && primeiro?.horaFim === "00:00" ? "22-00" : "19-22";
}

interface AvailabilityEditorProps {
  windows: AvailabilityWindow[];
  onChange: (windows: AvailabilityWindow[]) => void;
}

export function AvailabilityEditor({ windows, onChange }: AvailabilityEditorProps) {
  const [periodoId, setPeriodoId] = useState<PeriodoId>(() => detectarPeriodo(windows));
  const periodoRef = useRef<PeriodoId>(periodoId);

  function selecionarPeriodo(id: PeriodoId) {
    const selecionado = PERIODOS.find((item) => item.id === id);
    if (!selecionado) return;
    periodoRef.current = id;
    setPeriodoId(id);
    onChange(
      windows.map((janela) => ({
        ...janela,
        horaInicio: selecionado.horaInicio,
        horaFim: selecionado.horaFim,
      })),
    );
  }

  function toggleDia(diaSemana: number, ativo: boolean) {
    if (!ativo) {
      onChange(windows.filter((janela) => janela.diaSemana !== diaSemana));
      return;
    }

    if (windows.some((janela) => janela.diaSemana === diaSemana)) return;
    const selecionado = PERIODOS.find((item) => item.id === periodoRef.current) ?? PERIODOS[0];
    onChange([
      ...windows,
      { diaSemana, horaInicio: selecionado.horaInicio, horaFim: selecionado.horaFim },
    ]);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/45">
          Horários <span className="text-primary">*</span>
        </p>
        <span className="text-[9px] font-medium text-white/25">Escolha o horário e os dias</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        {PERIODOS.map((item) => {
          const ativo = item.id === periodoId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selecionarPeriodo(item.id)}
              className={`border px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                ativo
                  ? "border-primary bg-primary text-black"
                  : "border-white/10 bg-[#0c0d12] text-white/50 hover:border-white/25 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-white/10">
        {WEEK_DAYS.map((dia) => {
          const janela = windows.find((item) => item.diaSemana === dia.value);
          const ativo = Boolean(janela);
          return (
            <label
              key={dia.value}
              className="flex cursor-pointer items-center gap-2 border-b border-white/10 py-2.5"
            >
              <input
                type="checkbox"
                checked={ativo}
                onChange={(event) => toggleDia(dia.value, event.target.checked)}
                className="h-4 w-4 shrink-0 cursor-pointer accent-[#FFB800]"
              />
              <span className={`text-xs font-bold ${ativo ? "text-white" : "text-white/40"}`}>{dia.full}</span>
              <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-white/25">
                {janela ? `${janela.horaInicio} às ${janela.horaFim}` : "—"}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
