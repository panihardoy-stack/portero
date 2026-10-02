"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UnirseEdificioForm() {
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

  const claseInput = "rounded-md border p-2 text-sm bg-transparent";

  return (
    <form onSubmit={unirse} className="mt-4 flex flex-col gap-3 rounded-md border p-4">
      <p className="text-sm font-medium">Unite a tu edificio</p>
      <p className="text-sm text-muted-foreground">
        Pedile el código de invitación a la administración.
      </p>

      <input
        placeholder="Tu nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={claseInput}
      />
      <input
        required
        placeholder="Código de invitación (ej: 6f1d43)"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        className={claseInput}
      />
      <input
        required
        placeholder="Tu unidad (ej: 2A)"
        value={unidad}
        onChange={(e) => setUnidad(e.target.value)}
        className={claseInput}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? "Uniéndote..." : "Unirme"}
      </button>
    </form>
  );
}