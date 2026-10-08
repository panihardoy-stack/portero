// Lectura de los parámetros de la dirección (?estado=nuevo&dias=30)
export type Parametros = Record<string, string | string[] | undefined>;

export function leerParametro(p: Parametros, clave: string) {
  const v = p[clave];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}
