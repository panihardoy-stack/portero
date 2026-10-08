// Formatos de números en español de Uruguay, usados en el panel del vecino y el dashboard

// "3,7" (siempre un decimal)
export const unDecimal = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// "3" o "3,5" (hasta un decimal)
export const hastaUnDecimal = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 1 });

// "83 %"
export const porcentaje = new Intl.NumberFormat("es-UY", { style: "percent", maximumFractionDigits: 0 });
