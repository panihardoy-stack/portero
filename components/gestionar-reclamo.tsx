"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BOTON_PRIMARIO,
  CATEGORIAS,
  CATEGORIA_LABEL,
  ESTADOS,
  ESTADO_INFO,
  URGENCIAS,
  URGENCIA_INFO,
} from "@/components/portero-ui";

type Proveedor = { id: number; nombre: string; categoria: string };
type Reclamo = {
  id: number;
  categoria: string | null;
  urgencia: string | null;
  proveedor_id: number | null;
  estado: string;
};

const SELECT =
  "h-10 w-full rounded-md border border-[#CFD5CD] bg-white px-3 text-sm text-[#18211D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20";

export function GestionarReclamo({
  reclamo,
  proveedores,
}: {
  reclamo: Reclamo;
  proveedores: Proveedor[];
}) {
  const router = useRouter();
  const [categoria, setCategoria] = useState(reclamo.categoria ?? "");
  const [urgencia, setUrgencia] = useState(reclamo.urgencia ?? "");
  const [proveedorId, setProveedorId] = useState(reclamo.proveedor_id?.toString() ?? "");
  const [estado, setEstado] = useState(reclamo.estado);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Si hay categoría elegida, solo se muestran los proveedores de esa categoría
  const opcionesProveedor = categoria
    ? proveedores.filter((p) => p.categoria === categoria)
    : proveedores;

  async function guardar() {
    setMensaje(null);

    // Regla de negocio: no se asigna ni agenda sin proveedor
    if ((estado === "asignado" || estado === "agendado") && !proveedorId) {
      setMensaje({ tipo: "error", texto: "Elegí un proveedor para asignar o agendar el reclamo." });
      return;
    }

    setGuardando(true);

    const cambios: Record<string, unknown> = {
      categoria: categoria || null,
      urgencia: urgencia || null,
      proveedor_id: proveedorId ? Number(proveedorId) : null,
      estado,
    };
    // Fecha de resolución: se guarda al pasar a "resuelto" y se borra si se reabre
    if (estado === "resuelto" && reclamo.estado !== "resuelto") {
      cambios.resuelto_at = new Date().toISOString();
    } else if (estado !== "resuelto") {
      cambios.resuelto_at = null;
    }

    const supabase = createClient();
    // RLS verifica que el admin solo pueda modificar reclamos de sus edificios
    const { error } = await supabase.from("reclamos").update(cambios).eq("id", reclamo.id);

    setGuardando(false);

    if (error) {
      setMensaje({ tipo: "error", texto: "No se pudieron guardar los cambios: " + error.message });
      return;
    }

    setMensaje({ tipo: "ok", texto: "Cambios guardados." });
    router.refresh();
  }

  const id = (campo: string) => `${campo}-${reclamo.id}`;

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Categoría" htmlFor={id("categoria")}>
          <select
            id={id("categoria")}
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setProveedorId(""); // al cambiar categoría, se vuelve a elegir proveedor
            }}
            className={SELECT}
          >
            <option value="">Sin clasificar</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_LABEL[c]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Urgencia" htmlFor={id("urgencia")}>
          <select
            id={id("urgencia")}
            value={urgencia}
            onChange={(e) => setUrgencia(e.target.value)}
            className={SELECT}
          >
            <option value="">Sin definir</option>
            {URGENCIAS.map((u) => (
              <option key={u} value={u}>
                {URGENCIA_INFO[u].label}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Proveedor"
          htmlFor={id("proveedor")}
          ayuda={categoria && opcionesProveedor.length === 0 ? "No hay proveedores de esta categoría." : undefined}
        >
          <select
            id={id("proveedor")}
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className={SELECT}
          >
            <option value="">Sin asignar</option>
            {opcionesProveedor.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Estado" htmlFor={id("estado")}>
          <select
            id={id("estado")}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className={SELECT}
          >
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {ESTADO_INFO[s].admin}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando} className={BOTON_PRIMARIO}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {mensaje && (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={`text-sm ${mensaje.tipo === "ok" ? "text-[#265A42]" : "text-[#A3352B]"}`}
          >
            {mensaje.texto}
          </p>
        )}
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  htmlFor,
  ayuda,
  children,
}: {
  etiqueta: string;
  htmlFor: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-[#5B655F]">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="text-xs text-[#7A4F12]">{ayuda}</p>}
    </div>
  );
}
