export const formatDayOfWeek = (dateStr: string) => {
  if (!dateStr || dateStr === "A COMBINAR" || dateStr === "A definir")
    return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const date = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2]),
      );
      return date.toLocaleDateString("pt-BR", { weekday: "long" });
    }
  } catch {}
  return "";
};

export const formatFullDate = (dateStr: string) => {
  if (!dateStr || dateStr === "A COMBINAR" || dateStr === "A definir")
    return dateStr || "A definir";
  try {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      // Use UTC values if the string looks like a simple date YYYY-MM-DD to avoid timezone shifts
      if (dateStr.length === 10 && dateStr.includes("-")) {
        const [y, m, d] = dateStr.split("-").map(Number);
        return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
      }
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch {}
  return dateStr;
};

export const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === "A COMBINAR" || dateStr === "A definir")
    return dateStr;
  if (!dateStr.includes("-")) return dateStr; // Already in DD MMM format

  try {
    const date = new Date(dateStr + "T00:00:00");
    return date
      .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      .toUpperCase();
  } catch (e) {
    return dateStr;
  }
};

export const isMatchToday = (dateStr?: string | null): boolean => {
  if (!dateStr || dateStr === "A COMBINAR" || dateStr === "A definir") return false;

  try {
    let ymd = "";
    const trimmed = dateStr.trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      ymd = trimmed.substring(0, 10);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split("/");
      ymd = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, "0");
        const d = String(parsed.getDate()).padStart(2, "0");
        ymd = `${y}-${m}-${d}`;
      }
    }

    if (!ymd) return false;

    // Horário de Brasília (BRT - America/Sao_Paulo)
    const now = new Date();
    const brtFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayBrt = brtFormatter.format(now); // "YYYY-MM-DD"

    const localY = now.getFullYear();
    const localM = String(now.getMonth() + 1).padStart(2, "0");
    const localD = String(now.getDate()).padStart(2, "0");
    const todayLocal = `${localY}-${localM}-${localD}`;

    return ymd === todayBrt || ymd === todayLocal;
  } catch (err) {
    console.error("Erro ao verificar data de hoje:", err);
    return false;
  }
};
