import Link from "next/link";
import { Suspense } from "react";
import { obtenerSesion } from "@/lib/datos/sesion";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import { CatalogosProvider } from "@/components/catalogos-provider";
import { SalirButton } from "@/components/salir-button";
import { NavAdmin } from "@/components/nav-admin";
import { FUENTE_DISPLAY } from "@/components/portero-ui";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F3F4F1] text-[#18211D]">
      <header className="sticky top-0 z-20 border-b border-[#DDE1DB] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-stretch justify-between gap-4 px-5">
          <div className="flex min-w-0 items-stretch gap-6">
            <Link
              href="/protected"
              className="flex shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-4"
            >
              <span
                aria-hidden
                className="h-5 w-7 rounded-[2px] border border-[#B8904F] bg-[linear-gradient(180deg,#F4E7CF,#E3CA9F)] shadow-[inset_0_0_0_1.5px_#F8EEDC]"
              />
              <span className={`${FUENTE_DISPLAY} text-xl font-semibold tracking-tight`}>Portero</span>
            </Link>
            <Suspense fallback={null}>
              <Navegacion />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <Usuario />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <Navegacion movil />
        </Suspense>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
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

// Solo el admin tiene secciones; el vecino tiene una sola pantalla
// En el celular va en una segunda fila, debajo del logo
async function Navegacion({ movil = false }: { movil?: boolean }) {
  const sesion = await obtenerSesion();
  if (!sesion?.esAdmin) return null;
  return movil ? (
    <div className="flex h-11 border-t border-[#E6E9E4] px-2 sm:hidden">
      <NavAdmin />
    </div>
  ) : (
    <div className="hidden items-stretch sm:flex">
      <NavAdmin />
    </div>
  );
}

async function Usuario() {
  const sesion = await obtenerSesion();
  if (!sesion) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="hidden text-right leading-tight md:block">
        <p className="text-sm font-medium">{sesion.nombre}</p>
        <p className="text-xs text-[#5B655F]">{sesion.esAdmin ? "Administración" : "Vecino"}</p>
      </div>
      <SalirButton />
    </div>
  );
}
