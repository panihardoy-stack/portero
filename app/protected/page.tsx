import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NuevoReclamoForm } from "@/components/nuevo-reclamo-form";
import { GestionarReclamo } from "@/components/gestionar-reclamo";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Página principal después del login: muestra un panel según el rol.
export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <Suspense fallback={<p>Cargando...</p>}>
        <Panel />
      </Suspense>
    </div>
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
    return <PanelAdmin nombre={perfil.nombre ?? user.email ?? ""} />;
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

function Foto({ url }: { url?: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Foto del reclamo" className="mt-2 max-h-64 rounded-md object-cover" />;
}

// ---------- ADMINISTRADOR ----------
async function PanelAdmin({ nombre }: { nombre: string }) {
  const supabase = await createClient();

  // Por RLS, solo trae los edificios, reclamos y proveedores de este admin
  const { data: edificios } = await supabase
    .from("edificios")
    .select("id, nombre, direccion, codigo_invitacion");

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id, nombre, categoria")
    .order("nombre");

  const { data: reclamos, count: totalReclamos } = await supabase
    .from("reclamos")
    .select(
      "id, descripcion, estado, created_at, foto_path, categoria, urgencia, proveedor_id, unidades(nombre)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .limit(10);

  const fotos = await urlsFirmadas(supabase, (reclamos ?? []).map((r) => r.foto_path));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Panel del administrador</p>
        <h1 className="text-2xl font-bold">Hola, {nombre}</h1>
      </div>

      <div className="rounded-md border p-4">
        <p className="text-sm text-muted-foreground">Reclamos en tus edificios</p>
        <p className="text-3xl font-bold">{totalReclamos ?? 0}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Últimos reclamos</h2>
        {reclamos && reclamos.length > 0 ? (
          reclamos.map((r) => (
            <div key={r.id} className="rounded-md border p-4">
              <p className="font-medium">{r.descripcion}</p>
              <p className="text-sm text-muted-foreground">
                Unidad {nombreDe(r.unidades)} · Estado: {r.estado} ·{" "}
                {new Date(r.created_at).toLocaleDateString("es-UY")}
              </p>
              <Foto url={r.foto_path ? fotos.get(r.foto_path) : undefined} />
              <GestionarReclamo
                reclamo={{
                  id: r.id,
                  categoria: r.categoria,
                  urgencia: r.urgencia,
                  proveedor_id: r.proveedor_id,
                  estado: r.estado,
                }}
                proveedores={proveedores ?? []}
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No hay reclamos todavía.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Tus edificios</h2>
        {edificios && edificios.length > 0 ? (
          edificios.map((e) => (
            <div key={e.id} className="rounded-md border p-4">
              <p className="font-medium">{e.nombre}</p>
              <p className="text-sm text-muted-foreground">{e.direccion}</p>
              <p className="text-sm mt-2">
                Código de invitación:{" "}
                <span className="font-mono font-bold">{e.codigo_invitacion}</span>
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no tenés edificios.</p>
        )}
      </div>
    </div>
  );
}

// ---------- VECINO ----------
async function PanelVecino({ nombre }: { nombre: string }) {
  const supabase = await createClient();

  // Por RLS, el vecino solo ve su unidad y sus propios reclamos
  const { data: unidad } = await supabase
    .from("unidades")
    .select("id, nombre, edificios(nombre)")
    .maybeSingle();

  const { data: reclamos } = await supabase
    .from("reclamos")
    .select("id, descripcion, estado, created_at, foto_path")
    .order("created_at", { ascending: false });

  const fotos = await urlsFirmadas(supabase, (reclamos ?? []).map((r) => r.foto_path));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Panel del vecino</p>
        <h1 className="text-2xl font-bold">Hola, {nombre}</h1>
        {unidad ? (
          <p className="text-sm">
            {nombreDe(unidad.edificios)} · Unidad {unidad.nombre}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no estás asociado a ninguna unidad.
          </p>
        )}
      </div>

      {unidad && <NuevoReclamoForm unidadId={unidad.id} />}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Mis reclamos</h2>
        {reclamos && reclamos.length > 0 ? (
          reclamos.map((r) => (
            <div key={r.id} className="rounded-md border p-4">
              <p className="font-medium">{r.descripcion}</p>
              <p className="text-sm text-muted-foreground">
                Estado: {r.estado} · {new Date(r.created_at).toLocaleDateString("es-UY")}
              </p>
              <Foto url={r.foto_path ? fotos.get(r.foto_path) : undefined} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No tenés reclamos todavía.</p>
        )}
      </div>
    </div>
  );
}