import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/datos/sesion";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELO_IA, TIPOS_IMAGEN, clasificarReclamo } from "@/lib/ia/clasificar";

// Clasifica un reclamo con IA y guarda la sugerencia en la tabla sugerencias_ia.
// La llama el formulario del vecino al enviar, o el admin con "Pedir sugerencia".
export async function POST(request: Request) {
  const { reclamoId, forzar } = (await request.json().catch(() => ({}))) as {
    reclamoId?: number;
    forzar?: boolean;
  };
  if (!reclamoId) return NextResponse.json({ error: "Falta el reclamo." }, { status: 400 });

  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });

  // 1. Con los permisos del usuario: RLS confirma que puede ver este reclamo
  //    (el vecino que lo creó o el admin de su edificio)
  const { data: reclamo } = await sesion.supabase
    .from("reclamos")
    .select("id, descripcion, foto_path, unidad_id")
    .eq("id", reclamoId)
    .maybeSingle();
  if (!reclamo) return NextResponse.json({ error: "Reclamo no encontrado." }, { status: 404 });

  // 2. Con permisos de servidor: la sugerencia no la puede leer ni escribir el vecino
  const admin = createAdminClient();

  // Si ya tiene sugerencia, solo el admin puede pedir otra (cada llamada a la IA cuesta)
  const { data: existente } = await admin
    .from("sugerencias_ia")
    .select("reclamo_id")
    .eq("reclamo_id", reclamo.id)
    .maybeSingle();
  if (existente && !(forzar && sesion.esAdmin)) {
    return NextResponse.json({ ok: true, yaClasificado: true });
  }

  const { data: unidad } = await admin.from("unidades").select("edificios(admin_id)").eq("id", reclamo.unidad_id).single();
  const rel = unidad?.edificios as unknown as { admin_id: string } | { admin_id: string }[] | null;
  const adminId = Array.isArray(rel) ? rel[0]?.admin_id : rel?.admin_id;

  const [{ data: proveedores }, catalogos] = await Promise.all([
    admin.from("proveedores").select("id, nombre, categoria").eq("admin_id", adminId ?? ""),
    obtenerCatalogos(),
  ]);

  let imagen: { mediaType: string; base64: string } | undefined;
  if (reclamo.foto_path) {
    const { data: archivo } = await admin.storage.from("fotos-reclamos").download(reclamo.foto_path);
    if (archivo && (TIPOS_IMAGEN as readonly string[]).includes(archivo.type)) {
      imagen = { mediaType: archivo.type, base64: Buffer.from(await archivo.arrayBuffer()).toString("base64") };
    }
  }

  try {
    const sugerencia = await clasificarReclamo({
      descripcion: reclamo.descripcion,
      imagen,
      proveedores: proveedores ?? [],
      categorias: catalogos.categorias,
      urgencias: catalogos.urgencias,
    });

    const { error } = await admin.from("sugerencias_ia").upsert({
      reclamo_id: reclamo.id,
      categoria: sugerencia.categoria,
      urgencia: sugerencia.urgencia,
      proveedor_id: sugerencia.proveedor_id,
      justificacion: sugerencia.justificacion,
      modelo: MODELO_IA,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, sugerencia });
  } catch (e) {
    // Si la IA falla, el reclamo queda igual y el admin lo clasifica a mano
    console.error("Error al clasificar el reclamo", reclamo.id, e);
    return NextResponse.json({ error: "No se pudo obtener la sugerencia de la IA." }, { status: 502 });
  }
}
