// Pasa a minúsculas y saca tildes, para que "electrica" encuentre "Eléctrica"
export function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Ordena unidades como las ve una persona: 1A, 1B, 2A, 10A
export function compararUnidades(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}
