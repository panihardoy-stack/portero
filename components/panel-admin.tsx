import Link from "next/link";
import type { Sesion } from "@/lib/datos/sesion";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import { listarReclamosAdmin, resumenBandeja, LIMITE_BANDEJA } from "@/lib/datos/reclamos";
import { urlsFirmadas } from "@/lib/datos/fotos";
import { crearEtiquetas } from "@/lib/catalogos";
import { leerParametro, type Parametros } from "@/lib/parametros";
import { FiltrosReclamos } from "@/components/filtros-reclamos";
import { FilaReclamo, VistaPorUnidad } from "@/components/bandeja";
import { EstadoVacio } from "@/components/estado-vacio";
import { BOTON_SECUNDARIO, FUENTE_DISPLAY } from "@/components/portero-ui";

export async function PanelAdmin({ sesion, parametros }: { sesion: Sesion; parametros: Parametros }) {
  const { supabase } = sesion;
  const filtro = {
    q: leerParametro(parametros, "q"),
    estado: leerParametro(parametros, "estado"),
    categoria: leerParametro(parametros, "categoria"),
    urgencia: leerParametro(parametros, "urgencia"),
    dias: Number(leerParametro(parametros, "dias")) || 0,
  };
  const vista = leerParametro(parametros, "vista") === "lista" ? "lista" : "unidad";
  const etiquetas = crearEtiquetas(await obtenerCatalogos());

  // Por RLS, todo lo que sigue trae solo datos de los edificios de este admin
  const [edificiosRes, proveedoresRes, bandeja, resumen] = await Promise.all([
    supabase.from("edificios").select("id, nombre, direccion, codigo_invitacion").order("nombre"),
    supabase.from("proveedores").select("id, nombre, categoria").order("nombre"),
    listarReclamosAdmin(supabase, filtro, etiquetas),
    resumenBandeja(supabase),
  ]);

  const edificios = edificiosRes.data ?? [];
  const proveedores = proveedoresRes.data ?? [];
  const { reclamos, truncado } = bandeja;
  const fotos = await urlsFirmadas(supabase, reclamos.map((r) => r.foto_path));
  const ahora = Date.now();
  const filaProps = { ahora, fotos, proveedores, etiquetas };

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B655F]">
            {edificios.map((e) => e.nombre).join(", ") || "Todavía no tenés edificios"}
          </p>
          <h1 className={`${FUENTE_DISPLAY} mt-1 text-3xl font-semibold tracking-tight`}>Reclamos</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/protected/vecinos" className={BOTON_SECUNDARIO}>
            Vecinos
          </Link>
          <Link href="/protected/dashboard" className={BOTON_SECUNDARIO}>
            Ver indicadores
          </Link>
        </div>
      </section>

      <section aria-label="Resumen" className="-mt-4 flex flex-wrap gap-x-10 gap-y-2 border-y border-[#DDE1DB] py-4">
        <Cifra valor={resumen.abiertos} texto="abiertos" href="/protected" />
        <Cifra valor={resumen.sinRevisar} texto="sin revisar" href="/protected?estado=nuevo" />
        <Cifra valor={resumen.urgentes} texto="de urgencia alta" href="/protected?urgencia=alta" alerta />
      </section>

      <section aria-label="Bandeja de reclamos" className="flex flex-col gap-5">
        <FiltrosReclamos />

        <p className="text-sm text-[#5B655F]" aria-live="polite">
          {reclamos.length === 1 ? "1 reclamo" : `${reclamos.length} reclamos`}
          {vista === "unidad" && reclamos.length > 0 ? ` en ${new Set(reclamos.map((r) => r.unidad)).size} unidades` : ""}
          {truncado ? `. Se muestran los ${LIMITE_BANDEJA} más recientes.` : ""}
        </p>

        {reclamos.length === 0 ? (
          <EstadoVacio
            titulo="Ningún reclamo coincide con la búsqueda"
            texto="Probá con otra unidad o palabra, o cambiá los filtros."
          />
        ) : vista === "lista" ? (
          <ul className="divide-y divide-[#E6E9E4] overflow-hidden rounded-lg border border-[#DDE1DB] bg-white">
            {reclamos.map((r) => (
              <FilaReclamo key={r.id} r={r} mostrarUnidad {...filaProps} />
            ))}
          </ul>
        ) : (
          <VistaPorUnidad reclamos={reclamos} {...filaProps} />
        )}
      </section>

      {edificios.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className={`${FUENTE_DISPLAY} text-xl font-semibold`}>Edificios</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {edificios.map((e) => (
              <div key={e.id} className="rounded-lg border border-[#DDE1DB] bg-white p-5">
                <p className="font-semibold">{e.nombre}</p>
                <p className="text-sm text-[#5B655F]">{e.direccion}</p>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-[#F3F4F1] px-3 py-2.5">
                  <p className="text-sm">Código para vecinos</p>
                  <p className={`${FUENTE_DISPLAY} text-lg font-semibold tracking-[0.18em]`}>{e.codigo_invitacion}</p>
                </div>
                <p className="mt-2 text-xs text-[#5B655F]">Compartilo con los vecinos para que se unan desde la app.</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Cifra({ valor, texto, href, alerta = false }: { valor: number; texto: string; href: string; alerta?: boolean }) {
  return (
    <Link
      href={href}
      className="group flex items-baseline gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-4"
    >
      <span className={`${FUENTE_DISPLAY} text-2xl font-semibold tabular-nums ${alerta && valor > 0 ? "text-[#A3352B]" : ""}`}>
        {valor}
      </span>
      <span className="text-sm text-[#5B655F] underline-offset-4 group-hover:underline">{texto}</span>
    </Link>
  );
}
