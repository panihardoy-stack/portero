import Link from "next/link";
import { Suspense } from "react";
import { obtenerSesion } from "@/lib/datos/sesion";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import { CatalogosProvider } from "@/components/catalogos-provider";
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
      <main className="mx-auto max-w-5xl px-5 py-10">
        <Suspense fallback={<p className="text-sm text-[#5B655F]">Cargando…</p>}>
          <ConCatalogos>{children}</ConCatalogos>
        </Suspense>
      </main>
    </div>
  );
}

// Los catálogos se leen una vez y quedan disponibles para todas las pantallas
async function ConCatalogos({ children }: { children: React.ReactNode }) {
  const catalogos = await obtenerCatalogos();
  return <CatalogosProvider catalogos={catalogos}>{children}</CatalogosProvider>;
}

async function Usuario() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium">{sesion.nombre}</p>
        <p className="text-xs text-[#5B655F]">{sesion.esAdmin ? "Administración" : "Vecino"}</p>
      </div>
      <SalirButton />
    </div>
  );
}
