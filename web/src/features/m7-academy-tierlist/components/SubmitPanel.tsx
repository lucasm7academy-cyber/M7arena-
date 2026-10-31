import { Loader2, Send } from "lucide-react";

interface SubmitPanelProps {
  canSubmit: boolean;
  saving: boolean;
  error: string;
  onSubmit: () => void;
}

export function SubmitPanel({ canSubmit, saving, error, onSubmit }: SubmitPanelProps) {
  return (
    <section className="border-t border-white/10 pt-6">
      {error ? <p className="mb-3 text-[11px] font-medium text-red-400">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-medium text-white/25">
          {canSubmit ? "Tudo certo para enviar." : "Preencha os dados e escolha pelo menos 3 campeões."}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || saving}
          className="flex h-12 items-center justify-center gap-2 bg-primary px-6 text-[10px] font-black uppercase tracking-widest text-black transition-colors hover:bg-[#e6a600] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {saving ? "Enviando..." : "Enviar tier list"}
        </button>
      </div>
    </section>
  );
}
