"use client";

import { createContext, useContext, useMemo } from "react";
import { crearEtiquetas, type Catalogos } from "@/lib/catalogos";

// Los catálogos se leen una vez en el servidor (layout) y llegan a todos los
// componentes de cliente por contexto, sin pasarlos de mano en mano.
const Contexto = createContext<Catalogos | null>(null);

export function CatalogosProvider({ catalogos, children }: { catalogos: Catalogos; children: React.ReactNode }) {
  return <Contexto.Provider value={catalogos}>{children}</Contexto.Provider>;
}

export function useCatalogos() {
  const catalogos = useContext(Contexto);
  if (!catalogos) throw new Error("useCatalogos se usa dentro de CatalogosProvider");
  const etiquetas = useMemo(() => crearEtiquetas(catalogos), [catalogos]);
  return { ...catalogos, etiquetas };
}
