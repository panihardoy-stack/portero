"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/components/portero-ui";
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

type Cambios = {
  categoria?: string | null;
  urgencia?: string | null;
  proveedor_id?: number | null;
  estado?: string;
};

const SELECT =
  "h-10 w-full rounded-md border border-[#CFD5CD] bg-white px-3 text-sm text-[#18211D] focus:border-[#1E4D3E] focus:outline-none focus:ring-2 focus:ring-[#1E4D3E]/20";

const BOTON_TEXTO =
  "rounded px-1 text-sm font-medium text-[#1E4D3E] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] disabled:opacity-60";

// Convierte una fecha guardada al formato del campo "fecha y hora" (hora local)
function aCampoFecha(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// "viernes 9 de octubre a las 11:00"
function fechaLarga(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
  const hora = d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${dia} a las ${hora}`;
}

// Gestión de un reclamo: arriba, el próximo paso según el estado (un solo botón);
// abajo, todos los campos para corregir a mano. Los dos guardan con la misma función.
export function GestionarReclamo({
  reclamo,
  proveedores,
  ia,
  visita,
  prioridad,
  resueltoAt,
}: {
  reclamo: Reclamo;
  proveedores: Proveedor[];
  ia?: SugerenciaIA;
  visita?: string | null;
  prioridad?: Prioridad;
  resueltoAt?: string | null;
}) {
  const { categorias, urgencias, estados, etiquetas } = useCatalogos();
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const [reagendando, setReagendando] = useState(false);

  // Sugerencia: categoría y proveedor de la IA, urgencia ajustada por las reglas de prioridad
  const urgenciaSugerida = prioridad?.calculada ?? ia?.urgencia ?? null;
  const subio = !!prioridad?.calculada && !!prioridad.base && prioridad.calculada !== prioridad.base;

  // Campos del paso "asignar"
  const categoriaPaso = reclamo.categoria ?? ia?.categoria ?? null;
  const proveedoresPaso = categoriaPaso ? proveedores.filter((p) => p.categoria === categoriaPaso) : proveedores;
  const proveedorInicial = reclamo.proveedor_id ?? ia?.proveedor_id ?? proveedoresPaso[0]?.id ?? null;
  const [proveedorPaso, setProveedorPaso] = useState(proveedorInicial?.toString() ?? "");
  const [fechaPaso, setFechaPaso] = useState(aCampoFecha(visita));

  // Campos del formulario completo
  const [categoria, setCategoria] = useState(reclamo.categoria ?? "");
  const [urgencia, setUrgencia] = useState(reclamo.urgencia ?? "");
  const [proveedorId, setProveedorId] = useState(reclamo.proveedor_id?.toString() ?? "");
  const [estado, setEstado] = useState(reclamo.estado);
  const [fechaVisita, setFechaVisita] = useState(aCampoFecha(visita));
  const opcionesProveedor = categoria ? proveedores.filter((p) => p.categoria === categoria) : proveedores;

  const nombreProveedor = (id: number | string | null | undefined) =>
    proveedores.find((p) => p.id === Number(id))?.nombre ?? "";

  // Única función que escribe en la base. RLS verifica que el reclamo sea de un edificio de este admin.
  async function guardar(cambios: Cambios, nuevaVisita?: string, textoOk = "Cambios guardados.") {
    const estadoFinal = cambios.estado ?? reclamo.estado;
    const proveedorFinal = cambios.proveedor_id !== undefined ? cambios.proveedor_id : reclamo.proveedor_id;

    // Reglas de negocio: no se asigna ni agenda sin proveedor, ni se agenda sin fecha
    if ((estadoFinal === "asignado" || estadoFinal === "agendado") && !proveedorFinal) {
      setMensaje({ tipo: "error", texto: "Elegí un proveedor para asignar o agendar el reclamo." });
      return;
    }
    if (estadoFinal === "agendado" && !nuevaVisita && !visita) {
      setMensaje({ tipo: "error", texto: "Elegí la fecha y hora de la visita." });
      return;
    }

    setMensaje(null);
    setGuardando(true);
    const fila: Record<string, unknown> = { ...cambios };
    // Fecha de resolución: se guarda al pasar a resuelto y se borra si se reabre
    if (estadoFinal === "resuelto" && reclamo.estado !== "resuelto") fila.resuelto_at = new Date().toISOString();
    if (estadoFinal !== "resuelto") fila.resuelto_at = null;

    const supabase = createClient();
    const { error } = await supabase.from("reclamos").update(fila).eq("id", reclamo.id);
    if (error) {
      setGuardando(false);
      setMensaje({ tipo: "error", texto: "No se pudieron guardar los cambios: " + error.message });
      return;
    }

    // Una visita nueva queda registrada; n8n la toma y crea el evento en Google Calendar
    if (nuevaVisita) {
      const { error: errorVisita } = await supabase
        .from("visitas")
        .insert({ reclamo_id: reclamo.id, fecha: new Date(nuevaVisita).toISOString() });
      if (errorVisita) {
        setGuardando(false);
        setMensaje({ tipo: "error", texto: "Se guardó el estado, pero no la visita: " + errorVisita.message });
        return;
      }
    }

    setGuardando(false);
    setEditando(false);
    setReagendando(false);
    setMensaje({ tipo: "ok", texto: textoOk });
    router.refresh();
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

  function asignar() {
    const proveedor = proveedores.find((p) => p.id === Number(proveedorPaso));
    guardar(
      {
        // Si no hay categoría, se toma la del proveedor elegido
        categoria: categoriaPaso ?? proveedor?.categoria ?? null,
        urgencia: reclamo.urgencia ?? urgenciaSugerida,
        proveedor_id: proveedor?.id ?? null,
        estado: "asignado",
      },
      undefined,
      `Asignado a ${proveedor?.nombre ?? "el proveedor"}.`
    );
  }

  function guardarFormulario() {
    const visitaNueva = estado === "agendado" && fechaVisita && fechaVisita !== aCampoFecha(visita) ? fechaVisita : undefined;
    guardar(
      {
        categoria: categoria || null,
        urgencia: urgencia || null,
        proveedor_id: proveedorId ? Number(proveedorId) : null,
        estado,
      },
      visitaNueva,
      visitaNueva ? "Cambios guardados. La visita se agrega a Google Calendar en un minuto." : "Cambios guardados."
    );
  }

  const id = (campo: string) => `${campo}-${reclamo.id}`;

  // Texto de la sugerencia, en una línea
  const textoSugerencia = [
    ia?.categoria ? etiquetas.categoria(ia.categoria) : null,
    urgenciaSugerida ? `urgencia ${etiquetas.urgencia(urgenciaSugerida).toLowerCase()}` : null,
    ia?.proveedor_id ? nombreProveedor(ia.proveedor_id) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const sugerencia = ia?.categoria ? (
    <div className="flex flex-col gap-1">
      <p className="text-sm">
        <span className="font-medium">Sugerencia: </span>
        {textoSugerencia}.
      </p>
      {ia.justificacion && <p className="text-sm text-[#5B655F]">{ia.justificacion}</p>}
      {subio && (
        <p className="text-sm text-[#7A4F12]">
          Subió de {etiquetas.urgencia(prioridad!.base).toLowerCase()} a{" "}
          {etiquetas.urgencia(prioridad!.calculada).toLowerCase()}: {prioridad!.motivos.join(" y ").toLowerCase()}.
        </p>
      )}
    </div>
  ) : null;

  // El próximo paso depende del estado actual
  let paso: React.ReactNode;
  if (reclamo.estado === "nuevo") {
    paso = (
      <>
        <Titulo>Asignar a un proveedor</Titulo>
        {sugerencia ?? (
          <p className="text-sm text-[#5B655F]">
            Este reclamo no tiene sugerencia de la IA. Pedila o elegí el proveedor directamente.
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor={id("paso-proveedor")} className="text-xs font-medium text-[#5B655F]">
              Proveedor{categoriaPaso ? ` de ${etiquetas.categoria(categoriaPaso).toLowerCase()}` : ""}
            </label>
            <select
              id={id("paso-proveedor")}
              value={proveedorPaso}
              onChange={(e) => setProveedorPaso(e.target.value)}
              className={SELECT}
            >
              <option value="">Elegí un proveedor</option>
              {proveedoresPaso.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.id === ia?.proveedor_id ? " (sugerido)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={asignar} disabled={guardando || !proveedorPaso} className={BOTON_PRIMARIO}>
            {guardando ? "Asignando…" : "Asignar"}
          </button>
        </div>
        <p className="text-xs text-[#5B655F]">
          {ia?.categoria ? "Se guardan también la categoría y la urgencia sugeridas. " : ""}
          <button type="button" onClick={pedirSugerencia} disabled={analizando} className={BOTON_TEXTO}>
            {analizando ? "Analizando la foto y el texto…" : ia?.categoria ? "Volver a pedir a la IA" : "Pedir sugerencia a la IA"}
          </button>
        </p>
      </>
    );
  } else if (reclamo.estado === "asignado" || (reclamo.estado === "agendado" && reagendando)) {
    const proveedor = nombreProveedor(reclamo.proveedor_id);
    paso = (
      <>
        <Titulo>{reagendando ? "Cambiar la fecha de la visita" : "Agendar la visita"}</Titulo>
        <p className="text-sm text-[#5B655F]">
          {proveedor ? `Coordiná con ${proveedor} y anotá cuándo va.` : "Anotá cuándo va el proveedor."} Se agrega solo a
          Google Calendar.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor={id("paso-fecha")} className="text-xs font-medium text-[#5B655F]">
              Fecha y hora
            </label>
            <input
              id={id("paso-fecha")}
              type="datetime-local"
              value={fechaPaso}
              onChange={(e) => setFechaPaso(e.target.value)}
              className={SELECT}
            />
          </div>
          <button
            type="button"
            disabled={guardando || !fechaPaso || fechaPaso === aCampoFecha(visita)}
            onClick={() =>
              guardar({ estado: "agendado" }, fechaPaso, "Visita agendada. Aparece en Google Calendar en un minuto.")
            }
            className={BOTON_PRIMARIO}
          >
            {guardando ? "Agendando…" : "Agendar visita"}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {reagendando ? (
            <button type="button" onClick={() => setReagendando(false)} className={BOTON_TEXTO}>
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => guardar({ estado: "resuelto" }, undefined, "Reclamo resuelto.")}
              disabled={guardando}
              className={BOTON_TEXTO}
            >
              Se resolvió sin visita
            </button>
          )}
        </div>
      </>
    );
  } else if (reclamo.estado === "agendado") {
    paso = (
      <>
        <Titulo>Confirmar que quedó resuelto</Titulo>
        <p className="text-sm text-[#5B655F]">
          {visita ? `${nombreProveedor(reclamo.proveedor_id) || "El proveedor"} va el ${fechaLarga(visita)}.` : "Visita agendada."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => guardar({ estado: "resuelto" }, undefined, "Reclamo resuelto.")}
            disabled={guardando}
            className={BOTON_PRIMARIO}
          >
            {guardando ? "Guardando…" : "Marcar como resuelto"}
          </button>
          <button type="button" onClick={() => setReagendando(true)} className={BOTON_SECUNDARIO}>
            Cambiar la fecha
          </button>
        </div>
      </>
    );
  } else {
    paso = (
      <>
        <Titulo>Reclamo resuelto</Titulo>
        <p className="text-sm text-[#5B655F]">
          {resueltoAt ? `Se cerró el ${new Date(resueltoAt).toLocaleDateString("es-UY", { day: "numeric", month: "long" })}.` : "Ya está cerrado."}
          {" "}Si el problema volvió, reabrilo.
        </p>
        <div>
          <button
            type="button"
            onClick={() =>
              guardar({ estado: reclamo.proveedor_id ? "asignado" : "nuevo" }, undefined, "Reclamo reabierto.")
            }
            disabled={guardando}
            className={BOTON_SECUNDARIO}
          >
            Reabrir
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Próximo paso" className="flex flex-col gap-3 rounded-lg border border-[#CFE0D7] bg-[#F3F7F5] p-4">
        {paso}
      </section>

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`text-sm ${mensaje.tipo === "ok" ? "text-[#265A42]" : "text-[#A3352B]"}`}
        >
          {mensaje.texto}
        </p>
      )}

      <div className="border-t border-[#E6E9E4] pt-3">
        <button
          type="button"
          aria-expanded={editando}
          aria-controls={id("editar")}
          onClick={() => setEditando(!editando)}
          className="flex w-full items-center justify-between gap-3 rounded py-1 text-left text-sm font-medium text-[#18211D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]"
        >
          Editar categoría, urgencia, proveedor o estado
          <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 text-[#5B655F] transition-transform ${editando ? "rotate-180" : ""}`}>
            <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>

        {editando && (
          <div id={id("editar")} className="mt-3 flex flex-col gap-3">
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
                <select id={id("urgencia")} value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className={SELECT}>
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
                <select id={id("proveedor")} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={SELECT}>
                  <option value="">Sin asignar</option>
                  {opcionesProveedor.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Estado" htmlFor={id("estado")}>
                <select id={id("estado")} value={estado} onChange={(e) => setEstado(e.target.value)} className={SELECT}>
                  {estados.map((e) => (
                    <option key={e.codigo} value={e.codigo}>
                      {e.nombre_admin}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {estado === "agendado" && (
              <Campo etiqueta="Fecha y hora de la visita" htmlFor={id("visita")}>
                <input
                  id={id("visita")}
                  type="datetime-local"
                  value={fechaVisita}
                  onChange={(e) => setFechaVisita(e.target.value)}
                  className={`${SELECT} sm:max-w-xs`}
                />
              </Campo>
            )}
            <div>
              <button type="button" onClick={guardarFormulario} disabled={guardando} className={BOTON_PRIMARIO}>
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-[#1E4D3E]">{children}</h3>;
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
