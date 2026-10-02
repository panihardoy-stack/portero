"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, CAMPO } from "@/components/portero-ui";
import { EncabezadoAuth, ErrorAuth, traducirError } from "@/components/auth-ui";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const { error } = await createClient().auth.updateUser({ password });

    if (error) {
      setError(traducirError(error));
      setCargando(false);
      return;
    }
    router.push("/protected");
    router.refresh();
  }

  return (
    <>
      <EncabezadoAuth titulo="Elegí una contraseña nueva" texto="Vas a usarla para entrar a Portero." />
      <form onSubmit={guardar} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña nueva
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            aria-describedby="ayuda-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={CAMPO}
          />
          <p id="ayuda-password" className="text-xs text-[#5B655F]">
            Al menos 6 caracteres.
          </p>
        </div>

        <ErrorAuth mensaje={error} />

        <button type="submit" disabled={cargando} className={`${BOTON_PRIMARIO} w-full py-2.5`}>
          {cargando ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </>
  );
}
