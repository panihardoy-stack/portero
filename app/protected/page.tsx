import { Suspense } from "react";
import { redirect } from "next/navigation";
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

// ---------- ADMINISTRADOR ----------
async function PanelAdmin({ nombre }: { nombre: string }) {
  const supabase = await createClient();

  // Por RLS, solo trae los edificios y reclamos que administra este usuario
  const { data: edificios } = await supabase
    .from("edificios")
    .select("id, nombre, direccion, codigo_invitacion");

  const { count: totalReclamos } = await supabase
    .from("reclamos")
    .select("*", { count: "exact", head: true });

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

  const rel = unidad?.edificios as unknown as
    | { nombre: string }
    | { nombre: string }[]
    | null
    | undefined;
  const nombreEdificio = Array.isArray(rel) ? rel[0]?.nombre : rel?.nombre;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Panel del vecino</p>
        <h1 className="text-2xl font-bold">Hola, {nombre}</h1>
        {unidad ? (
          <p className="text-sm">
            {nombreEdificio} · Unidad {unidad.nombre}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no estás asociado a ninguna unidad.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Mis reclamos</h2>
        {reclamos && reclamos.length > 0 ? (
          reclamos.map((r) => (
            <div key={r.id} className="rounded-md border p-4">
              <p className="font-medium">{r.descripcion}</p>
              <p className="text-sm text-muted-foreground">Estado: {r.estado}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No tenés reclamos todavía.</p>
        )}
      </div>
    </div>
  );
}