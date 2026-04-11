// ===================================================
// ADMIN - Panel de vendedor (COMPLETO Y CORREGIDO)
// ===================================================

console.log('🚀 admin.js cargado correctamente');

// ===================================================
// CONFIGURACIÓN INICIAL
// ===================================================

const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r';
const CLOUDINARY_UPLOAD_PRESET = 'want_productos';

let vendedorActual = null;
let pedidos = [];
let productos = [];
let deliveries = [];
let filtroActual = 'preparando';
let terminoBusqueda = '';
let pedidoPendienteConfirmar = null;
let botonPendienteConfirmar = null;

let productosTempEdit = [];
let productosTempNuevo = [];
let modalesAbiertos = [];

const RUBROS_DISPONIBLES = [
    'Sandwichería', 'Hamburguesería', 'Pizzería', 'Empanadas', 'Pancheria',
    'Comida casera', 'Kiosco', 'Bebidas', 'Despensa', 'Supermercado',
    'Panadería', 'Verdulería', 'Pollería', 'Carnicería', 'Cafetería',
    'Bar', 'Restaurante', 'Bar y café', 'Heladería', 'Farmacia', 'Mascotas'
];

let rubrosTemporales = [];
let rubrosCallback = null;
let rubrosTempPerfil = [];
let rubrosTempRegistro = [];
let currentCallback = null;
let pedidoParaAsignar = null;

// ===================================================
// FUNCIONES MEJORADAS PARA MANEJO DE MODALES (MÓVIL)
// ===================================================

function abrirModalConZIndex(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    if (modal.classList.contains('active')) return;
    
    if (!modalesAbiertos.includes(modalId)) {
        modalesAbiertos.push(modalId);
    }
    
    // Calcular z-index: base 10000 + (profundidad * 200)
    // Los modales anidados tendrán z-index más alto
    const zIndexBase = 10000;
    const nuevoZIndex = zIndexBase + (modalesAbiertos.length * 200);
    modal.style.zIndex = nuevoZIndex;
    
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    console.log(`📂 Modal abierto: ${modalId} (z-index: ${nuevoZIndex})`);
}

function cerrarModalConZIndex(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const index = modalesAbiertos.indexOf(modalId);
    if (index !== -1) modalesAbiertos.splice(index, 1);
    
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.zIndex = '';
    
    if (modalesAbiertos.length === 0) {
        document.body.style.overflow = '';
    } else {
        const modalSuperior = document.getElementById(modalesAbiertos[modalesAbiertos.length - 1]);
        if (modalSuperior) {
            const nuevoZIndex = 10000 + (modalesAbiertos.length * 100);
            modalSuperior.style.zIndex = nuevoZIndex;
        }
    }
    
    console.log(`📂 Modal cerrado: ${modalId}`);
}

function cerrarTodosModales() {
    const modales = [...modalesAbiertos].reverse();
    modales.forEach(modalId => {
        cerrarModalConZIndex(modalId);
    });
}

// ===================================================
// FUNCIONES DE UTILIDAD
// ===================================================

function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio);
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizarEstado(estado) {
    if (!estado) return 'preparando';
    const estadoLower = estado.toLowerCase().trim();
    if (estadoLower === 'preparando' || estadoLower === 'nuevo') return 'preparando';
    if (estadoLower === 'en preparacion' || estadoLower === 'en preparación') return 'en preparacion';
    if (estadoLower === 'en camino') return 'en camino';
    if (estadoLower === 'entregado') return 'entregado';
    return estadoLower;
}

function getEstadoTexto(estado) {
    const textos = {
        'preparando': 'NUEVO PEDIDO',
        'en preparacion': 'EN PREPARACIÓN',
        'en camino': 'EN CAMINO',
        'entregado': 'ENTREGADO'
    };
    return textos[estado] || estado.toUpperCase();
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
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '40px';
    toast.style.fontSize = '0.8rem';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function withLoading(button, callback) {
    if (!button) return await callback();
    const originalText = button.innerHTML;
    const originalDisabled = button.disabled;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + originalText.replace(/<i class="[^"]*"><\/i>\s*/, '');
    try {
        return await callback();
    } finally {
        button.disabled = originalDisabled;
        button.innerHTML = originalText;
    }
}

async function subirImagenACloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        return data.secure_url || null;
    } catch (error) {
        return null;
    }
}

// ===================================================
// FUNCIONES DE SESIÓN
// ===================================================

function guardarSesion(vendedor) {
    sessionStorage.setItem('vendedor_sesion', JSON.stringify({
        id: vendedor.id,
        email: vendedor.email,
        nombre: vendedor.nombre
    }));
}

function cerrarSesion() {
    localStorage.removeItem('want_sesion');
    sessionStorage.removeItem('vendedor_sesion');
    location.reload();
}

function cargarSesionGuardada() {
    const localSesion = localStorage.getItem('want_sesion');
    if (localSesion) {
        try {
            const sesion = JSON.parse(localSesion);
            if (sesion && sesion.id) {
                cargarVendedorPorId(sesion.id);
                return true;
            }
        } catch (e) {}
    }
    const sessionSesion = sessionStorage.getItem('vendedor_sesion');
    if (sessionSesion) {
        try {
            const sesion = JSON.parse(sessionSesion);
            if (sesion && sesion.id) {
                cargarVendedorPorId(sesion.id);
                return true;
            }
        } catch (e) {}
    }
    return false;
}

async function cargarVendedorPorId(vendedorId) {
    try {
        const response = await callAPI('getVendedores', {}, true);
        if (response.success) {
            const vendedor = response.vendedores.find(v => v.id.toString() === vendedorId.toString());
            if (vendedor && vendedor.activo === true) {
                vendedorActual = vendedor;
                await iniciarPanel(vendedorActual);
            } else {
                cerrarSesion();
            }
        }
    } catch (error) {
        cerrarSesion();
    }
}

// ===================================================
// FUNCIONES DE ESTADO (ABIERTO/CERRADO)
// ===================================================

async function toggleEstadoAbierto() {
    if (!vendedorActual) return;
    const nuevoEstado = !vendedorActual.estado_abierto;
    const btnToggle = document.getElementById('toggle-estado-switch');
    await withLoading(btnToggle, async () => {
        try {
            const response = await postAPI('actualizarVendedor', { id: vendedorActual.id, estado_abierto: nuevoEstado });
            if (response && response.success) {
                vendedorActual.estado_abierto = nuevoEstado;
                actualizarUIEstadoAbierto();
                mostrarToast(nuevoEstado ? 'Negocio abierto' : 'Negocio cerrado', 'success');
            } else {
                throw new Error(response?.error || 'Error');
            }
        } catch (error) {
            mostrarToast('Error al cambiar estado', 'error');
        }
    });
}

function actualizarUIEstadoAbierto() {
    const estadoAbierto = vendedorActual?.estado_abierto === true;
    const toggleSwitch = document.getElementById('toggle-estado-switch');
    const estadoTexto = document.getElementById('estado-abierto-texto');
    const estadoBadge = document.getElementById('estado-abierto-badge');
    if (toggleSwitch) toggleSwitch.checked = estadoAbierto;
    if (estadoTexto) {
        estadoTexto.textContent = estadoAbierto ? 'Abierto' : 'Cerrado';
        estadoTexto.style.color = estadoAbierto ? '#10b981' : '#ef4444';
    }
    if (estadoBadge) {
        estadoBadge.className = `estado-badge-header ${estadoAbierto ? 'estado-abierto' : 'estado-cerrado'}`;
        estadoBadge.innerHTML = estadoAbierto ? '<i class="fas fa-check-circle"></i> Atendiendo' : '<i class="fas fa-times-circle"></i> Cerrado';
    }
}

// ===================================================
// FUNCIONES DE CARGA DE DATOS
// ===================================================

async function cargarPedidos(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('pedidos-container');
    if (container) container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando pedidos...</p></div>`;
    try {
        const response = await callAPI('getPedidos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        pedidos = (response.pedidos || []).map(p => ({ ...p, estado: normalizarEstado(p.estado) }));
        actualizarContadoresPedidos();
        calcularMetricas();
        renderizarPedidos();
        actualizarReportes();
        if (forceRefresh) mostrarToast('Pedidos actualizados', 'success');
    } catch (error) {
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar pedidos: ${error.message}</p></div>`;
    }
}

async function cargarProductos(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('productos-admin-grid');
    if (container) container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando productos...</p></div>`;
    try {
        const response = await callAPI('getProductos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        productos = (response.productos || []).filter(p => p.vendedor_id?.toString() === vendedorActual.id.toString());
        renderizarProductosAdmin();
        const badge = document.getElementById('badge-productos');
        if (badge) badge.textContent = productos.length;
    } catch (error) {
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar productos</p></div>`;
    }
}

async function cargarDeliveries(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('delivery-grid');
    if (container) container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando deliveries...</p></div>`;
    try {
        const response = await callAPI('getDeliveries', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        deliveries = response.deliveries || [];
        renderizarDeliveries();
        const badge = document.getElementById('badge-delivery');
        if (badge) badge.textContent = deliveries.length;
    } catch (error) {
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar deliveries</p></div>`;
    }
}

// ===================================================
// FUNCIONES DE MÉTRICAS Y CONTADORES
// ===================================================

function calcularMetricas() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    let ventasHoy = 0, ventasSemana = 0, ventasMes = 0, pedidosEntregados = 0, pedidosPendientes = 0;
    pedidos.forEach(pedido => {
        const fechaPedido = new Date(pedido.fecha);
        fechaPedido.setHours(0, 0, 0, 0);
        const total = parseFloat(pedido.total) || 0;
        if (pedido.estado === 'entregado') {
            pedidosEntregados++;
            if (fechaPedido >= hoy) ventasHoy += total;
            if (fechaPedido >= inicioSemana) ventasSemana += total;
            if (fechaPedido >= inicioMes) ventasMes += total;
        } else if (pedido.estado !== 'entregado' && pedido.estado !== 'cancelado') {
            pedidosPendientes++;
        }
    });
    const vh = document.getElementById('ventas-hoy');
    const vs = document.getElementById('ventas-semana');
    const vm = document.getElementById('ventas-mes');
    const pe = document.getElementById('pedidos-entregados');
    const pp = document.getElementById('pedidos-pendientes');
    if (vh) vh.textContent = formatearPrecio(ventasHoy);
    if (vs) vs.textContent = formatearPrecio(ventasSemana);
    if (vm) vm.textContent = formatearPrecio(ventasMes);
    if (pe) pe.textContent = pedidosEntregados;
    if (pp) pp.textContent = pedidosPendientes;
}

function actualizarContadoresPedidos() {
    const contarPorEstado = { preparando: 0, 'en preparacion': 0, 'en camino': 0, entregado: 0 };
    pedidos.forEach(p => {
        const estado = p.estado || 'preparando';
        if (contarPorEstado[estado] !== undefined) contarPorEstado[estado]++;
    });
    const cp = document.getElementById('count-preparando');
    const cpr = document.getElementById('count-preparacion');
    const cc = document.getElementById('count-camino');
    const ce = document.getElementById('count-entregado');
    const bp = document.getElementById('badge-pedidos');
    if (cp) cp.textContent = contarPorEstado.preparando;
    if (cpr) cpr.textContent = contarPorEstado['en preparacion'];
    if (cc) cc.textContent = contarPorEstado['en camino'];
    if (ce) ce.textContent = contarPorEstado.entregado;
    if (bp) bp.textContent = contarPorEstado.preparando;
}

function actualizarReportes() {
    if (!pedidos) return;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    let ventasHoy=0, ventasSemana=0, ventasMes=0, pedidosEntregados=0, pedidosPendientes=0;
    pedidos.forEach(pedido => {
        const fechaPedido = new Date(pedido.fecha); fechaPedido.setHours(0,0,0,0);
        const total = parseFloat(pedido.total) || 0;
        if (pedido.estado === 'entregado') {
            pedidosEntregados++;
            if (fechaPedido >= hoy) ventasHoy += total;
            if (fechaPedido >= inicioSemana) ventasSemana += total;
            if (fechaPedido >= inicioMes) ventasMes += total;
        } else if (pedido.estado !== 'entregado' && pedido.estado !== 'cancelado') {
            pedidosPendientes++;
        }
    });
    const rh = document.getElementById('reporte-ventas-hoy');
    const rs = document.getElementById('reporte-ventas-semana');
    const rm = document.getElementById('reporte-ventas-mes');
    const re = document.getElementById('reporte-pedidos-entregados');
    const rp = document.getElementById('reporte-pedidos-pendientes');
    const rt = document.getElementById('reporte-total-pedidos');
    if (rh) rh.textContent = formatearPrecio(ventasHoy);
    if (rs) rs.textContent = formatearPrecio(ventasSemana);
    if (rm) rm.textContent = formatearPrecio(ventasMes);
    if (re) re.textContent = pedidosEntregados;
    if (rp) rp.textContent = pedidosPendientes;
    if (rt) rt.textContent = pedidos.length;
    
    const ventasPorProducto = {};
    pedidos.forEach(pedido => {
        if (pedido.productos && pedido.productos.length > 0) {
            pedido.productos.forEach(prod => {
                const nombre = prod.nombre;
                if (!ventasPorProducto[nombre]) ventasPorProducto[nombre] = 0;
                ventasPorProducto[nombre] += prod.cantidad;
            });
        }
    });
    const topProductos = Object.entries(ventasPorProducto).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const topProductosContainer = document.getElementById('reporte-top-productos');
    if (topProductosContainer) {
        if (topProductos.length === 0) {
            topProductosContainer.innerHTML = '<div class="loading-small">No hay productos vendidos</div>';
        } else {
            topProductosContainer.innerHTML = topProductos.map(([nombre, cantidad]) => `
                <div class="reporte-item">
                    <span class="reporte-item-nombre">${escapeHTML(nombre)}</span>
                    <span class="reporte-item-cantidad">${cantidad} unidades</span>
                </div>
            `).join('');
        }
    }
    
    const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const ventasPorDia = Array(7).fill(0);
    const hoyDate = new Date();
    pedidos.forEach(pedido => {
        if (pedido.estado === 'entregado') {
            const fechaPedido = new Date(pedido.fecha);
            const diffDias = Math.floor((hoyDate - fechaPedido) / (1000*60*60*24));
            if (diffDias >=0 && diffDias <7) {
                const diaIndex = fechaPedido.getDay();
                ventasPorDia[diaIndex] += parseFloat(pedido.total) || 0;
            }
        }
    });
    const ventasDiasContainer = document.getElementById('reporte-ventas-dias');
    if (ventasDiasContainer) {
        ventasDiasContainer.innerHTML = diasSemana.map((dia,i)=>`
            <div class="dia-item">
                <span class="dia-nombre">${dia}</span>
                <span class="dia-valor">${formatearPrecio(ventasPorDia[i])}</span>
            </div>
        `).join('');
    }
    
    const ultimosPedidos = [...pedidos].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).slice(0,10);
    const ultimosPedidosContainer = document.getElementById('reporte-ultimos-pedidos');
    if (ultimosPedidosContainer) {
        if (ultimosPedidos.length === 0) {
            ultimosPedidosContainer.innerHTML = '<div class="loading-small">No hay pedidos</div>';
        } else {
            ultimosPedidosContainer.innerHTML = ultimosPedidos.map(p=>`
                <div class="pedido-item">
                    <div class="pedido-info">
                        <div class="pedido-numero">Pedido #${p.numero_orden || p.id}</div>
                        <div class="pedido-cliente">${escapeHTML(p.cliente_nombre || 'Sin nombre')}</div>
                    </div>
                    <div class="pedido-total">${formatearPrecio(p.total || 0)}</div>
                </div>
            `).join('');
        }
    }
}

// ===================================================
// RENDERIZADO DE PEDIDOS (CORREGIDO - SIN ONCLICK EN FILA)
// ===================================================

function filtrarPedidos() {
    let filtrados = pedidos.filter(p => p.estado === filtroActual);
    if (terminoBusqueda.trim()) {
        const termino = terminoBusqueda.toLowerCase().trim();
        filtrados = filtrados.filter(p => {
            return (p.numero_orden?.toString().includes(termino)) ||
                   (p.id?.toString().includes(termino)) ||
                   (p.cliente_nombre && p.cliente_nombre.toLowerCase().includes(termino)) ||
                   (p.cliente_telefono && p.cliente_telefono.includes(termino));
        });
    }
    filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return filtrados;
}

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        renderizarPedidosMovil();
    } else {
        renderizarPedidosDesktop();
    }
}

function renderizarPedidosDesktop() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    const pedidosFiltrados = filtrarPedidos();
    if (!pedidosFiltrados || pedidosFiltrados.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No hay pedidos en esta categoría</p></div>`;
        return;
    }
    let html = `<table class="pedidos-tabla"><thead><tr><th class="col-id">ID</th><th class="col-fecha">Fecha</th><th class="col-cliente">Cliente</th><th class="col-telefono">Teléfono</th><th class="col-direccion">Dirección</th><th class="col-pago">Pago</th><th class="col-productos">Productos</th><th class="col-total">Total</th><th class="col-estado">Estado</th><th class="col-acciones">Acciones</th></tr></thead><tbody>`;
    for (const p of pedidosFiltrados) {
        const fecha = new Date(p.fecha);
        const metodoPago = p.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo';
        const estado = p.estado || 'preparando';
        const numeroMostrar = p.numero_orden || p.id;
        
        let productosResumen = '';
        if (p.productos && Array.isArray(p.productos) && p.productos.length > 0) {
            const primeros = p.productos.slice(0, 2);
            productosResumen = primeros.map(pr => `${pr.cantidad}x ${pr.nombre}`).join(', ');
            if (p.productos.length > 2) productosResumen += ` +${p.productos.length - 2} más`;
        } else {
            productosResumen = 'Sin productos';
        }
        
        const total = formatearPrecio(p.total || 0);
        let botonesHTML = '';
        
        if (estado === 'preparando') {
            // Botón "Confirmar y preparar" (abre modal de tiempo)
            botonesHTML = `
                <button class="btn-tabla btn-confirmar-preparar" onclick="event.stopPropagation(); abrirModalTiempo(${p.id}, this)"><i class="fas fa-check-circle"></i> Confirmar y preparar</button>
            `;
            // Botón "Coordinar transferencia" (solo si método de pago es transferencia)
            if (p.metodo_pago === 'transferencia') {
                botonesHTML += `
                    <button class="btn-tabla btn-coordinar" onclick="event.stopPropagation(); abrirModalCoordinarTransferencia(${p.id})"><i class="fas fa-exchange-alt"></i> Coordinar transferencia</button>
                `;
            }
            botonesHTML += `
                <button class="btn-tabla btn-editar" onclick="event.stopPropagation(); abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="event.stopPropagation(); cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        } else if (estado === 'en preparacion') {
            botonesHTML = `
                <button class="btn-tabla btn-notificar-cliente" onclick="event.stopPropagation(); notificarClienteEnCamino(${p.id}, this)"><i class="fab fa-whatsapp"></i> Notificar al cliente</button>
                <button class="btn-tabla btn-enviar-delivery" onclick="event.stopPropagation(); abrirModalAsignarDelivery(${p.id})"><i class="fas fa-truck"></i> Enviar al delivery</button>
                <button class="btn-tabla btn-editar" onclick="event.stopPropagation(); abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="event.stopPropagation(); cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        } else if (estado === 'en camino') {
            botonesHTML = `
                <button class="btn-tabla btn-entregar-pedido" onclick="event.stopPropagation(); entregarPedido(${p.id}, this)"><i class="fas fa-check-double"></i> Pedido entregado</button>
                <button class="btn-tabla btn-editar" onclick="event.stopPropagation(); abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="event.stopPropagation(); cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        } else if (estado === 'entregado') {
            botonesHTML = `
                <button class="btn-tabla btn-editar" onclick="event.stopPropagation(); abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="event.stopPropagation(); cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        }
        
        html += `<tr>
            <td class="col-id">#${numeroMostrar}</td>
            <td class="col-fecha">${fecha.toLocaleString('es-AR')}</td>
            <td class="col-cliente">${escapeHTML(p.cliente_nombre || 'Sin nombre')}</td>
            <td class="col-telefono">${p.cliente_telefono || '-'}</td>
            <td class="col-direccion">${escapeHTML(p.direccion || '-')}</td>
            <td class="col-pago">${metodoPago}</td>
            <td class="col-productos"><span class="productos-preview">${escapeHTML(productosResumen)}</span></td>
            <td class="col-total">${total}</td>
            <td class="col-estado"><span class="estado-badge estado-${estado.replace(' ', '-')}">${getEstadoTexto(estado)}</span></td>
            <td class="col-acciones">${botonesHTML}</td>
        </tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function renderizarPedidosMovil() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    const pedidosFiltrados = filtrarPedidos();
    if (!pedidosFiltrados || pedidosFiltrados.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No hay pedidos en esta categoría</p></div>`;
        return;
    }
    let html = `<div class="pedidos-lista-movil">`;
    for (const p of pedidosFiltrados) {
        const estado = p.estado || 'preparando';
        const numeroMostrar = p.numero_orden || p.id;
        const total = formatearPrecio(p.total || 0);
        
        let productosResumen = '';
        if (p.productos && Array.isArray(p.productos) && p.productos.length > 0) {
            const primeros = p.productos.slice(0, 2);
            productosResumen = primeros.map(pr => `${pr.cantidad}x ${pr.nombre}`).join(', ');
            if (p.productos.length > 2) productosResumen += ` +${p.productos.length - 2} más`;
        } else {
            productosResumen = 'Sin productos';
        }
        
        let estadoTexto = '', estadoClase = '';
        if (estado === 'preparando') { estadoTexto = 'NUEVO'; estadoClase = 'estado-preparando'; }
        else if (estado === 'en preparacion') { estadoTexto = 'PREPARACIÓN'; estadoClase = 'estado-en-preparacion'; }
        else if (estado === 'en camino') { estadoTexto = 'EN CAMINO'; estadoClase = 'estado-en-camino'; }
        else if (estado === 'entregado') { estadoTexto = 'ENTREGADO'; estadoClase = 'estado-entregado'; }
        
        let botonesHTML = '';
        
        if (estado === 'preparando') {
            botonesHTML = `
                <button class="btn-tabla btn-confirmar-preparar" onclick="abrirModalTiempo(${p.id}, this)"><i class="fas fa-check-circle"></i> Confirmar y preparar</button>
            `;
            if (p.metodo_pago === 'transferencia') {
                botonesHTML += `<button class="btn-tabla btn-coordinar" onclick="abrirModalCoordinarTransferencia(${p.id})"><i class="fas fa-exchange-alt"></i> Coordinar</button>`;
            }
            botonesHTML += `
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        } else if (estado === 'en preparacion') {
            botonesHTML = `
                <button class="btn-tabla btn-notificar-cliente" onclick="notificarClienteEnCamino(${p.id}, this)"><i class="fab fa-whatsapp"></i> Notificar</button>
                <button class="btn-tabla btn-enviar-delivery" onclick="abrirModalAsignarDelivery(${p.id})"><i class="fas fa-truck"></i> Delivery</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        } else if (estado === 'en camino') {
            botonesHTML = `
                <button class="btn-tabla btn-entregar-pedido" onclick="entregarPedido(${p.id}, this)"><i class="fas fa-check-double"></i> Entregar</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        } else if (estado === 'entregado') {
            botonesHTML = `
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        }
        
        html += `
            <div class="pedido-card-movil" data-pedido-id="${p.id}">
                <div class="pedido-card-header">
                    <span class="pedido-numero-movil">#${numeroMostrar}</span>
                    <span class="pedido-estado-movil ${estadoClase}">${estadoTexto}</span>
                </div>
                <div class="pedido-card-body">
                    <div class="pedido-cliente-movil">${escapeHTML(p.cliente_nombre || 'Sin nombre')}</div>
                    <div class="pedido-resumen-movil">📦 ${escapeHTML(productosResumen)}</div>
                    <div class="pedido-resumen-movil">💰 ${total}</div>
                </div>
                <div class="pedido-card-footer" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
                    ${botonesHTML}
                </div>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// ===================================================
// FUNCIONES DE ACCIONES DE PEDIDOS
// ===================================================

async function actualizarEstado(pedidoId, nuevoEstado, boton) {
    if (!boton) return;
    await withLoading(boton, async () => {
        try {
            const response = await postAPI('actualizarEstado', { pedidoId, estado: nuevoEstado });
            if (response && response.success) {
                mostrarToast(`Pedido actualizado a ${getEstadoTexto(nuevoEstado)}`, 'success');
                const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
                if (pedido) pedido.estado = nuevoEstado;
                actualizarContadoresPedidos();
                calcularMetricas();
                renderizarPedidos();
                actualizarReportes();
            } else throw new Error(response?.error || 'Error');
        } catch (error) {
            mostrarToast('Error al actualizar', 'error');
            throw error;
        }
    });
}

async function cancelarPedido(pedidoId, boton) {
    if (!confirm('¿Cancelar este pedido? Se eliminará permanentemente.')) return;
    await withLoading(boton, async () => {
        try {
            const response = await postAPI('cancelarPedido', { pedidoId });
            if (response && response.success) {
                mostrarToast(`Pedido cancelado`, 'success');
                pedidos = pedidos.filter(p => p.id.toString() !== pedidoId.toString());
                actualizarContadoresPedidos();
                calcularMetricas();
                renderizarPedidos();
                actualizarReportes();
            } else throw new Error(response?.error || 'Error');
        } catch (error) {
            mostrarToast('Error al cancelar', 'error');
            throw error;
        }
    });
}

async function confirmarPedidoWhatsApp(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    pedidoPendienteConfirmar = pedido;
    botonPendienteConfirmar = boton;
    document.getElementById('tiempo-entrega-input').value = '';
    abrirModalConZIndex('modal-tiempo-entrega');
}

async function enviarConfirmacionWhatsApp() {
    const tiempoEntrega = document.getElementById('tiempo-entrega-input')?.value.trim();
    if (!tiempoEntrega) {
        mostrarToast('Ingrese un tiempo estimado de entrega', 'error');
        return;
    }
    if (!pedidoPendienteConfirmar) return;
    const pedido = pedidoPendienteConfirmar;
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `*CONFIRMACIÓN DE TU PEDIDO*\n\nHola ${pedido.cliente_nombre},\n\nRecibimos tu pedido correctamente!\n\n━━━━━━━━━━━━━━━━━━━━\n*DETALLE DE TU PEDIDO:*\n━━━━━━━━━━━━━━━━━━━━\n`;
    pedido.productos.forEach(p => { mensaje += `• ${p.cantidad}x ${p.nombre}\n`; });
    if (pedido.detalles) mensaje += `\n*INDICACIONES:* ${pedido.detalles}\n`;
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n*TOTAL:* $${pedido.total.toLocaleString('es-AR')}\n*NUMERO DE ORDEN:* #${pedido.numero_orden || pedido.id}\n━━━━━━━━━━━━━━━━━━━━\n\n*TIEMPO ESTIMADO:* ${tiempoEntrega}\n\n*MÉTODO DE PAGO:* ${metodoPagoTexto === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo'}\n\n*DIRECCIÓN:* ${pedido.direccion}\n\n*Gracias por confiar en nosotros!*`;
    
    window.open(`https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
    cerrarModalConZIndex('modal-tiempo-entrega');
    if (botonPendienteConfirmar) {
        botonPendienteConfirmar.disabled = false;
        botonPendienteConfirmar.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar pedido';
    }
}

async function notificarEnCamino(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    await withLoading(boton, async () => {
        const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
        let mensaje = `*ACTUALIZACIÓN DE TU PEDIDO*\n\nHola ${pedido.cliente_nombre},\n\n*¡Tu pedido está en camino!*\n\n━━━━━━━━━━━━━━━━━━━━\n*DETALLE:*\n`;
        pedido.productos.forEach(p => { mensaje += `• ${p.cantidad}x ${p.nombre}\n`; });
        if (pedido.detalles) mensaje += `\n*INDICACIONES:* ${pedido.detalles}\n`;
        mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n*DIRECCIÓN:* ${pedido.direccion}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        if (metodoPagoTexto === 'transferencia') {
            mensaje += `*PAGO:* Transferencia bancaria (YA REALIZADA)`;
        } else {
            mensaje += `*PAGO:* Efectivo - *DEBES PAGAR $${pedido.total.toLocaleString('es-AR')} AL DELIVERY*`;
        }
        window.open(`https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
    });
}

// ===================================================
// FUNCIONES DE DELIVERY
// ===================================================

function renderizarDeliveries() {
    const container = document.getElementById('delivery-grid');
    if (!container) return;
    if (deliveries.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No tenés deliveries registrados</p><button class="btn-primary" onclick="abrirModalDelivery()">Agregar delivery</button></div>`;
        return;
    }
    container.innerHTML = deliveries.map(d => `
        <div class="delivery-card">
            <div class="delivery-info">
                <h4>${escapeHTML(d.nombre)}</h4>
                <p><i class="fab fa-whatsapp"></i> ${d.telefono}</p>
            </div>
            <div class="delivery-actions">
                <button class="btn-wa-delivery" onclick="whatsappDelivery('${d.telefono}', '${escapeHTML(d.nombre)}')"><i class="fab fa-whatsapp"></i></button>
                <button class="btn-edit-delivery" onclick="abrirModalDelivery(${d.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-delete-delivery" onclick="eliminarDelivery(${d.id})"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `).join('');
}

function abrirModalDelivery(deliveryId = null) {
    if (deliveryId) {
        const d = deliveries.find(d => d.id === deliveryId);
        if (d) {
            document.getElementById('delivery-id').value = d.id;
            document.getElementById('delivery-nombre').value = d.nombre;
            document.getElementById('delivery-telefono').value = d.telefono;
            document.getElementById('modal-delivery-title').textContent = 'Editar delivery';
        }
    } else {
        document.getElementById('delivery-form').reset();
        document.getElementById('delivery-id').value = '';
        document.getElementById('modal-delivery-title').textContent = 'Nuevo delivery';
    }
    abrirModalConZIndex('modal-delivery');
}

function cerrarModalDelivery() {
    cerrarModalConZIndex('modal-delivery');
}

async function guardarDelivery() {
    const id = document.getElementById('delivery-id').value;
    const nombre = document.getElementById('delivery-nombre').value.trim();
    const telefono = document.getElementById('delivery-telefono').value.trim();
    if (!nombre || !telefono) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    const data = { vendedor_id: vendedorActual.id, nombre, telefono };
    if (id) data.id = parseInt(id);
    const action = id ? 'actualizarDelivery' : 'crearDelivery';
    try {
        const response = await postAPI(action, data);
        if (response && response.success) {
            mostrarToast(id ? 'Delivery actualizado' : 'Delivery creado', 'success');
            cerrarModalDelivery();
            await cargarDeliveries(true);
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

async function eliminarDelivery(deliveryId) {
    if (!confirm('¿Eliminar este delivery?')) return;
    try {
        const response = await postAPI('eliminarDelivery', { deliveryId });
        if (response.success) {
            mostrarToast('Delivery eliminado', 'success');
            await cargarDeliveries(true);
        }
    } catch (error) {
        mostrarToast('Error al eliminar', 'error');
    }
}

function whatsappDelivery(telefono, nombre) {
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(`Hola ${nombre}, soy del negocio.`)}`, '_blank');
}

// ===================================================
// FUNCIONES DE PRODUCTOS
// ===================================================

function renderizarProductosAdmin() {
    const container = document.getElementById('productos-admin-grid');
    if (!container) return;
    if (productos.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No tenés productos cargados</p><button class="btn-primary" onclick="abrirModalProducto()">Agregar producto</button></div>`;
        return;
    }
    container.innerHTML = productos.map(p => `
        <div class="producto-admin-card">
            <div class="producto-admin-imagen">
                ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${escapeHTML(p.nombre)}">` : '<div class="placeholder-img">🍕</div>'}
            </div>
            <div class="producto-admin-info">
                <div class="producto-admin-nombre">${escapeHTML(p.nombre)}</div>
                <div class="producto-admin-precio">${formatearPrecio(p.precio)}</div>
                <div class="producto-admin-descripcion">${escapeHTML(p.descripcion || 'Sin descripción')}</div>
                <div class="producto-admin-actions">
                    <button class="btn-editar" onclick="abrirModalProducto(${p.id})">Editar</button>
                    <button class="btn-eliminar" onclick="eliminarProducto(${p.id})">Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
}

function abrirModalProducto(productoId = null) {
    if (productoId) {
        const p = productos.find(p => p.id === productoId);
        if (p) {
            document.getElementById('producto-id').value = p.id;
            document.getElementById('producto-nombre').value = p.nombre;
            document.getElementById('producto-descripcion').value = p.descripcion || '';
            document.getElementById('producto-precio').value = p.precio;
            document.getElementById('producto-disponible').value = p.disponible ? 'SI' : 'NO';
            const preview = document.getElementById('producto-imagen-preview');
            if (preview && p.imagen_url) preview.innerHTML = `<img src="${p.imagen_url}" style="max-width: 100px;">`;
            document.getElementById('modal-producto-title').textContent = 'Editar producto';
        }
    } else {
        document.getElementById('producto-form').reset();
        document.getElementById('producto-id').value = '';
        document.getElementById('producto-imagen-preview').innerHTML = '';
        document.getElementById('producto-disponible').value = 'SI';
        document.getElementById('modal-producto-title').textContent = 'Nuevo producto';
    }
    abrirModalConZIndex('modal-producto');
}

function cerrarModalProducto() {
    cerrarModalConZIndex('modal-producto');
}

async function guardarProducto() {
    const id = document.getElementById('producto-id').value;
    const nombre = document.getElementById('producto-nombre').value.trim();
    const descripcion = document.getElementById('producto-descripcion').value.trim();
    const precio = parseFloat(document.getElementById('producto-precio').value);
    const disponible = document.getElementById('producto-disponible')?.value || 'SI';
    const imagenFile = document.getElementById('producto-imagen').files[0];
    
    if (!nombre || !precio) {
        mostrarToast('Nombre y precio son obligatorios', 'error');
        return;
    }
    
    let imagenUrl = null;
    if (imagenFile) {
        mostrarToast('Subiendo imagen...', 'info');
        imagenUrl = await subirImagenACloudinary(imagenFile);
        if (!imagenUrl) {
            mostrarToast('Error al subir imagen', 'error');
            return;
        }
    }
    
    const data = {
        vendedor_id: vendedorActual.id,
        nombre,
        descripcion,
        precio,
        disponible: disponible === 'SI' ? true : false
    };
    if (imagenUrl) data.imagen_url = imagenUrl;
    if (id) data.id = parseInt(id);
    
    const action = id ? 'actualizarProducto' : 'crearProducto';
    try {
        const response = await postAPI(action, data);
        if (response && response.success) {
            mostrarToast(id ? 'Producto actualizado' : 'Producto creado', 'success');
            cerrarModalProducto();
            await cargarProductos(true);
        } else {
            throw new Error(response?.error || 'Error al guardar');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

async function eliminarProducto(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;
    if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return;
    try {
        const response = await postAPI('eliminarProducto', { productoId });
        if (response.success) {
            mostrarToast('Producto eliminado', 'success');
            await cargarProductos(true);
        }
    } catch (error) {
        mostrarToast('Error al eliminar', 'error');
    }
}

// ===================================================
// FUNCIONES DE PERFIL (CORREGIDAS - CON AVATAR)
// ===================================================

function abrirModalPerfil() {
    cargarPerfil();
    abrirModalConZIndex('modal-perfil');
}

function cerrarModalPerfil() {
    cerrarModalConZIndex('modal-perfil');
}

function cargarPerfil() {
    if (!vendedorActual) return;
    
    document.getElementById('perfil-nombre-display').textContent = vendedorActual.nombre || '';
    document.getElementById('perfil-email-display').textContent = vendedorActual.email || '';
    document.getElementById('perfil-nombre').value = vendedorActual.nombre || '';
    document.getElementById('perfil-telefono').value = vendedorActual.telefono || '';
    document.getElementById('perfil-direccion').value = vendedorActual.direccion || '';
    document.getElementById('perfil-horario').value = vendedorActual.horario || '';
    document.getElementById('perfil-descripcion').value = vendedorActual.descripcion || '';
    
    const avatarImg = document.getElementById('perfil-avatar-img');
    if (avatarImg) {
        if (vendedorActual.logo_url) {
            avatarImg.innerHTML = `<img src="${vendedorActual.logo_url}" style="width: 100%; height: 100%; border-radius: 16px; object-fit: cover;">`;
        } else {
            avatarImg.innerHTML = '<i class="fas fa-store"></i>';
            avatarImg.style.background = 'linear-gradient(135deg, #FF5A00, #FF7A00)';
        }
    }
    
    const btnCambiarLogo = document.getElementById('btn-cambiar-logo');
    const logoInput = document.getElementById('perfil-logo-input');
    if (btnCambiarLogo && logoInput) {
        btnCambiarLogo.onclick = () => logoInput.click();
        logoInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (avatarImg) {
                        avatarImg.innerHTML = `<img src="${ev.target.result}" style="width: 100%; height: 100%; border-radius: 16px; object-fit: cover;">`;
                    }
                };
                reader.readAsDataURL(file);
                window.logoPendiente = file;
            }
        };
    }
    
    const rubrosActuales = vendedorActual.rubros || [];
    rubrosTempPerfil = [...rubrosActuales];
    const rubrosContainer = document.getElementById('perfil-rubros-container');
    if (rubrosContainer) {
        if (rubrosActuales.length === 0) {
            rubrosContainer.innerHTML = '<span class="rubro-placeholder">No hay rubros seleccionados</span>';
        } else {
            rubrosContainer.innerHTML = rubrosActuales.map(r => `<span class="rubro-tag">${escapeHTML(r)}</span>`).join('');
        }
    }
    
    const btnEditarRubros = document.getElementById('btn-editar-rubros');
    if (btnEditarRubros) {
        btnEditarRubros.onclick = () => {
            abrirModalRubros(rubrosTempPerfil, (nuevosRubros) => {
                rubrosTempPerfil = nuevosRubros;
                if (rubrosContainer) {
                    if (nuevosRubros.length === 0) {
                        rubrosContainer.innerHTML = '<span class="rubro-placeholder">No hay rubros seleccionados</span>';
                    } else {
                        rubrosContainer.innerHTML = nuevosRubros.map(r => `<span class="rubro-tag">${escapeHTML(r)}</span>`).join('');
                    }
                }
            });
        };
    }
    
    setTimeout(inicializarBotonDescripcion, 100);
}

async function actualizarPerfil() {
    const nombre = document.getElementById('perfil-nombre')?.value.trim() || '';
    const telefono = document.getElementById('perfil-telefono')?.value.trim() || '';
    const direccion = document.getElementById('perfil-direccion')?.value.trim() || '';
    const horario = document.getElementById('perfil-horario')?.value.trim() || '';
    const descripcion = document.getElementById('perfil-descripcion')?.value.trim() || '';
    const newPassword = document.getElementById('perfil-new-password')?.value || '';
    const logoFile = window.logoPendiente;
    const rubrosSeleccionados = rubrosTempPerfil;
    
    let logoUrl = vendedorActual.logo_url;
    if (logoFile) {
        mostrarToast('Subiendo logo...', 'info');
        logoUrl = await subirImagenACloudinary(logoFile);
        if (!logoUrl) {
            mostrarToast('Error al subir logo', 'error');
            return;
        }
        window.logoPendiente = null;
    }
    
    const updateData = {
        id: vendedorActual.id,
        nombre,
        telefono,
        direccion,
        horario,
        logo_url: logoUrl,
        rubros: rubrosSeleccionados,
        descripcion: descripcion
    };
    
    if (newPassword) {
        if (newPassword.length < 6) {
            mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        updateData.password_hash = newPassword;
    }
    
    try {
        const response = await postAPI('actualizarVendedor', updateData);
        if (response && response.success) {
            mostrarToast('Perfil actualizado', 'success');
            vendedorActual = { ...vendedorActual, nombre, telefono, direccion, horario, logo_url: logoUrl, rubros: rubrosSeleccionados, descripcion: descripcion };
            document.getElementById('perfil-new-password').value = '';
            cerrarModalPerfil();
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast('Error al actualizar perfil', 'error');
    }
}

// ===================================================
// FUNCIONES DE RUBROS
// ===================================================

function abrirModalRubros(rubrosActuales, callback) {
    rubrosTemporales = [...(rubrosActuales || [])];
    rubrosCallback = callback;
    
    const modalPerfil = document.getElementById('modal-perfil');
    const modalPerfilEstabaAbierto = modalPerfil && modalPerfil.classList.contains('active');
    if (modalPerfilEstabaAbierto) {
        cerrarModalConZIndex('modal-perfil');
        window.modalPerfilAbierto = true;
    }
    
    const grid = document.getElementById('rubros-grid-modal');
    if (!grid) return;
    
    grid.innerHTML = RUBROS_DISPONIBLES.map(rubro => `
        <button type="button" class="btn-rubro ${rubrosTemporales.includes(rubro) ? 'selected' : ''}" data-rubro="${rubro}">
            ${rubro}
        </button>
    `).join('');
    
    actualizarListaRubrosSeleccionados();
    
    document.querySelectorAll('.btn-rubro').forEach(btn => {
        btn.addEventListener('click', () => {
            const rubro = btn.getAttribute('data-rubro');
            if (rubrosTemporales.includes(rubro)) {
                rubrosTemporales = rubrosTemporales.filter(r => r !== rubro);
                btn.classList.remove('selected');
            } else {
                rubrosTemporales.push(rubro);
                btn.classList.add('selected');
            }
            actualizarListaRubrosSeleccionados();
        });
    });
    
    abrirModalConZIndex('modal-rubros');
}

function actualizarListaRubrosSeleccionados() {
    const listaSpan = document.getElementById('rubros-seleccionados-lista');
    if (listaSpan) {
        if (rubrosTemporales.length === 0) {
            listaSpan.textContent = 'Ninguno';
        } else {
            listaSpan.textContent = rubrosTemporales.join(', ');
        }
    }
}

function cerrarModalRubros() {
    cerrarModalConZIndex('modal-rubros');
    rubrosCallback = null;
    if (window.modalPerfilAbierto) {
        abrirModalConZIndex('modal-perfil');
        window.modalPerfilAbierto = false;
    }
}

function confirmarRubros() {
    if (rubrosCallback) {
        rubrosCallback(rubrosTemporales);
    }
    cerrarModalRubros();
}

// ===================================================
// FUNCIONES DE EDICIÓN DE PEDIDOS
// ===================================================

function abrirModalEditarPedido(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    productosTempEdit = JSON.parse(JSON.stringify(pedido.productos || []));
    document.getElementById('edit-pedido-id').value = pedido.id;
    document.getElementById('edit-pedido-id-display').textContent = pedido.numero_orden || pedido.id;
    document.getElementById('edit-cliente-nombre').value = pedido.cliente_nombre || '';
    document.getElementById('edit-cliente-telefono').value = pedido.cliente_telefono || '';
    document.getElementById('edit-direccion').value = pedido.direccion || '';
    document.getElementById('edit-detalles').value = pedido.detalles || '';
    document.getElementById('edit-metodo-pago').value = pedido.metodo_pago || 'efectivo';
    document.getElementById('edit-estado').value = pedido.estado || 'preparando';
    
    renderizarProductosEditar();
    actualizarTotalEdit();
    
    abrirModalConZIndex('modal-editar-pedido');
}

function cerrarModalEditarPedido() {
    cerrarModalConZIndex('modal-editar-pedido');
    productosTempEdit = [];
}

function renderizarProductosEditar() {
    const container = document.getElementById('productos-editar-container');
    if (!container) return;
    if (productosTempEdit.length === 0) {
        container.innerHTML = '<p style="text-align: center;">No hay productos agregados</p>';
        return;
    }
    container.innerHTML = productosTempEdit.map((p, idx) => `
        <div class="producto-item-seleccion">
            <div class="producto-info-seleccion">
                <div class="producto-nombre-seleccion">${escapeHTML(p.nombre)}</div>
                <div class="producto-precio-seleccion">${formatearPrecio(p.precio)} c/u</div>
            </div>
            <div class="producto-cantidad-seleccion">
                <button onclick="modificarCantidadProductoEdit(${idx}, -1)">-</button>
                <span>${p.cantidad}</span>
                <button onclick="modificarCantidadProductoEdit(${idx}, 1)">+</button>
            </div>
            <button class="btn-eliminar-producto" onclick="eliminarProductoEdit(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function modificarCantidadProductoEdit(idx, cambio) {
    if (productosTempEdit[idx]) {
        productosTempEdit[idx].cantidad += cambio;
        if (productosTempEdit[idx].cantidad <= 0) {
            productosTempEdit.splice(idx, 1);
        }
        renderizarProductosEditar();
        actualizarTotalEdit();
    }
}

function eliminarProductoEdit(idx) {
    productosTempEdit.splice(idx, 1);
    renderizarProductosEditar();
    actualizarTotalEdit();
}

function actualizarTotalEdit() {
    const total = productosTempEdit.reduce((s, p) => s + (p.precio * p.cantidad), 0);
    document.getElementById('edit-total').value = formatearPrecio(total);
}

async function guardarEditarPedido() {
    const pedidoId = parseInt(document.getElementById('edit-pedido-id').value);
    const cliente_nombre = document.getElementById('edit-cliente-nombre').value.trim();
    const cliente_telefono = document.getElementById('edit-cliente-telefono').value.trim();
    const direccion = document.getElementById('edit-direccion').value.trim();
    const detalles = document.getElementById('edit-detalles').value.trim();
    const metodo_pago = document.getElementById('edit-metodo-pago').value;
    const estado = document.getElementById('edit-estado').value;
    const total = productosTempEdit.reduce((s, p) => s + (p.precio * p.cantidad), 0);
    
    if (!cliente_nombre || !cliente_telefono || !direccion) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    
    const data = {
        id: pedidoId,
        cliente_nombre,
        cliente_telefono,
        direccion,
        detalles,
        metodo_pago,
        estado,
        productos: productosTempEdit,
        total
    };
    
    try {
        const response = await postAPI('actualizarPedidoCompleto', data);
        if (response && response.success) {
            mostrarToast('Pedido actualizado', 'success');
            cerrarModalEditarPedido();
            await cargarPedidos(true);
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

// ===================================================
// FUNCIONES DE NUEVO PEDIDO
// ===================================================

function abrirModalNuevoPedido() {
    productosTempNuevo = [];
    document.getElementById('nuevo-cliente-nombre').value = '';
    document.getElementById('nuevo-cliente-telefono').value = '';
    document.getElementById('nuevo-direccion').value = '';
    document.getElementById('nuevo-detalles').value = '';
    document.getElementById('nuevo-metodo-pago').value = 'efectivo';
    renderizarProductosNuevo();
    actualizarTotalNuevo();
    abrirModalConZIndex('modal-nuevo-pedido');
}

function cerrarModalNuevoPedido() {
    cerrarModalConZIndex('modal-nuevo-pedido');
    productosTempNuevo = [];
}

function renderizarProductosNuevo() {
    const container = document.getElementById('productos-nuevo-container');
    if (!container) return;
    if (productosTempNuevo.length === 0) {
        container.innerHTML = '<p style="text-align: center;">No hay productos agregados</p>';
        return;
    }
    container.innerHTML = productosTempNuevo.map((p, idx) => `
        <div class="producto-item-seleccion">
            <div class="producto-info-seleccion">
                <div class="producto-nombre-seleccion">${escapeHTML(p.nombre)}</div>
                <div class="producto-precio-seleccion">${formatearPrecio(p.precio)} c/u</div>
            </div>
            <div class="producto-cantidad-seleccion">
                <button onclick="modificarCantidadProductoNuevo(${idx}, -1)">-</button>
                <span>${p.cantidad}</span>
                <button onclick="modificarCantidadProductoNuevo(${idx}, 1)">+</button>
            </div>
            <button class="btn-eliminar-producto" onclick="eliminarProductoNuevo(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function modificarCantidadProductoNuevo(idx, cambio) {
    if (productosTempNuevo[idx]) {
        productosTempNuevo[idx].cantidad += cambio;
        if (productosTempNuevo[idx].cantidad <= 0) {
            productosTempNuevo.splice(idx, 1);
        }
        renderizarProductosNuevo();
        actualizarTotalNuevo();
    }
}

function eliminarProductoNuevo(idx) {
    productosTempNuevo.splice(idx, 1);
    renderizarProductosNuevo();
    actualizarTotalNuevo();
}

function actualizarTotalNuevo() {
    const total = productosTempNuevo.reduce((s, p) => s + (p.precio * p.cantidad), 0);
    document.getElementById('nuevo-total').value = formatearPrecio(total);
}

async function guardarNuevoPedido() {
    const cliente_nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
    const cliente_telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
    const direccion = document.getElementById('nuevo-direccion').value.trim();
    const detalles = document.getElementById('nuevo-detalles').value.trim();
    const metodo_pago = document.getElementById('nuevo-metodo-pago').value;
    const total = productosTempNuevo.reduce((s, p) => s + (p.precio * p.cantidad), 0);
    
    if (!cliente_nombre || !cliente_telefono || !direccion) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    if (productosTempNuevo.length === 0) {
        mostrarToast('Agregá al menos un producto', 'error');
        return;
    }
    
    const data = {
        vendedor_id: vendedorActual.id,
        cliente_nombre,
        cliente_telefono,
        direccion,
        detalles,
        metodo_pago,
        productos: productosTempNuevo,
        total
    };
    
    try {
        const response = await postAPI('crearPedidoVendedor', data);
        if (response && response.success) {
            mostrarToast('Pedido creado', 'success');
            cerrarModalNuevoPedido();
            await cargarPedidos(true);
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

// ===================================================
// FUNCIONES DE SELECCIÓN DE PRODUCTOS
// ===================================================

function abrirModalSeleccionarProducto(productosList, callback) {
    currentCallback = callback;
    const select = document.getElementById('select-producto');
    select.innerHTML = '<option value="">Seleccionar...</option>';
    productos.forEach(p => {
        if (p.disponible === true || p.disponible === 'SI') {
            select.innerHTML += `<option value="${p.id}" data-precio="${p.precio}" data-nombre="${escapeHTML(p.nombre)}">${escapeHTML(p.nombre)} - ${formatearPrecio(p.precio)}</option>`;
        }
    });
    document.getElementById('select-cantidad').value = '1';
    abrirModalConZIndex('modal-seleccionar-producto');
}

function cerrarModalSeleccionarProducto() {
    cerrarModalConZIndex('modal-seleccionar-producto');
    currentCallback = null;
}

function confirmarAgregarProducto() {
    const select = document.getElementById('select-producto');
    const productoId = select.value;
    const cantidad = parseInt(document.getElementById('select-cantidad').value) || 1;
    if (!productoId) {
        mostrarToast('Seleccioná un producto', 'error');
        return;
    }
    const producto = productos.find(p => p.id.toString() === productoId);
    if (!producto) return;
    if (currentCallback) {
        currentCallback({
            id: producto.id,
            nombre: producto.nombre,
            precio: parseFloat(producto.precio),
            cantidad
        });
    }
    cerrarModalSeleccionarProducto();
}

// ===================================================
// FUNCIONES DE REGISTRO Y LOGIN
// ===================================================

function mostrarPanelRegistro() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('register-panel').classList.add('active');
    rubrosTempRegistro = [];
    const rubrosContainer = document.getElementById('rubros-selector-registro');
    if (rubrosContainer) {
        rubrosContainer.innerHTML = RUBROS_DISPONIBLES.map(rubro => `
            <button type="button" class="btn-rubro-registro ${rubrosTempRegistro.includes(rubro) ? 'selected' : ''}" data-rubro="${rubro}">
                ${rubro}
            </button>
        `).join('');
        document.querySelectorAll('.btn-rubro-registro').forEach(btn => {
            btn.addEventListener('click', () => {
                const rubro = btn.getAttribute('data-rubro');
                if (rubrosTempRegistro.includes(rubro)) {
                    rubrosTempRegistro = rubrosTempRegistro.filter(r => r !== rubro);
                    btn.classList.remove('selected');
                } else {
                    rubrosTempRegistro.push(rubro);
                    btn.classList.add('selected');
                }
                actualizarListaRubrosRegistro();
            });
        });
    }
    actualizarListaRubrosRegistro();
}

function actualizarListaRubrosRegistro() {
    const listaSpan = document.getElementById('rubros-lista-registro');
    if (listaSpan) {
        if (rubrosTempRegistro.length === 0) {
            listaSpan.textContent = 'Ninguno';
        } else {
            listaSpan.textContent = rubrosTempRegistro.join(', ');
        }
    }
}

function mostrarPanelRecuperacion() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('recover-panel').classList.add('active');
}

function mostrarPanelLogin() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('login-panel').classList.add('active');
}

async function login() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    try {
        mostrarToast('Validando credenciales...', 'info');
        const response = await callAPI('loginVendedor', { email, password }, true);
        if (response.success && response.vendedor) {
            vendedorActual = response.vendedor;
            const rememberMe = document.getElementById('remember-me')?.checked || false;
            if (rememberMe) {
                localStorage.setItem('want_sesion', JSON.stringify({
                    id: vendedorActual.id,
                    email: vendedorActual.email,
                    nombre: vendedorActual.nombre
                }));
            } else {
                guardarSesion(vendedorActual);
            }
            await iniciarPanel(vendedorActual);
            mostrarToast(`Bienvenido ${vendedorActual.nombre}`, 'success');
        } else {
            throw new Error(response.error || 'Email o contraseña incorrectos');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

async function registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile, rubros) {
    console.log('📝 Registrando vendedor:', { nombre, email, rubros });
    let logoUrl = null;
    if (logoFile) {
        logoUrl = await subirImagenACloudinary(logoFile);
        if (!logoUrl) {
            mostrarToast('Error al subir el logo', 'error');
            return false;
        }
    }
    const response = await postAPI('registrarVendedor', {
        nombre,
        email,
        telefono,
        direccion,
        horario,
        password,
        logo_url: logoUrl,
        rubros
    });
    console.log('Respuesta registro:', response);
    return response;
}

// ===================================================
// INICIALIZACIÓN DEL PANEL
// ===================================================

async function iniciarPanel(vendedor) {
    console.log('🎯 Iniciando panel para:', vendedor.nombre);
    
    const adminAuth = document.getElementById('admin-auth');
    const adminPanel = document.getElementById('admin-panel');
    const headerAdmin = document.getElementById('header-admin');
    
    if (adminAuth) adminAuth.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'block';
    if (headerAdmin) headerAdmin.style.display = 'block';
    
    const headerNombreNegocio = document.getElementById('header-nombre-negocio');
    if (headerNombreNegocio) headerNombreNegocio.textContent = vendedor.nombre;
    
    const headerLogoImg = document.getElementById('header-logo-img');
    if (headerLogoImg && vendedor.logo_url) {
        headerLogoImg.src = vendedor.logo_url;
        headerLogoImg.style.display = 'block';
    }
    
    actualizarUIEstadoAbierto();
    
    await cargarPedidos();
    await cargarProductos();
    await cargarDeliveries();
    actualizarReportes();
    
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            await withLoading(btnRefresh, async () => {
                await cargarPedidos(true);
                await cargarProductos(true);
                await cargarDeliveries(true);
                actualizarReportes();
                mostrarToast('Datos actualizados', 'success');
            });
        });
    }
    
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
    
    const mobileLogout = document.getElementById('mobile-logout-btn');
    if (mobileLogout) mobileLogout.addEventListener('click', cerrarSesion);
    
    const btnOpenProfile = document.getElementById('btn-open-profile');
    if (btnOpenProfile) btnOpenProfile.addEventListener('click', abrirModalPerfil);
    
    const btnAgregarProducto = document.getElementById('btn-agregar-producto');
    if (btnAgregarProducto) btnAgregarProducto.addEventListener('click', () => abrirModalProducto());
    
    const btnAgregarDelivery = document.getElementById('btn-agregar-delivery');
    if (btnAgregarDelivery) btnAgregarDelivery.addEventListener('click', () => abrirModalDelivery());
    
    const btnNuevoPedido = document.getElementById('btn-nuevo-pedido');
    if (btnNuevoPedido) btnNuevoPedido.addEventListener('click', () => abrirModalNuevoPedido());
    
    const btnGuardarProducto = document.getElementById('guardar-producto');
    if (btnGuardarProducto) btnGuardarProducto.addEventListener('click', guardarProducto);
    
    const btnGuardarDelivery = document.getElementById('guardar-delivery');
    if (btnGuardarDelivery) btnGuardarDelivery.addEventListener('click', guardarDelivery);
    
    const btnGuardarEditarPedido = document.getElementById('guardar-editar-pedido');
    if (btnGuardarEditarPedido) btnGuardarEditarPedido.addEventListener('click', guardarEditarPedido);
    
    const btnGuardarNuevoPedido = document.getElementById('guardar-nuevo-pedido');
    if (btnGuardarNuevoPedido) btnGuardarNuevoPedido.addEventListener('click', guardarNuevoPedido);
    
    const btnConfirmarAgregarProducto = document.getElementById('btn-confirmar-agregar-producto');
    if (btnConfirmarAgregarProducto) btnConfirmarAgregarProducto.addEventListener('click', confirmarAgregarProducto);
    
    const btnEnviarDelivery = document.getElementById('btn-enviar-delivery');
    if (btnEnviarDelivery) btnEnviarDelivery.addEventListener('click', enviarPedidoADelivery);
    
    const btnConfirmarTiempo = document.getElementById('btn-confirmar-tiempo');
    if (btnConfirmarTiempo) btnConfirmarTiempo.addEventListener('click', enviarConfirmacionWhatsApp);
    
    const btnCancelarTiempo = document.getElementById('btn-cancelar-tiempo');
    if (btnCancelarTiempo) btnCancelarTiempo.addEventListener('click', () => cerrarModalConZIndex('modal-tiempo-entrega'));
    
    const cerrarModalTiempoBtn = document.getElementById('cerrar-modal-tiempo');
    if (cerrarModalTiempoBtn) cerrarModalTiempoBtn.addEventListener('click', () => cerrarModalConZIndex('modal-tiempo-entrega'));
    
    const btnAgregarProductoEditar = document.getElementById('btn-agregar-producto-editar');
    if (btnAgregarProductoEditar) {
        btnAgregarProductoEditar.addEventListener('click', () => {
            abrirModalSeleccionarProducto(productosTempEdit, (prod) => {
                const existente = productosTempEdit.find(p => p.id === prod.id);
                if (existente) {
                    existente.cantidad += prod.cantidad;
                } else {
                    productosTempEdit.push(prod);
                }
                renderizarProductosEditar();
                actualizarTotalEdit();
            });
        });
    }
    
    const btnAgregarProductoNuevo = document.getElementById('btn-agregar-producto-nuevo');
    if (btnAgregarProductoNuevo) {
        btnAgregarProductoNuevo.addEventListener('click', () => {
            abrirModalSeleccionarProducto(productosTempNuevo, (prod) => {
                const existente = productosTempNuevo.find(p => p.id === prod.id);
                if (existente) {
                    existente.cantidad += prod.cantidad;
                } else {
                    productosTempNuevo.push(prod);
                }
                renderizarProductosNuevo();
                actualizarTotalNuevo();
            });
        });
    }
    
    const toggleSwitch = document.getElementById('toggle-estado-switch');
    if (toggleSwitch) toggleSwitch.addEventListener('change', toggleEstadoAbierto);
    
    inicializarTabs();
    inicializarFiltros();
    inicializarMenuAdmin();
    inicializarBuscador();
    inicializarMenuHamburguesa();
    inicializarNotificacionesVendedor();
}

function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tabContent = document.getElementById(`tab-${tabId}`);
            if (tabContent) tabContent.classList.add('active');
            if (tabId === 'productos') cargarProductos();
            if (tabId === 'delivery') cargarDeliveries();
            if (tabId === 'reportes') actualizarReportes();
        });
    });
}

function inicializarFiltros() {
    const filtros = document.querySelectorAll('.filtro-btn');
    filtros.forEach(btn => {
        btn.addEventListener('click', () => {
            filtros.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActual = btn.getAttribute('data-estado');
            renderizarPedidos();
        });
    });
}

function inicializarMenuAdmin() {
    const toggle = document.getElementById('menu-toggle-admin');
    const menu = document.getElementById('mobile-menu-admin');
    const overlay = document.getElementById('menu-overlay-admin');
    const close = document.getElementById('menu-close-admin');
    
    function closeMenu() {
        if (menu) menu.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function openMenu() {
        if (menu) menu.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    if (toggle) toggle.onclick = openMenu;
    if (close) close.onclick = closeMenu;
    if (overlay) overlay.onclick = closeMenu;
    
    const mobileTabs = document.querySelectorAll('.mobile-tab-btn');
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            mobileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-btn').forEach(t => {
                t.classList.remove('active');
                if (t.getAttribute('data-tab') === tabId) t.classList.add('active');
            });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tabContent = document.getElementById(`tab-${tabId}`);
            if (tabContent) tabContent.classList.add('active');
            if (tabId === 'productos') cargarProductos();
            if (tabId === 'delivery') cargarDeliveries();
            if (tabId === 'reportes') actualizarReportes();
            closeMenu();
        });
    });
}

function inicializarBuscador() {
    const buscadorInput = document.getElementById('buscador-pedidos');
    const limpiarBtn = document.getElementById('btn-limpiar-busqueda');
    if (buscadorInput) {
        buscadorInput.addEventListener('input', (e) => {
            terminoBusqueda = e.target.value;
            renderizarPedidos();
        });
    }
    if (limpiarBtn) {
        limpiarBtn.addEventListener('click', () => {
            if (buscadorInput) {
                buscadorInput.value = '';
                terminoBusqueda = '';
                renderizarPedidos();
                mostrarToast('Búsqueda limpiada', 'info');
            }
        });
    }
}

// ===================================================
// FUNCIONES DE DESCRIPCIÓN (BOTÓN APARTE)
// ===================================================

async function guardarSoloDescripcion() {
    console.log('🖊️ Guardando solo descripción...');
    
    let vendedorId = null;
    const vendedorSesion = sessionStorage.getItem('vendedor_sesion');
    if (vendedorSesion) {
        try {
            const vendedor = JSON.parse(vendedorSesion);
            vendedorId = vendedor.id;
        } catch(e) {}
    }
    
    if (!vendedorId && vendedorActual) {
        vendedorId = vendedorActual.id;
    }
    
    if (!vendedorId) {
        mostrarToast('Error: No hay sesión activa', 'error');
        return;
    }
    
    const descripcion = document.getElementById('perfil-descripcion').value;
    const statusSpan = document.getElementById('descripcion-status');
    
    if (statusSpan) {
        statusSpan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        statusSpan.style.color = '#007bff';
    }
    
    try {
        const result = await window.callAPI('actualizarVendedor', {
            id: parseInt(vendedorId),
            descripcion: descripcion
        });
        
        if (result.success) {
            if (statusSpan) {
                statusSpan.innerHTML = '<i class="fas fa-check-circle"></i> ¡Descripción guardada!';
                statusSpan.style.color = 'green';
                setTimeout(() => statusSpan.innerHTML = '', 3000);
            }
            mostrarToast('Descripción guardada correctamente', 'success');
            if (vendedorActual) vendedorActual.descripcion = descripcion;
        } else {
            if (statusSpan) {
                statusSpan.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error: ' + (result.error || 'No se pudo guardar');
                statusSpan.style.color = 'red';
            }
            mostrarToast('Error al guardar descripción', 'error');
        }
    } catch (error) {
        console.error('❌ Error guardando descripción:', error);
        if (statusSpan) {
            statusSpan.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error de conexión';
            statusSpan.style.color = 'red';
        }
    }
}

function inicializarBotonDescripcion() {
    const btn = document.getElementById('btn-guardar-descripcion');
    if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            guardarSoloDescripcion();
        });
    }
}

function observarModalPerfil() {
    const modalPerfil = document.getElementById('modal-perfil');
    if (modalPerfil) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class') {
                    if (modalPerfil.classList.contains('active')) {
                        setTimeout(inicializarBotonDescripcion, 200);
                    }
                }
            });
        });
        observer.observe(modalPerfil, { attributes: true });
    } else {
        setTimeout(observarModalPerfil, 500);
    }
}

setTimeout(observarModalPerfil, 1000);

document.addEventListener('click', function(e) {
    if (e.target.id === 'btn-open-profile' || e.target.closest('#btn-open-profile')) {
        setTimeout(inicializarBotonDescripcion, 300);
    }
});

// ===================================================
// FUNCIONES DE VER PEDIDO COMPLETO
// ===================================================

function verPedidoCompleto(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    const fecha = new Date(pedido.fecha);
    const metodoPago = pedido.metodo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo';
    const numeroMostrar = pedido.numero_orden || pedido.id;
    
    let productosHTML = '';
    if (pedido.productos && Array.isArray(pedido.productos) && pedido.productos.length > 0) {
        pedido.productos.forEach(pr => {
            productosHTML += `<div class="producto-detalle"><span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span><span>${formatearPrecio(pr.precio * pr.cantidad)}</span></div>`;
        });
    } else {
        productosHTML = '<p>No hay productos</p>';
    }
    
    let detallesHTML = '';
    if (pedido.detalles && pedido.detalles.trim()) {
        detallesHTML = `<div class="detalle-seccion"><strong><i class="fas fa-pen"></i> Detalles del pedido:</strong><p>${escapeHTML(pedido.detalles)}</p></div>`;
    }
    
    const modalContent = `
        <div class="modal" id="modal-pedido-completo" style="display: flex;">
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header">
                    <h3><i class="fas fa-receipt"></i> Pedido #${numeroMostrar}</h3>
                    <button class="modal-close" onclick="cerrarModalPedidoCompleto()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detalle-seccion"><strong><i class="fas fa-calendar"></i> Fecha:</strong><p>${fecha.toLocaleString('es-AR')}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-user"></i> Cliente:</strong><p>${escapeHTML(pedido.cliente_nombre || 'Sin nombre')}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-phone"></i> Teléfono:</strong><p>${pedido.cliente_telefono || 'Sin teléfono'}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong><p>${escapeHTML(pedido.direccion || 'Sin dirección')}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-money-bill-wave"></i> Método de pago:</strong><p>${metodoPago}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-box"></i> Productos:</strong><div class="productos-detalle">${productosHTML}</div></div>
                    ${detallesHTML}
                    <div class="detalle-seccion total"><strong><i class="fas fa-calculator"></i> Total:</strong><p class="total-monto">${formatearPrecio(pedido.total || 0)}</p></div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="cerrarModalPedidoCompleto()">Cerrar</button>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('modal-pedido-completo');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalContent);
    const modal = document.getElementById('modal-pedido-completo');
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModalPedidoCompleto(); });
}

function cerrarModalPedidoCompleto() {
    const modal = document.getElementById('modal-pedido-completo');
    if (modal) modal.remove();
}

function verPedidoCompletoMovil(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    const fecha = new Date(pedido.fecha);
    const metodoPago = pedido.metodo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo';
    const numeroMostrar = pedido.numero_orden || pedido.id;
    const estado = pedido.estado || 'preparando';
    
    let productosHTML = '';
    if (pedido.productos && Array.isArray(pedido.productos) && pedido.productos.length > 0) {
        pedido.productos.forEach(pr => {
            productosHTML += `<div class="producto-detalle"><span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span><span>${formatearPrecio(pr.precio * pr.cantidad)}</span></div>`;
        });
    } else {
        productosHTML = '<p>No hay productos</p>';
    }
    
    let detallesHTML = '';
    if (pedido.detalles && pedido.detalles.trim()) {
        detallesHTML = `<div class="detalle-seccion"><strong><i class="fas fa-pen"></i> Detalles:</strong><p>${escapeHTML(pedido.detalles)}</p></div>`;
    }
    
    let botonesAccion = '';
    if (estado === 'preparando') {
        botonesAccion = `
            <button class="btn-tabla btn-whatsapp" onclick="confirmarPedidoWhatsApp(${pedido.id}, this)"><i class="fab fa-whatsapp"></i> Confirmar</button>
            <button class="btn-tabla btn-preparar" onclick="actualizarEstado(${pedido.id}, 'en preparacion', this)"><i class="fas fa-utensils"></i> Preparar</button>
            <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
        `;
    } else if (estado === 'en preparacion') {
        botonesAccion = `
            <button class="btn-tabla btn-pedido-listo" onclick="abrirModalAsignarDelivery(${pedido.id})"><i class="fas fa-check-circle"></i> Listo</button>
            <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
        `;
    } else if (estado === 'en camino') {
        botonesAccion = `
            <button class="btn-tabla btn-notificar" onclick="notificarEnCamino(${pedido.id}, this)"><i class="fab fa-whatsapp"></i> Notificar</button>
            <button class="btn-tabla btn-entregar" onclick="actualizarEstado(${pedido.id}, 'entregado', this)"><i class="fas fa-check-double"></i> Entregar</button>
            <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
        `;
    } else if (estado === 'entregado') {
        botonesAccion = `
            <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
        `;
    }
    
    const modalContent = `
        <div class="modal" id="modal-pedido-completo-movil" style="display: flex;">
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header">
                    <h3><i class="fas fa-receipt"></i> Pedido #${numeroMostrar}</h3>
                    <button class="modal-close" onclick="cerrarModalPedidoCompletoMovil()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detalle-seccion"><strong><i class="fas fa-calendar"></i> Fecha:</strong><p>${fecha.toLocaleString('es-AR')}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-user"></i> Cliente:</strong><p>${escapeHTML(pedido.cliente_nombre || 'Sin nombre')}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-phone"></i> Teléfono:</strong><p>${pedido.cliente_telefono || 'Sin teléfono'}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong><p>${escapeHTML(pedido.direccion || 'Sin dirección')}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-money-bill-wave"></i> Pago:</strong><p>${metodoPago}</p></div>
                    <div class="detalle-seccion"><strong><i class="fas fa-box"></i> Productos:</strong><div class="productos-detalle">${productosHTML}</div></div>
                    ${detallesHTML}
                    <div class="detalle-seccion total"><strong><i class="fas fa-calculator"></i> Total:</strong><p class="total-monto">${formatearPrecio(pedido.total || 0)}</p></div>
                </div>
                <div class="modal-footer" style="flex-wrap: wrap; gap: 8px;">
                    ${botonesAccion}
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('modal-pedido-completo-movil');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalContent);
    const modal = document.getElementById('modal-pedido-completo-movil');
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModalPedidoCompletoMovil(); });
}

function cerrarModalPedidoCompletoMovil() {
    const modal = document.getElementById('modal-pedido-completo-movil');
    if (modal) modal.remove();
}

// ===================================================
// FUNCIONES DE ASIGNAR DELIVERY
// ===================================================

function abrirModalAsignarDelivery(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    pedidoParaAsignar = pedido;
    document.getElementById('asignar-pedido-id').textContent = pedido.numero_orden || pedido.id;
    document.getElementById('asignar-cliente-nombre').textContent = pedido.cliente_nombre;
    document.getElementById('asignar-total').textContent = formatearPrecio(pedido.total);
    const select = document.getElementById('select-delivery');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar...</option>';
        deliveries.forEach(d => {
            select.innerHTML += `<option value="${d.id}" data-telefono="${d.telefono}" data-nombre="${escapeHTML(d.nombre)}">${escapeHTML(d.nombre)} - ${d.telefono}</option>`;
        });
    }
    abrirModalConZIndex('modal-asignar-delivery');
}

function cerrarModalAsignarDelivery() {
    cerrarModalConZIndex('modal-asignar-delivery');
    pedidoParaAsignar = null;
}

async function enviarPedidoADelivery() {
    const select = document.getElementById('select-delivery');
    const selectedOption = select.options[select.selectedIndex];
    const deliveryTelefono = selectedOption?.getAttribute('data-telefono');
    const deliveryNombre = selectedOption?.getAttribute('data-nombre');
    if (!deliveryTelefono || !pedidoParaAsignar) {
        mostrarToast('Selecciona un delivery', 'error');
        return;
    }
    const pedido = pedidoParaAsignar;
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `*NUEVO PEDIDO PARA ENTREGAR*\n\nHola ${deliveryNombre},\n\nTienes un nuevo pedido:\n\n━━━━━━━━━━━━━━━━━━━━\n*PEDIDO #${pedido.numero_orden || pedido.id}*\n━━━━━━━━━━━━━━━━━━━━\n*Cliente:* ${pedido.cliente_nombre}\n*Teléfono:* ${pedido.cliente_telefono}\n*Dirección:* ${pedido.direccion}\n\n*Productos:*\n`;
    pedido.productos.forEach(p => { mensaje += `• ${p.cantidad}x ${p.nombre}\n`; });
    if (pedido.detalles) mensaje += `\n*Indicaciones:* ${pedido.detalles}\n`;
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n*Total:* $${pedido.total.toLocaleString('es-AR')}\n`;
    mensaje += metodoPagoTexto === 'transferencia' ? '*PAGO:* Transferencia bancaria (YA REALIZADA)' : `*PAGO:* Efectivo - *DEBES COBRAR $${pedido.total.toLocaleString('es-AR')}*`;
    
    window.open(`https://wa.me/${deliveryTelefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
    await actualizarEstado(pedido.id, 'en camino', { disabled: false, innerHTML: '' });
    mostrarToast(`Pedido #${pedido.numero_orden || pedido.id} asignado`, 'success');
    cerrarModalAsignarDelivery();
}

// ===================================================
// FUNCIONES DE CIERRE DE MODALES (GLOBALES)
// ===================================================

window.cerrarModal = function(modalId) {
    cerrarModalConZIndex(modalId);
};

window.cerrarModalRubros = cerrarModalRubros;
window.cerrarModalPerfil = cerrarModalPerfil;
window.cerrarModalProducto = cerrarModalProducto;
window.cerrarModalDelivery = cerrarModalDelivery;
window.cerrarModalEditarPedido = cerrarModalEditarPedido;
window.cerrarModalNuevoPedido = cerrarModalNuevoPedido;
window.cerrarModalSeleccionarProducto = cerrarModalSeleccionarProducto;
window.cerrarModalTiempo = () => cerrarModalConZIndex('modal-tiempo-entrega');
window.cerrarModalAsignarDelivery = cerrarModalAsignarDelivery;
window.cerrarModalPedidoCompleto = cerrarModalPedidoCompleto;
window.cerrarModalPedidoCompletoMovil = cerrarModalPedidoCompletoMovil;

// ===================================================
// EXPOSICIÓN DE FUNCIONES GLOBALES
// ===================================================

window.login = login;
window.registrarVendedorConLogo = registrarVendedorConLogo;
window.mostrarPanelRegistro = mostrarPanelRegistro;
window.mostrarPanelRecuperacion = mostrarPanelRecuperacion;
window.mostrarPanelLogin = mostrarPanelLogin;
window.cargarPedidos = cargarPedidos;
window.cargarProductos = cargarProductos;
window.cargarDeliveries = cargarDeliveries;
window.abrirModalRubros = abrirModalRubros;
window.confirmarRubros = confirmarRubros;
window.toggleEstadoAbierto = toggleEstadoAbierto;
window.actualizarEstado = actualizarEstado;
window.cancelarPedido = cancelarPedido;
window.confirmarPedidoWhatsApp = confirmarPedidoWhatsApp;
window.notificarEnCamino = notificarEnCamino;
window.abrirModalEditarPedido = abrirModalEditarPedido;
window.modificarCantidadProductoEdit = modificarCantidadProductoEdit;
window.eliminarProductoEdit = eliminarProductoEdit;
window.modificarCantidadProductoNuevo = modificarCantidadProductoNuevo;
window.eliminarProductoNuevo = eliminarProductoNuevo;
window.abrirModalDelivery = abrirModalDelivery;
window.guardarDelivery = guardarDelivery;
window.eliminarDelivery = eliminarDelivery;
window.whatsappDelivery = whatsappDelivery;
window.abrirModalProducto = abrirModalProducto;
window.guardarProducto = guardarProducto;
window.eliminarProducto = eliminarProducto;
window.abrirModalPerfil = abrirModalPerfil;
window.verPedidoCompleto = verPedidoCompleto;
window.verPedidoCompletoMovil = verPedidoCompletoMovil;
window.enviarConfirmacionWhatsApp = enviarConfirmacionWhatsApp;
window.abrirModalAsignarDelivery = abrirModalAsignarDelivery;
window.enviarPedidoADelivery = enviarPedidoADelivery;
window.guardarEditarPedido = guardarEditarPedido;
window.guardarNuevoPedido = guardarNuevoPedido;
window.abrirModalNuevoPedido = abrirModalNuevoPedido;
window.confirmarAgregarProducto = confirmarAgregarProducto;
window.guardarSoloDescripcion = guardarSoloDescripcion;

// ===================================================
// DOM CONTENT LOADED
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, configurando event listeners');
    
    const sesion = cargarSesionGuardada();
    if (!sesion) {
        const adminAuth = document.getElementById('admin-auth');
        if (adminAuth) adminAuth.style.display = 'flex';
    }
    
    window.addEventListener('resize', () => {
        if (pedidos.length > 0) renderizarPedidos();
    });
    
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.getAttribute('data-target'));
            if (input) {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                btn.querySelector('i').classList.toggle('fa-eye');
                btn.querySelector('i').classList.toggle('fa-eye-slash');
            }
        });
    });
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await login();
        });
    }
    
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('reg-nombre')?.value.trim() || '';
            const email = document.getElementById('reg-email')?.value.trim() || '';
            const telefono = document.getElementById('reg-telefono')?.value.trim() || '';
            const direccion = document.getElementById('reg-direccion')?.value.trim() || '';
            const horario = document.getElementById('reg-horario')?.value.trim() || '';
            const password = document.getElementById('reg-password')?.value || '';
            const password2 = document.getElementById('reg-password2')?.value || '';
            const logoFile = document.getElementById('reg-logo')?.files[0];
            const rubrosSeleccionados = rubrosTempRegistro;
            
            if (password !== password2) {
                alert('Las contraseñas no coinciden');
                return;
            }
            if (password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres');
                return;
            }
            if (rubrosSeleccionados.length === 0) {
                alert('Selecciona al menos un rubro');
                return;
            }
            
            const response = await registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile, rubrosSeleccionados);
            if (response && response.success) {
                alert('Registro exitoso. Ahora podés iniciar sesión.');
                mostrarPanelLogin();
                registerForm.reset();
                rubrosTempRegistro = [];
                document.getElementById('login-email').value = email;
            } else {
                alert(response?.error || 'Error al registrar');
            }
        });
        
        const regLogo = document.getElementById('reg-logo');
        if (regLogo) {
            regLogo.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const preview = document.getElementById('reg-logo-preview');
                        if (preview) preview.innerHTML = `<img src="${ev.target.result}" style="max-width: 80px; border-radius: 12px;">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }
    
    const showRegister = document.getElementById('btn-show-register');
    if (showRegister) showRegister.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelRegistro(); });
    
    const showRecover = document.getElementById('btn-show-recover');
    if (showRecover) showRecover.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelRecuperacion(); });
    
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) backToLogin.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelLogin(); });
    
    const backToLoginRecover = document.getElementById('back-to-login-recover');
    if (backToLoginRecover) backToLoginRecover.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelLogin(); });
});

// ===================================================
// FUNCIÓN ESPECÍFICA PARA EL MENÚ HAMBURGUESA (MÓVIL)
// ===================================================

function inicializarMenuHamburguesa() {
    const toggleBtn = document.getElementById('menu-toggle-admin');
    const mobileMenu = document.getElementById('mobile-menu-admin');
    const overlay = document.getElementById('menu-overlay-admin');
    const closeBtn = document.getElementById('menu-close-admin');
    
    function abrirMenu() {
        if (mobileMenu) {
            mobileMenu.style.display = 'flex';
            mobileMenu.classList.add('active');
        }
        if (overlay) {
            overlay.style.display = 'block';
            overlay.classList.add('active');
        }
        document.body.style.overflow = 'hidden';
    }
    
    function cerrarMenu() {
        if (mobileMenu) {
            mobileMenu.style.display = 'none';
            mobileMenu.classList.remove('active');
        }
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('active');
        }
        document.body.style.overflow = '';
    }
    
    if (toggleBtn) {
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
        
        newToggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🍔 Botón hamburguesa clickeado');
            abrirMenu();
        });
    }
    
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            cerrarMenu();
        });
    }
    
    if (overlay) {
        const newOverlay = overlay.cloneNode(true);
        overlay.parentNode.replaceChild(newOverlay, overlay);
        
        newOverlay.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            cerrarMenu();
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarMenu();
        }
    });
    
    console.log('✅ Menú hamburguesa inicializado correctamente');
}
// ===================================================
// SOBRESCRIBIR FUNCIONES DE MODALES PARA QUE FUNCIONEN CORRECTAMENTE
// ===================================================

// Guardar referencia a las funciones originales
const originalAbrirModalEditarPedido = window.abrirModalEditarPedido;
const originalVerPedidoCompleto = window.verPedidoCompleto;
const originalVerPedidoCompletoMovil = window.verPedidoCompletoMovil;

// Nueva función para abrir modal de editar pedido cerrando el anterior
window.abrirModalEditarPedido = function(pedidoId) {
    // Primero cerrar el modal de detalle del pedido si está abierto
    const modalDetalle = document.getElementById('modal-pedido-completo');
    if (modalDetalle && modalDetalle.style.display === 'flex') {
        cerrarModalConZIndex('modal-pedido-completo');
    }
    
    const modalDetalleMovil = document.getElementById('modal-pedido-completo-movil');
    if (modalDetalleMovil && modalDetalleMovil.style.display === 'flex') {
        modalDetalleMovil.remove();
    }
    
    // Llamar a la función original después de un pequeño retraso
    setTimeout(() => {
        if (originalAbrirModalEditarPedido) {
            originalAbrirModalEditarPedido(pedidoId);
        } else {
            // Si no existe la función original, usar la nuestra
            const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
            if (!pedido) return;
            
            productosTempEdit = JSON.parse(JSON.stringify(pedido.productos || []));
            document.getElementById('edit-pedido-id').value = pedido.id;
            document.getElementById('edit-pedido-id-display').textContent = pedido.numero_orden || pedido.id;
            document.getElementById('edit-cliente-nombre').value = pedido.cliente_nombre || '';
            document.getElementById('edit-cliente-telefono').value = pedido.cliente_telefono || '';
            document.getElementById('edit-direccion').value = pedido.direccion || '';
            document.getElementById('edit-detalles').value = pedido.detalles || '';
            document.getElementById('edit-metodo-pago').value = pedido.metodo_pago || 'efectivo';
            document.getElementById('edit-estado').value = pedido.estado || 'preparando';
            
            renderizarProductosEditar();
            actualizarTotalEdit();
            
            abrirModalConZIndex('modal-editar-pedido');
        }
    }, 100);
};

// Nueva función para ver pedido completo (versión móvil)
window.verPedidoCompletoMovil = function(pedidoId) {
    // Cerrar cualquier modal de edición abierto
    const modalEditar = document.getElementById('modal-editar-pedido');
    if (modalEditar && modalEditar.classList.contains('active')) {
        cerrarModalConZIndex('modal-editar-pedido');
    }
    
    if (originalVerPedidoCompletoMovil) {
        originalVerPedidoCompletoMovil(pedidoId);
    } else {
        // Versión simplificada
        const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
        if (!pedido) return;
        
        const fecha = new Date(pedido.fecha);
        const metodoPago = pedido.metodo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo';
        const numeroMostrar = pedido.numero_orden || pedido.id;
        
        let productosHTML = '';
        if (pedido.productos && Array.isArray(pedido.productos) && pedido.productos.length > 0) {
            pedido.productos.forEach(pr => {
                productosHTML += `<div class="producto-detalle"><span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span><span>${formatearPrecio(pr.precio * pr.cantidad)}</span></div>`;
            });
        } else {
            productosHTML = '<p>No hay productos</p>';
        }
        
        let detallesHTML = '';
        if (pedido.detalles && pedido.detalles.trim()) {
            detallesHTML = `<div class="detalle-seccion"><strong><i class="fas fa-pen"></i> Detalles:</strong><p>${escapeHTML(pedido.detalles)}</p></div>`;
        }
        
        const estado = pedido.estado || 'preparando';
        let botonesAccion = '';
        
        if (estado === 'preparando') {
            botonesAccion = `
                <button class="btn-tabla btn-whatsapp" onclick="confirmarPedidoWhatsApp(${pedido.id}, this)"><i class="fab fa-whatsapp"></i> Confirmar</button>
                <button class="btn-tabla btn-preparar" onclick="actualizarEstado(${pedido.id}, 'en preparacion', this)"><i class="fas fa-utensils"></i> Preparar</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        } else if (estado === 'en preparacion') {
            botonesAccion = `
                <button class="btn-tabla btn-pedido-listo" onclick="abrirModalAsignarDelivery(${pedido.id})"><i class="fas fa-check-circle"></i> Listo</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        } else if (estado === 'en camino') {
            botonesAccion = `
                <button class="btn-tabla btn-notificar" onclick="notificarEnCamino(${pedido.id}, this)"><i class="fab fa-whatsapp"></i> Notificar</button>
                <button class="btn-tabla btn-entregar" onclick="actualizarEstado(${pedido.id}, 'entregado', this)"><i class="fas fa-check-double"></i> Entregar</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        } else if (estado === 'entregado') {
            botonesAccion = `
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${pedido.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${pedido.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
            `;
        }
        
        const modalContent = `
            <div class="modal" id="modal-pedido-completo-movil" style="display: flex; z-index: 10100;">
                <div class="modal-content" style="max-width: 550px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-receipt"></i> Pedido #${numeroMostrar}</h3>
                        <button class="modal-close" onclick="cerrarModalPedidoCompletoMovil()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detalle-seccion"><strong><i class="fas fa-calendar"></i> Fecha:</strong><p>${fecha.toLocaleString('es-AR')}</p></div>
                        <div class="detalle-seccion"><strong><i class="fas fa-user"></i> Cliente:</strong><p>${escapeHTML(pedido.cliente_nombre || 'Sin nombre')}</p></div>
                        <div class="detalle-seccion"><strong><i class="fas fa-phone"></i> Teléfono:</strong><p>${pedido.cliente_telefono || 'Sin teléfono'}</p></div>
                        <div class="detalle-seccion"><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong><p>${escapeHTML(pedido.direccion || 'Sin dirección')}</p></div>
                        <div class="detalle-seccion"><strong><i class="fas fa-money-bill-wave"></i> Pago:</strong><p>${metodoPago}</p></div>
                        <div class="detalle-seccion"><strong><i class="fas fa-box"></i> Productos:</strong><div class="productos-detalle">${productosHTML}</div></div>
                        ${detallesHTML}
                        <div class="detalle-seccion total"><strong><i class="fas fa-calculator"></i> Total:</strong><p class="total-monto">${formatearPrecio(pedido.total || 0)}</p></div>
                    </div>
                    <div class="modal-footer" style="flex-wrap: wrap; gap: 8px;">
                        ${botonesAccion}
                    </div>
                </div>
            </div>
        `;
        
        const existingModal = document.getElementById('modal-pedido-completo-movil');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalContent);
        const modal = document.getElementById('modal-pedido-completo-movil');
        modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModalPedidoCompletoMovil(); });
    }
};

// También mejorar la función de cerrar modales para asegurar que se limpia bien
const originalCerrarModalPedidoCompleto = window.cerrarModalPedidoCompleto;
window.cerrarModalPedidoCompleto = function() {
    if (originalCerrarModalPedidoCompleto) {
        originalCerrarModalPedidoCompleto();
    }
    const modal = document.getElementById('modal-pedido-completo');
    if (modal) modal.remove();
};

const originalCerrarModalPedidoCompletoMovil = window.cerrarModalPedidoCompletoMovil;
window.cerrarModalPedidoCompletoMovil = function() {
    if (originalCerrarModalPedidoCompletoMovil) {
        originalCerrarModalPedidoCompletoMovil();
    }
    const modal = document.getElementById('modal-pedido-completo-movil');
    if (modal) modal.remove();
};

console.log('✅ Modales corregidos - los nuevos modales se abren por encima');

console.log('✅ admin.js cargado completamente');

// ===================================================
// NOTIFICACIONES Y NUEVAS FUNCIONALIDADES
// ===================================================

// ===================================================
// 1. NOTIFICACIONES PARA VENDEDOR
// ===================================================

let notificacionesVendedor = [];
let notificacionesPanelAbierto = false;

function obtenerNotificacionesVendedor() {
    const saved = localStorage.getItem('want_notificaciones_vendedor');
    if (saved) {
        try {
            notificacionesVendedor = JSON.parse(saved);
        } catch(e) {
            notificacionesVendedor = [];
        }
    }
    return notificacionesVendedor;
}

function guardarNotificacionesVendedor() {
    localStorage.setItem('want_notificaciones_vendedor', JSON.stringify(notificacionesVendedor));
}

function agregarNotificacionVendedor(mensaje, tipo = 'info') {
    const notificacion = {
        id: Date.now(),
        mensaje: mensaje,
        tipo: tipo,
        leida: false,
        fecha: new Date().toISOString()
    };
    notificacionesVendedor.unshift(notificacion);
    if (notificacionesVendedor.length > 50) notificacionesVendedor.pop();
    guardarNotificacionesVendedor();
    actualizarContadorNotificacionesVendedor();
    
    // Reproducir sonido
    try {
        const audio = document.getElementById('notificacion-sound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Error al reproducir sonido:', e));
        }
    } catch(e) {}
    
    mostrarToast(mensaje, 'info');
}

function actualizarContadorNotificacionesVendedor() {
    const noLeidas = notificacionesVendedor.filter(n => !n.leida).length;
    const contador = document.getElementById('notificaciones-count');
    if (contador) {
        if (noLeidas > 0) {
            contador.textContent = noLeidas > 99 ? '99+' : noLeidas;
            contador.style.display = 'flex';
        } else {
            contador.style.display = 'none';
        }
    }
}

function toggleNotificacionesVendedor() {
    const panel = document.getElementById('notificaciones-panel');
    if (!panel) return;
    
    if (notificacionesPanelAbierto) {
        panel.classList.remove('active');
        notificacionesPanelAbierto = false;
    } else {
        renderizarNotificacionesVendedor();
        panel.classList.add('active');
        notificacionesPanelAbierto = true;
    }
}

function cerrarPanelNotificacionesVendedor() {
    const panel = document.getElementById('notificaciones-panel');
    if (panel) {
        panel.classList.remove('active');
        notificacionesPanelAbierto = false;
    }
}

function renderizarNotificacionesVendedor() {
    const container = document.getElementById('notificaciones-lista');
    if (!container) return;
    
    obtenerNotificacionesVendedor();
    
    if (notificacionesVendedor.length === 0) {
        container.innerHTML = `
            <div class="notificaciones-vacio">
                <i class="fas fa-bell-slash"></i>
                <p>No hay notificaciones</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notificacionesVendedor.map(notif => {
        const fecha = new Date(notif.fecha);
        const fechaStr = fecha.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let icono = 'fa-bell';
        if (notif.tipo === 'pedido') icono = 'fa-box';
        else if (notif.tipo === 'success') icono = 'fa-check-circle';
        else if (notif.tipo === 'error') icono = 'fa-exclamation-circle';
        
        return `
            <div class="notificacion-item ${notif.leida ? 'leida' : ''}" onclick="marcarNotificacionLeidaVendedor(${notif.id})">
                <div class="notificacion-icono">
                    <i class="fas ${icono}"></i>
                </div>
                <div class="notificacion-contenido">
                    <div class="notificacion-mensaje">${escapeHTML(notif.mensaje)}</div>
                    <div class="notificacion-fecha">${fechaStr}</div>
                </div>
            </div>
        `;
    }).join('');
    
    actualizarContadorNotificacionesVendedor();
}

function marcarNotificacionLeidaVendedor(notificacionId) {
    const notif = notificacionesVendedor.find(n => n.id === notificacionId);
    if (notif) {
        notif.leida = true;
        guardarNotificacionesVendedor();
        renderizarNotificacionesVendedor();
        actualizarContadorNotificacionesVendedor();
    }
}

function escucharNuevosPedidos() {
    if (!vendedorActual) return;
    
    setInterval(async () => {
        const response = await callAPI('getPedidos', { vendedorId: vendedorActual.id }, true);
        if (response.success && response.pedidos) {
            const nuevosPedidos = response.pedidos.filter(p => 
                p.estado === 'preparando' && 
                !pedidos.find(existing => existing.id === p.id)
            );
            
            nuevosPedidos.forEach(pedido => {
                agregarNotificacionVendedor(`📦 Nuevo pedido #${pedido.numero_orden || pedido.id} de ${pedido.cliente_nombre}`, 'pedido');
            });
            
            if (nuevosPedidos.length > 0) {
                await cargarPedidos(true);
            }
        }
    }, 30000);
}

function inicializarNotificacionesVendedor() {
    obtenerNotificacionesVendedor();
    actualizarContadorNotificacionesVendedor();
    escucharNuevosPedidos();
}

// ===================================================
// 2. NUEVAS FUNCIONES DE BOTONES
// ===================================================

let pedidoPendienteTiempo = null;
let botonPendienteTiempo = null;

function abrirModalTiempo(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    pedidoPendienteTiempo = pedido;
    botonPendienteTiempo = boton;
    document.getElementById('tiempo-entrega-input').value = '';
    abrirModalConZIndex('modal-tiempo-entrega');
}

function confirmarTiempoYPreparar() {
    const tiempoEntrega = document.getElementById('tiempo-entrega-input')?.value.trim();
    if (!tiempoEntrega) {
        mostrarToast('Ingrese un tiempo estimado de entrega', 'error');
        return;
    }
    if (!pedidoPendienteTiempo) return;
    
    actualizarTiempoEstimado(pedidoPendienteTiempo.id, tiempoEntrega);
    actualizarEstado(pedidoPendienteTiempo.id, 'en preparacion', botonPendienteTiempo);
    
    cerrarModalConZIndex('modal-tiempo-entrega');
    pedidoPendienteTiempo = null;
    botonPendienteTiempo = null;
}

async function actualizarTiempoEstimado(pedidoId, tiempoEstimado) {
    try {
        const { error } = await supabaseClient
            .from('pedidos')
            .update({ tiempo_estimado: tiempoEstimado })
            .eq('id', pedidoId);
        if (error) console.error('Error actualizando tiempo estimado:', error);
    } catch (error) {
        console.error('Error:', error);
    }
}

let pedidoTransferenciaActual = null;

function abrirModalCoordinarTransferencia(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    pedidoTransferenciaActual = pedido;
    document.getElementById('mensaje-transferencia').value = '';
    abrirModalConZIndex('modal-coordinar-transferencia');
}

function cerrarModalCoordinarTransferencia() {
    cerrarModalConZIndex('modal-coordinar-transferencia');
    pedidoTransferenciaActual = null;
}

function enviarCoordinacionTransferencia() {
    if (!pedidoTransferenciaActual) return;
    
    const mensaje = document.getElementById('mensaje-transferencia').value.trim();
    if (!mensaje) {
        mostrarToast('Escriba un mensaje para el cliente', 'error');
        return;
    }
    
    const textoWhatsApp = `*COORDINACIÓN DE PAGO POR TRANSFERENCIA*\n\nHola ${pedidoTransferenciaActual.cliente_nombre},\n\n${mensaje}\n\n*Pedido #${pedidoTransferenciaActual.numero_orden || pedidoTransferenciaActual.id}*\n*Total:* $${pedidoTransferenciaActual.total.toLocaleString('es-AR')}\n\n*Gracias por tu compra!*`;
    
    window.open(`https://wa.me/${pedidoTransferenciaActual.cliente_telefono}?text=${encodeURIComponent(textoWhatsApp)}`, '_blank');
    
    cerrarModalCoordinarTransferencia();
    mostrarToast('Mensaje enviado al cliente', 'success');
}

function notificarClienteEnCamino(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    let mensaje = `*ACTUALIZACIÓN DE TU PEDIDO*\n\nHola ${pedido.cliente_nombre},\n\n*¡Tu pedido está en camino!*\n\n━━━━━━━━━━━━━━━━━━━━\n*DETALLE:*\n`;
    pedido.productos.forEach(p => { mensaje += `• ${p.cantidad}x ${p.nombre}\n`; });
    if (pedido.detalles) mensaje += `\n*INDICACIONES:* ${pedido.detalles}\n`;
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n*DIRECCIÓN:* ${pedido.direccion}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (metodoPagoTexto === 'transferencia') {
        mensaje += `*PAGO:* Transferencia bancaria (YA REALIZADA)`;
    } else {
        mensaje += `*PAGO:* Efectivo - *DEBES PAGAR $${pedido.total.toLocaleString('es-AR')} AL DELIVERY*`;
    }
    
    window.open(`https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
    mostrarToast(`Notificación enviada al cliente`, 'success');
}

function entregarPedido(pedidoId, boton) {
    actualizarEstado(pedidoId, 'entregado', boton);
}

// ===================================================
// 3. SOBREESCRIBIR FUNCIONES DE BOTONES EXISTENTES
// ===================================================

// Modificar la función renderizarPedidosDesktop para incluir nuevos botones
// Esta función se mantiene igual pero los botones se generan desde el HTML
// Los botones llaman a las nuevas funciones

// ===================================================
// 4. INICIALIZAR NOTIFICACIONES AL INICIAR PANEL
// ===================================================

// Agregar esta línea dentro de iniciarPanel() al final:
// inicializarNotificacionesVendedor();

// Exponer funciones globales
window.toggleNotificacionesVendedor = toggleNotificacionesVendedor;
window.cerrarPanelNotificacionesVendedor = cerrarPanelNotificacionesVendedor;
window.marcarNotificacionLeidaVendedor = marcarNotificacionLeidaVendedor;
window.abrirModalTiempo = abrirModalTiempo;
window.confirmarTiempoYPreparar = confirmarTiempoYPreparar;
window.abrirModalCoordinarTransferencia = abrirModalCoordinarTransferencia;
window.cerrarModalCoordinarTransferencia = cerrarModalCoordinarTransferencia;
window.enviarCoordinacionTransferencia = enviarCoordinacionTransferencia;
window.notificarClienteEnCamino = notificarClienteEnCamino;
window.entregarPedido = entregarPedido;
window.cerrarModalTiempo = () => cerrarModalConZIndex('modal-tiempo-entrega');

// Agregar event listeners para los nuevos modales
document.addEventListener('DOMContentLoaded', function() {
    const btnConfirmarTiempo = document.getElementById('btn-confirmar-tiempo');
    if (btnConfirmarTiempo) {
        btnConfirmarTiempo.addEventListener('click', confirmarTiempoYPreparar);
    }
    
    const btnEnviarCoordinacion = document.getElementById('btn-enviar-coordinacion');
    if (btnEnviarCoordinacion) {
        btnEnviarCoordinacion.addEventListener('click', enviarCoordinacionTransferencia);
    }
    
    const btnNotificaciones = document.getElementById('btn-notificaciones');
    if (btnNotificaciones) {
        btnNotificaciones.addEventListener('click', toggleNotificacionesVendedor);
    }
    
    const btnCerrarNotif = document.getElementById('btn-cerrar-notif');
    if (btnCerrarNotif) {
        btnCerrarNotif.addEventListener('click', cerrarPanelNotificacionesVendedor);
    }
});

// Modificar la función iniciarPanel para incluir notificaciones
// Busca la función iniciarPanel en tu código y agrega esta línea al final:
// inicializarNotificacionesVendedor();