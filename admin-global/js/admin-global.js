// ===================================================
// ADMIN GLOBAL - SPA con funcionalidades completas
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
        console.log('📡 GET:', url);
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        console.log('📥 Respuesta:', result);
        return result;
    } catch (error) {
        console.error('❌ Error en callAPI:', error);
        return { error: error.message };
    }
}

async function postAPI(action, data = {}) {
    try {
        console.log('📡 POST:', API_URL);
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        console.log('📥 Respuesta POST:', result);
        return result;
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
    const textos = { 
        'preparando': 'Nuevo', 
        'en preparacion': 'En preparación', 
        'en camino': 'En camino', 
        'entregado': 'Entregado' 
    };
    return textos[estado] || estado || 'Nuevo';
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
let vendedorAEliminar = null;
let productoAEliminar = null;
let pedidoAEliminar = null;
let vendedorAEditar = null;
let productoAEditar = null;
let pedidoAEditar = null;

// ===================================================
// CARGA DE DATOS
// ===================================================

async function cargarTodosLosDatos() {
    console.log('🔄 Cargando todos los datos...');
    
    try {
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
        
        return true;
    } catch (error) {
        console.error('Error cargando datos:', error);
        return false;
    }
}

async function actualizarDatosManual() {
    const btnRefresh = document.getElementById('btn-refresh-data');
    if (btnRefresh) {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    }
    
    mostrarToast('Actualizando datos...', 'info');
    
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
        
        mostrarToast('Datos actualizados correctamente', 'success');
    } catch (error) {
        mostrarToast('Error al actualizar datos', 'error');
    } finally {
        if (btnRefresh) {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
        }
    }
}

// ===================================================
// DASHBOARD (solo gráfico de ventas por día)
// ===================================================

function actualizarDashboard() {
    const totalVendedores = allVendedores.length;
    const totalPedidos = allPedidos.length;
    const totalProductos = allProductos.length;
    const ingresosTotales = allPedidos.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    
    const totalVendedoresEl = document.getElementById('total-vendedores');
    const totalPedidosEl = document.getElementById('total-pedidos');
    const totalProductosEl = document.getElementById('total-productos');
    const totalIngresosEl = document.getElementById('total-ingresos');
    
    if (totalVendedoresEl) totalVendedoresEl.textContent = totalVendedores;
    if (totalPedidosEl) totalPedidosEl.textContent = totalPedidos;
    if (totalProductosEl) totalProductosEl.textContent = totalProductos;
    if (totalIngresosEl) totalIngresosEl.textContent = formatearPrecio(ingresosTotales);
    
    // Gráfico de ventas por día (últimos 7 días)
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
                datasets: [{
                    label: 'Ventas',
                    data: ultimos7Dias.map(d => ventasPorDia[d]),
                    borderColor: '#FF5A00',
                    backgroundColor: 'rgba(255, 90, 0, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#FF5A00',
                    pointBorderColor: 'white',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }
}

// ===================================================
// VENDEDORES - CRUD COMPLETO
// ===================================================

function renderizarVendedores() {
    const tbody = document.getElementById('vendedores-tbody');
    if (!tbody) return;
    
    if (allVendedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-text">No hay vendedores registrados</td></tr>';
        return;
    }
    
    const stats = {};
    allPedidos.forEach(p => {
        const id = p.vendedor_id;
        if (!stats[id]) stats[id] = { pedidos: 0, ingresos: 0 };
        stats[id].pedidos++;
        stats[id].ingresos += parseFloat(p.total) || 0;
    });
    
    tbody.innerHTML = allVendedores.map(v => `
        <tr>
            <td>${v.id}</td>
            <td><strong>${escapeHTML(v.nombre)}</strong></td>
            <td>${escapeHTML(v.email || '-')}</td>
            <td>${v.telefono || '-'}</td>
            <td>${escapeHTML(v.direccion || '-')}</td>
            <td>
                <span class="status-badge ${v.activo === 'SI' ? 'status-activo' : 'status-inactivo'}">
                    ${v.activo === 'SI' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>${stats[v.id]?.pedidos || 0}</td>
            <td>${formatearPrecio(stats[v.id]?.ingresos || 0)}</td>
            <td>
                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-toggle-status" onclick="toggleVendedorStatus(${v.id})">
                    <i class="fas fa-${v.activo === 'SI' ? 'ban' : 'check-circle'}"></i>
                    ${v.activo === 'SI' ? 'Suspender' : 'Habilitar'}
                </button>
                <button class="btn-delete" onclick="eliminarVendedor(${v.id})"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarVendedor(id) {
    const vendedor = allVendedores.find(v => v.id.toString() === id.toString());
    if (!vendedor) return;
    
    document.getElementById('edit-vendedor-id').value = vendedor.id;
    document.getElementById('edit-vendedor-nombre').value = vendedor.nombre || '';
    document.getElementById('edit-vendedor-email').value = vendedor.email || '';
    document.getElementById('edit-vendedor-telefono').value = vendedor.telefono || '';
    document.getElementById('edit-vendedor-direccion').value = vendedor.direccion || '';
    document.getElementById('edit-vendedor-horario').value = vendedor.horario || '';
    
    document.getElementById('modal-editar-vendedor').classList.add('active');
}

async function guardarEditarVendedor() {
    const id = document.getElementById('edit-vendedor-id').value;
    const data = {
        id: parseInt(id),
        nombre: document.getElementById('edit-vendedor-nombre').value.trim(),
        email: document.getElementById('edit-vendedor-email').value.trim(),
        telefono: document.getElementById('edit-vendedor-telefono').value.trim(),
        direccion: document.getElementById('edit-vendedor-direccion').value.trim(),
        horario: document.getElementById('edit-vendedor-horario').value.trim()
    };
    
    try {
        const response = await postAPI('actualizarVendedor', data);
        if (response.success) {
            mostrarToast('Vendedor actualizado correctamente', 'success');
            cerrarModalEditarVendedor();
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al actualizar: ' + error.message, 'error');
    }
}

async function toggleVendedorStatus(id) {
    const vendedor = allVendedores.find(v => v.id.toString() === id.toString());
    if (!vendedor) return;
    
    const nuevoEstado = vendedor.activo === 'SI' ? 'NO' : 'SI';
    const accion = nuevoEstado === 'SI' ? 'habilitado' : 'suspendido';
    
    try {
        const response = await postAPI('actualizarVendedor', {
            id: parseInt(id),
            activo: nuevoEstado
        });
        if (response.success) {
            mostrarToast(`Vendedor ${accion} correctamente`, 'success');
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al cambiar estado', 'error');
    }
}

function eliminarVendedor(id) {
    vendedorAEliminar = id;
    document.getElementById('modal-confirmar-vendedor').classList.add('active');
}

async function confirmarEliminarVendedor() {
    if (!vendedorAEliminar) return;
    
    try {
        const response = await postAPI('eliminarVendedor', { vendedorId: vendedorAEliminar });
        if (response.success) {
            mostrarToast('Vendedor eliminado correctamente', 'success');
            cerrarModalConfirmarVendedor();
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
    vendedorAEliminar = null;
}

function cerrarModalEditarVendedor() {
    document.getElementById('modal-editar-vendedor').classList.remove('active');
}

function cerrarModalConfirmarVendedor() {
    document.getElementById('modal-confirmar-vendedor').classList.remove('active');
    vendedorAEliminar = null;
}

// ===================================================
// PRODUCTOS - CRUD COMPLETO
// ===================================================

function renderizarProductos() {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    
    let productosFiltrados = [...allProductos];
    
    const filtroVendedor = document.getElementById('filtro-vendedor-prod')?.value;
    if (filtroVendedor) {
        productosFiltrados = productosFiltrados.filter(p => p.vendedor_id?.toString() === filtroVendedor);
    }
    
    const searchTerm = document.getElementById('search-producto')?.value.toLowerCase();
    if (searchTerm) {
        productosFiltrados = productosFiltrados.filter(p => 
            p.nombre?.toLowerCase().includes(searchTerm) || 
            p.descripcion?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (productosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading-text">No hay productos</td></tr>';
        return;
    }
    
    // Calcular ventas por producto
    const ventasPorProducto = {};
    allPedidos.forEach(p => {
        if (p.productos) {
            p.productos.forEach(prod => {
                const key = `${prod.id}_${p.vendedor_id}`;
                ventasPorProducto[key] = (ventasPorProducto[key] || 0) + prod.cantidad;
            });
        }
    });
    
    tbody.innerHTML = productosFiltrados.map(p => {
        const ventas = ventasPorProducto[`${p.id}_${p.vendedor_id}`] || 0;
        return `
            <tr>
                <td>${p.id}</td>
                <td>${p.imagen_url ? `<img src="${p.imagen_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;">` : '<span style="color:#ccc;">📷</span>'}</td>
                <td><strong>${escapeHTML(p.nombre)}</strong></td>
                <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
                <td>${formatearPrecio(p.precio)}</td>
                <td>${ventas}</td>
                <td><span class="status-badge ${p.disponible === 'SI' ? 'status-activo' : 'status-inactivo'}">${p.disponible === 'SI' ? 'Disponible' : 'No disponible'}</span></td>
                <td>
                    <button class="btn-edit" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-delete" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i> Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
}

function editarProducto(id) {
    const producto = allProductos.find(p => p.id.toString() === id.toString());
    if (!producto) return;
    
    document.getElementById('edit-producto-id').value = producto.id;
    document.getElementById('edit-producto-nombre').value = producto.nombre || '';
    document.getElementById('edit-producto-descripcion').value = producto.descripcion || '';
    document.getElementById('edit-producto-precio').value = producto.precio || '';
    document.getElementById('edit-producto-disponible').value = producto.disponible || 'SI';
    
    document.getElementById('modal-editar-producto').classList.add('active');
}

async function guardarEditarProducto() {
    const id = document.getElementById('edit-producto-id').value;
    const data = {
        id: parseInt(id),
        nombre: document.getElementById('edit-producto-nombre').value.trim(),
        descripcion: document.getElementById('edit-producto-descripcion').value.trim(),
        precio: parseFloat(document.getElementById('edit-producto-precio').value),
        disponible: document.getElementById('edit-producto-disponible').value
    };
    
    try {
        const response = await postAPI('actualizarProducto', data);
        if (response.success) {
            mostrarToast('Producto actualizado correctamente', 'success');
            cerrarModalEditarProducto();
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al actualizar: ' + error.message, 'error');
    }
}

function eliminarProducto(id) {
    productoAEliminar = id;
    document.getElementById('modal-confirmar-producto').classList.add('active');
}

async function confirmarEliminarProducto() {
    if (!productoAEliminar) return;
    
    try {
        const response = await postAPI('eliminarProducto', { productoId: productoAEliminar });
        if (response.success) {
            mostrarToast('Producto eliminado correctamente', 'success');
            cerrarModalConfirmarProducto();
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
    productoAEliminar = null;
}

function cerrarModalEditarProducto() {
    document.getElementById('modal-editar-producto').classList.remove('active');
}

function cerrarModalConfirmarProducto() {
    document.getElementById('modal-confirmar-producto').classList.remove('active');
    productoAEliminar = null;
}

// ===================================================
// PEDIDOS - CRUD COMPLETO
// ===================================================

function renderizarPedidos() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    
    let pedidosFiltrados = [...allPedidos];
    
    const filtroVendedor = document.getElementById('filtro-vendedor')?.value;
    if (filtroVendedor) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.vendedor_id?.toString() === filtroVendedor);
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
            <td>
                <button class="btn-edit" onclick="editarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-delete" onclick="eliminarPedido(${p.id})"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarPedido(id) {
    const pedido = allPedidos.find(p => p.id.toString() === id.toString());
    if (!pedido) return;
    
    document.getElementById('edit-pedido-id').value = pedido.id;
    document.getElementById('edit-pedido-cliente').value = pedido.cliente_nombre || '';
    document.getElementById('edit-pedido-telefono').value = pedido.cliente_telefono || '';
    document.getElementById('edit-pedido-direccion').value = pedido.direccion || '';
    document.getElementById('edit-pedido-total').value = pedido.total || '';
    document.getElementById('edit-pedido-estado').value = pedido.estado || 'preparando';
    
    document.getElementById('modal-editar-pedido').classList.add('active');
}

async function guardarEditarPedido() {
    const id = document.getElementById('edit-pedido-id').value;
    const nuevoEstado = document.getElementById('edit-pedido-estado').value;
    
    try {
        const response = await postAPI('actualizarEstado', { pedidoId: parseInt(id), estado: nuevoEstado });
        if (response.success) {
            mostrarToast('Pedido actualizado correctamente', 'success');
            cerrarModalEditarPedido();
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al actualizar: ' + error.message, 'error');
    }
}

function eliminarPedido(id) {
    pedidoAEliminar = id;
    document.getElementById('modal-confirmar-pedido').classList.add('active');
}

async function confirmarEliminarPedido() {
    if (!pedidoAEliminar) return;
    
    try {
        const response = await postAPI('cancelarPedido', { pedidoId: pedidoAEliminar });
        if (response.success) {
            mostrarToast('Pedido eliminado correctamente', 'success');
            cerrarModalConfirmarPedido();
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
    pedidoAEliminar = null;
}

function cerrarModalEditarPedido() {
    document.getElementById('modal-editar-pedido').classList.remove('active');
}

function cerrarModalConfirmarPedido() {
    document.getElementById('modal-confirmar-pedido').classList.remove('active');
    pedidoAEliminar = null;
}

// ===================================================
// FILTROS
// ===================================================

function cargarFiltros() {
    const filtroVendedor = document.getElementById('filtro-vendedor');
    const filtroVendedorProd = document.getElementById('filtro-vendedor-prod');
    
    const options = '<option value="">Todos los vendedores</option>' + 
        allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    
    if (filtroVendedor) filtroVendedor.innerHTML = options;
    if (filtroVendedorProd) filtroVendedorProd.innerHTML = options;
}

// ===================================================
// EXPORTAR
// ===================================================

function exportarVendedores() {
    const data = allVendedores.map(v => ({
        ID: v.id,
        Nombre: v.nombre,
        Email: v.email,
        Telefono: v.telefono,
        Direccion: v.direccion,
        Horario: v.horario,
        Estado: v.activo === 'SI' ? 'Activo' : 'Inactivo'
    }));
    const csv = convertToCSV(data);
    downloadCSV(csv, 'vendedores_want.csv');
    mostrarToast('Exportando vendedores...', 'success');
}

function exportarPedidos() {
    const data = allPedidos.map(p => ({
        ID: p.id,
        Fecha: p.fecha,
        Cliente: p.cliente_nombre,
        Telefono: p.cliente_telefono,
        Vendedor: p.vendedor_nombre,
        Direccion: p.direccion,
        MetodoPago: p.metodo_pago,
        Total: p.total,
        Estado: p.estado
    }));
    const csv = convertToCSV(data);
    downloadCSV(csv, 'pedidos_want.csv');
    mostrarToast('Exportando pedidos...', 'success');
}

function exportarProductos() {
    const data = allProductos.map(p => ({
        ID: p.id,
        Nombre: p.nombre,
        Vendedor: p.vendedor_nombre,
        Precio: p.precio,
        Descripcion: p.descripcion,
        Disponible: p.disponible === 'SI' ? 'Sí' : 'No'
    }));
    const csv = convertToCSV(data);
    downloadCSV(csv, 'productos_want.csv');
    mostrarToast('Exportando productos...', 'success');
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(header => JSON.stringify(obj[header] || '')).join(','));
    return [headers.join(','), ...rows].join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ===================================================
// NAVEGACIÓN ENTRE SECCIONES
// ===================================================

function cambiarSeccion(seccionId) {
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    
    const seccion = document.getElementById(`section-${seccionId}`);
    if (seccion) seccion.style.display = 'block';
    
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
    
    await cargarTodosLosDatos();
    
    // Navegación
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const seccion = item.getAttribute('data-section');
            cambiarSeccion(seccion);
        });
    });
    
    // Botón actualizar
    const btnRefresh = document.getElementById('btn-refresh-data');
    if (btnRefresh) btnRefresh.addEventListener('click', actualizarDatosManual);
    
    // Filtros
    document.getElementById('filtro-vendedor')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-estado')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-fecha')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-vendedor-prod')?.addEventListener('change', () => renderizarProductos());
    document.getElementById('search-producto')?.addEventListener('input', () => renderizarProductos());
    
    // Exportar
    document.getElementById('export-vendedores')?.addEventListener('click', exportarVendedores);
    document.getElementById('export-pedidos')?.addEventListener('click', exportarPedidos);
    document.getElementById('export-productos')?.addEventListener('click', exportarProductos);
    
    // Botones de confirmación de modales
    document.getElementById('confirmar-eliminar-vendedor')?.addEventListener('click', confirmarEliminarVendedor);
    document.getElementById('confirmar-eliminar-producto')?.addEventListener('click', confirmarEliminarProducto);
    document.getElementById('confirmar-eliminar-pedido')?.addEventListener('click', confirmarEliminarPedido);
    document.getElementById('guardar-editar-vendedor')?.addEventListener('click', guardarEditarVendedor);
    document.getElementById('guardar-editar-producto')?.addEventListener('click', guardarEditarProducto);
    document.getElementById('guardar-editar-pedido')?.addEventListener('click', guardarEditarPedido);
    
    // Cerrar modales
    document.querySelectorAll('.modal-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
        });
    });
    
    // Cerrar sesión
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