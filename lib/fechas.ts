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
  return fechaCorta(iso);
}

const DIA_MES: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
const HORA: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

// "9 de octubre"
export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", DIA_MES);
}

// "9 de octubre, 11:00"
export function fechaHora(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-UY", DIA_MES)}, ${d.toLocaleTimeString("es-UY", HORA)}`;
}

// "viernes 9 de octubre a las 11:00"
export function fechaLarga(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-UY", { weekday: "long", ...DIA_MES })} a las ${d.toLocaleTimeString("es-UY", HORA)}`;
}

// Convierte una fecha guardada al formato del campo "fecha y hora" (hora local)
export function aCampoFecha(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}
