"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, CAMPO } from "@/components/portero-ui";
import { EncabezadoAuth, ErrorAuth, LINK, traducirError } from "@/components/auth-ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function ingresar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const { error } = await createClient().auth.signInWithPassword({ email, password });

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
      <EncabezadoAuth titulo="Iniciar sesión" texto="Entrá con el mail y la contraseña de tu cuenta." />
      <form onSubmit={ingresar} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={CAMPO}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <Link href="/auth/forgot-password" className={`${LINK} text-sm`}>
              ¿Te la olvidaste?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={CAMPO}
          />
        </div>

        <ErrorAuth mensaje={error} />

        <button type="submit" disabled={cargando} className={`${BOTON_PRIMARIO} w-full py-2.5`}>
          {cargando ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>

      <p className="mt-8 border-t border-[#DDE1DB] pt-6 text-sm text-[#5B655F]">
        ¿Primera vez en Portero?{" "}
        <Link href="/auth/sign-up" className={LINK}>
          Crear una cuenta
        </Link>
      </p>
    </>
  );
}
