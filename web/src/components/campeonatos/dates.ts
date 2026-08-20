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
