"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO } from "@/components/portero-ui";
import { useCatalogos } from "@/components/catalogos-provider";

type Proveedor = { id: number; nombre: string; categoria: string };
type Reclamo = {
  id: number;
  categoria: string | null;
  urgencia: string | null;
  proveedor_id: number | null;
  estado: string;
};

// Lo que calculó la base con las reglas de prioridad (vista reclamos_detalle)
export type Prioridad = { base: string | null; calculada: string | null; motivos: string[] };

export type SugerenciaIA = {
  categoria: string | null;
  urgencia: string | null;
  proveedor_id: number | null;
  justificacion: string | null;
};

const SELECT =
  "h-10 w-full rounded-md border border-[#CFD5CD] bg-white px-3 text-sm text-[#18211D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20";

// Convierte una fecha guardada al formato del campo "fecha y hora" (hora local)
function aCampoFecha(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function GestionarReclamo({
  reclamo,
  proveedores,
  ia,
  visita,
  prioridad,
}: {
  reclamo: Reclamo;
  proveedores: Proveedor[];
  ia?: SugerenciaIA;
  visita?: string | null;
  prioridad?: Prioridad;
}) {
  const { categorias, urgencias, estados, etiquetas } = useCatalogos();
  const router = useRouter();
  const [categoria, setCategoria] = useState(reclamo.categoria ?? "");
  const [urgencia, setUrgencia] = useState(reclamo.urgencia ?? "");
  const [proveedorId, setProveedorId] = useState(reclamo.proveedor_id?.toString() ?? "");
  const [estado, setEstado] = useState(reclamo.estado);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [fechaVisita, setFechaVisita] = useState(aCampoFecha(visita));

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
    // Para agendar hace falta la fecha y hora de la visita
    if (estado === "agendado" && !fechaVisita) {
      setMensaje({ tipo: "error", texto: "Elegí la fecha y hora de la visita para agendar el reclamo." });
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

    if (error) {
      setGuardando(false);
      setMensaje({ tipo: "error", texto: "No se pudieron guardar los cambios: " + error.message });
      return;
    }

    // Si se agendó una fecha nueva, se registra la visita. n8n la toma y crea el evento en Google Calendar.
    let textoOk = "Cambios guardados.";
    if (estado === "agendado" && fechaVisita !== aCampoFecha(visita)) {
      const { error: errorVisita } = await supabase.from("visitas").insert({
        reclamo_id: reclamo.id,
        fecha: new Date(fechaVisita).toISOString(),
      });
      if (errorVisita) {
        setGuardando(false);
        setMensaje({ tipo: "error", texto: "Se guardó el estado, pero no la visita: " + errorVisita.message });
        return;
      }
      textoOk = "Cambios guardados. La visita se va a agregar a Google Calendar en un minuto.";
    }

    setGuardando(false);
    setMensaje({ tipo: "ok", texto: textoOk });
    router.refresh();
  }

  const id = (campo: string) => `${campo}-${reclamo.id}`;

  const hayIA = !!ia?.categoria;
  const proveedorIA = proveedores.find((p) => p.id === ia?.proveedor_id);
  // La urgencia sugerida es la de la IA ajustada por las reglas de prioridad
  const urgenciaSugerida = prioridad?.calculada ?? ia?.urgencia ?? null;
  const subio = !!prioridad?.calculada && !!prioridad.base && prioridad.calculada !== prioridad.base;
  const yaCoincide =
    hayIA &&
    categoria === (ia?.categoria ?? "") &&
    urgencia === (urgenciaSugerida ?? "") &&
    proveedorId === (ia?.proveedor_id?.toString() ?? "");

  function usarSugerencia() {
    if (!ia) return;
    setCategoria(ia.categoria ?? "");
    setUrgencia(urgenciaSugerida ?? "");
    setProveedorId(ia.proveedor_id?.toString() ?? "");
    if (estado === "nuevo" && ia.proveedor_id) setEstado("asignado");
    setMensaje(null);
  }

  async function pedirSugerencia() {
    setAnalizando(true);
    setMensaje(null);
    const respuesta = await fetch("/api/clasificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reclamoId: reclamo.id, forzar: true }),
    }).catch(() => null);
    setAnalizando(false);
    if (!respuesta?.ok) {
      setMensaje({ tipo: "error", texto: "La IA no respondió. Probá de nuevo o clasificalo a mano." });
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      {hayIA ? (
        <div className="flex flex-col gap-2 rounded-md border border-[#CFE0D7] bg-[#EEF4F0] p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#1E4D3E]">Sugerencia de la IA y las reglas de prioridad</p>
            <p className="mt-0.5 text-sm font-medium">
              {etiquetas.categoria(ia!.categoria)}
              {urgenciaSugerida ? `, urgencia ${etiquetas.urgencia(urgenciaSugerida).toLowerCase()}` : ""}
              {proveedorIA ? `, ${proveedorIA.nombre}` : ""}
            </p>
            {ia!.justificacion && <p className="mt-1 text-sm text-[#5B655F]">{ia!.justificacion}</p>}
            {subio && (
              <p className="mt-2 text-sm text-[#7A4F12]">
                Subió de {etiquetas.urgencia(prioridad!.base).toLowerCase()} a{" "}
                {etiquetas.urgencia(prioridad!.calculada).toLowerCase()}: {prioridad!.motivos.join(" y ").toLowerCase()}.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {yaCoincide ? (
              <span className="text-xs text-[#265A42]">Coincide con lo elegido</span>
            ) : (
              <button
                type="button"
                onClick={usarSugerencia}
                className="rounded-md border border-[#1E4D3E] bg-white px-3 py-1.5 text-sm font-medium text-[#1E4D3E] hover:bg-[#F3F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]"
              >
                Usar sugerencia
              </button>
            )}
            <button
              type="button"
              onClick={pedirSugerencia}
              disabled={analizando}
              className="text-xs text-[#5B655F] underline-offset-4 hover:underline disabled:opacity-60"
            >
              {analizando ? "Analizando…" : "Volver a pedir"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-[#CFD5CD] px-3 py-2.5">
          <p className="text-sm text-[#5B655F]">Este reclamo no tiene sugerencia de la IA.</p>
          <button
            type="button"
            onClick={pedirSugerencia}
            disabled={analizando}
            className="rounded-md border border-[#1E4D3E] bg-white px-3 py-1.5 text-sm font-medium text-[#1E4D3E] hover:bg-[#F3F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] disabled:opacity-60"
          >
            {analizando ? "Analizando la foto y el texto…" : "Pedir sugerencia a la IA"}
          </button>
        </div>
      )}

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
            {categorias.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nombre}
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
            {urgencias.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.nombre}
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
            {estados.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.nombre_admin}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {estado === "agendado" && (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor={id("visita")} className="text-xs font-medium text-[#5B655F]">
            Fecha y hora de la visita
          </label>
          <input
            id={id("visita")}
            type="datetime-local"
            value={fechaVisita}
            onChange={(e) => setFechaVisita(e.target.value)}
            className={SELECT}
          />
          {visita && fechaVisita !== aCampoFecha(visita) && (
            <p className="text-xs text-[#7A4F12]">
              Al guardar se agenda una visita nueva. La anterior queda en Calendar hasta que la borres.
            </p>
          )}
        </div>
      )}

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
