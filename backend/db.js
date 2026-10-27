require("dotenv").config();
const mysql = require("mysql2/promise");

// Las credenciales vienen de variables de entorno (nunca van en el código).
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  charset: "utf8mb4",
  // Evita que la base de datos en la nube cierre conexiones inactivas.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 2,
  idleTimeout: 30000,
  // Las bases de datos en la nube normalmente exigen conexión cifrada.
  ssl:
    process.env.DB_SSL === "true"
      ? {
          minVersion: "TLSv1.2",
          rejectUnauthorized: process.env.DB_SSL_VERIFICAR !== "false"
        }
      : undefined
});

// Errores de red que se resuelven abriendo una conexión nueva.
const ERRORES_RECUPERABLES = [
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "EPIPE",
  "ETIMEDOUT"
];

// Ejecuta una consulta y, si la conexión se había caído, la repite una vez.
async function consultar(sql, parametros = []) {
  try {
    return await pool.query(sql, parametros);
  } catch (error) {
    if (!ERRORES_RECUPERABLES.includes(error.code)) throw error;

    console.warn("Conexión perdida con la base de datos, reintentando...");
    return await pool.query(sql, parametros);
  }
}

// Crea las tablas si todavía no existen.
async function crearTablas() {
  await consultar(`
    CREATE TABLE IF NOT EXISTS categorias (
      id     INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(60) NOT NULL UNIQUE
    )
  `);

  await consultar(`
    CREATE TABLE IF NOT EXISTS productos (
      id           INT PRIMARY KEY,
      nombre       VARCHAR(150) NOT NULL,
      descripcion  TEXT,
      imagen       VARCHAR(500),
      precio_base  DECIMAL(10,2) NOT NULL,
      categoria_id INT NOT NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )
  `);
}

module.exports = { pool, consultar, crearTablas };