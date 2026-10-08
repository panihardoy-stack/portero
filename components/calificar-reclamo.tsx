"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, BOTON_TEXTO, CAMPO, COLOR_ESTRELLA, Estrellas, FORMA_ESTRELLA } from "@/components/portero-ui";

const TEXTOS = ["", "Muy mal", "Mal", "Regular", "Bien", "Muy bien"];

// El vecino califica el arreglo de un reclamo resuelto. Puede cambiar la calificación después.
export function CalificarReclamo({
  reclamoId,
  actual,
}: {
  reclamoId: number;
  actual?: { puntaje: number; comentario: string | null } | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(!actual);
  const [puntaje, setPuntaje] = useState(actual?.puntaje ?? 0);
  const [encima, setEncima] = useState(0);
  const [comentario, setComentario] = useState(actual?.comentario ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  if (!editando && actual) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-[#F6F1E6] px-3 py-2">
        <span className="text-sm text-[#5B655F]">Tu calificación</span>
        <Estrellas puntaje={actual.puntaje} />
        {actual.comentario && <span className="text-sm">“{actual.comentario}”</span>}
        <button
          type="button"
          onClick={() => setEditando(true)}
          className={`ml-auto ${BOTON_TEXTO}`}
        >
          Cambiar
        </button>
      </div>
    );
  }

  async function enviar() {
    if (!puntaje) {
      setError("Elegí de 1 a 5 estrellas.");
      return;
    }
    setError("");
    setGuardando(true);
    // RLS verifica que el reclamo sea de este vecino y que esté resuelto
    const { error } = await createClient()
      .from("calificaciones")
      .upsert({
        reclamo_id: reclamoId,
        puntaje,
        comentario: comentario.trim() || null,
        updated_at: new Date().toISOString(),
      });
    setGuardando(false);
    if (error) {
      setError("No se pudo guardar la calificación. Probá de nuevo.");
      return;
    }
    setEditando(false);
    router.refresh();
  }

  const mostrado = encima || puntaje;
  const grupo = `puntaje-${reclamoId}`;

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-[#E3D5B8] bg-[#FBF7EE] p-3">
      <legend className="sr-only">Calificá cómo se resolvió</legend>
      <p className="text-sm font-medium">¿Cómo se resolvió?</p>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setEncima(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setEncima(n)}>
              <input
                type="radio"
                name={grupo}
                value={n}
                checked={puntaje === n}
                onChange={() => setPuntaje(n)}
                className="peer sr-only"
              />
              <span className="sr-only">{n} {n === 1 ? "estrella" : "estrellas"}</span>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-7 w-7 rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[#1E4D3E]"
              >
                <path
                  d={FORMA_ESTRELLA}
                  fill={n <= mostrado ? COLOR_ESTRELLA : "white"}
                  stroke={n <= mostrado ? COLOR_ESTRELLA : "#B9C0B8"}
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
            </label>
          ))}
        </div>
        <span className="text-sm text-[#5B655F]" aria-live="polite">
          {TEXTOS[mostrado]}
        </span>
      </div>
      <label htmlFor={`comentario-${reclamoId}`} className="sr-only">
        Comentario
      </label>
      <textarea
        id={`comentario-${reclamoId}`}
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Comentario opcional: puntualidad, trato, si quedó bien"
        className={CAMPO}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={enviar} disabled={guardando} className={BOTON_PRIMARIO}>
          {guardando ? "Guardando…" : "Enviar calificación"}
        </button>
        {actual && (
          <button
            type="button"
            onClick={() => setEditando(false)}
            className={`${BOTON_TEXTO} text-[#5B655F]`}
          >
            Cancelar
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-[#A3352B]">
            {error}
          </p>
        )}
      </div>
    </fieldset>
  );
}
