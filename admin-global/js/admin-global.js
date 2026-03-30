// ===================================================
// ADMIN GLOBAL - Funciones completas con efectos de carga
// ===================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbws2dMYwykCAqHmvKaL6ZXLIT3fUfgLRq7ZvpgHIKvidoNI5yQp62ej5yejCq569eFL/exec';

// ===================================================
// FUNCIONES DE API (TODAS USAN GET PARA EVITAR CORS)
// ===================================================

async function callAPI(action, data = {}) {
    try {
        let url = `${API_URL}?action=${action}`;
        if (data && Object.keys(data).length > 0) {
            for (let key in data) {
                url += `&${key}=${encodeURIComponent(data[key])}`;
            }
        }
        console.log('📡 GET:', url);
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
        let url = `${API_URL}?action=${action}`;
        for (let key in data) {
            if (data[key] !== undefined && data[key] !== null) {
                url += `&${key}=${encodeURIComponent(data[key])}`;
            }
        }
        console.log('📡 POST (via GET):', url);
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
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
    return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

// Función para mostrar loading en un botón
async function withLoading(button, callback) {
    if (!button) return await callback();
    
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
    
    try {
        return await callback();
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// ===================================================
// VARIABLES GLOBALES
// ===================================================

let allVendedores = [];
let allPedidos = [];
let allProductos = [];
let charts = {};

// ===================================================
// CARGA DE DATOS
// ===================================================

async function cargarTodosLosDatos() {
    console.log('🔄 Cargando todos los datos...');
    try {
        const vendedoresRes = await callAPI('getVendedores');
        if (vendedoresRes.success) allVendedores = vendedoresRes.vendedores || [];
        
        const pedidosRes = await callAPI('getAllPedidos');
        if (pedidosRes.success) allPedidos = pedidosRes.pedidos || [];
        
        const productosRes = await callAPI('getAllProductos');
        if (productosRes.success) allProductos = productosRes.productos || [];
        
        actualizarDashboard();
        renderizarVendedores();
        renderizarPedidos();
        renderizarProductos();
        cargarFiltros();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

async function actualizarDatosManual() {
    const btnRefresh = document.getElementById('btn-refresh-data');
    await withLoading(btnRefresh, async () => {
        mostrarToast('Actualizando datos...', 'info');
        try {
            const vendedoresRes = await callAPI('getVendedores');
            if (vendedoresRes.success) allVendedores = vendedoresRes.vendedores || [];
            const pedidosRes = await callAPI('getAllPedidos');
            if (pedidosRes.success) allPedidos = pedidosRes.pedidos || [];
            const productosRes = await callAPI('getAllProductos');
            if (productosRes.success) allProductos = productosRes.productos || [];
            actualizarDashboard(); renderizarVendedores(); renderizarPedidos(); renderizarProductos(); cargarFiltros();
            mostrarToast('Datos actualizados', 'success');
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

// ===================================================
// DASHBOARD
// ===================================================

function actualizarDashboard() {
    document.getElementById('total-vendedores').textContent = allVendedores.length;
    document.getElementById('total-pedidos').textContent = allPedidos.length;
    document.getElementById('total-productos').textContent = allProductos.length;
    const ingresos = allPedidos.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    document.getElementById('total-ingresos').textContent = formatearPrecio(ingresos);
    
    const ultimos7Dias = [], ventasPorDia = {};
    for (let i = 6; i >= 0; i--) {
        const fecha = new Date(); fecha.setDate(fecha.getDate() - i);
        const fechaStr = fecha.toISOString().split('T')[0];
        ultimos7Dias.push(fechaStr); ventasPorDia[fechaStr] = 0;
    }
    allPedidos.forEach(p => {
        const fecha = p.fecha ? p.fecha.split('T')[0] : null;
        if (fecha && ventasPorDia[fecha] !== undefined) ventasPorDia[fecha] += parseFloat(p.total) || 0;
    });
    const ctxVentas = document.getElementById('ventas-chart');
    if (ctxVentas && typeof Chart !== 'undefined') {
        if (charts.ventas) charts.ventas.destroy();
        charts.ventas = new Chart(ctxVentas, {
            type: 'line', data: { labels: ultimos7Dias.map(d => d.slice(5)), datasets: [{ label: 'Ventas', data: ultimos7Dias.map(d => ventasPorDia[d]), borderColor: '#FF5A00', backgroundColor: 'rgba(255,90,0,0.1)', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    const ventasPorVendedor = {};
    allPedidos.forEach(p => { const nombre = p.vendedor_nombre || 'Desconocido'; ventasPorVendedor[nombre] = (ventasPorVendedor[nombre] || 0) + (parseFloat(p.total) || 0); });
    const topVendedores = Object.entries(ventasPorVendedor).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('top-vendedores-list').innerHTML = topVendedores.map(([nombre, total]) => `<div class="top-item"><span>${escapeHTML(nombre)}</span><span>${formatearPrecio(total)}</span></div>`).join('') || '<p class="loading-text">No hay datos</p>';
    
    const ventasPorProducto = {};
    allPedidos.forEach(p => { if (p.productos) p.productos.forEach(prod => ventasPorProducto[prod.nombre] = (ventasPorProducto[prod.nombre] || 0) + prod.cantidad); });
    const topProductos = Object.entries(ventasPorProducto).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('top-productos-list').innerHTML = topProductos.map(([nombre, cantidad]) => `<div class="top-item"><span>${escapeHTML(nombre)}</span><span>${cantidad} unidades</span></div>`).join('') || '<p class="loading-text">No hay datos</p>';
    
    const recentOrders = allPedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
    document.getElementById('recent-orders-tbody').innerHTML = recentOrders.map(p => `<tr>
        <td>#${p.id}</td>
        <td>${escapeHTML(p.cliente_nombre || 'N/A')}</td>
        <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
        <td>${formatearPrecio(p.total)}</td>
        <td><span class="status-badge status-${p.estado || 'preparando'}">${getEstadoTexto(p.estado)}</span></td>
        <td>${formatearFecha(p.fecha)}</td>
     `).join('') || '<tr><td colspan="6" class="loading-text">No hay pedidos</td>';
}

// ===================================================
// VENDEDORES
// ===================================================

function renderizarVendedores() {
    const tbody = document.getElementById('vendedores-tbody');
    if (!tbody) return;
    const stats = {};
    allPedidos.forEach(p => { const id = p.vendedor_id; if (!stats[id]) stats[id] = { pedidos: 0, ingresos: 0 }; stats[id].pedidos++; stats[id].ingresos += parseFloat(p.total) || 0; });
    tbody.innerHTML = allVendedores.map(v => `
        <tr>
            <td>${v.id}</td>
            <td><strong>${escapeHTML(v.nombre)}</strong></td>
            <td>${escapeHTML(v.email || '-')}</td>
            <td>${v.telefono || '-'}</td>
            <td>${escapeHTML(v.direccion || '-')}</td>
            <td><span class="status-badge ${v.activo === 'SI' ? 'status-activo' : 'status-inactivo'}">${v.activo === 'SI' ? 'Activo' : 'Inactivo'}</span></td>
            <td>${stats[v.id]?.pedidos || 0}</td>
            <td>${formatearPrecio(stats[v.id]?.ingresos || 0)}</td>
            <td>
                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-toggle-status" onclick="toggleVendedorStatus(${v.id}, this)"><i class="fas fa-${v.activo === 'SI' ? 'ban' : 'check-circle'}"></i> ${v.activo === 'SI' ? 'Suspender' : 'Habilitar'}</button>
                <button class="btn-delete" onclick="eliminarVendedor(${v.id}, this)"><i class="fas fa-trash"></i> Eliminar</button>
             </td>
        </tr>
    `).join('');
}

function editarVendedor(id) {
    const v = allVendedores.find(v => v.id.toString() === id.toString());
    if (!v) return;
    document.getElementById('edit-vendedor-id').value = v.id;
    document.getElementById('edit-vendedor-nombre').value = v.nombre || '';
    document.getElementById('edit-vendedor-email').value = v.email || '';
    document.getElementById('edit-vendedor-telefono').value = v.telefono || '';
    document.getElementById('edit-vendedor-direccion').value = v.direccion || '';
    document.getElementById('edit-vendedor-horario').value = v.horario || '';
    document.getElementById('modal-editar-vendedor').classList.add('active');
}

async function guardarEditarVendedor() {
    const btn = document.getElementById('guardar-editar-vendedor');
    await withLoading(btn, async () => {
        const data = {
            id: parseInt(document.getElementById('edit-vendedor-id').value),
            nombre: document.getElementById('edit-vendedor-nombre').value.trim(),
            email: document.getElementById('edit-vendedor-email').value.trim(),
            telefono: document.getElementById('edit-vendedor-telefono').value.trim(),
            direccion: document.getElementById('edit-vendedor-direccion').value.trim(),
            horario: document.getElementById('edit-vendedor-horario').value.trim()
        };
        try {
            const res = await postAPI('actualizarVendedor', data);
            if (res && res.success) { mostrarToast('Vendedor actualizado', 'success'); cerrarModal('modal-editar-vendedor'); await actualizarDatosManual(); }
            else { mostrarToast(res?.error || 'Error al actualizar', 'error'); }
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

async function toggleVendedorStatus(id, button) {
    const v = allVendedores.find(v => v.id.toString() === id.toString());
    if (!v) return;
    const nuevoEstado = v.activo === 'SI' ? 'NO' : 'SI';
    const accion = nuevoEstado === 'SI' ? 'habilitando' : 'suspendiendo';
    
    await withLoading(button, async () => {
        try {
            const res = await postAPI('actualizarVendedor', { id: parseInt(id), activo: nuevoEstado });
            if (res && res.success) { mostrarToast(`Vendedor ${nuevoEstado === 'SI' ? 'habilitado' : 'suspendido'}`, 'success'); await actualizarDatosManual(); }
            else { mostrarToast(res?.error || 'Error al cambiar estado', 'error'); }
        } catch (error) { mostrarToast('Error al cambiar estado', 'error'); }
    });
}

function eliminarVendedor(id, button) {
    window.vendedorAEliminar = id;
    window.vendedorButton = button;
    document.getElementById('modal-confirmar-vendedor').classList.add('active');
}

async function confirmarEliminarVendedor() {
    if (!window.vendedorAEliminar) return;
    const btn = document.getElementById('confirmar-eliminar-vendedor');
    await withLoading(btn, async () => {
        try {
            const res = await postAPI('eliminarVendedor', { vendedorId: window.vendedorAEliminar });
            if (res && res.success) { mostrarToast('Vendedor eliminado', 'success'); cerrarModal('modal-confirmar-vendedor'); await actualizarDatosManual(); }
            else { mostrarToast(res?.error || 'Error al eliminar', 'error'); }
        } catch (error) { mostrarToast('Error al eliminar', 'error'); }
        window.vendedorAEliminar = null;
        window.vendedorButton = null;
    });
}

// ===================================================
// PRODUCTOS
// ===================================================

function renderizarProductos() {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    const filtroVendedor = document.getElementById('filtro-vendedor-prod')?.value;
    const searchTerm = document.getElementById('search-producto')?.value.toLowerCase();
    let filtered = [...allProductos];
    if (filtroVendedor) filtered = filtered.filter(p => p.vendedor_id?.toString() === filtroVendedor);
    if (searchTerm) filtered = filtered.filter(p => p.nombre?.toLowerCase().includes(searchTerm) || p.descripcion?.toLowerCase().includes(searchTerm));
    const ventasPorProducto = {};
    allPedidos.forEach(p => { if (p.productos) p.productos.forEach(prod => { const key = `${prod.id}_${p.vendedor_id}`; ventasPorProducto[key] = (ventasPorProducto[key] || 0) + prod.cantidad; }); });
    tbody.innerHTML = filtered.map(p => `<tr>
        <td>${p.id}</td>
        <td>${p.imagen_url ? `<img src="${p.imagen_url}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;">` : '<span>📷</span>'}</td>
        <td><strong>${escapeHTML(p.nombre)}</strong></td>
        <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
        <td>${formatearPrecio(p.precio)}</td>
        <td>${ventasPorProducto[`${p.id}_${p.vendedor_id}`] || 0}</td>
        <td><span class="status-badge ${p.disponible === 'SI' ? 'status-activo' : 'status-inactivo'}">${p.disponible === 'SI' ? 'Disponible' : 'No disponible'}</span></td>
        <td><button class="btn-edit" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i> Editar</button><button class="btn-delete" onclick="eliminarProducto(${p.id}, this)"><i class="fas fa-trash"></i> Eliminar</button></td>
     `).join('');
}

function editarProducto(id) {
    const p = allProductos.find(p => p.id.toString() === id.toString());
    if (!p) return;
    document.getElementById('edit-producto-id').value = p.id;
    document.getElementById('edit-producto-nombre').value = p.nombre || '';
    document.getElementById('edit-producto-descripcion').value = p.descripcion || '';
    document.getElementById('edit-producto-precio').value = p.precio || '';
    document.getElementById('edit-producto-disponible').value = p.disponible || 'SI';
    document.getElementById('modal-editar-producto').classList.add('active');
}

async function guardarEditarProducto() {
    const btn = document.getElementById('guardar-editar-producto');
    await withLoading(btn, async () => {
        const data = {
            id: parseInt(document.getElementById('edit-producto-id').value),
            nombre: document.getElementById('edit-producto-nombre').value.trim(),
            descripcion: document.getElementById('edit-producto-descripcion').value.trim(),
            precio: parseFloat(document.getElementById('edit-producto-precio').value),
            disponible: document.getElementById('edit-producto-disponible').value
        };
        try {
            const res = await postAPI('actualizarProducto', data);
            if (res && res.success) { mostrarToast('Producto actualizado', 'success'); cerrarModal('modal-editar-producto'); await actualizarDatosManual(); }
            else { mostrarToast(res?.error || 'Error al actualizar', 'error'); }
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

function eliminarProducto(id, button) {
    window.productoAEliminar = id;
    window.productoButton = button;
    document.getElementById('modal-confirmar-producto').classList.add('active');
}

async function confirmarEliminarProducto() {
    if (!window.productoAEliminar) return;
    const btn = document.getElementById('confirmar-eliminar-producto');
    await withLoading(btn, async () => {
        try {
            const res = await postAPI('eliminarProducto', { productoId: window.productoAEliminar });
            if (res && res.success) { mostrarToast('Producto eliminado', 'success'); cerrarModal('modal-confirmar-producto'); await actualizarDatosManual(); }
            else { mostrarToast(res?.error || 'Error al eliminar', 'error'); }
        } catch (error) { mostrarToast('Error al eliminar', 'error'); }
        window.productoAEliminar = null;
        window.productoButton = null;
    });
}

// ===================================================
// PEDIDOS
// ===================================================

function renderizarPedidos() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    let filtered = [...allPedidos];
    const filtroVendedor = document.getElementById('filtro-vendedor')?.value;
    const filtroEstado = document.getElementById('filtro-estado')?.value;
    const filtroFecha = document.getElementById('filtro-fecha')?.value;
    if (filtroVendedor) filtered = filtered.filter(p => p.vendedor_id?.toString() === filtroVendedor);
    if (filtroEstado) filtered = filtered.filter(p => p.estado === filtroEstado);
    if (filtroFecha) filtered = filtered.filter(p => p.fecha && p.fecha.split('T')[0] === filtroFecha);
    filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    tbody.innerHTML = filtered.slice(0, 100).map(p => `<tr>
        <td>#${p.id}</td>
        <td>${formatearFecha(p.fecha)}</td>
        <td>${escapeHTML(p.cliente_nombre || 'N/A')}</td>
        <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
        <td>${formatearPrecio(p.total)}</td>
        <td><span class="status-badge status-${p.estado || 'preparando'}">${getEstadoTexto(p.estado)}</span></td>
        <td>${p.productos ? p.productos.length : 0} productos</td>
        <td><button class="btn-edit" onclick="editarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button><button class="btn-delete" onclick="eliminarPedido(${p.id}, this)"><i class="fas fa-trash"></i> Eliminar</button></td>
     `).join('');
}

function editarPedido(id) {
    const p = allPedidos.find(p => p.id.toString() === id.toString());
    if (!p) return;
    document.getElementById('edit-pedido-id').value = p.id;
    document.getElementById('edit-pedido-cliente').value = p.cliente_nombre || '';
    document.getElementById('edit-pedido-telefono').value = p.cliente_telefono || '';
    document.getElementById('edit-pedido-direccion').value = p.direccion || '';
    document.getElementById('edit-pedido-total').value = p.total || '';
    document.getElementById('edit-pedido-estado').value = p.estado || 'preparando';
    document.getElementById('modal-editar-pedido').classList.add('active');
}

async function guardarEditarPedido() {
    const btn = document.getElementById('guardar-editar-pedido');
    await withLoading(btn, async () => {
        const id = document.getElementById('edit-pedido-id').value;
        const nuevoEstado = document.getElementById('edit-pedido-estado').value;
        try {
            const res = await postAPI('actualizarEstado', { pedidoId: parseInt(id), estado: nuevoEstado });
            if (res && res.success) { mostrarToast('Pedido actualizado', 'success'); cerrarModal('modal-editar-pedido'); await actualizarDatosManual(); }
            else { mostrarToast(res?.error || 'Error al actualizar', 'error'); }
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

function eliminarPedido(id, button) {
    window.pedidoAEliminar = id;
    window.pedidoButton = button;
    document.getElementById('modal-confirmar-pedido').classList.add('active');
}

async function confirmarEliminarPedido() {
    if (!window.pedidoAEliminar) return;
    const btn = document.getElementById('confirmar-eliminar-pedido');
    await withLoading(btn, async () => {
        try {
            const res = await postAPI('cancelarPedido', { pedidoId: window.pedidoAEliminar });
            if (res && res.success) { mostrarToast('Pedido eliminado', 'success'); cerrarModal('modal-confirmar-pedido'); await actualizarDatosManual(); }
            else { mostrarToast(res?.error || 'Error al eliminar', 'error'); }
        } catch (error) { mostrarToast('Error al eliminar', 'error'); }
        window.pedidoAEliminar = null;
        window.pedidoButton = null;
    });
}

// ===================================================
// FILTROS Y EXPORTAR
// ===================================================

function cargarFiltros() {
    const options = '<option value="">Todos los vendedores</option>' + allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    const filtroVendedor = document.getElementById('filtro-vendedor');
    const filtroVendedorProd = document.getElementById('filtro-vendedor-prod');
    if (filtroVendedor) filtroVendedor.innerHTML = options;
    if (filtroVendedorProd) filtroVendedorProd.innerHTML = options;
}

async function exportarVendedores() {
    const btn = document.getElementById('export-vendedores');
    await withLoading(btn, async () => {
        const data = allVendedores.map(v => ({ ID: v.id, Nombre: v.nombre, Email: v.email, Telefono: v.telefono, Direccion: v.direccion, Horario: v.horario, Estado: v.activo === 'SI' ? 'Activo' : 'Inactivo' }));
        downloadCSV(data, 'vendedores_want.csv');
    });
}

async function exportarPedidos() {
    const btn = document.getElementById('export-pedidos');
    await withLoading(btn, async () => {
        const data = allPedidos.map(p => ({ ID: p.id, Fecha: p.fecha, Cliente: p.cliente_nombre, Telefono: p.cliente_telefono, Vendedor: p.vendedor_nombre, Direccion: p.direccion, MetodoPago: p.metodo_pago, Total: p.total, Estado: p.estado }));
        downloadCSV(data, 'pedidos_want.csv');
    });
}

async function exportarProductos() {
    const btn = document.getElementById('export-productos');
    await withLoading(btn, async () => {
        const data = allProductos.map(p => ({ ID: p.id, Nombre: p.nombre, Vendedor: p.vendedor_nombre, Precio: p.precio, Descripcion: p.descripcion, Disponible: p.disponible === 'SI' ? 'Sí' : 'No' }));
        downloadCSV(data, 'productos_want.csv');
    });
}

function downloadCSV(data, filename) {
    if (!data || !data.length) return mostrarToast('No hay datos para exportar', 'error');
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(h => JSON.stringify(obj[h] || '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    mostrarToast('Exportado correctamente', 'success');
}

function cerrarModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

function cambiarSeccion(seccionId) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.getElementById(`section-${seccionId}`).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === seccionId) item.classList.add('active');
    });
}

// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Panel Administrativo Global iniciado');
    await cargarTodosLosDatos();
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => cambiarSeccion(item.getAttribute('data-section')));
    });
    
    document.getElementById('btn-refresh-data')?.addEventListener('click', actualizarDatosManual);
    document.getElementById('filtro-vendedor')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-estado')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-fecha')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-vendedor-prod')?.addEventListener('change', () => renderizarProductos());
    document.getElementById('search-producto')?.addEventListener('input', () => renderizarProductos());
    document.getElementById('search-vendedor')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allVendedores.filter(v => v.nombre?.toLowerCase().includes(term) || v.email?.toLowerCase().includes(term));
        const tbody = document.getElementById('vendedores-tbody');
        if (!tbody) return;
        if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="9" class="loading-text">No hay vendedores</td>'; return; }
        const stats = {};
        allPedidos.forEach(p => { const id = p.vendedor_id; if (!stats[id]) stats[id] = { pedidos: 0, ingresos: 0 }; stats[id].pedidos++; stats[id].ingresos += parseFloat(p.total) || 0; });
        tbody.innerHTML = filtered.map(v => `<tr>
            <td>${v.id}</td><td><strong>${escapeHTML(v.nombre)}</strong></td><td>${escapeHTML(v.email || '-')}</td><td>${v.telefono || '-'}</td><td>${escapeHTML(v.direccion || '-')}</td>
            <td><span class="status-badge ${v.activo === 'SI' ? 'status-activo' : 'status-inactivo'}">${v.activo === 'SI' ? 'Activo' : 'Inactivo'}</span></td>
            <td>${stats[v.id]?.pedidos || 0}</td><td>${formatearPrecio(stats[v.id]?.ingresos || 0)}</td>
            <td><button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-toggle-status" onclick="toggleVendedorStatus(${v.id}, this)"><i class="fas fa-${v.activo === 'SI' ? 'ban' : 'check-circle'}"></i> ${v.activo === 'SI' ? 'Suspender' : 'Habilitar'}</button>
                <button class="btn-delete" onclick="eliminarVendedor(${v.id}, this)"><i class="fas fa-trash"></i> Eliminar</button>
              </td>
         `).join('');
    });
    
    document.getElementById('export-vendedores')?.addEventListener('click', exportarVendedores);
    document.getElementById('export-pedidos')?.addEventListener('click', exportarPedidos);
    document.getElementById('export-productos')?.addEventListener('click', exportarProductos);
    
    document.getElementById('guardar-editar-vendedor')?.addEventListener('click', guardarEditarVendedor);
    document.getElementById('guardar-editar-producto')?.addEventListener('click', guardarEditarProducto);
    document.getElementById('guardar-editar-pedido')?.addEventListener('click', guardarEditarPedido);
    document.getElementById('confirmar-eliminar-vendedor')?.addEventListener('click', confirmarEliminarVendedor);
    document.getElementById('confirmar-eliminar-producto')?.addEventListener('click', confirmarEliminarProducto);
    document.getElementById('confirmar-eliminar-pedido')?.addEventListener('click', confirmarEliminarPedido);
    
    document.querySelectorAll('.modal-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')));
    });
    
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        sessionStorage.removeItem('admin_session');
        window.location.href = 'login.html';
    });
    
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        document.addEventListener('click', (e) => { if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== menuToggle) sidebar.classList.remove('active'); });
    }
});