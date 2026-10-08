"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Secciones del administrador, siempre visibles en el encabezado
const SECCIONES = [
  { href: "/protected", texto: "Reclamos" },
  { href: "/protected/vecinos", texto: "Vecinos" },
  { href: "/protected/dashboard", texto: "Indicadores" },
];

export function NavAdmin() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="flex h-full items-stretch gap-1 overflow-x-auto">
      {SECCIONES.map((s) => {
        const activa = s.href === "/protected" ? pathname === s.href : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activa ? "page" : undefined}
            className={`relative flex items-center whitespace-nowrap px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E4D3E] ${
              activa
                ? "text-[#18211D] after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-[#1E4D3E]"
                : "text-[#5B655F] hover:text-[#18211D]"
            }`}
          >
            {s.texto}
          </Link>
        );
      })}
    </nav>
  );
}
