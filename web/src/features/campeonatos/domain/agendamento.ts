/** Preserva os sentinelas do cronograma sem reinterpretar datas ou horarios. */
export const semHorario = (data?: string, hora?: string) =>
  !data || data === "A COMBINAR" || !hora || hora === "--:--";
