const { pool, crearTablas, consultar } = require("../db");
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

// Tipo de cambio USD -> MXN con valor de respaldo.
async function obtenerTipoCambio() {
  try {
    const respuesta = await fetch(URL_CAMBIO);
    if (!respuesta.ok) throw new Error(`Estado ${respuesta.status}`);

    const datos = await respuesta.json();
    return datos.rates.MXN;
  } catch (error) {
    console.warn("Tipo de cambio no disponible, se usa el de respaldo:", error.message);
    return TASA_RESPALDO;
  }
}

// Patrón Adapter: convierte el formato de DummyJSON al de nuestra tabla.
function adaptarProducto(externo, tasa) {
  return {
    id: externo.id,
    nombre: externo.title,
    descripcion: externo.description,
    imagen: externo.thumbnail,
    precioBase: redondear(externo.price * tasa)
  };
}

// Descarga los productos de la API de terceros y los guarda en MySQL.
async function importarProductos() {
  const tasa = await obtenerTipoCambio();
  let total = 0;

  for (const [slug, nombreCategoria] of Object.entries(CATEGORIAS_API)) {
    const respuesta = await fetch(
      `${URL_PRODUCTOS}/${slug}?limit=${PRODUCTOS_POR_CATEGORIA}`
    );

    if (!respuesta.ok) {
      throw new Error(`DummyJSON respondió ${respuesta.status} en ${slug}`);
    }

    const datos = await respuesta.json();

    await pool.execute(
      "INSERT INTO categorias (nombre) VALUES (?) ON DUPLICATE KEY UPDATE nombre = nombre",
      [nombreCategoria]
    );

    const [filas] = await pool.execute(
      "SELECT id FROM categorias WHERE nombre = ?",
      [nombreCategoria]
    );
    const categoriaId = filas[0].id;

    for (const externo of datos.products) {
      const p = adaptarProducto(externo, tasa);

      await pool.execute(
        `INSERT INTO productos (id, nombre, descripcion, imagen, precio_base, categoria_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre),
           descripcion = VALUES(descripcion),
           imagen = VALUES(imagen),
           precio_base = VALUES(precio_base),
           categoria_id = VALUES(categoria_id)`,
        [p.id, p.nombre, p.descripcion, p.imagen, p.precioBase, categoriaId]
      );
      total++;
    }
  }

  return total;
}

// Crea las tablas y, si la base está vacía, la llena con la API externa.
async function inicializar() {
  await crearTablas();

  const [[{ total }]] = await consultar("SELECT COUNT(*) AS total FROM productos");

  if (total === 0) {
    console.log("Base de datos vacía: importando productos de DummyJSON...");
    const importados = await importarProductos();
    console.log(`Se importaron ${importados} productos.`);
  }
}

// Convierte una fila de MySQL al formato JSON de nuestra API.
function filaAProducto(fila, modo) {
  const precioBase = Number(fila.precio_base);

  return {
    id: fila.id,
    nombre: fila.nombre,
    categoria: fila.categoria,
    descripcion: fila.descripcion,
    imagen: fila.imagen,
    precioBase,
    precio: calcularPrecio(precioBase, modo)
  };
}

const CONSULTA_BASE = `
  SELECT p.id, p.nombre, c.nombre AS categoria, p.descripcion, p.imagen, p.precio_base
  FROM productos p
  JOIN categorias c ON c.id = p.categoria_id
`;

// Lista productos con filtros opcionales (consultas parametrizadas).
async function obtenerProductos(modo = "base", { categoria, buscar } = {}) {
  const condiciones = [];
  const parametros = [];

  if (categoria) {
    condiciones.push("c.nombre = ?");
    parametros.push(categoria);
  }

  if (buscar) {
    const texto = `%${String(buscar).trim()}%`;
    condiciones.push("(p.nombre LIKE ? OR p.descripcion LIKE ? OR c.nombre LIKE ?)");
    parametros.push(texto, texto, texto);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const [filas] = await consultar(
    `${CONSULTA_BASE} ${where} ORDER BY p.id`,
    parametros
  );

  return filas.map(fila => filaAProducto(fila, modo));
}

async function obtenerProductoPorId(id, modo = "base") {
  const [filas] = await consultar(`${CONSULTA_BASE} WHERE p.id = ?`, [id]);
  return filas.length ? filaAProducto(filas[0], modo) : null;
}

async function obtenerCategorias() {
  const [filas] = await consultar("SELECT nombre FROM categorias ORDER BY nombre");
  return filas.map(f => f.nombre);
}

module.exports = {
  inicializar,
  importarProductos,
  obtenerProductos,
  obtenerProductoPorId,
  obtenerCategorias,
  obtenerTipoCambio,
  adaptarProducto
};