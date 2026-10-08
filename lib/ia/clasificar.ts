// Clasificación de reclamos con un modelo de lenguaje con visión (Claude Haiku 4.5).
// Se llama solo desde el servidor, porque usa la clave de la API.

export const MODELO_IA = "claude-haiku-4-5";

import type { Categoria, Urgencia } from "@/lib/catalogos";

// Formatos de imagen que acepta la API. Otros (por ejemplo HEIC) se clasifican solo por el texto.
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export type Clasificacion = {
  categoria: string;
  urgencia: string;
  proveedor_id: number | null;
  justificacion: string;
};

type Proveedor = { id: number; nombre: string; categoria: string };

// Las categorías y urgencias, con su descripción, vienen de la base:
// si se agrega una categoría en la tabla, la IA la conoce sin cambiar este archivo.
function instrucciones(categorias: Categoria[], urgencias: Urgencia[]) {
  return `Sos el asistente de la administración de un edificio de apartamentos en Uruguay.
Recibís el reclamo de un vecino (texto y, a veces, una foto) y lo clasificás para que la administración decida rápido.

Categorías:
${categorias.map((c) => `- ${c.codigo}: ${c.descripcion}.`).join("\n")}

Urgencia:
${urgencias.map((u) => `- ${u.codigo}: ${u.descripcion}.`).join("\n")}

Proveedor: elegí el id de la lista de proveedores que corresponda a la categoría. Si ninguno corresponde, usá null.
Justificación: una sola oración, en español rioplatense, de 25 palabras como máximo, que explique la urgencia.
Si la foto no tiene relación con el texto, clasificá por el texto y mencionalo en la justificación.`;
}

export async function clasificarReclamo({
  descripcion,
  imagen,
  proveedores,
  categorias,
  urgencias,
}: {
  descripcion: string;
  imagen?: { mediaType: string; base64: string };
  proveedores: Proveedor[];
  categorias: Categoria[];
  urgencias: Urgencia[];
}): Promise<Clasificacion> {
  const codigosCategoria = categorias.map((c) => c.codigo);
  const codigosUrgencia = urgencias.map((u) => u.codigo);
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
      system: instrucciones(categorias, urgencias),
      // Se fuerza el uso de la herramienta para recibir siempre un JSON con este formato
      tools: [
        {
          name: "clasificar_reclamo",
          description: "Guarda la clasificación sugerida para el reclamo.",
          input_schema: {
            type: "object",
            properties: {
              categoria: { type: "string", enum: codigosCategoria },
              urgencia: { type: "string", enum: codigosUrgencia },
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
  const categoria = codigosCategoria.includes(String(resultado.categoria)) ? String(resultado.categoria) : "otros";
  const urgencia = codigosUrgencia.includes(String(resultado.urgencia)) ? String(resultado.urgencia) : "media";
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
