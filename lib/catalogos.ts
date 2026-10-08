// Tipos y ayudas de los catálogos (categorías, urgencias, estados, tipos de vecino).
// Los datos viven en la base; este archivo no los repite, solo define cómo se usan.
// No importa nada del servidor, así que lo pueden usar componentes de cliente y de servidor.

export type Categoria = { codigo: string; nombre: string; descripcion: string; orden: number };
export type Urgencia = { codigo: string; nombre: string; descripcion: string; nivel: number };
export type Estado = { codigo: string; nombre_admin: string; nombre_vecino: string; orden: number };
export type TipoVecino = {
  codigo: string;
  nombre: string;
  descripcion: string;
  sube_niveles: number;
  categorias: string[] | null;
};

export type Catalogos = {
  categorias: Categoria[];
  urgencias: Urgencia[];
  estados: Estado[];
  tiposVecino: TipoVecino[];
};

// Busca el nombre visible de un código; si no existe, devuelve el código o el texto por defecto
function nombre<T extends { codigo: string }>(lista: T[], campo: keyof T, codigo: string | null, porDefecto = "") {
  if (!codigo) return porDefecto;
  const fila = lista.find((x) => x.codigo === codigo);
  return fila ? String(fila[campo]) : codigo;
}

export function crearEtiquetas(c: Catalogos) {
  return {
    categoria: (codigo: string | null) => nombre(c.categorias, "nombre", codigo, "Sin clasificar"),
    urgencia: (codigo: string | null) => nombre(c.urgencias, "nombre", codigo),
    estadoAdmin: (codigo: string | null) => nombre(c.estados, "nombre_admin", codigo),
    estadoVecino: (codigo: string | null) => nombre(c.estados, "nombre_vecino", codigo),
    tipoVecino: (codigo: string | null) => nombre(c.tiposVecino, "nombre", codigo, "Estándar"),
  };
}

export type Etiquetas = ReturnType<typeof crearEtiquetas>;
