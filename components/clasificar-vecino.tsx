"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCatalogos } from "@/components/catalogos-provider";
import { BOTON_PRIMARIO, CAMPO } from "@/components/portero-ui";

const SELECT =
  "h-10 rounded-md border border-[#CFD5CD] bg-white px-3 text-sm focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20";

export function ClasificarVecino({ vecinoId, tipo, motivo }: { vecinoId: string; tipo: string; motivo: string | null }) {
  const router = useRouter();
  const { tiposVecino } = useCatalogos();
  const [nuevoTipo, setNuevoTipo] = useState(tipo);
  const [nuevoMotivo, setNuevoMotivo] = useState(motivo ?? "");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const cambio = nuevoTipo !== tipo || nuevoMotivo !== (motivo ?? "");

  async function guardar() {
    setMensaje(null);
    if (nuevoTipo !== "estandar" && !nuevoMotivo.trim()) {
      setMensaje({ ok: false, texto: "Anotá el motivo del perfil." });
      return;
    }
    setGuardando(true);
    const supabase = createClient();
    // RLS verifica que el vecino sea de un edificio de este admin.
    // Estándar no se guarda: sin fila, el vecino es estándar.
    const { error } =
      nuevoTipo === "estandar"
        ? await supabase.from("clasificacion_vecinos").delete().eq("vecino_id", vecinoId)
        : await supabase.from("clasificacion_vecinos").upsert({
            vecino_id: vecinoId,
            tipo: nuevoTipo,
            motivo: nuevoMotivo.trim(),
            updated_at: new Date().toISOString(),
          });
    setGuardando(false);
    if (error) {
      setMensaje({ ok: false, texto: "No se pudo guardar: " + error.message });
      return;
    }
    setMensaje({ ok: true, texto: "Guardado." });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 sm:w-[26rem]">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`tipo-${vecinoId}`}>Perfil</label>
        <select id={`tipo-${vecinoId}`} value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} className={SELECT}>
          {tiposVecino.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.nombre}
            </option>
          ))}
        </select>
        {nuevoTipo !== "estandar" && (
          <>
            <label className="sr-only" htmlFor={`motivo-${vecinoId}`}>Motivo</label>
            <input
              id={`motivo-${vecinoId}`}
              value={nuevoMotivo}
              onChange={(e) => setNuevoMotivo(e.target.value)}
              placeholder="Motivo, por ejemplo: dos quejas formales"
              className={`${CAMPO} h-10`}
            />
          </>
        )}
      </div>
      {(cambio || mensaje) && (
        <div className="flex items-center gap-3">
          {cambio && (
            <button type="button" onClick={guardar} disabled={guardando} className={`${BOTON_PRIMARIO} py-1.5`}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          )}
          {mensaje && (
            <p role={mensaje.ok ? "status" : "alert"} className={`text-sm ${mensaje.ok ? "text-[#265A42]" : "text-[#A3352B]"}`}>
              {mensaje.texto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
