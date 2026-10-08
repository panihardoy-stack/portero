// Ayudas de fechas que usan el panel, la bandeja y el dashboard

export const DIA = 1000 * 60 * 60 * 24;

export function diasEntre(desde: string, hasta: string | number) {
  return (new Date(hasta).getTime() - new Date(desde).getTime()) / DIA;
}

export function tiempoRelativo(iso: string, ahora: number) {
  const dias = Math.floor(diasEntre(iso, ahora));
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias < 30) return `Hace ${dias} días`;
  return new Date(iso).toLocaleDateString("es-UY", { day: "numeric", month: "long" });
}
