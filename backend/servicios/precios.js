// Patrón Strategy: cada modo de precio es una estrategia intercambiable.

const INCREMENTO = 0.35;

function redondear(cantidad) {
  return Math.round(cantidad * 100) / 100;
}

const estrategias = {
  base: {
    calcular: precioBase => redondear(precioBase)
  },
  venta: {
    calcular: precioBase => redondear(precioBase * (1 + INCREMENTO))
  }
};

// Si el modo no existe, se usa el precio base.
function calcularPrecio(precioBase, modo = "base") {
  const estrategia = estrategias[modo] || estrategias.base;
  return estrategia.calcular(precioBase);
}

module.exports = { INCREMENTO, redondear, calcularPrecio };