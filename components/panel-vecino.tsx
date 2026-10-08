import Link from "next/link";
import type { Sesion } from "@/lib/datos/sesion";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import { listarReclamosVecino } from "@/lib/datos/reclamos";
import { urlsFirmadas } from "@/lib/datos/fotos";
import { crearEtiquetas } from "@/lib/catalogos";
import { DIA, diasEntre, tiempoRelativo } from "@/lib/fechas";
import { leerParametro, type Parametros } from "@/lib/parametros";
import { NuevoReclamoForm } from "@/components/nuevo-reclamo-form";
import { UnirseEdificioForm } from "@/components/unirse-edificio-form";
import { EstadoVacio } from "@/components/estado-vacio";
import { Seguimiento } from "@/components/marcas";
import { FUENTE_DISPLAY, GRUPO_SEGMENTOS, Placa, claseSegmento } from "@/components/portero-ui";

const unDecimal = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 1 });

function textoEnviado(iso: string, ahora: number) {
  const t = tiempoRelativo(iso, ahora);
  return /^\d/.test(t) ? `Enviado el ${t}` : `Enviado ${t.toLowerCase()}`;
}

export async function PanelVecino({ sesion, parametros }: { sesion: Sesion; parametros: Parametros }) {
  const { supabase, nombre, tieneNombre } = sesion;

  // Por RLS, el vecino solo ve su unidad y sus propios reclamos
  const { data: unidad } = await supabase.from("unidades").select("id, nombre, edificios(nombre)").maybeSingle();

  if (!unidad) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div>
          <h1 className={`${FUENTE_DISPLAY} text-3xl font-semibold tracking-tight`}>Hola, {nombre}</h1>
          <p className="mt-2 text-[#5B655F]">
            Para hacer reclamos, primero unite a tu edificio con el código que te dio la administración.
          </p>
        </div>
        <UnirseEdificioForm pedirNombre={!tieneNombre} />
      </div>
    );
  }

  const [todos, catalogos] = await Promise.all([listarReclamosVecino(supabase), obtenerCatalogos()]);
  const etiquetas = crearEtiquetas(catalogos);
  const ahora = Date.now();
  const verResueltos = leerParametro(parametros, "ver") === "resueltos";
  const enCurso = todos.filter((r) => r.estado !== "resuelto");
  const resueltos = todos.filter((r) => r.estado === "resuelto");
  const lista = verResueltos ? resueltos : enCurso;
  const fotos = await urlsFirmadas(supabase, lista.map((r) => r.foto_path));
  const rel = unidad.edificios as unknown as { nombre: string } | { nombre: string }[] | null;
  const edificio = Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex items-center gap-5">
        <Placa unidad={unidad.nombre} tamano="lg" />
        <div>
          <h1 className={`${FUENTE_DISPLAY} text-3xl font-semibold tracking-tight`}>Hola, {nombre}</h1>
          <p className="text-[#5B655F]">{edificio}</p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <NuevoReclamoForm unidadId={unidad.id} />

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={`${FUENTE_DISPLAY} text-xl font-semibold`}>Tus reclamos</h2>
            <nav aria-label="Filtrar tus reclamos" className={GRUPO_SEGMENTOS}>
              <Link href="/protected" aria-current={!verResueltos ? "page" : undefined} className={claseSegmento(!verResueltos)}>
                En curso ({enCurso.length})
              </Link>
              <Link
                href="/protected?ver=resueltos"
                aria-current={verResueltos ? "page" : undefined}
                className={claseSegmento(verResueltos)}
              >
                Resueltos ({resueltos.length})
              </Link>
            </nav>
          </div>

          {lista.length === 0 ? (
            <EstadoVacio
              titulo={verResueltos ? "Todavía no tenés reclamos resueltos" : "No tenés reclamos en curso"}
              texto={
                verResueltos
                  ? "Cuando la administración resuelva un reclamo, va a aparecer acá."
                  : "Cuando algo se rompa en tu unidad o en el edificio, contalo en el formulario."
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.map((r) => {
                const foto = r.foto_path ? fotos.get(r.foto_path) : undefined;
                const visitaProxima =
                  r.ultima_visita && new Date(r.ultima_visita).getTime() >= ahora - DIA ? r.ultima_visita : null;
                const dias = r.resuelto_at ? diasEntre(r.created_at, r.resuelto_at) : null;

                return (
                  <li key={r.id} className="rounded-lg border border-[#DDE1DB] bg-white p-4">
                    <div className="flex gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.descripcion}</p>
                        <p className="mt-0.5 text-sm text-[#5B655F]">
                          {textoEnviado(r.created_at, ahora)}
                          {r.categoria ? `, ${etiquetas.categoria(r.categoria)}` : ""}
                        </p>
                      </div>
                      {foto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={foto}
                          alt={`Foto del reclamo: ${r.descripcion}`}
                          className="h-16 w-16 shrink-0 rounded-md border border-[#DDE1DB] object-cover"
                        />
                      )}
                    </div>
                    <div className="mt-4">
                      <Seguimiento estado={r.estado} />
                    </div>
                    {visitaProxima && r.estado !== "resuelto" && (
                      <p className="mt-3 rounded-md bg-[#ECE8F6] px-3 py-2 text-sm text-[#4E3F8A]">
                        Visita del proveedor:{" "}
                        {new Date(visitaProxima).toLocaleString("es-UY", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    {dias !== null && (
                      <p className="mt-3 text-sm text-[#265A42]">
                        Resuelto en {dias < 1 ? "menos de un día" : `${unDecimal.format(dias)} ${dias < 1.5 ? "día" : "días"}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
