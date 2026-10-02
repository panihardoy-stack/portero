"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, CAMPO } from "@/components/portero-ui";

export function UnirseEdificioForm({ pedirNombre = true }: { pedirNombre?: boolean }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [unidad, setUnidad] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unirse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const supabase = createClient();
    // La función de la base valida el código y la unidad antes de asociar al vecino
    const { error } = await supabase.rpc("unirse_edificio", {
      p_codigo: codigo,
      p_unidad: unidad,
      p_nombre: nombre,
    });

    setEnviando(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <form
      onSubmit={unirse}
      className="flex flex-col gap-4 rounded-lg border border-[#DDE1DB] bg-white p-5 sm:p-6"
    >
      {pedirNombre && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium">
            Tu nombre
          </label>
          <input
            id="nombre"
            autoComplete="name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={CAMPO}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="codigo" className="text-sm font-medium">
          Código del edificio
        </label>
        <input
          id="codigo"
          required
          autoComplete="off"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Por ejemplo: 6f1d43"
          className={`${CAMPO} tracking-[0.15em] placeholder:tracking-normal`}
        />
        <p className="text-xs text-[#5B655F]">Son seis caracteres. Te lo da la administración.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="unidad" className="text-sm font-medium">
          Tu unidad
        </label>
        <input
          id="unidad"
          required
          autoComplete="off"
          value={unidad}
          onChange={(e) => setUnidad(e.target.value)}
          placeholder="Por ejemplo: 2A"
          className={`${CAMPO} uppercase placeholder:normal-case`}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-[#F7E3E0] px-3 py-2 text-sm text-[#8E2C23]">
          {error}
        </p>
      )}

      <button type="submit" disabled={enviando} className={`${BOTON_PRIMARIO} self-start`}>
        {enviando ? "Uniéndote…" : "Unirme al edificio"}
      </button>
    </form>
  );
}
