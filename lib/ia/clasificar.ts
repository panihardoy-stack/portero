// Clasificación de reclamos con un modelo de lenguaje con visión (Claude Haiku 4.5).
// Se llama solo desde el servidor, porque usa la clave de la API.

export const MODELO_IA = "claude-haiku-4-5";

const CATEGORIAS = ["sanitaria", "humedad", "electrica", "ascensor", "cerrajeria", "otros"] as const;
const URGENCIAS = ["alta", "media", "baja"] as const;

// Formatos de imagen que acepta la API. Otros (por ejemplo HEIC) se clasifican solo por el texto.
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export type Clasificacion = {
  categoria: string;
  urgencia: string;
  proveedor_id: number | null;
  justificacion: string;
};

type Proveedor = { id: number; nombre: string; categoria: string };

const INSTRUCCIONES = `Sos el asistente de la administración de un edificio de apartamentos en Uruguay.
Recibís el reclamo de un vecino (texto y, a veces, una foto) y lo clasificás para que la administración decida rápido.

Categorías:
- sanitaria: cañerías, canillas, desagües, inodoros, calefón, pérdidas de agua.
- humedad: manchas, filtraciones, goteras, moho, paredes o techos mojados.
- electrica: luces, enchufes, llaves térmicas, portero eléctrico, cables.
- ascensor: cualquier falla del ascensor.
- cerrajeria: cerraduras, llaves, puertas que no cierran, buzones.
- otros: lo que no entra en las anteriores (vidrios, pintura, ruidos, limpieza).

Urgencia:
- alta: riesgo para las personas, o un daño que empeora rápido. Por ejemplo: agua saliendo sin control, chispas u olor a quemado, gente atrapada en el ascensor, la puerta de entrada del edificio que no cierra.
- media: afecta el uso normal de la unidad o del edificio, pero no empeora de un momento a otro.
- baja: algo estético o menor que puede esperar.

Proveedor: elegí el id de la lista de proveedores que corresponda a la categoría. Si ninguno corresponde, usá null.
Justificación: una sola oración, en español rioplatense, de 25 palabras como máximo, que explique la urgencia.
Si la foto no tiene relación con el texto, clasificá por el texto y mencionalo en la justificación.`;

export async function clasificarReclamo({
  descripcion,
  imagen,
  proveedores,
}: {
  descripcion: string;
  imagen?: { mediaType: string; base64: string };
  proveedores: Proveedor[];
}): Promise<Clasificacion> {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) throw new Error("Falta ANTHROPIC_API_KEY en las variables de entorno.");

  const listaProveedores = proveedores.length
    ? proveedores.map((p) => `- id ${p.id}: ${p.nombre} (${p.categoria})`).join("\n")
    : "(no hay proveedores cargados)";

  const contenido: unknown[] = [];
  if (imagen) {
    contenido.push({
      type: "image",
      source: { type: "base64", media_type: imagen.mediaType, data: imagen.base64 },
    });
  }
  contenido.push({
    type: "text",
    text: `Reclamo del vecino: "${descripcion}"\n\nProveedores disponibles:\n${listaProveedores}`,
  });

  const respuesta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": clave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO_IA,
      max_tokens: 400,
      system: INSTRUCCIONES,
      // Se fuerza el uso de la herramienta para recibir siempre un JSON con este formato
      tools: [
        {
          name: "clasificar_reclamo",
          description: "Guarda la clasificación sugerida para el reclamo.",
          input_schema: {
            type: "object",
            properties: {
              categoria: { type: "string", enum: CATEGORIAS },
              urgencia: { type: "string", enum: URGENCIAS },
              proveedor_id: { type: ["integer", "null"] },
              justificacion: { type: "string" },
            },
            required: ["categoria", "urgencia", "proveedor_id", "justificacion"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "clasificar_reclamo" },
      messages: [{ role: "user", content: contenido }],
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`La API de IA respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = (await respuesta.json()) as {
    content: { type: string; input?: Partial<Clasificacion> }[];
  };
  const resultado = datos.content.find((c) => c.type === "tool_use")?.input;
  if (!resultado) throw new Error("La IA no devolvió una clasificación.");

  // Validar todo lo que vuelve: nunca se confía ciegamente en la respuesta del modelo
  const categoria = CATEGORIAS.includes(resultado.categoria as (typeof CATEGORIAS)[number])
    ? (resultado.categoria as string)
    : "otros";
  const urgencia = URGENCIAS.includes(resultado.urgencia as (typeof URGENCIAS)[number])
    ? (resultado.urgencia as string)
    : "media";
  const proveedorValido = proveedores.some((p) => p.id === resultado.proveedor_id);
  const proveedor_id = proveedorValido
    ? (resultado.proveedor_id as number)
    : proveedores.find((p) => p.categoria === categoria)?.id ?? null;

  return {
    categoria,
    urgencia,
    proveedor_id,
    justificacion: String(resultado.justificacion ?? "").slice(0, 300),
  };
}
