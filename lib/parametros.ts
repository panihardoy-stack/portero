// Lectura de los parámetros de la dirección (?estado=nuevo&dias=30)
export type Parametros = Record<string, string | string[] | undefined>;

export function leerParametro(p: Parametros, clave: string) {
  const v = p[clave];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// Arma un link a la misma pantalla cambiando algunos parámetros (null = quitarlo)
export function enlace(base: string, p: Parametros, cambios: Record<string, string | null>) {
  const nuevos = new URLSearchParams();
  Object.entries(p).forEach(([clave, valor]) => {
    const v = Array.isArray(valor) ? valor[0] : valor;
    if (v) nuevos.set(clave, v);
  });
  Object.entries(cambios).forEach(([clave, valor]) => (valor ? nuevos.set(clave, valor) : nuevos.delete(clave)));
  const texto = nuevos.toString();
  return texto ? `${base}?${texto}` : base;
}
