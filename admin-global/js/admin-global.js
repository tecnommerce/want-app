// ===================================================
// ADMIN GLOBAL - SPA (Single Page Application)
// ===================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbws2dMYwykCAqHmvKaL6ZXLIT3fUfgLRq7ZvpgHIKvidoNI5yQp62ej5yejCq569eFL/exec';

// ===================================================
// FUNCIONES DE API
// ===================================================

async function callAPI(action, data = {}) {
    try {
        let url = `${API_URL}?action=${action}`;
        if (data && Object.keys(data).length > 0) {
            for (let key in data) {
                url += `&${key}=${encodeURIComponent(data[key])}`;
            }
        }
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('❌ Error en callAPI:', error);
        return { error: error.message };
    }
}

async function postAPI(action, data = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('❌ Error en postAPI:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// UTILITARIAS
// ===================================================

function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio);
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'N/A';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getEstadoTexto(estado) {
    const textos = { 'preparando': 'Nuevo', 'en preparacion': 'En preparación', 'en camino': 'En camino', 'entregado': 'Entregado' };
    return textos[estado] || estado || 'Nuevo';
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.textContent = mensaje;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : '#FF5A00';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '50px';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===================================================
// VARIABLES GLOBALES
// ===================================================

let allVendedores = [];
let allPedidos = [];
let allProductos = [];
let charts = {};

// ===================================================
// CARGA DE DATOS (UNA SOLA VEZ)
// ===================================================

async function cargarTodosLosDatos() {
    console.log('🔄 Cargando todos los datos...');
    
    const vendedoresRes = await callAPI('getVendedores');
    if (vendedoresRes.success) {
        allVendedores = vendedoresRes.vendedores || [];
        console.log(`✅ Cargados ${allVendedores.length} vendedores`);
    }
    
    const pedidosRes = await callAPI('getAllPedidos');
    if (pedidosRes.success) {
        allPedidos = pedidosRes.pedidos || [];
        console.log(`✅ Cargados ${allPedidos.length} pedidos`);
    }
    
    const productosRes = await callAPI('getAllProductos');
    if (productosRes.success) {
        allProductos = productosRes.productos || [];
        console.log(`✅ Cargados ${allProductos.length} productos`);
    }
    
    actualizarDashboard();
    renderizarVendedores();
    renderizarPedidos();
    renderizarProductos();
    cargarFiltros();
}

// ===================================================
// DASHBOARD
// ===================================================

function actualizarDashboard() {
    const totalVendedores = allVendedores.length;
    const totalPedidos = allPedidos.length;
    const totalProductos = allProductos.length;
    const ingresosTotales = allPedidos.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    
    document.getElementById('total-vendedores').textContent = totalVendedores;
    document.getElementById('total-pedidos').textContent = totalPedidos;
    document.getElementById('total-productos').textContent = totalProductos;
    document.getElementById('total-ingresos').textContent = formatearPrecio(ingresosTotales);
    
    const estados = { preparando: 0, 'en preparacion': 0, 'en camino': 0, entregado: 0 };
    allPedidos.forEach(p => {
        const estado = p.estado || 'preparando';
        if (estados[estado] !== undefined) estados[estado]++;
    });
    
    const ctxEstados = document.getElementById('estados-chart');
    if (ctxEstados && typeof Chart !== 'undefined') {
        if (charts.estados) charts.estados.destroy();
        charts.estados = new Chart(ctxEstados, {
            type: 'doughnut',
            data: {
                labels: ['Nuevos', 'En preparación', 'En camino', 'Entregados'],
                datasets: [{ data: [estados.preparando, estados['en preparacion'], estados['en camino'], estados.entregado], backgroundColor: ['#FF9800', '#FFC107', '#2196F3', '#4CAF50'] }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    const ultimos7Dias = [];
    const ventasPorDia = {};
    for (let i = 6; i >= 0; i--) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        const fechaStr = fecha.toISOString().split('T')[0];
        ultimos7Dias.push(fechaStr);
        ventasPorDia[fechaStr] = 0;
    }
    
    allPedidos.forEach(p => {
        const fecha = p.fecha ? p.fecha.split('T')[0] : null;
        if (fecha && ventasPorDia[fecha] !== undefined) {
            ventasPorDia[fecha] += parseFloat(p.total) || 0;
        }
    });
    
    const ctxVentas = document.getElementById('ventas-chart');
    if (ctxVentas && typeof Chart !== 'undefined') {
        if (charts.ventas) charts.ventas.destroy();
        charts.ventas = new Chart(ctxVentas, {
            type: 'line',
            data: {
                labels: ultimos7Dias.map(d => d.slice(5)),
                datasets: [{ label: 'Ventas', data: ultimos7Dias.map(d => ventasPorDia[d]), borderColor: '#FF5A00', backgroundColor: 'rgba(255, 90, 0, 0.1)', fill: true }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    const ventasPorVendedor = {};
    allPedidos.forEach(p => {
        const nombre = p.vendedor_nombre || 'Desconocido';
        ventasPorVendedor[nombre] = (ventasPorVendedor[nombre] || 0) + (parseFloat(p.total) || 0);
    });
    const topVendedores = Object.entries(ventasPorVendedor).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const topVendedoresDiv = document.getElementById('top-vendedores-list');
    if (topVendedoresDiv) {
        topVendedoresDiv.innerHTML = topVendedores.map(([nombre, total]) => `<div class="top-item"><span class="top-item-name">${escapeHTML(nombre)}</span><span class="top-item-value">${formatearPrecio(total)}</span></div>`).join('');
        if (topVendedores.length === 0) topVendedoresDiv.innerHTML = '<p class="loading-text">No hay datos</p>';
    }
    
    const ventasPorProducto = {};
    allPedidos.forEach(p => {
        if (p.productos) {
            p.productos.forEach(prod => {
                ventasPorProducto[prod.nombre] = (ventasPorProducto[prod.nombre] || 0) + prod.cantidad;
            });
        }
    });
    const topProductos = Object.entries(ventasPorProducto).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const topProductosDiv = document.getElementById('top-productos-list');
    if (topProductosDiv) {
        topProductosDiv.innerHTML = topProductos.map(([nombre, cantidad]) => `<div class="top-item"><span class="top-item-name">${escapeHTML(nombre)}</span><span class="top-item-value">${cantidad} unidades</span></div>`).join('');
        if (topProductos.length === 0) topProductosDiv.innerHTML = '<p class="loading-text">No hay datos</p>';
    }
    
    const recentOrders = allPedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
    const tbody = document.getElementById('recent-orders-tbody');
    if (tbody) {
        tbody.innerHTML = recentOrders.map(p => `
             <tr>
                 <td>#${p.id}</td>
                 <td>${escapeHTML(p.cliente_nombre || 'N/A')}</td>
                 <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
                 <td>${formatearPrecio(p.total)}</td>
                 <td><span class="status-badge status-${p.estado || 'preparando'}">${getEstadoTexto(p.estado)}</span></td>
                 <td>${formatearFecha(p.fecha)}</td>
             </tr>
        `).join('');
        if (recentOrders.length === 0) tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No hay pedidos</td></tr>';
    }
}

// ===================================================
// VENDEDORES
// ===================================================

function renderizarVendedores() {
    const tbody = document.getElementById('vendedores-tbody');
    if (!tbody) return;
    
    if (allVendedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-text">No hay vendedores registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = allVendedores.map(v => `
        <tr>
            <td>${v.id}</td>
            <td><strong>${escapeHTML(v.nombre)}</strong></td>
            <td>${escapeHTML(v.email || '-')}</td>
            <td>${v.telefono || '-'}</td>
            <td>${escapeHTML(v.direccion || '-')}</td>
            <td><span class="status-badge ${v.activo === 'SI' ? 'status-activo' : 'status-inactivo'}">${v.activo === 'SI' ? 'Activo' : 'Inactivo'}</span></td>
            <td>
                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="eliminarVendedor(${v.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// ===================================================
// PEDIDOS
// ===================================================

function renderizarPedidos() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    
    let pedidosFiltrados = [...allPedidos];
    
    const filtroVendedor = document.getElementById('filtro-vendedor')?.value;
    if (filtroVendedor) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.vendedor_id.toString() === filtroVendedor);
    }
    
    const filtroEstado = document.getElementById('filtro-estado')?.value;
    if (filtroEstado) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.estado === filtroEstado);
    }
    
    const filtroFecha = document.getElementById('filtro-fecha')?.value;
    if (filtroFecha) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.fecha && p.fecha.split('T')[0] === filtroFecha);
    }
    
    pedidosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    if (pedidosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-text">No hay pedidos</td></tr>';
        return;
    }
    
    tbody.innerHTML = pedidosFiltrados.slice(0, 100).map(p => `
        <tr>
            <td>#${p.id}</td>
            <td>${formatearFecha(p.fecha)}</td>
            <td>${escapeHTML(p.cliente_nombre || 'N/A')}</td>
            <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
            <td>${formatearPrecio(p.total)}</td>
            <td><span class="status-badge status-${p.estado || 'preparando'}">${getEstadoTexto(p.estado)}</span></td>
            <td>${p.productos ? p.productos.length : 0} productos</td>
        </tr>
    `).join('');
}

function cargarFiltros() {
    const filtroVendedor = document.getElementById('filtro-vendedor');
    const filtroVendedorProd = document.getElementById('filtro-vendedor-prod');
    
    const options = '<option value="">Todos los vendedores</option>' + allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    
    if (filtroVendedor) filtroVendedor.innerHTML = options;
    if (filtroVendedorProd) filtroVendedorProd.innerHTML = options;
}

// ===================================================
// PRODUCTOS
// ===================================================

function renderizarProductos() {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    
    let productosFiltrados = [...allProductos];
    
    const filtroVendedor = document.getElementById('filtro-vendedor-prod')?.value;
    if (filtroVendedor) {
        productosFiltrados = productosFiltrados.filter(p => p.vendedor_id.toString() === filtroVendedor);
    }
    
    const searchTerm = document.getElementById('search-producto')?.value.toLowerCase();
    if (searchTerm) {
        productosFiltrados = productosFiltrados.filter(p => p.nombre?.toLowerCase().includes(searchTerm) || p.descripcion?.toLowerCase().includes(searchTerm));
    }
    
    if (productosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-text">No hay productos</td></tr>';
        return;
    }
    
    tbody.innerHTML = productosFiltrados.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.imagen_url ? `<img src="${p.imagen_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;">` : '<span style="color:#ccc;">📷</span>'}</td>
            <td><strong>${escapeHTML(p.nombre)}</strong></td>
            <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
            <td>${formatearPrecio(p.precio)}</td>
            <td>0</td>
            <td><span class="status-badge ${p.disponible === 'SI' ? 'status-activo' : 'status-inactivo'}">${p.disponible === 'SI' ? 'Disponible' : 'No disponible'}</span></td>
            <td>
                <button class="btn-edit" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// ===================================================
// NAVEGACIÓN ENTRE SECCIONES (sin recargar)
// ===================================================

function cambiarSeccion(seccionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    
    // Mostrar la sección seleccionada
    const seccion = document.getElementById(`section-${seccionId}`);
    if (seccion) seccion.style.display = 'block';
    
    // Actualizar clase activa en el menú
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === seccionId) {
            item.classList.add('active');
        }
    });
}

// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Panel Administrativo Global iniciado');
    
    // Cargar todos los datos una sola vez
    await cargarTodosLosDatos();
    
    // Configurar navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const seccion = item.getAttribute('data-section');
            cambiarSeccion(seccion);
        });
    });
    
    // Filtros de pedidos
    const filtros = ['filtro-vendedor', 'filtro-estado', 'filtro-fecha'];
    filtros.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => renderizarPedidos());
    });
    
    // Buscador de productos
    const searchProducto = document.getElementById('search-producto');
    if (searchProducto) searchProducto.addEventListener('input', () => renderizarProductos());
    
    // Buscador de vendedores
    const searchVendedor = document.getElementById('search-vendedor');
    if (searchVendedor) {
        searchVendedor.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allVendedores.filter(v => v.nombre?.toLowerCase().includes(term) || v.email?.toLowerCase().includes(term));
            const tbody = document.getElementById('vendedores-tbody');
            if (tbody) {
                if (filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" class="loading-text">No hay vendedores</td></tr>';
                } else {
                    tbody.innerHTML = filtered.map(v => `
                        <tr>
                            <td>${v.id}</td>
                            <td><strong>${escapeHTML(v.nombre)}</strong></td>
                            <td>${escapeHTML(v.email || '-')}</td>
                            <td>${v.telefono || '-'}</td>
                            <td>${escapeHTML(v.direccion || '-')}</td>
                            <td><span class="status-badge ${v.activo === 'SI' ? 'status-activo' : 'status-inactivo'}">${v.activo === 'SI' ? 'Activo' : 'Inactivo'}</span></td>
                            <td>
                                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i></button>
                                <button class="btn-delete" onclick="eliminarVendedor(${v.id})"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        });
    }
    
    // Botón cerrar sesión
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.removeItem('admin_session');
            window.location.href = 'login.html';
        });
    }
    
    // Menú móvil
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove('active');
            }
        });
    }
});