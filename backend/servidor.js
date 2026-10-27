const express = require("express");
const path = require("path");
const {
  inicializar,
  obtenerProductos,
  obtenerProductoPorId,
  obtenerCategorias,
  obtenerTipoCambio
} = require("./servicios/productosServicio");

const app = express();
const PUERTO = process.env.PORT || 3000;

// CORS básico (permite llamar a la API desde otro origen).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Solo se aceptan dos modos: "base" o "venta".
function leerModo(req) {
  return req.query.modo === "venta" ? "venta" : "base";
}

// GET /api/salud -> comprobar que el servicio está activo
app.get("/api/salud", (req, res) => {
  res.json({ estado: "ok", hora: new Date().toISOString() });
});

// GET /api/tipo-cambio -> tipo de cambio USD a MXN (API de terceros)
app.get("/api/tipo-cambio", async (req, res) => {
  const tasa = await obtenerTipoCambio();
  res.json({ de: "USD", a: "MXN", tasa });
});

// GET /api/categorias
app.get("/api/categorias", async (req, res) => {
  try {
    res.json(await obtenerCategorias());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al consultar la base de datos." });
  }
});

// GET /api/productos?modo=base|venta&categoria=Celulares&buscar=texto
app.get("/api/productos", async (req, res) => {
  try {
    const modo = leerModo(req);
    const { categoria, buscar } = req.query;
    const productos = await obtenerProductos(modo, { categoria, buscar });

    res.json({ modo, total: productos.length, productos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al consultar la base de datos." });
  }
});

// GET /api/productos/:id?modo=base|venta
app.get("/api/productos/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "El id debe ser un número entero." });
  }

  try {
    const producto = await obtenerProductoPorId(id, leerModo(req));

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    res.json(producto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al consultar la base de datos." });
  }
});

// Sirve el frontend desde la misma dirección que la API.
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Arranca: primero prepara la base de datos y luego abre el puerto.
async function iniciar() {
  try {
    await inicializar();
    app.listen(PUERTO, () => {
      console.log(`ElectroMarket escuchando en el puerto ${PUERTO}`);
    });
  } catch (error) {
    console.error("No se pudo conectar con la base de datos:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  iniciar();
}

// Se exporta para poder probarlo con Supertest.
module.exports = app;