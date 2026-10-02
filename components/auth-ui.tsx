import { FUENTE_DISPLAY } from "@/components/portero-ui";

// Piezas compartidas de las pantallas de ingreso

// Traduce los mensajes de error de Supabase a algo que se entienda
export function traducirError(error: unknown) {
  const mensaje = error instanceof Error ? error.message : String(error ?? "");
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) return "El mail o la contraseña no son correctos.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu mail. Revisá tu casilla.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya hay una cuenta con ese mail. Iniciá sesión.";
  if (m.includes("password should be at least") || m.includes("at least 6"))
    return "La contraseña tiene que tener al menos 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Hubo demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.";
  if (m.includes("same as the old") || m.includes("different from the old"))
    return "La contraseña nueva tiene que ser distinta de la anterior.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "Ese mail no parece válido. Revisalo.";
  if (m.includes("fetch") || m.includes("network"))
    return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  return "No se pudo completar. Probá de nuevo en unos minutos.";
}

export function EncabezadoAuth({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="mb-6">
      <h1 className={`${FUENTE_DISPLAY} text-3xl font-semibold tracking-tight`}>{titulo}</h1>
      {texto && <p className="mt-2 text-[#5B655F]">{texto}</p>}
    </div>
  );
}

export function ErrorAuth({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="rounded-md bg-[#F7E3E0] px-3 py-2 text-sm text-[#8E2C23]">
      {mensaje}
    </p>
  );
}

export const LINK =
  "font-medium text-[#1E4D3E] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] rounded-sm";
