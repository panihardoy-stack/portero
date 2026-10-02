import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SalirButton } from "@/components/salir-button";
import { FUENTE_DISPLAY } from "@/components/portero-ui";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F3F4F1] text-[#18211D]">
      <header className="border-b border-[#DDE1DB] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
          <Link
            href="/protected"
            className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-4"
          >
            <span
              aria-hidden
              className="h-5 w-7 rounded-[2px] border border-[#B8904F] bg-[linear-gradient(180deg,#F4E7CF,#E3CA9F)] shadow-[inset_0_0_0_1.5px_#F8EEDC]"
            />
            <span className={`${FUENTE_DISPLAY} text-xl font-semibold tracking-tight`}>Portero</span>
          </Link>
          <Suspense fallback={null}>
            <Usuario />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}

async function Usuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex items-center gap-4">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium">{perfil?.nombre ?? user.email}</p>
        <p className="text-xs text-[#5B655F]">
          {perfil?.rol === "admin" ? "Administración" : "Vecino"}
        </p>
      </div>
      <SalirButton />
    </div>
  );
}
