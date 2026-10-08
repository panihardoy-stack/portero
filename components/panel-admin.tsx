import type { Sesion } from "@/lib/datos/sesion";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import {
  contarBandeja,
  listarReclamosAdmin,
  obtenerReclamo,
  LIMITE_BANDEJA,
  type ReclamoDetalle,
} from "@/lib/datos/reclamos";
import { urlsFirmadas } from "@/lib/datos/fotos";
import { calificacionesDe, type Calificacion } from "@/lib/datos/calificaciones";
import { crearEtiquetas, type Etiquetas } from "@/lib/catalogos";
import { enlace, leerParametro, type Parametros } from "@/lib/parametros";
import { FiltrosReclamos, type Conteo } from "@/components/filtros-reclamos";
import { ListaReclamos } from "@/components/bandeja";
import { DetalleReclamo } from "@/components/detalle-reclamo";
import { CodigoInvitacion } from "@/components/codigo-invitacion";
import { EstadoVacio } from "@/components/estado-vacio";
import { FUENTE_DISPLAY } from "@/components/portero-ui";
import { Suspense } from "react";

type Edificio = { id: number; nombre: string; direccion: string | null; codigo_invitacion: string };
type Proveedor = { id: number; nombre: string; categoria: string };

// Busca los datos de la bandeja. Por RLS, todo trae solo lo de los edificios de este admin.
export async function PanelAdmin({ sesion, parametros }: { sesion: Sesion; parametros: Parametros }) {
  const { supabase } = sesion;
  const filtro = {
    q: leerParametro(parametros, "q"),
    estado: leerParametro(parametros, "estado"),
    categoria: leerParametro(parametros, "categoria"),
    urgencia: leerParametro(parametros, "urgencia"),
    dias: Number(leerParametro(parametros, "dias")) || 0,
  };
  const catalogos = await obtenerCatalogos();
  const etiquetas = crearEtiquetas(catalogos);
  const pedido = Number(leerParametro(parametros, "r")) || null;

  const [edificiosRes, proveedoresRes, bandeja, conteo] = await Promise.all([
    supabase.from("edificios").select("id, nombre, direccion, codigo_invitacion").order("nombre"),
    supabase.from("proveedores").select("id, nombre, categoria").order("nombre"),
    listarReclamosAdmin(supabase, filtro, etiquetas),
    contarBandeja(supabase, catalogos.estados.map((e) => e.codigo)),
  ]);

  // El reclamo abierto: el pedido en la dirección (aunque los filtros lo saquen de la lista)
  // o, en pantallas grandes, el primero de la lista
  const abierto =
    (pedido && (bandeja.reclamos.find((r) => r.id === pedido) ?? (await obtenerReclamo(supabase, pedido)))) ||
    bandeja.reclamos[0] ||
    null;
  const [fotos, calificaciones] = await Promise.all([
    abierto?.foto_path ? urlsFirmadas(supabase, [abierto.foto_path]) : new Map<string, string>(),
    abierto?.estado === "resuelto" ? calificacionesDe(supabase, [abierto.id]) : new Map<number, Calificacion>(),
  ]);

  return (
    <BandejaAdmin
      edificios={(edificiosRes.data ?? []) as Edificio[]}
      proveedores={(proveedoresRes.data ?? []) as Proveedor[]}
      reclamos={bandeja.reclamos}
      truncado={bandeja.truncado}
      conteo={conteo}
      abierto={abierto}
      elegido={!!pedido && abierto?.id === pedido}
      foto={abierto?.foto_path ? fotos.get(abierto.foto_path) : undefined}
      calificacion={abierto ? calificaciones.get(abierto.id) : undefined}
      parametros={parametros}
      etiquetas={etiquetas}
    />
  );
}

// Solo presentación: lista a la izquierda y el reclamo abierto a la derecha.
// En el celular se ve una cosa por vez: la lista, o el reclamo elegido.
export function BandejaAdmin({
  edificios,
  proveedores,
  reclamos,
  truncado,
  conteo,
  abierto,
  elegido,
  foto,
  calificacion,
  parametros,
  etiquetas,
  ahora = Date.now(),
}: {
  edificios: Edificio[];
  proveedores: Proveedor[];
  reclamos: ReclamoDetalle[];
  truncado: boolean;
  conteo: Conteo;
  abierto: ReclamoDetalle | null;
  elegido: boolean;
  foto?: string;
  calificacion?: Calificacion;
  parametros: Parametros;
  etiquetas: Etiquetas;
  ahora?: number;
}) {
  const porUnidad = leerParametro(parametros, "vista") === "unidad";
  const hrefDe = (id: number) => enlace("/protected", parametros, { r: String(id) });

  return (
    <div className="flex flex-col gap-6">
      <section className={`flex-wrap items-end justify-between gap-4 ${elegido ? "hidden lg:flex" : "flex"}`}>
        <div>
          <p className="text-sm text-[#5B655F]">{edificios.map((e) => e.nombre).join(", ") || "Todavía no tenés edificios"}</p>
          <h1 className={`${FUENTE_DISPLAY} mt-0.5 text-3xl font-semibold tracking-tight`}>Reclamos</h1>
        </div>
        {edificios.length === 1 && <CodigoInvitacion codigo={edificios[0].codigo_invitacion} />}
      </section>

      <div className={elegido ? "hidden lg:block" : ""}>
        <Suspense fallback={<div className="h-[6.5rem]" />}>
          <FiltrosReclamos conteo={conteo} />
        </Suspense>
      </div>

      {reclamos.length === 0 && !abierto ? (
        <EstadoVacio
          titulo="No hay reclamos para mostrar"
          texto="Probá con otra pestaña, otra búsqueda o limpiá los filtros."
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section
            aria-label="Lista de reclamos"
            className={`overflow-hidden rounded-lg border border-[#DDE1DB] bg-white ${elegido ? "hidden lg:block" : ""}`}
          >
            <p className="border-b border-[#E6E9E4] px-4 py-2.5 text-xs text-[#5B655F]" aria-live="polite">
              {reclamos.length === 1 ? "1 reclamo" : `${reclamos.length} reclamos`}, los más urgentes primero
              {truncado ? `. Se muestran los ${LIMITE_BANDEJA} más recientes.` : ""}
            </p>
            {reclamos.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#5B655F]">Ningún reclamo coincide con los filtros.</p>
            ) : (
              <div className="lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto">
                <ListaReclamos
                  reclamos={reclamos}
                  porUnidad={porUnidad}
                  seleccionado={abierto?.id ?? null}
                  ahora={ahora}
                  etiquetas={etiquetas}
                  hrefDe={hrefDe}
                />
              </div>
            )}
          </section>

          {abierto && (
            <section
              aria-label="Reclamo abierto"
              className={`rounded-lg border border-[#DDE1DB] bg-white lg:sticky lg:top-24 ${elegido ? "" : "hidden lg:block"}`}
            >
              <DetalleReclamo
                r={abierto}
                foto={foto}
                calificacion={calificacion}
                proveedores={proveedores}
                etiquetas={etiquetas}
                hrefVolver={enlace("/protected", parametros, { r: null })}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
