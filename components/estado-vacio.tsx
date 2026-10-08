import { FUENTE_DISPLAY } from "@/components/portero-ui";

// Recuadro para listas vacías: se usa en la bandeja, el panel del vecino y vecinos
export function EstadoVacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#CFD5CD] bg-white px-6 py-10 text-center">
      <p className={`${FUENTE_DISPLAY} text-lg font-semibold`}>{titulo}</p>
      <p className="mt-1 text-sm text-[#5B655F]">{texto}</p>
    </div>
  );
}
