// Dirección del web service propio (backend con Express).
const API_URL = "https://electromarket-b9qe.onrender.com";

// Aquí se guardan los productos recibidos de nuestra API.
let productos = [];

// Pide los productos al backend. El cálculo del +35 % lo hace el servidor.
async function cargarProductos(modoVenta) {
  const modo = modoVenta ? "venta" : "base";
  const respuesta = await fetch(`${API_URL}/productos?modo=${modo}`);

  if (!respuesta.ok) {
    throw new Error(`El servidor respondió ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  return datos.productos;
}

// Formatea las cantidades como moneda mexicana.
function formatoMoneda(cantidad) {
  return cantidad.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN"
  });
}

// Genera las categorías a partir de los productos.
function obtenerCategorias() {
  return [...new Set(productos.map(p => p.categoria))];
}

// Crea las tarjetas de productos.
function mostrarProductos(lista, modoVenta) {
  const contenedor = document.getElementById("lista-productos");
  const contador = document.getElementById("contador");

  if (!contenedor) return;

  if (contador) {
    contador.textContent = `${lista.length} productos`;
  }

  if (lista.length === 0) {
    contenedor.innerHTML =
      '<p class="sin-resultados">No se encontraron productos.</p>';
    return;
  }

  contenedor.innerHTML = lista.map(producto => `
      <article class="producto">
        <img
          src="${producto.imagen}"
          alt="${producto.nombre}"
          class="producto-imagen"
          loading="lazy"
        >

        <div class="producto-info">
          <span class="categoria">${producto.categoria}</span>
          <h3>${producto.nombre}</h3>
          <p>${producto.descripcion}</p>

          <div class="precio">
            ${formatoMoneda(producto.precio)}
          </div>

          ${
            modoVenta
              ? `<p class="detalle-precio">
                   Precio base: ${formatoMoneda(producto.precioBase)}
                 </p>
                 <span class="etiqueta-ganancia">
                   +35 % aplicado
                 </span>`
              : `<p class="detalle-precio">
                   Precio base del artículo
                 </p>`
          }
        </div>
      </article>
    `).join("");
}

// Configura buscador, categorías y página actual.
document.addEventListener("DOMContentLoaded", async () => {
  const modoVenta = document.body.dataset.modo === "venta";
  const buscador = document.getElementById("buscador");
  const filtro = document.getElementById("filtro-categoria");
  const contenedor = document.getElementById("lista-productos");

  if (contenedor) {
    contenedor.innerHTML =
      '<p class="sin-resultados">Cargando productos...</p>';
  }

  try {
    productos = await cargarProductos(modoVenta);
  } catch (error) {
    console.error("No se pudieron cargar los productos:", error);
    if (contenedor) {
      contenedor.innerHTML =
        '<p class="sin-resultados">No se pudo conectar con el servidor. Verifica que el backend esté encendido (npm start).</p>';
    }
    return;
  }

  if (filtro) {
    filtro.innerHTML =
      '<option value="Todas">Todas las categorías</option>' +
      obtenerCategorias().map(categoria =>
        `<option value="${categoria}">${categoria}</option>`
      ).join("");
  }

  function filtrarProductos() {
    const texto = buscador ? buscador.value.toLowerCase().trim() : "";
    const categoria = filtro ? filtro.value : "Todas";

    const resultado = productos.filter(producto => {
      const coincideTexto =
        producto.nombre.toLowerCase().includes(texto) ||
        producto.descripcion.toLowerCase().includes(texto) ||
        producto.categoria.toLowerCase().includes(texto);

      const coincideCategoria =
        categoria === "Todas" || producto.categoria === categoria;

      return coincideTexto && coincideCategoria;
    });

    mostrarProductos(resultado, modoVenta);
  }

  if (buscador) buscador.addEventListener("input", filtrarProductos);
  if (filtro) filtro.addEventListener("change", filtrarProductos);

  filtrarProductos();
});