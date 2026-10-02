import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevoReclamoForm } from "@/components/nuevo-reclamo-form";
import { UnirseEdificioForm } from "@/components/unirse-edificio-form";
import { FiltrosReclamos } from "@/components/filtros-reclamos";
import { FilaReclamo, VistaPorUnidad, type ReclamoAdmin } from "@/components/bandeja";
import {
  BOTON_SECUNDARIO,
  CATEGORIA_LABEL,
  ESTADO_INFO,
  FUENTE_DISPLAY,
  Placa,
  Seguimiento,
  normalizar,
  tiempoRelativo,
} from "@/components/portero-ui";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Parametros = Record<string, string | string[] | undefined>;

const DIA = 1000 * 60 * 60 * 24;
const unDecimal = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 1 });

// Página principal después del login: muestra un panel según el rol.
export default function ProtectedPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  return (
    <Suspense fallback={<p className="text-sm text-[#5B655F]">Cargando…</p>}>
      <Panel searchParams={searchParams} />
    </Suspense>
  );
}

async function Panel({ searchParams }: { searchParams: Promise<Parametros> }) {
  const parametros = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol === "admin") {
    return <PanelAdmin parametros={parametros} />;
  }
  return (
    <PanelVecino
      nombre={perfil?.nombre ?? user.email ?? ""}
      tieneNombre={!!perfil?.nombre}
      parametros={parametros}
    />
  );
}

function texto(p: Parametros, clave: string) {
  const v = p[clave];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// Saca el nombre de una relación de Supabase (puede venir como objeto o lista)
function nombreDe(rel: unknown): string | undefined {
  const r = rel as { nombre: string } | { nombre: string }[] | null | undefined;
  return Array.isArray(r) ? r[0]?.nombre : r?.nombre;
}

// Genera links temporales (1 hora) para ver fotos del bucket privado
async function urlsFirmadas(supabase: Supabase, paths: (string | null)[]) {
  const validos = paths.filter((p): p is string => !!p);
  const mapa = new Map<string, string>();
  if (validos.length === 0) return mapa;

  const { data } = await supabase.storage
    .from("fotos-reclamos")
    .createSignedUrls(validos, 3600);

  data?.forEach((d) => {
    if (d.path && d.signedUrl) mapa.set(d.path, d.signedUrl);
  });
  return mapa;
}

// Orden dentro de la bandeja: primero lo que nadie revisó, después por urgencia
const PRIORIDAD_URGENCIA: Record<string, number> = { alta: 1, media: 3, baja: 4 };
function prioridad(r: { estado: string; urgencia: string | null }) {
  if (r.estado === "resuelto") return 9;
  if (r.estado === "nuevo") return 0;
  return PRIORIDAD_URGENCIA[r.urgencia ?? ""] ?? 2;
}


// ---------- ADMINISTRADOR ----------
const LIMITE = 500;

async function PanelAdmin({ parametros }: { parametros: Parametros }) {
  const supabase = await createClient();

  const filtro = {
    q: texto(parametros, "q"),
    estado: texto(parametros, "estado"),
    categoria: texto(parametros, "categoria"),
    urgencia: texto(parametros, "urgencia"),
    dias: Number(texto(parametros, "dias")) || 0,
    vista: texto(parametros, "vista") === "lista" ? "lista" : "unidad",
  };

  // Filtros que resuelve la base de datos (por RLS, solo reclamos de sus edificios)
  let consulta = supabase
    .from("reclamos")
    .select(
      "id, descripcion, estado, created_at, foto_path, categoria, urgencia, proveedor_id, unidades(nombre)"
    )
    .order("created_at", { ascending: false })
    .limit(LIMITE);

  if (!filtro.estado) consulta = consulta.neq("estado", "resuelto");
  else if (filtro.estado !== "todos") consulta = consulta.eq("estado", filtro.estado);
  if (filtro.categoria === "sin") consulta = consulta.is("categoria", null);
  else if (filtro.categoria) consulta = consulta.eq("categoria", filtro.categoria);
  if (filtro.urgencia) consulta = consulta.eq("urgencia", filtro.urgencia);

  const ahora = Date.now();
  if (filtro.dias) {
    consulta = consulta.gte("created_at", new Date(ahora - filtro.dias * DIA).toISOString());
  }

  const [edificiosRes, proveedoresRes, reclamosRes, abiertosRes, sinRevisarRes, urgentesRes] =
    await Promise.all([
      supabase.from("edificios").select("id, nombre, direccion, codigo_invitacion").order("nombre"),
      supabase.from("proveedores").select("id, nombre, categoria").order("nombre"),
      consulta,
      supabase.from("reclamos").select("*", { count: "exact", head: true }).neq("estado", "resuelto"),
      supabase.from("reclamos").select("*", { count: "exact", head: true }).eq("estado", "nuevo"),
      supabase
        .from("reclamos")
        .select("*", { count: "exact", head: true })
        .neq("estado", "resuelto")
        .eq("urgencia", "alta"),
    ]);

  const edificios = edificiosRes.data ?? [];
  const proveedores = proveedoresRes.data ?? [];

  // La búsqueda de texto se hace acá: unidad, descripción, categoría o estado
  const busqueda = normalizar(filtro.q);
  const reclamos: ReclamoAdmin[] = (reclamosRes.data ?? [])
    .map((r) => ({ ...r, unidad: nombreDe(r.unidades) ?? "?" }))
    .filter((r) => {
      if (!busqueda) return true;
      const campos = [
        r.unidad,
        r.descripcion,
        r.categoria ? CATEGORIA_LABEL[r.categoria] ?? r.categoria : "sin clasificar",
        ESTADO_INFO[r.estado]?.admin ?? r.estado,
      ];
      return campos.some((c) => normalizar(c).includes(busqueda));
    })
    .sort((a, b) => prioridad(a) - prioridad(b));

  const fotos = await urlsFirmadas(supabase, reclamos.map((r) => r.foto_path));

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B655F]">
            {edificios.map((e) => e.nombre).join(", ") || "Todavía no tenés edificios"}
          </p>
          <h1 className={`${FUENTE_DISPLAY} mt-1 text-3xl font-semibold tracking-tight`}>Reclamos</h1>
        </div>
        <Link href="/protected/dashboard" className={BOTON_SECUNDARIO}>
          Ver indicadores
        </Link>
      </section>

      <section
        aria-label="Resumen"
        className="-mt-4 flex flex-wrap gap-x-10 gap-y-2 border-y border-[#DDE1DB] py-4"
      >
        <Cifra valor={abiertosRes.count ?? 0} texto="abiertos" href="/protected" />
        <Cifra valor={sinRevisarRes.count ?? 0} texto="sin revisar" href="/protected?estado=nuevo" />
        <Cifra
          valor={urgentesRes.count ?? 0}
          texto="de urgencia alta"
          href="/protected?urgencia=alta"
          alerta
        />
      </section>

      <section aria-label="Bandeja de reclamos" className="flex flex-col gap-5">
        <FiltrosReclamos />

        <p className="text-sm text-[#5B655F]" aria-live="polite">
          {reclamos.length === 1 ? "1 reclamo" : `${reclamos.length} reclamos`}
          {filtro.vista === "unidad" && reclamos.length > 0
            ? ` en ${new Set(reclamos.map((r) => r.unidad)).size} unidades`
            : ""}
          {(reclamosRes.data?.length ?? 0) === LIMITE ? `. Se muestran los ${LIMITE} más recientes.` : ""}
        </p>

        {reclamos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CFD5CD] bg-white px-6 py-12 text-center">
            <p className={`${FUENTE_DISPLAY} text-lg font-semibold`}>
              Ningún reclamo coincide con la búsqueda
            </p>
            <p className="mt-1 text-sm text-[#5B655F]">
              Probá con otra unidad o palabra, o cambiá los filtros.
            </p>
          </div>
        ) : filtro.vista === "lista" ? (
          <ul className="divide-y divide-[#E6E9E4] overflow-hidden rounded-lg border border-[#DDE1DB] bg-white">
            {reclamos.map((r) => (
              <FilaReclamo
                key={r.id}
                r={r}
                ahora={ahora}
                foto={r.foto_path ? fotos.get(r.foto_path) : undefined}
                proveedores={proveedores}
                mostrarUnidad
              />
            ))}
          </ul>
        ) : (
          <VistaPorUnidad reclamos={reclamos} ahora={ahora} fotos={fotos} proveedores={proveedores} />
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
                  <p className={`${FUENTE_DISPLAY} text-lg font-semibold tracking-[0.18em]`}>
                    {e.codigo_invitacion}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[#5B655F]">
                  Compartilo con los vecinos para que se unan desde la app.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Cifra({
  valor,
  texto,
  href,
  alerta = false,
}: {
  valor: number;
  texto: string;
  href: string;
  alerta?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-baseline gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] focus-visible:ring-offset-4"
    >
      <span
        className={`${FUENTE_DISPLAY} text-2xl font-semibold tabular-nums ${
          alerta && valor > 0 ? "text-[#A3352B]" : ""
        }`}
      >
        {valor}
      </span>
      <span className="text-sm text-[#5B655F] underline-offset-4 group-hover:underline">{texto}</span>
    </Link>
  );
}

// ---------- VECINO ----------
function textoEnviado(iso: string, ahora: number) {
  const t = tiempoRelativo(iso, ahora);
  return /^\d/.test(t) ? `Enviado el ${t}` : `Enviado ${t.toLowerCase()}`;
}

async function PanelVecino({
  nombre,
  tieneNombre,
  parametros,
}: {
  nombre: string;
  tieneNombre: boolean;
  parametros: Parametros;
}) {
  const supabase = await createClient();

  // Por RLS, el vecino solo ve su unidad y sus propios reclamos
  const { data: unidad } = await supabase
    .from("unidades")
    .select("id, nombre, edificios(nombre)")
    .maybeSingle();

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

  const { data: reclamos } = await supabase
    .from("reclamos")
    .select("id, descripcion, estado, created_at, resuelto_at, foto_path, categoria, visitas(fecha)")
    .order("created_at", { ascending: false });

  const ahora = Date.now();
  const todos = reclamos ?? [];
  const verResueltos = texto(parametros, "ver") === "resueltos";
  const enCurso = todos.filter((r) => r.estado !== "resuelto");
  const resueltos = todos.filter((r) => r.estado === "resuelto");
  const lista = verResueltos ? resueltos : enCurso;
  const fotos = await urlsFirmadas(supabase, lista.map((r) => r.foto_path));

  return (
    <div className="flex flex-col gap-10">
      <section className="flex items-center gap-5">
        <Placa unidad={unidad.nombre} tamano="lg" />
        <div>
          <h1 className={`${FUENTE_DISPLAY} text-3xl font-semibold tracking-tight`}>Hola, {nombre}</h1>
          <p className="text-[#5B655F]">{nombreDe(unidad.edificios)}</p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <NuevoReclamoForm unidadId={unidad.id} />

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={`${FUENTE_DISPLAY} text-xl font-semibold`}>Tus reclamos</h2>
            <nav aria-label="Filtrar tus reclamos" className="inline-flex rounded-md border border-[#CFD5CD] bg-white p-0.5">
              <Pestana href="/protected" activa={!verResueltos} texto={`En curso (${enCurso.length})`} />
              <Pestana
                href="/protected?ver=resueltos"
                activa={verResueltos}
                texto={`Resueltos (${resueltos.length})`}
              />
            </nav>
          </div>

          {lista.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#CFD5CD] bg-white px-6 py-10 text-center">
              <p className="font-medium">
                {verResueltos ? "Todavía no tenés reclamos resueltos" : "No tenés reclamos en curso"}
              </p>
              <p className="mt-1 text-sm text-[#5B655F]">
                {verResueltos
                  ? "Cuando la administración resuelva un reclamo, va a aparecer acá."
                  : "Cuando algo se rompa en tu unidad o en el edificio, contalo en el formulario."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.map((r) => {
                const foto = r.foto_path ? fotos.get(r.foto_path) : undefined;
                const visitas = (r.visitas ?? []) as { fecha: string }[];
                const proximaVisita = visitas
                  .map((v) => v.fecha)
                  .filter((f) => new Date(f).getTime() >= ahora - DIA)
                  .sort()[0];
                const diasResolucion =
                  r.resuelto_at &&
                  (new Date(r.resuelto_at).getTime() - new Date(r.created_at).getTime()) / DIA;

                return (
                  <li key={r.id} className="rounded-lg border border-[#DDE1DB] bg-white p-4">
                    <div className="flex gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.descripcion}</p>
                        <p className="mt-0.5 text-sm text-[#5B655F]">
                          {textoEnviado(r.created_at, ahora)}
                          {r.categoria ? `, ${CATEGORIA_LABEL[r.categoria] ?? r.categoria}` : ""}
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
                    {proximaVisita && r.estado !== "resuelto" && (
                      <p className="mt-3 rounded-md bg-[#ECE8F6] px-3 py-2 text-sm text-[#4E3F8A]">
                        Visita del proveedor:{" "}
                        {new Date(proximaVisita).toLocaleString("es-UY", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    {typeof diasResolucion === "number" && (
                      <p className="mt-3 text-sm text-[#265A42]">
                        Resuelto en{" "}
                        {diasResolucion < 1
                          ? "menos de un día"
                          : `${unDecimal.format(diasResolucion)} ${diasResolucion < 1.5 ? "día" : "días"}`}
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

function Pestana({ href, activa, texto }: { href: string; activa: boolean; texto: string }) {
  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      className={`rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E] ${
        activa ? "bg-[#1E4D3E] text-white" : "text-[#5B655F] hover:text-[#18211D]"
      }`}
    >
      {texto}
    </Link>
  );
}
