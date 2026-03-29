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
    return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.animation = 'fadeInUp 0.3s ease';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOutDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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

// ===================================================
// ACTUALIZACIÓN MANUAL DE DATOS
// ===================================================

async function actualizarDatosManual() {
    const btnRefresh = document.getElementById('btn-refresh-data');
    if (btnRefresh) {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    }
    
    mostrarToast('Actualizando datos...', 'info');
    
    try {
        const vendedoresRes = await callAPI('getVendedores');
        if (vendedoresRes.success) {
            allVendedores = vendedoresRes.vendedores || [];
        }
        
        const pedidosRes = await callAPI('getAllPedidos');
        if (pedidosRes.success) {
            allPedidos = pedidosRes.pedidos || [];
        }
        
        const productosRes = await callAPI('getAllProductos');
        if (productosRes.success) {
            allProductos = productosRes.productos || [];
        }
        
        actualizarDashboard();
        renderizarVendedores();
        renderizarPedidos();
        renderizarProductos();
        cargarFiltros();
        
        mostrarToast('Datos actualizados correctamente', 'success');
    } catch (error) {
        console.error('Error al actualizar:', error);
        mostrarToast('Error al actualizar datos', 'error');
    } finally {
        if (btnRefresh) {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
        }
    }
}

// ===================================================
// DASHBOARD
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
                datasets: [{
                    data: [estados.preparando, estados['en preparacion'], estados['en camino'], estados.entregado],
                    backgroundColor: ['#FF9800', '#FFC107', '#2196F3', '#4CAF50'],
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
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
    
    const ventasPorVendedor = {};
    allPedidos.forEach(p => {
        const nombre = p.vendedor_nombre || 'Desconocido';
        ventasPorVendedor[nombre] = (ventasPorVendedor[nombre] || 0) + (parseFloat(p.total) || 0);
    });
    const topVendedores = Object.entries(ventasPorVendedor).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const topVendedoresDiv = document.getElementById('top-vendedores-list');
    if (topVendedoresDiv) {
        if (topVendedores.length === 0) {
            topVendedoresDiv.innerHTML = '<p class="loading-text">No hay datos</p>';
        } else {
            topVendedoresDiv.innerHTML = topVendedores.map(([nombre, total]) => `
                <div class="top-item">
                    <span class="top-item-name">${escapeHTML(nombre)}</span>
                    <span class="top-item-value">${formatearPrecio(total)}</span>
                </div>
            `).join('');
        }
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
        if (topProductos.length === 0) {
            topProductosDiv.innerHTML = '<p class="loading-text">No hay datos</p>';
        } else {
            topProductosDiv.innerHTML = topProductos.map(([nombre, cantidad]) => `
                <div class="top-item">
                    <span class="top-item-name">${escapeHTML(nombre)}</span>
                    <span class="top-item-value">${cantidad} unidades</span>
                </div>
            `).join('');
        }
    }
    
    const recentOrders = allPedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
    const tbody = document.getElementById('recent-orders-tbody');
    if (tbody) {
        if (recentOrders.length === 0) {
            tbody.innerHTML = '}<tr><td colspan="6" class="loading-text">No hay pedidos</td></tr>';
        } else {
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
        }
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
                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-delete" onclick="eliminarVendedor(${v.id})"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarVendedor(id) {
    const vendedor = allVendedores.find(v => v.id.toString() === id.toString());
    if (!vendedor) return;
    
    // Implementar modal de edición
    mostrarToast('Funcionalidad en desarrollo', 'info');
}

async function eliminarVendedor(id) {
    const confirmar = confirm('¿Estás seguro que querés eliminar este vendedor? Se eliminarán todos sus productos y pedidos.');
    if (!confirmar) return;
    
    try {
        const response = await postAPI('eliminarVendedor', { vendedorId: id });
        if (response.success) {
            mostrarToast('Vendedor eliminado correctamente', 'success');
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al eliminar vendedor', 'error');
    }
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
        </tr>
    `).join('');
}

function cargarFiltros() {
    const filtroVendedor = document.getElementById('filtro-vendedor');
    const filtroVendedorProd = document.getElementById('filtro-vendedor-prod');
    
    const options = '<option value="">Todos los vendedores</option>' + 
        allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    
    if (filtroVendedor) filtroVendedor.innerHTML = options;
    if (filtroVendedorProd) filtroVendedorProd.innerHTML = options;
}

function exportarPedidos() {
    if (allPedidos.length === 0) {
        mostrarToast('No hay datos para exportar', 'error');
        return;
    }
    
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

// ===================================================
// PRODUCTOS
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
                <button class="btn-edit" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-delete" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editarProducto(id) {
    mostrarToast('Funcionalidad en desarrollo', 'info');
}

async function eliminarProducto(id) {
    const confirmar = confirm('¿Estás seguro que querés eliminar este producto?');
    if (!confirmar) return;
    
    try {
        const response = await postAPI('eliminarProducto', { productoId: id });
        if (response.success) {
            mostrarToast('Producto eliminado correctamente', 'success');
            await actualizarDatosManual();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al eliminar producto', 'error');
    }
}

function exportarProductos() {
    if (allProductos.length === 0) {
        mostrarToast('No hay datos para exportar', 'error');
        return;
    }
    
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

function exportarVendedores() {
    if (allVendedores.length === 0) {
        mostrarToast('No hay datos para exportar', 'error');
        return;
    }
    
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
// UTILITARIAS DE EXPORTACIÓN
// ===================================================

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
// NAVEGACIÓN ENTRE SECCIONES (sin recargar)
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
// ANIMACIONES CSS PARA TOAST
// ===================================================

const styleToast = document.createElement('style');
styleToast.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    @keyframes fadeOutDown {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
    }
`;
document.head.appendChild(styleToast);

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
    
    // Botón actualizar manual
    const btnRefresh = document.getElementById('btn-refresh-data');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', actualizarDatosManual);
    }
    
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
            const filtered = allVendedores.filter(v => 
                v.nombre?.toLowerCase().includes(term) || 
                v.email?.toLowerCase().includes(term)
            );
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
                                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i> Editar</button>
                                <button class="btn-delete" onclick="eliminarVendedor(${v.id})"><i class="fas fa-trash"></i> Eliminar</button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        });
    }
    
    // Botones de exportación
    const exportVendedores = document.getElementById('export-vendedores');
    if (exportVendedores) exportVendedores.addEventListener('click', exportarVendedores);
    
    const exportPedidos = document.getElementById('export-pedidos');
    if (exportPedidos) exportPedidos.addEventListener('click', exportarPedidos);
    
    const exportProductos = document.getElementById('export-productos');
    if (exportProductos) exportProductos.addEventListener('click', exportarProductos);
    
    // Configuración
    if (document.getElementById('configuracion')) {
        cargarConfiguracion();
        initConfigForm();
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