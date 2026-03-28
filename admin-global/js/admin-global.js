// ===================================================
// ADMIN GLOBAL - Funciones principales
// ===================================================

// Configuración de la API
const API_URL = 'https://script.google.com/macros/s/AKfycbzUdhEDY1ESQk3iv4M_BbG4jMjPm0B8/exec';

// ===================================================
// FUNCIONES DE API (copiadas de utils.js)
// ===================================================

async function callAPI(action, data = {}, forceRefresh = false) {
    try {
        let url = `${API_URL}?action=${action}`;
        
        if (data && Object.keys(data).length > 0) {
            for (let key in data) {
                url += `&${key}=${encodeURIComponent(data[key])}`;
            }
        }
        
        console.log('📡 GET:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📥 Respuesta GET:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Error en callAPI:', error);
        return { error: error.message };
    }
}

async function postAPI(action, data = {}) {
    try {
        const url = API_URL;
        
        console.log('📡 POST a:', url);
        console.log('📦 Datos enviados:', { action, ...data });
        
        const jsonData = JSON.stringify({ action, ...data });
        
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: jsonData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
// VARIABLES GLOBALES
// ===================================================

let allVendedores = [];
let allPedidos = [];
let allProductos = [];
let charts = {};
let vendedorAEliminar = null;
let productoAEliminar = null;

// ===================================================
// CARGA DE DATOS
// ===================================================

async function cargarTodosLosDatos() {
    try {
        console.log('🔄 Cargando todos los datos...');
        
        // Cargar vendedores
        const vendedoresRes = await callAPI('getVendedores');
        if (vendedoresRes.success) {
            allVendedores = vendedoresRes.vendedores || [];
            console.log(`✅ Cargados ${allVendedores.length} vendedores`);
        }
        
        // Cargar pedidos de todos los vendedores
        allPedidos = [];
        for (const v of allVendedores) {
            const pedidosRes = await callAPI('getPedidos', { vendedorId: v.id });
            if (pedidosRes.success && pedidosRes.pedidos) {
                allPedidos.push(...pedidosRes.pedidos.map(p => ({ ...p, vendedor_nombre: v.nombre })));
            }
        }
        console.log(`✅ Cargados ${allPedidos.length} pedidos`);
        
        // Cargar productos de todos los vendedores
        allProductos = [];
        for (const v of allVendedores) {
            const productosRes = await callAPI('getProductos', { vendedorId: v.id });
            if (productosRes.success && productosRes.productos) {
                allProductos.push(...productosRes.productos.map(p => ({ ...p, vendedor_nombre: v.nombre })));
            }
        }
        console.log(`✅ Cargados ${allProductos.length} productos`);
        
        actualizarDashboard();
        return true;
    } catch (error) {
        console.error('Error cargando datos:', error);
        return false;
    }
}

// ===================================================
// DASHBOARD
// ===================================================

function actualizarDashboard() {
    // Calcular métricas
    const totalVendedores = allVendedores.length;
    const totalPedidos = allPedidos.length;
    const totalProductos = allProductos.length;
    const ingresosTotales = allPedidos.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    
    // Actualizar stats
    const totalVendedoresEl = document.getElementById('total-vendedores');
    const totalPedidosEl = document.getElementById('total-pedidos');
    const totalProductosEl = document.getElementById('total-productos');
    const totalIngresosEl = document.getElementById('total-ingresos');
    
    if (totalVendedoresEl) totalVendedoresEl.textContent = totalVendedores;
    if (totalPedidosEl) totalPedidosEl.textContent = totalPedidos;
    if (totalProductosEl) totalProductosEl.textContent = totalProductos;
    if (totalIngresosEl) totalIngresosEl.textContent = formatearPrecio(ingresosTotales);
    
    // Gráfico de pedidos por estado
    const estados = { preparando: 0, 'en preparacion': 0, 'en camino': 0, entregado: 0 };
    allPedidos.forEach(p => {
        const estado = p.estado || 'preparando';
        if (estados[estado] !== undefined) estados[estado]++;
    });
    
    const ctxEstados = document.getElementById('estados-chart');
    if (ctxEstados) {
        if (charts.estados) charts.estados.destroy();
        charts.estados = new Chart(ctxEstados, {
            type: 'doughnut',
            data: {
                labels: ['Nuevos', 'En preparación', 'En camino', 'Entregados'],
                datasets: [{
                    data: [estados.preparando, estados['en preparacion'], estados['en camino'], estados.entregado],
                    backgroundColor: ['#FF9800', '#FFC107', '#2196F3', '#4CAF50']
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
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
    if (ctxVentas) {
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
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    // Top 5 vendedores
    const ventasPorVendedor = {};
    allPedidos.forEach(p => {
        const nombre = p.vendedor_nombre || 'Desconocido';
        ventasPorVendedor[nombre] = (ventasPorVendedor[nombre] || 0) + (parseFloat(p.total) || 0);
    });
    const topVendedores = Object.entries(ventasPorVendedor)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const topVendedoresDiv = document.getElementById('top-vendedores-list');
    if (topVendedoresDiv) {
        topVendedoresDiv.innerHTML = topVendedores.map(([nombre, total]) => `
            <div class="top-item">
                <span class="top-item-name">${escapeHTML(nombre)}</span>
                <span class="top-item-value">${formatearPrecio(total)}</span>
            </div>
        `).join('');
        if (topVendedores.length === 0) topVendedoresDiv.innerHTML = '<p class="loading-text">No hay datos</p>';
    }
    
    // Top 5 productos
    const ventasPorProducto = {};
    allPedidos.forEach(p => {
        if (p.productos) {
            p.productos.forEach(prod => {
                const nombre = prod.nombre;
                ventasPorProducto[nombre] = (ventasPorProducto[nombre] || 0) + prod.cantidad;
            });
        }
    });
    const topProductos = Object.entries(ventasPorProducto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const topProductosDiv = document.getElementById('top-productos-list');
    if (topProductosDiv) {
        topProductosDiv.innerHTML = topProductos.map(([nombre, cantidad]) => `
            <div class="top-item">
                <span class="top-item-name">${escapeHTML(nombre)}</span>
                <span class="top-item-value">${cantidad} unidades</span>
            </div>
        `).join('');
        if (topProductos.length === 0) topProductosDiv.innerHTML = '<p class="loading-text">No hay datos</p>';
    }
    
    // Últimos pedidos
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

async function cargarVendedores() {
    const tbody = document.getElementById('vendedores-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" class="loading-text">Cargando vendedores...</td></tr>';
    
    try {
        const response = await callAPI('getVendedores');
        if (response.success) {
            allVendedores = response.vendedores || [];
            renderizarVendedores(allVendedores);
        }
    } catch (error) {
        console.error('Error cargar vendedores:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="loading-text">Error al cargar</td></tr>';
    }
}

function renderizarVendedores(vendedores) {
    const tbody = document.getElementById('vendedores-tbody');
    if (!tbody) return;
    
    // Calcular pedidos e ingresos por vendedor
    const stats = {};
    allPedidos.forEach(p => {
        const id = p.vendedor_id;
        if (!stats[id]) stats[id] = { pedidos: 0, ingresos: 0 };
        stats[id].pedidos++;
        stats[id].ingresos += parseFloat(p.total) || 0;
    });
    
    tbody.innerHTML = vendedores.map(v => `
        <tr>
            <td>${v.id}</td>
            <td><strong>${escapeHTML(v.nombre)}</strong></td>
            <td>${escapeHTML(v.email || '-')}</td>
            <td>${v.telefono || '-'}</td>
            <td>${escapeHTML(v.direccion || '-')}</td>
            <td>
                <button class="btn-toggle ${v.activo === 'SI' ? 'active' : 'inactive'}" onclick="toggleVendedorActivo(${v.id})">
                    <i class="fas fa-${v.activo === 'SI' ? 'check-circle' : 'times-circle'}"></i>
                    ${v.activo === 'SI' ? 'Activo' : 'Inactivo'}
                </button>
            </td>
            <td>${stats[v.id]?.pedidos || 0}</td>
            <td>${formatearPrecio(stats[v.id]?.ingresos || 0)}</td>
            <td>
                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="confirmarEliminarVendedor(${v.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function editarVendedor(id) {
    const vendedor = allVendedores.find(v => v.id.toString() === id.toString());
    if (!vendedor) return;
    
    document.getElementById('edit-id').value = vendedor.id;
    document.getElementById('edit-nombre').value = vendedor.nombre || '';
    document.getElementById('edit-email').value = vendedor.email || '';
    document.getElementById('edit-telefono').value = vendedor.telefono || '';
    document.getElementById('edit-direccion').value = vendedor.direccion || '';
    document.getElementById('edit-horario').value = vendedor.horario || '';
    document.getElementById('edit-activo').value = vendedor.activo || 'SI';
    
    document.getElementById('modal-editar-vendedor').classList.add('active');
}

async function guardarEditarVendedor() {
    const id = document.getElementById('edit-id').value;
    const data = {
        id: parseInt(id),
        nombre: document.getElementById('edit-nombre').value.trim(),
        email: document.getElementById('edit-email').value.trim(),
        telefono: document.getElementById('edit-telefono').value.trim(),
        direccion: document.getElementById('edit-direccion').value.trim(),
        horario: document.getElementById('edit-horario').value.trim(),
        activo: document.getElementById('edit-activo').value
    };
    
    try {
        const response = await postAPI('actualizarVendedor', data);
        if (response.success) {
            mostrarToast('Vendedor actualizado correctamente', 'success');
            cerrarModalEditar();
            await cargarVendedores();
            await cargarTodosLosDatos();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al actualizar: ' + error.message, 'error');
    }
}

async function toggleVendedorActivo(id) {
    const vendedor = allVendedores.find(v => v.id.toString() === id.toString());
    if (!vendedor) return;
    
    const nuevoEstado = vendedor.activo === 'SI' ? 'NO' : 'SI';
    
    try {
        const response = await postAPI('actualizarVendedor', {
            id: parseInt(id),
            activo: nuevoEstado
        });
        if (response.success) {
            mostrarToast(`Vendedor ${nuevoEstado === 'SI' ? 'activado' : 'desactivado'}`, 'success');
            await cargarVendedores();
            await cargarTodosLosDatos();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al cambiar estado', 'error');
    }
}

function confirmarEliminarVendedor(id) {
    vendedorAEliminar = id;
    document.getElementById('modal-confirmar').classList.add('active');
}

async function eliminarVendedor() {
    if (!vendedorAEliminar) return;
    
    try {
        const response = await postAPI('eliminarVendedor', { vendedorId: vendedorAEliminar });
        if (response.success) {
            mostrarToast('Vendedor eliminado correctamente', 'success');
            cerrarModalConfirmar();
            await cargarVendedores();
            await cargarTodosLosDatos();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
    vendedorAEliminar = null;
}

function cerrarModalEditar() {
    document.getElementById('modal-editar-vendedor').classList.remove('active');
}

function cerrarModalConfirmar() {
    document.getElementById('modal-confirmar').classList.remove('active');
    vendedorAEliminar = null;
}

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
}

// ===================================================
// PEDIDOS
// ===================================================

async function cargarPedidosGlobal() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Cargando pedidos...</td></tr>';
    
    await cargarTodosLosDatos();
    
    // Cargar vendedores en filtro
    const filtroVendedor = document.getElementById('filtro-vendedor');
    if (filtroVendedor) {
        filtroVendedor.innerHTML = '<option value="">Todos los vendedores</option>' + 
            allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    }
    
    renderizarPedidosGlobal();
}

function renderizarPedidosGlobal() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    
    let pedidosFiltrados = [...allPedidos];
    
    // Filtro vendedor
    const filtroVendedor = document.getElementById('filtro-vendedor')?.value;
    if (filtroVendedor) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.vendedor_id.toString() === filtroVendedor);
    }
    
    // Filtro estado
    const filtroEstado = document.getElementById('filtro-estado')?.value;
    if (filtroEstado) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.estado === filtroEstado);
    }
    
    // Filtro fecha
    const filtroFecha = document.getElementById('filtro-fecha')?.value;
    if (filtroFecha) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.fecha && p.fecha.split('T')[0] === filtroFecha);
    }
    
    pedidosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    tbody.innerHTML = pedidosFiltrados.map(p => `
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
    
    if (pedidosFiltrados.length === 0) tbody.innerHTML = '<tr><td colspan="7" class="loading-text">No hay pedidos</td></tr>';
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
}

// ===================================================
// PRODUCTOS
// ===================================================

async function cargarProductosGlobal() {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="8" class="loading-text">Cargando productos...</td></tr>';
    
    await cargarTodosLosDatos();
    
    // Cargar vendedores en filtro
    const filtroVendedor = document.getElementById('filtro-vendedor-prod');
    if (filtroVendedor) {
        filtroVendedor.innerHTML = '<option value="">Todos los vendedores</option>' + 
            allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    }
    
    renderizarProductosGlobal();
}

function renderizarProductosGlobal() {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    
    let productosFiltrados = [...allProductos];
    
    // Filtro vendedor
    const filtroVendedor = document.getElementById('filtro-vendedor-prod')?.value;
    if (filtroVendedor) {
        productosFiltrados = productosFiltrados.filter(p => p.vendedor_id.toString() === filtroVendedor);
    }
    
    // Búsqueda
    const searchTerm = document.getElementById('search-producto')?.value.toLowerCase();
    if (searchTerm) {
        productosFiltrados = productosFiltrados.filter(p => 
            p.nombre?.toLowerCase().includes(searchTerm) || 
            p.descripcion?.toLowerCase().includes(searchTerm)
        );
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
                <td>
                    ${p.imagen_url ? 
                        `<img src="${p.imagen_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">` : 
                        '<span style="color:#ccc;">📷</span>'}
                </td>
                <td><strong>${escapeHTML(p.nombre)}</strong></td>
                <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
                <td>${formatearPrecio(p.precio)}</td>
                <td>${ventas}</td>
                <td>
                    <span class="status-badge ${p.disponible === 'SI' ? 'status-entregado' : 'status-preparando'}">
                        ${p.disponible === 'SI' ? 'Disponible' : 'No disponible'}
                    </span>
                </td>
                <td>
                    <button class="btn-edit" onclick="editarProducto(${p.id}, ${p.vendedor_id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" onclick="confirmarEliminarProducto(${p.id}, ${p.vendedor_id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    
    if (productosFiltrados.length === 0) tbody.innerHTML = '<tr><td colspan="8" class="loading-text">No hay productos</td></tr>';
}

function editarProducto(productoId, vendedorId) {
    const producto = allProductos.find(p => p.id.toString() === productoId.toString() && p.vendedor_id.toString() === vendedorId.toString());
    if (!producto) return;
    
    document.getElementById('edit-producto-id').value = producto.id;
    document.getElementById('edit-producto-vendedor').value = producto.vendedor_id;
    document.getElementById('edit-producto-nombre').value = producto.nombre || '';
    document.getElementById('edit-producto-descripcion').value = producto.descripcion || '';
    document.getElementById('edit-producto-precio').value = producto.precio || '';
    document.getElementById('edit-producto-disponible').value = producto.disponible || 'SI';
    
    document.getElementById('modal-editar-producto').classList.add('active');
}

async function guardarEditarProducto() {
    const id = document.getElementById('edit-producto-id').value;
    const vendedorId = document.getElementById('edit-producto-vendedor').value;
    const data = {
        id: parseInt(id),
        vendedor_id: parseInt(vendedorId),
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
            await cargarProductosGlobal();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        mostrarToast('Error al actualizar: ' + error.message, 'error');
    }
}

function confirmarEliminarProducto(productoId, vendedorId) {
    productoAEliminar = { id: productoId, vendedorId };
    document.getElementById('modal-confirmar-producto').classList.add('active');
}

async function eliminarProducto() {
    if (!productoAEliminar) return;
    
    try {
        const response = await postAPI('eliminarProducto', { productoId: productoAEliminar.id });
        if (response.success) {
            mostrarToast('Producto eliminado correctamente', 'success');
            cerrarModalConfirmarProducto();
            await cargarProductosGlobal();
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
}

// ===================================================
// CONFIGURACIÓN
// ===================================================

function cargarConfiguracion() {
    const savedConfig = localStorage.getItem('admin_config');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (document.getElementById('config-email')) document.getElementById('config-email').value = config.admin_email || 'admin@want.com';
        if (document.getElementById('config-comision')) document.getElementById('config-comision').value = config.comision || '5';
        if (document.getElementById('config-soporte-email')) document.getElementById('config-soporte-email').value = config.soporte_email || 'soporte@want.com';
        if (document.getElementById('config-soporte-whatsapp')) document.getElementById('config-soporte-whatsapp').value = config.soporte_whatsapp || '';
    } else {
        if (document.getElementById('config-email')) document.getElementById('config-email').value = 'admin@want.com';
        if (document.getElementById('config-comision')) document.getElementById('config-comision').value = '5';
        if (document.getElementById('config-soporte-email')) document.getElementById('config-soporte-email').value = 'soporte@want.com';
    }
}

function initConfigForm() {
    const adminForm = document.getElementById('config-admin-form');
    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newEmail = document.getElementById('config-email').value.trim();
            const newPassword = document.getElementById('config-password').value;
            const newPassword2 = document.getElementById('config-password2').value;
            
            if (newPassword && newPassword !== newPassword2) {
                mostrarToast('Las contraseñas no coinciden', 'error');
                return;
            }
            
            // Guardar configuración
            const config = {
                admin_email: newEmail,
                comision: document.getElementById('config-comision')?.value || '5',
                soporte_email: document.getElementById('config-soporte-email')?.value || '',
                soporte_whatsapp: document.getElementById('config-soporte-whatsapp')?.value || ''
            };
            localStorage.setItem('admin_config', JSON.stringify(config));
            
            mostrarToast('Configuración guardada', 'success');
            if (newPassword) {
                mostrarToast('La contraseña se actualizará al reiniciar sesión', 'info');
            }
        });
    }
    
    const comisionForm = document.getElementById('config-comision-form');
    if (comisionForm) {
        comisionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const config = JSON.parse(localStorage.getItem('admin_config') || '{}');
            config.comision = document.getElementById('config-comision').value;
            localStorage.setItem('admin_config', JSON.stringify(config));
            mostrarToast('Comisión guardada', 'success');
        });
    }
    
    const contactoForm = document.getElementById('config-contacto-form');
    if (contactoForm) {
        contactoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const config = JSON.parse(localStorage.getItem('admin_config') || '{}');
            config.soporte_email = document.getElementById('config-soporte-email').value;
            config.soporte_whatsapp = document.getElementById('config-soporte-whatsapp').value;
            localStorage.setItem('admin_config', JSON.stringify(config));
            mostrarToast('Contacto guardado', 'success');
        });
    }
}

// ===================================================
// MENÚ MÓVIL
// ===================================================

function initMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
        
        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== menuToggle) {
                sidebar.classList.remove('active');
            }
        });
    }
}

// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Panel Administrativo Global iniciado');
    initMobileMenu();
    
    const path = window.location.pathname;
    
    if (path.includes('vendedores.html')) {
        await cargarVendedores();
        document.getElementById('export-vendedores')?.addEventListener('click', exportarVendedores);
        document.getElementById('search-vendedor')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allVendedores.filter(v => 
                v.nombre?.toLowerCase().includes(term) || 
                v.email?.toLowerCase().includes(term)
            );
            renderizarVendedores(filtered);
        });
        document.getElementById('confirmar-eliminar')?.addEventListener('click', eliminarVendedor);
        
    } else if (path.includes('pedidos.html')) {
        await cargarPedidosGlobal();
        document.getElementById('filtro-vendedor')?.addEventListener('change', renderizarPedidosGlobal);
        document.getElementById('filtro-estado')?.addEventListener('change', renderizarPedidosGlobal);
        document.getElementById('filtro-fecha')?.addEventListener('change', renderizarPedidosGlobal);
        document.getElementById('export-pedidos')?.addEventListener('click', exportarPedidos);
        
    } else if (path.includes('productos.html')) {
        await cargarProductosGlobal();
        document.getElementById('filtro-vendedor-prod')?.addEventListener('change', renderizarProductosGlobal);
        document.getElementById('search-producto')?.addEventListener('input', renderizarProductosGlobal);
        document.getElementById('export-productos')?.addEventListener('click', exportarProductos);
        document.getElementById('confirmar-eliminar-producto')?.addEventListener('click', eliminarProducto);
        
    } else if (path.includes('configuracion.html')) {
        cargarConfiguracion();
        initConfigForm();
        
    } else {
        // Dashboard
        await cargarTodosLosDatos();
    }
});