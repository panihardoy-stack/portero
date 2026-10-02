import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIPOS_IMAGEN, clasificarReclamo } from "@/lib/ia/clasificar";

// Clasifica un reclamo con IA y guarda la sugerencia en las columnas ia_*.
// La llama el formulario del vecino al enviar, o el admin con "Pedir sugerencia".
export async function POST(request: Request) {
  const { reclamoId, forzar } = (await request.json().catch(() => ({}))) as {
    reclamoId?: number;
    forzar?: boolean;
  };
  if (!reclamoId) {
    return NextResponse.json({ error: "Falta el reclamo." }, { status: 400 });
  }

  // 1. Con los permisos del usuario: RLS confirma que puede ver este reclamo
  //    (el vecino que lo creó o el admin de su edificio)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });

  const { data: reclamo } = await supabase
    .from("reclamos")
    .select("id, descripcion, foto_path, unidad_id, ia_categoria")
    .eq("id", reclamoId)
    .maybeSingle();
  if (!reclamo) return NextResponse.json({ error: "Reclamo no encontrado." }, { status: 404 });

  // Si ya tiene sugerencia, solo el admin puede pedir otra (cada llamada a la IA cuesta)
  if (reclamo.ia_categoria) {
    const { data: perfil } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
    if (!(forzar && perfil?.rol === "admin")) {
      return NextResponse.json({ ok: true, yaClasificado: true });
    }
  }

  // 2. Con permisos de servidor: leer proveedores y la foto, y guardar la sugerencia
  const admin = createAdminClient();

  const { data: unidad } = await admin
    .from("unidades")
    .select("edificios(admin_id)")
    .eq("id", reclamo.unidad_id)
    .single();
  const rel = unidad?.edificios as unknown as { admin_id: string } | { admin_id: string }[] | null;
  const adminId = Array.isArray(rel) ? rel[0]?.admin_id : rel?.admin_id;

  const { data: proveedores } = await admin
    .from("proveedores")
    .select("id, nombre, categoria")
    .eq("admin_id", adminId ?? "");

  let imagen: { mediaType: string; base64: string } | undefined;
  if (reclamo.foto_path) {
    const { data: archivo } = await admin.storage.from("fotos-reclamos").download(reclamo.foto_path);
    if (archivo && (TIPOS_IMAGEN as readonly string[]).includes(archivo.type)) {
      imagen = {
        mediaType: archivo.type,
        base64: Buffer.from(await archivo.arrayBuffer()).toString("base64"),
      };
    }
  }

  try {
    const sugerencia = await clasificarReclamo({
      descripcion: reclamo.descripcion,
      imagen,
      proveedores: proveedores ?? [],
    });

    const { error } = await admin
      .from("reclamos")
      .update({
        ia_categoria: sugerencia.categoria,
        ia_urgencia: sugerencia.urgencia,
        ia_proveedor_id: sugerencia.proveedor_id,
        ia_justificacion: sugerencia.justificacion,
      })
      .eq("id", reclamo.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, sugerencia });
  } catch (e) {
    // Si la IA falla, el reclamo queda igual y el admin lo clasifica a mano
    console.error("Error al clasificar el reclamo", reclamo.id, e);
    return NextResponse.json({ error: "No se pudo obtener la sugerencia de la IA." }, { status: 502 });
  }
}
