// Respaldo de las fotos de los reclamos (bucket "fotos-reclamos" de Supabase).
// Descarga todas las fotos a backups/fotos-AAAA-MM-DD/, con la misma estructura de carpetas,
// para poder volver a subirlas con la misma ruta si hiciera falta.
//
// Uso (desde la carpeta del proyecto):
//   node --env-file=.env.local scripts/backup-fotos.mjs
//
// Usa la clave secreta de Supabase, que solo existe en .env.local (nunca en el repositorio).
// La carpeta backups/ está en .gitignore: las fotos son datos personales y no se suben a GitHub.

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BUCKET = "fotos-reclamos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const claveSecreta =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !claveSecreta) {
  console.error(
    "Faltan variables: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, claveSecreta, { auth: { persistSession: false } });
const fecha = new Date().toISOString().slice(0, 10);
const destino = path.join("backups", `fotos-${fecha}`);

// Recorre una carpeta del bucket y devuelve la ruta de cada archivo, entrando en las subcarpetas.
async function listarArchivos(carpeta = "") {
  const archivos = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(carpeta, { limit: 1000, offset });
    if (error) throw new Error(`No se pudo listar "${carpeta || "/"}": ${error.message}`);
    for (const item of data) {
      const ruta = carpeta ? `${carpeta}/${item.name}` : item.name;
      if (item.id === null) archivos.push(...(await listarArchivos(ruta))); // es una carpeta
      else archivos.push(ruta);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return archivos;
}

const archivos = await listarArchivos();
console.log(`Encontré ${archivos.length} fotos en "${BUCKET}". Descargando en ${destino}/ ...`);

let ok = 0;
let errores = 0;
for (const ruta of archivos) {
  const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
  if (error) {
    errores++;
    console.error(`  Error con ${ruta}: ${error.message}`);
    continue;
  }
  const archivoLocal = path.join(destino, ruta);
  await mkdir(path.dirname(archivoLocal), { recursive: true });
  await writeFile(archivoLocal, Buffer.from(await data.arrayBuffer()));
  ok++;
}

console.log(`Listo: ${ok} fotos respaldadas${errores ? `, ${errores} con error` : ""}.`);
