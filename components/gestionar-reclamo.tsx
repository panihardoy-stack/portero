"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIAS = ["sanitaria", "electrica", "ascensor", "humedad", "cerrajeria", "otros"];
const URGENCIAS = ["baja", "media", "alta"];
const ESTADOS = ["nuevo", "asignado", "agendado", "resuelto"];

type Proveedor = { id: number; nombre: string; categoria: string };
type Reclamo = {
  id: number;
  categoria: string | null;
  urgencia: string | null;
  proveedor_id: number | null;
  estado: string;
};

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
      setMensaje({ tipo: "error", texto: "Elegí un proveedor antes de asignar o agendar." });
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
      setMensaje({ tipo: "error", texto: "No se pudo guardar: " + error.message });
      return;
    }

    setMensaje({ tipo: "ok", texto: "Cambios guardados." });
    router.refresh();
  }

  const claseSelect = "rounded-md border p-2 text-sm bg-transparent";

  return (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Categoría
          <select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setProveedorId(""); // al cambiar categoría, se vuelve a elegir proveedor
            }}
            className={claseSelect}
          >
            <option value="">Sin definir</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Urgencia
          <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className={claseSelect}>
            <option value="">Sin definir</option>
            {URGENCIAS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Proveedor
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={claseSelect}>
            <option value="">Sin asignar</option>
            {opcionesProveedor.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={claseSelect}>
            {ESTADOS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        {mensaje && (
          <p className={`text-sm ${mensaje.tipo === "ok" ? "text-green-600" : "text-red-500"}`}>
            {mensaje.texto}
          </p>
        )}
      </div>
    </div>
  );
}