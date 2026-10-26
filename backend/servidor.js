const express = require("express");
const path = require("path");
const {
  obtenerProductos,
  obtenerProductoPorId,
  obtenerTipoCambio
} = require("./servicios/ProductoServicio");

const app = express();
const PUERTO = process.env.PORT || 3000;

// CORS básico para que Live Server (puerto 5500) pueda llamar a la API.
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

// GET /api/tipo-cambio -> tipo de cambio USD a MXN usado
app.get("/api/tipo-cambio", async (req, res) => {
  const tasa = await obtenerTipoCambio();
  res.json({ de: "USD", a: "MXN", tasa });
});

// GET /api/productos?modo=base|venta&categoria=Celulares&buscar=texto
app.get("/api/productos", async (req, res) => {
  try {
    const modo = leerModo(req);
    let productos = await obtenerProductos(modo);

    const { categoria, buscar } = req.query;

    if (categoria) {
      productos = productos.filter(p => p.categoria === categoria);
    }

    if (buscar) {
      const texto = String(buscar).toLowerCase().trim();
      productos = productos.filter(p =>
        p.nombre.toLowerCase().includes(texto) ||
        p.descripcion.toLowerCase().includes(texto) ||
        p.categoria.toLowerCase().includes(texto)
      );
    }

    res.json({ modo, total: productos.length, productos });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: "No se pudo obtener el catálogo del proveedor externo." });
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
    res.status(502).json({ error: "No se pudo obtener el producto del proveedor externo." });
  }
});

// Opcional: sirve el frontend desde http://localhost:3000
app.use(express.static(path.join(__dirname, "..", "frontend")));

if (require.main === module) {
  app.listen(PUERTO, () => {
    console.log(`ElectroMarket en http://localhost:${PUERTO}`);
  });
}

// Se exporta para poder probarlo con Supertest.
module.exports = app;