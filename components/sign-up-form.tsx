"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, CAMPO } from "@/components/portero-ui";
import { EncabezadoAuth, ErrorAuth, LINK, traducirError } from "@/components/auth-ui";

export function SignUpForm() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function registrarse(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== repetir) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        // El nombre lo guarda el trigger de la base en la tabla profiles
        data: { nombre: nombre.trim() },
        emailRedirectTo: `${window.location.origin}/protected`,
      },
    });

    if (error) {
      setError(traducirError(error));
      setCargando(false);
      return;
    }

    // Si la confirmación por mail está desactivada, ya hay sesión y sigue directo al panel
    if (data.session) {
      router.push("/protected");
      router.refresh();
    } else {
      router.push("/auth/sign-up-success");
    }
  }

  return (
    <>
      <EncabezadoAuth
        titulo="Crear una cuenta"
        texto="Si sos vecino, después vas a necesitar el código que te da la administración."
      />
      <form onSubmit={registrarse} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nombre" className="text-sm font-medium">
            Tu nombre
          </label>
          <input
            id="nombre"
            autoComplete="name"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={CAMPO}
          />
        </div>
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
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="repetir" className="text-sm font-medium">
            Repetí la contraseña
          </label>
          <input
            id="repetir"
            type="password"
            autoComplete="new-password"
            required
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            className={CAMPO}
          />
        </div>

        <ErrorAuth mensaje={error} />

        <button type="submit" disabled={cargando} className={`${BOTON_PRIMARIO} w-full py-2.5`}>
          {cargando ? "Creando la cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-8 border-t border-[#DDE1DB] pt-6 text-sm text-[#5B655F]">
        ¿Ya tenés cuenta?{" "}
        <Link href="/auth/login" className={LINK}>
          Iniciar sesión
        </Link>
      </p>
    </>
  );
}
