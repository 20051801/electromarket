const { redondear, calcularPrecio } = require("./precios");

// Servicios de terceros
const URL_PRODUCTOS = "https://dummyjson.com/products/category";
const URL_CAMBIO = "https://api.frankfurter.app/latest?from=USD&to=MXN";

// Categorías de la API externa y su nombre en español.
const CATEGORIAS_API = {
  laptops: "Computadoras",
  smartphones: "Celulares",
  tablets: "Tabletas",
  "mobile-accessories": "Accesorios"
};

const PRODUCTOS_POR_CATEGORIA = 6;
const TASA_RESPALDO = 18;
const VIGENCIA_CAMBIO_MS = 60 * 60 * 1000; // 1 hora

let cacheCambio = { tasa: null, expira: 0 };

// Tipo de cambio USD -> MXN con caché y valor de respaldo.
async function obtenerTipoCambio() {
  if (cacheCambio.tasa && Date.now() < cacheCambio.expira) {
    return cacheCambio.tasa;
  }

  try {
    const respuesta = await fetch(URL_CAMBIO);
    if (!respuesta.ok) throw new Error(`Estado ${respuesta.status}`);

    const datos = await respuesta.json();
    const tasa = datos.rates.MXN;

    cacheCambio = { tasa, expira: Date.now() + VIGENCIA_CAMBIO_MS };
    return tasa;
  } catch (error) {
    console.warn("Tipo de cambio no disponible, se usa el de respaldo:", error.message);
    return cacheCambio.tasa || TASA_RESPALDO;
  }
}

// Patrón Adapter: convierte el formato de DummyJSON al formato de nuestra app.
function adaptarProducto(productoExterno, categoria, tasa, modo) {
  const precioBase = redondear(productoExterno.price * tasa);

  return {
    id: productoExterno.id,
    nombre: productoExterno.title,
    categoria,
    descripcion: productoExterno.description,
    imagen: productoExterno.thumbnail,
    precioBase,
    precio: calcularPrecio(precioBase, modo)
  };
}

async function obtenerProductos(modo = "base") {
  const tasa = await obtenerTipoCambio();

  const peticiones = Object.entries(CATEGORIAS_API).map(async ([slug, nombre]) => {
    const respuesta = await fetch(
      `${URL_PRODUCTOS}/${slug}?limit=${PRODUCTOS_POR_CATEGORIA}`
    );

    if (!respuesta.ok) {
      throw new Error(`DummyJSON respondió ${respuesta.status} en ${slug}`);
    }

    const datos = await respuesta.json();
    return datos.products.map(p => adaptarProducto(p, nombre, tasa, modo));
  });

  const resultados = await Promise.all(peticiones);
  return resultados.flat();
}

async function obtenerProductoPorId(id, modo = "base") {
  const productos = await obtenerProductos(modo);
  return productos.find(p => p.id === id) || null;
}

module.exports = {
  obtenerProductos,
  obtenerProductoPorId,
  obtenerTipoCambio,
  adaptarProducto
};