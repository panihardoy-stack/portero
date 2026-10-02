"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, CAMPO } from "@/components/portero-ui";
import { EncabezadoAuth, ErrorAuth, LINK, traducirError } from "@/components/auth-ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    // Esta dirección tiene que estar permitida en Supabase: Authentication → URL Configuration
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setCargando(false);
    if (error) {
      setError(traducirError(error));
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <>
        <EncabezadoAuth
          titulo="Revisá tu mail"
          texto={`Si ${email} tiene una cuenta en Portero, te llega un link para elegir una contraseña nueva.`}
        />
        <Link href="/auth/login" className={`${LINK} text-sm`}>
          Volver a iniciar sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <EncabezadoAuth
        titulo="Recuperar la contraseña"
        texto="Escribí el mail de tu cuenta y te mandamos un link para elegir una nueva."
      />
      <form onSubmit={enviar} className="flex flex-col gap-5">
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

        <ErrorAuth mensaje={error} />

        <button type="submit" disabled={cargando} className={`${BOTON_PRIMARIO} w-full py-2.5`}>
          {cargando ? "Enviando…" : "Enviar el link"}
        </button>
      </form>

      <p className="mt-8 border-t border-[#DDE1DB] pt-6 text-sm text-[#5B655F]">
        ¿Te acordaste?{" "}
        <Link href="/auth/login" className={LINK}>
          Iniciar sesión
        </Link>
      </p>
    </>
  );
}
