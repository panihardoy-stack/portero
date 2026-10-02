import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevoReclamoForm } from "@/components/nuevo-reclamo-form";
import { GestionarReclamo } from "@/components/gestionar-reclamo";
import { UnirseEdificioForm } from "@/components/unirse-edificio-form";
import {
  BOTON_SECUNDARIO,
  CATEGORIA_LABEL,
  EstadoChip,
  FUENTE_DISPLAY,
  Placa,
  Seguimiento,
  UrgenciaMarca,
  tiempoRelativo,
} from "@/components/portero-ui";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Página principal después del login: muestra un panel según el rol.
export default function ProtectedPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#5B655F]">Cargando…</p>}>
      <Panel />
    </Suspense>
  );
}

async function Panel() {
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
    return <PanelAdmin />;
  }
  return <PanelVecino nombre={perfil?.nombre ?? user.email ?? ""} />;
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

// Orden de la bandeja: primero lo que nadie revisó, después por urgencia
const PRIORIDAD_URGENCIA: Record<string, number> = { alta: 1, media: 3, baja: 4 };
function prioridad(r: { estado: string; urgencia: string | null }) {
  if (r.estado === "nuevo") return 0;
  return PRIORIDAD_URGENCIA[r.urgencia ?? ""] ?? 2;
}

// ---------- ADMINISTRADOR ----------
async function PanelAdmin() {
  const supabase = await createClient();

  // Por RLS, todas estas consultas traen solo datos de los edificios de este admin
  const [edificiosRes, proveedoresRes, abiertosRes, sinRevisarRes, urgentesRes] = await Promise.all([
    supabase.from("edificios").select("id, nombre, direccion, codigo_invitacion").order("nombre"),
    supabase.from("proveedores").select("id, nombre, categoria").order("nombre"),
    supabase
      .from("reclamos")
      .select(
        "id, descripcion, estado, created_at, foto_path, categoria, urgencia, proveedor_id, unidades(nombre)",
        { count: "exact" }
      )
      .neq("estado", "resuelto")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("reclamos").select("*", { count: "exact", head: true }).eq("estado", "nuevo"),
    supabase
      .from("reclamos")
      .select("*", { count: "exact", head: true })
      .neq("estado", "resuelto")
      .eq("urgencia", "alta"),
  ]);

  const ahora = Date.now();
  const edificios = edificiosRes.data ?? [];
  const proveedores = proveedoresRes.data ?? [];
  const totalAbiertos = abiertosRes.count ?? 0;
  const bandeja = [...(abiertosRes.data ?? [])].sort((a, b) => prioridad(a) - prioridad(b));
  const fotos = await urlsFirmadas(supabase, bandeja.map((r) => r.foto_path));

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B655F]">
            {edificios.map((e) => e.nombre).join(", ") || "Todavía no tenés edificios"}
          </p>
          <h1 className={`${FUENTE_DISPLAY} mt-1 text-3xl font-semibold tracking-tight`}>
            Reclamos abiertos
          </h1>
        </div>
        <Link href="/protected/dashboard" className={BOTON_SECUNDARIO}>
          Ver indicadores
        </Link>
      </section>

      <section
        aria-label="Resumen"
        className="-mt-4 flex flex-wrap gap-x-10 gap-y-2 border-y border-[#DDE1DB] py-4"
      >
        <Cifra valor={totalAbiertos} texto="abiertos" />
        <Cifra valor={sinRevisarRes.count ?? 0} texto="sin revisar" />
        <Cifra valor={urgentesRes.count ?? 0} texto="de urgencia alta" alerta />
      </section>

      <section aria-label="Bandeja de reclamos">
        {bandeja.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CFD5CD] bg-white px-6 py-12 text-center">
            <p className={`${FUENTE_DISPLAY} text-lg font-semibold`}>No hay reclamos abiertos</p>
            <p className="mt-1 text-sm text-[#5B655F]">
              Cuando un vecino reporte un problema, va a aparecer acá.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E6E9E4] overflow-hidden rounded-lg border border-[#DDE1DB] bg-white">
            {bandeja.map((r) => {
              const foto = r.foto_path ? fotos.get(r.foto_path) : undefined;
              return (
                <li key={r.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[#F8F9F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E4D3E] [&::-webkit-details-marker]:hidden">
                      <Placa unidad={nombreDe(r.unidades)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.descripcion}</p>
                        <p className="mt-0.5 text-sm text-[#5B655F]">
                          {tiempoRelativo(r.created_at, ahora)}
                          {r.categoria ? `, ${CATEGORIA_LABEL[r.categoria] ?? r.categoria}` : ""}
                          {foto ? ", con foto" : ""}
                        </p>
                      </div>
                      <div className="hidden items-center gap-4 sm:flex">
                        <UrgenciaMarca urgencia={r.urgencia} />
                        <EstadoChip estado={r.estado} vista="admin" />
                      </div>
                      <svg
                        aria-hidden
                        viewBox="0 0 20 20"
                        className="h-4 w-4 shrink-0 text-[#5B655F] transition-transform group-open:rotate-180"
                      >
                        <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </summary>

                    <div className="border-t border-[#E6E9E4] bg-[#FAFBF9] px-4 pb-5 pt-4 sm:pl-[5.25rem]">
                      <div className="mb-3 flex items-center gap-4 sm:hidden">
                        <UrgenciaMarca urgencia={r.urgencia} />
                        <EstadoChip estado={r.estado} vista="admin" />
                      </div>
                      {r.descripcion.length > 60 && (
                        <p className="max-w-prose text-sm">{r.descripcion}</p>
                      )}
                      {foto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={foto}
                          alt={`Foto del reclamo: ${r.descripcion}`}
                          className="mt-3 max-h-72 rounded-md border border-[#DDE1DB] object-cover"
                        />
                      )}
                      <GestionarReclamo
                        reclamo={{
                          id: r.id,
                          categoria: r.categoria,
                          urgencia: r.urgencia,
                          proveedor_id: r.proveedor_id,
                          estado: r.estado,
                        }}
                        proveedores={proveedores}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {totalAbiertos > bandeja.length && (
          <p className="mt-3 text-sm text-[#5B655F]">
            Se muestran los {bandeja.length} más recientes de {totalAbiertos} reclamos abiertos.
          </p>
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

function Cifra({ valor, texto, alerta = false }: { valor: number; texto: string; alerta?: boolean }) {
  return (
    <p className="flex items-baseline gap-2">
      <span
        className={`${FUENTE_DISPLAY} text-2xl font-semibold tabular-nums ${
          alerta && valor > 0 ? "text-[#A3352B]" : ""
        }`}
      >
        {valor}
      </span>
      <span className="text-sm text-[#5B655F]">{texto}</span>
    </p>
  );
}

function textoEnviado(iso: string, ahora: number) {
  const t = tiempoRelativo(iso, ahora);
  return /^\d/.test(t) ? `Enviado el ${t}` : `Enviado ${t.toLowerCase()}`;
}

// ---------- VECINO ----------
async function PanelVecino({ nombre }: { nombre: string }) {
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
        <UnirseEdificioForm />
      </div>
    );
  }

  const { data: reclamos } = await supabase
    .from("reclamos")
    .select("id, descripcion, estado, created_at, foto_path")
    .order("created_at", { ascending: false });

  const ahora = Date.now();
  const lista = reclamos ?? [];
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
          <h2 className={`${FUENTE_DISPLAY} text-xl font-semibold`}>Tus reclamos</h2>
          {lista.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#CFD5CD] bg-white px-6 py-10 text-center">
              <p className="font-medium">Todavía no hiciste reclamos</p>
              <p className="mt-1 text-sm text-[#5B655F]">
                Cuando algo se rompa en tu unidad o en el edificio, contalo en el formulario.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.map((r) => {
                const foto = r.foto_path ? fotos.get(r.foto_path) : undefined;
                return (
                  <li key={r.id} className="rounded-lg border border-[#DDE1DB] bg-white p-4">
                    <div className="flex gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.descripcion}</p>
                        <p className="mt-0.5 text-sm text-[#5B655F]">
                          {textoEnviado(r.created_at, ahora)}
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
