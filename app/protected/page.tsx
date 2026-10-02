import { Suspense } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

// ---------- ACCIÓN: el vecino crea un reclamo ----------
async function crearReclamo(formData: FormData) {
  "use server";

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (!descripcion) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("unidad_id")
    .eq("id", user.id)
    .single();
  if (!perfil?.unidad_id) return;

  // RLS verifica que el vecino solo pueda crear reclamos en su propia unidad
  const { error } = await supabase.from("reclamos").insert({
    descripcion,
    unidad_id: perfil.unidad_id,
    vecino_id: user.id,
  });

  if (error) {
    console.error("Error al crear reclamo:", error.message);
    return;
  }

  revalidatePath("/protected");
}

// Saca el nombre de una relación de Supabase (puede venir como objeto o lista)
function nombreDe(rel: unknown): string | undefined {
  const r = rel as { nombre: string } | { nombre: string }[] | null | undefined;
  return Array.isArray(r) ? r[0]?.nombre : r?.nombre;
}

// ---------- ADMINISTRADOR ----------
async function PanelAdmin({ nombre }: { nombre: string }) {
  const supabase = await createClient();

  // Por RLS, solo trae los edificios y reclamos que administra este usuario
  const { data: edificios } = await supabase
    .from("edificios")
    .select("id, nombre, direccion, codigo_invitacion");

  const { data: reclamos, count: totalReclamos } = await supabase
    .from("reclamos")
    .select("id, descripcion, estado, created_at, unidades(nombre)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .limit(10);

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
    .select("nombre, edificios(nombre)")
    .maybeSingle();

  const { data: reclamos } = await supabase
    .from("reclamos")
    .select("id, descripcion, estado, created_at")
    .order("created_at", { ascending: false });

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

      {unidad && (
        <form action={crearReclamo} className="flex flex-col gap-2 rounded-md border p-4">
          <label htmlFor="descripcion" className="text-sm font-medium">
            Nuevo reclamo
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            required
            rows={3}
            placeholder="Ej: pierde agua la canilla del baño"
            className="rounded-md border p-2 text-sm bg-transparent"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
          >
            Enviar reclamo
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Mis reclamos</h2>
        {reclamos && reclamos.length > 0 ? (
          reclamos.map((r) => (
            <div key={r.id} className="rounded-md border p-4">
              <p className="font-medium">{r.descripcion}</p>
              <p className="text-sm text-muted-foreground">
                Estado: {r.estado} · {new Date(r.created_at).toLocaleDateString("es-UY")}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No tenés reclamos todavía.</p>
        )}
      </div>
    </div>
  );
}