"use client";

import { useState } from "react";
import { FUENTE_DISPLAY } from "@/components/portero-ui";

// Código del edificio para que los vecinos se unan, con botón para copiarlo
export function CodigoInvitacion({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-3 rounded-md border border-[#DDE1DB] bg-white py-1.5 pl-3 pr-1.5">
      <span className="text-xs text-[#5B655F]">Código para vecinos</span>
      <span className={`${FUENTE_DISPLAY} text-base font-semibold tracking-[0.18em]`}>{codigo}</span>
      <button
        type="button"
        onClick={copiar}
        className="rounded px-2 py-1 text-xs font-medium text-[#1E4D3E] hover:bg-[#F3F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]"
      >
        <span aria-live="polite">{copiado ? "Copiado" : "Copiar"}</span>
      </button>
    </div>
  );
}
