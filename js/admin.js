// ===================================================
// ADMIN - Panel de vendedor (versión completa)
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

let paginaActual = 1;
let pedidosPorPagina = 10;
let pedidosFiltrados = [];

let productosTempEdit = [];
let productosTempNuevo = [];

// ===================================================
// UTILIDADES
// ===================================================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function guardarSesion(vendedor) {
    sessionStorage.setItem('vendedor_sesion', JSON.stringify({
        id: vendedor.id,
        email: vendedor.email,
        nombre: vendedor.nombre
    }));
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

function cerrarSesion() {
    localStorage.removeItem('want_sesion');
    sessionStorage.removeItem('vendedor_sesion');
    location.reload();
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

async function withLoading(button, callback) {
    if (!button) return await callback();
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + button.innerHTML.replace(/<i class="[^"]*"><\/i>\s*/, '');
    try {
        return await callback();
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
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

function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio);
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
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '40px';
    toast.style.fontSize = '0.8rem';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===================================================
// MÉTRICAS Y CONTADORES
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
    
    document.getElementById('ventas-hoy') && (document.getElementById('ventas-hoy').textContent = formatearPrecio(ventasHoy));
    document.getElementById('ventas-semana') && (document.getElementById('ventas-semana').textContent = formatearPrecio(ventasSemana));
    document.getElementById('ventas-mes') && (document.getElementById('ventas-mes').textContent = formatearPrecio(ventasMes));
    document.getElementById('pedidos-entregados') && (document.getElementById('pedidos-entregados').textContent = pedidosEntregados);
    document.getElementById('pedidos-pendientes') && (document.getElementById('pedidos-pendientes').textContent = pedidosPendientes);
}

function actualizarContadoresPedidos() {
    const contarPorEstado = { preparando: 0, 'en preparacion': 0, 'en camino': 0, entregado: 0 };
    pedidos.forEach(p => { const estado = p.estado || 'preparando'; if (contarPorEstado[estado] !== undefined) contarPorEstado[estado]++; });
    
    document.getElementById('count-preparando') && (document.getElementById('count-preparando').textContent = contarPorEstado.preparando);
    document.getElementById('count-preparacion') && (document.getElementById('count-preparacion').textContent = contarPorEstado['en preparacion']);
    document.getElementById('count-camino') && (document.getElementById('count-camino').textContent = contarPorEstado['en camino']);
    document.getElementById('count-entregado') && (document.getElementById('count-entregado').textContent = contarPorEstado.entregado);
    document.getElementById('badge-pedidos') && (document.getElementById('badge-pedidos').textContent = contarPorEstado.preparando);
}

// ===================================================
// PAGINACIÓN Y FILTROS
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

function actualizarPaginacion() {
    pedidosFiltrados = filtrarPedidos();
    const totalPaginas = Math.ceil(pedidosFiltrados.length / pedidosPorPagina);
    if (paginaActual > totalPaginas && totalPaginas > 0) paginaActual = totalPaginas;
    if (paginaActual < 1) paginaActual = 1;
    const inicio = (paginaActual - 1) * pedidosPorPagina;
    const pedidosPagina = pedidosFiltrados.slice(inicio, inicio + pedidosPorPagina);
    renderizarPedidos(pedidosPagina);
    renderizarPaginacion(totalPaginas);
}

function renderizarPaginacion(totalPaginas) {
    const container = document.getElementById('paginacion-container');
    const btnAnterior = document.getElementById('btn-pagina-anterior');
    const btnSiguiente = document.getElementById('btn-pagina-siguiente');
    const infoPagina = document.getElementById('info-pagina');
    if (!container) return;
    if (totalPaginas <= 1) { container.style.display = 'none'; return; }
    container.style.display = 'flex';
    infoPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    btnAnterior.disabled = paginaActual <= 1;
    btnSiguiente.disabled = paginaActual >= totalPaginas;
}

function resetearPaginacion() { paginaActual = 1; actualizarPaginacion(); }

function inicializarPaginacion() {
    document.getElementById('btn-pagina-anterior')?.addEventListener('click', () => { if (paginaActual > 1) { paginaActual--; actualizarPaginacion(); } });
    document.getElementById('btn-pagina-siguiente')?.addEventListener('click', () => { const total = Math.ceil(filtrarPedidos().length / pedidosPorPagina); if (paginaActual < total) { paginaActual++; actualizarPaginacion(); } });
}

function inicializarBuscador() {
    const buscadorInput = document.getElementById('buscador-pedidos');
    const limpiarBtn = document.getElementById('btn-limpiar-busqueda');
    if (buscadorInput) buscadorInput.addEventListener('input', (e) => { terminoBusqueda = e.target.value; resetearPaginacion(); });
    if (limpiarBtn) limpiarBtn.addEventListener('click', () => { if (buscadorInput) buscadorInput.value = ''; terminoBusqueda = ''; resetearPaginacion(); });
}

// ===================================================
// RENDERIZAR PEDIDOS - VERSIÓN ROBUSTA
// ===================================================

function renderizarPedidos(pedidosMostrar) {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    
    if (!pedidosMostrar || pedidosMostrar.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No hay pedidos en esta categoría</p></div>`;
        return;
    }
    
    container.innerHTML = pedidosMostrar.map(p => {
        const fecha = new Date(p.fecha);
        const metodoPago = p.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo';
        const estado = p.estado || 'preparando';
        const numeroMostrar = p.numero_orden || p.id;
        
        // Productos - con validación para evitar datos basura
        let productosHTML = '';
        if (p.productos && Array.isArray(p.productos) && p.productos.length > 0) {
            p.productos.forEach(pr => {
                if (pr && pr.nombre && typeof pr.nombre === 'string' && !pr.nombre.includes('1.0000')) {
                    productosHTML += `
                        <li>
                            <span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span>
                            <span>${formatearPrecio(pr.precio * pr.cantidad)}</span>
                        </li>
                    `;
                }
            });
        }
        
        if (!productosHTML) {
            productosHTML = '<li>No hay productos</li>';
        }
        
        // Detalles
        let detallesHTML = '';
        if (p.detalles && p.detalles.trim() && !p.detalles.includes('1.0000')) {
            detallesHTML = `
                <div class="pedido-detalles">
                    <strong><i class="fas fa-pen"></i> Detalles:</strong>
                    <p>${escapeHTML(p.detalles)}</p>
                </div>
            `;
        }
        
        // Botones según estado
        let botonesHTML = '';
        if (estado === 'preparando') {
            botonesHTML = `
                <div class="botones-estado">
                    <button class="btn-confirmar-whatsapp" onclick="confirmarPedidoWhatsApp(${p.id}, this)"><i class="fab fa-whatsapp"></i> Confirmar</button>
                    <button class="btn-preparar-pedido" onclick="actualizarEstado(${p.id}, 'en preparacion', this)"><i class="fas fa-utensils"></i> Preparar</button>
                </div>
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
                </div>
            `;
        } else if (estado === 'en preparacion') {
            botonesHTML = `
                <div class="botones-estado">
                    <button class="btn-pedido-listo" onclick="abrirModalAsignarDelivery(${p.id})"><i class="fas fa-check-circle"></i> Pedido listo</button>
                </div>
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
                </div>
            `;
        } else if (estado === 'en camino') {
            botonesHTML = `
                <div class="botones-estado">
                    <button class="btn-notificar-camino" onclick="notificarEnCamino(${p.id}, this)"><i class="fab fa-whatsapp"></i> Notificar Envío</button>
                    <button class="btn-confirmar-entrega" onclick="actualizarEstado(${p.id}, 'entregado', this)"><i class="fas fa-check-double"></i> Confirmar entrega</button>
                </div>
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
                </div>
            `;
        } else if (estado === 'entregado') {
            botonesHTML = `
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
                </div>
            `;
        }
        
        return `
            <div class="pedido-card">
                <div class="pedido-header">
                    <div class="pedido-id">Pedido #${numeroMostrar}</div>
                    <div class="pedido-fecha">${fecha.toLocaleString('es-AR')}</div>
                </div>
                <div class="pedido-cliente">
                    <strong><i class="fas fa-user"></i> ${escapeHTML(p.cliente_nombre || 'Sin nombre')}</strong>
                    <span><i class="fas fa-phone"></i> ${p.cliente_telefono || 'Sin teléfono'}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHTML(p.direccion || 'Sin dirección')}</span>
                    <span><i class="fas fa-money-bill-wave"></i> ${metodoPago}</span>
                </div>
                <div class="pedido-productos">
                    <strong>Productos:</strong>
                    <ul>${productosHTML}</ul>
                    ${detallesHTML}
                    <div class="pedido-total">Total: ${formatearPrecio(p.total || 0)}</div>
                </div>
                <div class="pedido-actions">
                    <div class="estado-actual">
                        <span class="estado-badge estado-${estado.replace(' ', '-')}">${getEstadoTexto(estado)}</span>
                    </div>
                    ${botonesHTML}
                </div>
            </div>
        `;
    }).join('');
}

// ===================================================
// ACTUALIZAR ESTADO Y CANCELAR
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
                resetearPaginacion();
            } else throw new Error(response?.error || 'Error');
        } catch (error) { mostrarToast('Error al actualizar', 'error'); throw error; }
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
                resetearPaginacion();
            } else throw new Error(response?.error || 'Error');
        } catch (error) { mostrarToast('Error al cancelar', 'error'); throw error; }
    });
}

// ===================================================
// WHATSAPP Y DELIVERY
// ===================================================

async function confirmarPedidoWhatsApp(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    pedidoPendienteConfirmar = pedido;
    botonPendienteConfirmar = boton;
    document.getElementById('tiempo-entrega-input').value = '';
    document.getElementById('modal-tiempo-entrega').classList.add('active');
}

async function enviarConfirmacionWhatsApp() {
    const tiempoEntrega = document.getElementById('tiempo-entrega-input')?.value.trim();
    if (!tiempoEntrega) { mostrarToast('Ingrese un tiempo estimado de entrega', 'error'); return; }
    if (!pedidoPendienteConfirmar) return;
    
    const pedido = pedidoPendienteConfirmar;
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `*CONFIRMACIÓN DE TU PEDIDO*\n\nHola ${pedido.cliente_nombre},\n\nRecibimos tu pedido correctamente!\n\n━━━━━━━━━━━━━━━━━━━━\n*DETALLE DE TU PEDIDO:*\n━━━━━━━━━━━━━━━━━━━━\n`;
    pedido.productos.forEach(p => { mensaje += `• ${p.cantidad}x ${p.nombre}\n`; });
    if (pedido.detalles) mensaje += `\n*INDICACIONES:* ${pedido.detalles}\n`;
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n*TOTAL:* $${pedido.total.toLocaleString('es-AR')}\n*NUMERO DE ORDEN:* #${pedido.numero_orden || pedido.id}\n━━━━━━━━━━━━━━━━━━━━\n\n*TIEMPO ESTIMADO:* ${tiempoEntrega}\n\n*MÉTODO DE PAGO:* ${metodoPagoTexto === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo'}\n\n*DIRECCIÓN:* ${pedido.direccion}\n\n*Gracias por confiar en nosotros!*`;
    
    window.open(`https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
    cerrarModalTiempo();
    if (botonPendienteConfirmar) { botonPendienteConfirmar.disabled = false; botonPendienteConfirmar.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar pedido'; }
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
        if (metodoPagoTexto === 'transferencia') mensaje += `*PAGO:* Transferencia bancaria (YA REALIZADA)`;
        else mensaje += `*PAGO:* Efectivo - *DEBES PAGAR $${pedido.total.toLocaleString('es-AR')} AL DELIVERY*`;
        window.open(`https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`, '_blank');
    });
}

function cerrarModalTiempo() {
    document.getElementById('modal-tiempo-entrega').classList.remove('active');
    pedidoPendienteConfirmar = null;
    botonPendienteConfirmar = null;
}

let pedidoParaAsignar = null;
function abrirModalAsignarDelivery(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    pedidoParaAsignar = pedido;
    document.getElementById('asignar-pedido-id').textContent = pedido.numero_orden || pedido.id;
    document.getElementById('asignar-cliente-nombre').textContent = pedido.cliente_nombre;
    document.getElementById('asignar-total').textContent = formatearPrecio(pedido.total);
    const select = document.getElementById('select-delivery');
    select.innerHTML = '<option value="">Seleccionar...</option>';
    deliveries.forEach(d => { select.innerHTML += `<option value="${d.id}" data-telefono="${d.telefono}" data-nombre="${escapeHTML(d.nombre)}">${escapeHTML(d.nombre)} - ${d.telefono}</option>`; });
    document.getElementById('modal-asignar-delivery').classList.add('active');
}
function cerrarModalAsignarDelivery() { document.getElementById('modal-asignar-delivery').classList.remove('active'); pedidoParaAsignar = null; }
async function enviarPedidoADelivery() {
    const select = document.getElementById('select-delivery');
    const selectedOption = select.options[select.selectedIndex];
    const deliveryTelefono = selectedOption?.getAttribute('data-telefono');
    const deliveryNombre = selectedOption?.getAttribute('data-nombre');
    if (!deliveryTelefono || !pedidoParaAsignar) { mostrarToast('Selecciona un delivery', 'error'); return; }
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
// DELIVERY CRUD
// ===================================================

async function cargarDeliveries(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('delivery-grid');
    if (container) container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando deliveries...</p></div>`;
    try {
        const response = await callAPI('getDeliveries', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        deliveries = response.deliveries || [];
        renderizarDeliveries();
        document.getElementById('badge-delivery') && (document.getElementById('badge-delivery').textContent = deliveries.length);
    } catch (error) { if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar deliveries</p></div>`; }
}

function renderizarDeliveries() {
    const container = document.getElementById('delivery-grid');
    if (!container) return;
    if (deliveries.length === 0) { container.innerHTML = `<div class="sin-pedidos"><p>No tenés deliveries registrados</p><button class="btn-primary" onclick="abrirModalDelivery()">Agregar delivery</button></div>`; return; }
    container.innerHTML = deliveries.map(d => `
        <div class="delivery-card">
            <div class="delivery-info"><h4>${escapeHTML(d.nombre)}</h4><p><i class="fab fa-whatsapp"></i> ${d.telefono}</p></div>
            <div class="delivery-actions">
                <button class="btn-wa-delivery" onclick="whatsappDelivery('${d.telefono}', '${escapeHTML(d.nombre)}')"><i class="fab fa-whatsapp"></i></button>
                <button class="btn-delete-delivery" onclick="eliminarDelivery(${d.id})"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `).join('');
}

function abrirModalDelivery(deliveryId = null) {
    if (deliveryId) { const d = deliveries.find(d => d.id === deliveryId); if (d) { document.getElementById('delivery-id').value = d.id; document.getElementById('delivery-nombre').value = d.nombre; document.getElementById('delivery-telefono').value = d.telefono; document.getElementById('modal-delivery-title').textContent = 'Editar delivery'; } }
    else { document.getElementById('delivery-form').reset(); document.getElementById('delivery-id').value = ''; document.getElementById('modal-delivery-title').textContent = 'Nuevo delivery'; }
    document.getElementById('modal-delivery').classList.add('active');
}
function cerrarModalDelivery() { document.getElementById('modal-delivery').classList.remove('active'); }
async function guardarDelivery() {
    const id = document.getElementById('delivery-id').value;
    const nombre = document.getElementById('delivery-nombre').value.trim();
    const telefono = document.getElementById('delivery-telefono').value.trim();
    if (!nombre || !telefono) { mostrarToast('Completá todos los campos', 'error'); return; }
    const data = { vendedor_id: vendedorActual.id, nombre, telefono };
    if (id) data.id = parseInt(id);
    const action = id ? 'actualizarDelivery' : 'crearDelivery';
    try {
        const response = await postAPI(action, data);
        if (response && response.success) { mostrarToast(id ? 'Delivery actualizado' : 'Delivery creado', 'success'); cerrarModalDelivery(); await cargarDeliveries(true); }
        else throw new Error(response?.error || 'Error');
    } catch (error) { mostrarToast(error.message, 'error'); }
}
async function eliminarDelivery(deliveryId) { if (!confirm('¿Eliminar este delivery?')) return; try { const response = await postAPI('eliminarDelivery', { deliveryId }); if (response.success) { mostrarToast('Delivery eliminado', 'success'); await cargarDeliveries(true); } } catch (error) { mostrarToast('Error al eliminar', 'error'); } }
function whatsappDelivery(telefono, nombre) { window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(`Hola ${nombre}, soy del negocio.`)}`, '_blank'); }

// ===================================================
// PRODUCTOS CRUD
// ===================================================

async function cargarProductos(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('productos-admin-grid');
    if (container) container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando productos...</p></div>`;
    try {
        const response = await callAPI('getProductos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        productos = (response.productos || []).filter(p => p.vendedor_id?.toString() === vendedorActual.id.toString());
        renderizarProductosAdmin();
        document.getElementById('badge-productos') && (document.getElementById('badge-productos').textContent = productos.length);
    } catch (error) { if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar productos</p></div>`; }
}

function renderizarProductosAdmin() {
    const container = document.getElementById('productos-admin-grid');
    if (!container) return;
    if (productos.length === 0) { container.innerHTML = `<div class="sin-pedidos"><p>No tenés productos cargados</p><button class="btn-primary" onclick="abrirModalProducto()">Agregar producto</button></div>`; return; }
    container.innerHTML = productos.map(p => `
        <div class="producto-admin-card">
            <div class="producto-admin-imagen">${p.imagen_url ? `<img src="${p.imagen_url}" alt="${escapeHTML(p.nombre)}">` : '<div class="placeholder-img">🍕</div>'}</div>
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
    if (productoId) { const p = productos.find(p => p.id === productoId); if (p) { document.getElementById('producto-id').value = p.id; document.getElementById('producto-nombre').value = p.nombre; document.getElementById('producto-descripcion').value = p.descripcion || ''; document.getElementById('producto-precio').value = p.precio; document.getElementById('producto-disponible').value = p.disponible || 'SI'; const preview = document.getElementById('producto-imagen-preview'); if (preview && p.imagen_url) preview.innerHTML = `<img src="${p.imagen_url}" style="max-width: 100px;">`; document.getElementById('modal-producto-title').textContent = 'Editar producto'; } }
    else { document.getElementById('producto-form').reset(); document.getElementById('producto-id').value = ''; document.getElementById('producto-imagen-preview').innerHTML = ''; document.getElementById('producto-disponible').value = 'SI'; document.getElementById('modal-producto-title').textContent = 'Nuevo producto'; }
    document.getElementById('modal-producto').classList.add('active');
}
function cerrarModalProducto() { document.getElementById('modal-producto').classList.remove('active'); }
async function guardarProducto() {
    const id = document.getElementById('producto-id').value;
    const nombre = document.getElementById('producto-nombre').value.trim();
    const descripcion = document.getElementById('producto-descripcion').value.trim();
    const precio = parseFloat(document.getElementById('producto-precio').value);
    const disponible = document.getElementById('producto-disponible')?.value || 'SI';
    const imagenFile = document.getElementById('producto-imagen').files[0];
    if (!nombre || !precio) { mostrarToast('Nombre y precio son obligatorios', 'error'); return; }
    let imagenUrl = null;
    if (imagenFile) { mostrarToast('Subiendo imagen...', 'info'); imagenUrl = await subirImagenACloudinary(imagenFile); if (!imagenUrl) { mostrarToast('Error al subir imagen', 'error'); return; } }
    const data = { vendedor_id: vendedorActual.id, nombre, descripcion, precio, disponible };
    if (imagenUrl) data.imagen_url = imagenUrl;
    if (id) data.id = parseInt(id);
    const action = id ? 'actualizarProducto' : 'crearProducto';
    try {
        const response = await postAPI(action, data);
        if (response && response.success) { mostrarToast(id ? 'Producto actualizado' : 'Producto creado', 'success'); cerrarModalProducto(); await cargarProductos(true); }
        else throw new Error(response?.error || 'Error');
    } catch (error) { mostrarToast(error.message, 'error'); }
}
async function eliminarProducto(productoId) { const producto = productos.find(p => p.id === productoId); if (!producto) return; if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return; try { const response = await postAPI('eliminarProducto', { productoId }); if (response.success) { mostrarToast('Producto eliminado', 'success'); await cargarProductos(true); } } catch (error) { mostrarToast('Error al eliminar', 'error'); } }

// ===================================================
// PERFIL
// ===================================================

function abrirModalPerfil() { cargarPerfil(); document.getElementById('modal-perfil').classList.add('active'); }
function cerrarModalPerfil() { document.getElementById('modal-perfil').classList.remove('active'); }
function cargarPerfil() {
    if (!vendedorActual) return;
    document.getElementById('perfil-nombre') && (document.getElementById('perfil-nombre').value = vendedorActual.nombre || '');
    document.getElementById('perfil-telefono') && (document.getElementById('perfil-telefono').value = vendedorActual.telefono || '');
    document.getElementById('perfil-direccion') && (document.getElementById('perfil-direccion').value = vendedorActual.direccion || '');
    document.getElementById('perfil-horario') && (document.getElementById('perfil-horario').value = vendedorActual.horario || '');
    document.getElementById('perfil-nombre-display') && (document.getElementById('perfil-nombre-display').textContent = vendedorActual.nombre || '');
    document.getElementById('perfil-email-display') && (document.getElementById('perfil-email-display').textContent = vendedorActual.email || '');
    const logoPreview = document.getElementById('logo-preview');
    if (logoPreview && vendedorActual.logo_url) logoPreview.innerHTML = `<img src="${vendedorActual.logo_url}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">`;
    const btnUpload = document.getElementById('btn-upload-logo');
    const logoInput = document.getElementById('perfil-logo');
    if (btnUpload && logoInput) {
        btnUpload.onclick = () => logoInput.click();
        logoInput.onchange = (e) => { const file = e.target.files[0]; if (file && logoPreview) { const reader = new FileReader(); reader.onload = (ev) => logoPreview.innerHTML = `<img src="${ev.target.result}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">`; reader.readAsDataURL(file); } };
    }
    const perfilForm = document.getElementById('perfil-form');
    if (perfilForm) perfilForm.onsubmit = async (e) => { e.preventDefault(); await actualizarPerfil(); };
}
async function actualizarPerfil() {
    const nombre = document.getElementById('perfil-nombre')?.value.trim() || '';
    const telefono = document.getElementById('perfil-telefono')?.value.trim() || '';
    const direccion = document.getElementById('perfil-direccion')?.value.trim() || '';
    const horario = document.getElementById('perfil-horario')?.value.trim() || '';
    const newPassword = document.getElementById('perfil-new-password')?.value || '';
    const logoFile = document.getElementById('perfil-logo')?.files[0];
    let logoUrl = vendedorActual.logo_url;
    if (logoFile) { mostrarToast('Subiendo logo...', 'info'); logoUrl = await subirImagenACloudinary(logoFile); if (!logoUrl) { mostrarToast('Error al subir logo', 'error'); return; } }
    const updateData = { id: vendedorActual.id, nombre, telefono, direccion, horario, logo_url: logoUrl };
    if (newPassword) { if (newPassword.length < 6) { mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; } updateData.password_hash = await hashPassword(newPassword); }
    try {
        const response = await postAPI('actualizarVendedor', updateData);
        if (response && response.success) { mostrarToast('Perfil actualizado', 'success'); vendedorActual = { ...vendedorActual, nombre, telefono, direccion, horario, logo_url: logoUrl }; document.getElementById('panel-nombre') && (document.getElementById('panel-nombre').textContent = nombre); document.getElementById('perfil-nombre-display') && (document.getElementById('perfil-nombre-display').textContent = nombre); document.getElementById('perfil-new-password').value = ''; cerrarModalPerfil(); }
        else throw new Error(response?.error || 'Error');
    } catch (error) { mostrarToast('Error al actualizar perfil', 'error'); }
}

// ===================================================
// EDICIÓN DE PEDIDO
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
    document.getElementById('modal-editar-pedido').classList.add('active');
}
function cerrarModalEditarPedido() { document.getElementById('modal-editar-pedido').classList.remove('active'); productosTempEdit = []; }
function renderizarProductosEditar() {
    const container = document.getElementById('productos-editar-container');
    if (!container) return;
    if (productosTempEdit.length === 0) { container.innerHTML = '<p style="text-align: center;">No hay productos agregados</p>'; return; }
    container.innerHTML = productosTempEdit.map((p, idx) => `
        <div class="producto-item-seleccion">
            <div class="producto-info-seleccion"><div class="producto-nombre-seleccion">${escapeHTML(p.nombre)}</div><div class="producto-precio-seleccion">${formatearPrecio(p.precio)} c/u</div></div>
            <div class="producto-cantidad-seleccion"><button onclick="modificarCantidadProductoEdit(${idx}, -1)">-</button><span>${p.cantidad}</span><button onclick="modificarCantidadProductoEdit(${idx}, 1)">+</button></div>
            <button class="btn-eliminar-producto" onclick="eliminarProductoEdit(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}
function modificarCantidadProductoEdit(idx, cambio) { if (productosTempEdit[idx]) { productosTempEdit[idx].cantidad += cambio; if (productosTempEdit[idx].cantidad <= 0) productosTempEdit.splice(idx, 1); renderizarProductosEditar(); actualizarTotalEdit(); } }
function eliminarProductoEdit(idx) { productosTempEdit.splice(idx, 1); renderizarProductosEditar(); actualizarTotalEdit(); }
function actualizarTotalEdit() { const total = productosTempEdit.reduce((s, p) => s + (p.precio * p.cantidad), 0); document.getElementById('edit-total').value = formatearPrecio(total); }
async function guardarEditarPedido() {
    const pedidoId = parseInt(document.getElementById('edit-pedido-id').value);
    const cliente_nombre = document.getElementById('edit-cliente-nombre').value.trim();
    const cliente_telefono = document.getElementById('edit-cliente-telefono').value.trim();
    const direccion = document.getElementById('edit-direccion').value.trim();
    const detalles = document.getElementById('edit-detalles').value.trim();
    const metodo_pago = document.getElementById('edit-metodo-pago').value;
    const estado = document.getElementById('edit-estado').value;
    const total = productosTempEdit.reduce((s, p) => s + (p.precio * p.cantidad), 0);
    if (!cliente_nombre || !cliente_telefono || !direccion) { mostrarToast('Completá todos los campos', 'error'); return; }
    const data = { id: pedidoId, cliente_nombre, cliente_telefono, direccion, detalles, metodo_pago, estado, productos: productosTempEdit, total };
    try { const response = await postAPI('actualizarPedidoCompleto', data); if (response && response.success) { mostrarToast('Pedido actualizado', 'success'); cerrarModalEditarPedido(); await cargarPedidos(true); } else throw new Error(response?.error || 'Error'); } catch (error) { mostrarToast(error.message, 'error'); }
}

// ===================================================
// CREAR NUEVO PEDIDO
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
    document.getElementById('modal-nuevo-pedido').classList.add('active');
}
function cerrarModalNuevoPedido() { document.getElementById('modal-nuevo-pedido').classList.remove('active'); productosTempNuevo = []; }
function renderizarProductosNuevo() {
    const container = document.getElementById('productos-nuevo-container');
    if (!container) return;
    if (productosTempNuevo.length === 0) { container.innerHTML = '<p style="text-align: center;">No hay productos agregados</p>'; return; }
    container.innerHTML = productosTempNuevo.map((p, idx) => `
        <div class="producto-item-seleccion">
            <div class="producto-info-seleccion"><div class="producto-nombre-seleccion">${escapeHTML(p.nombre)}</div><div class="producto-precio-seleccion">${formatearPrecio(p.precio)} c/u</div></div>
            <div class="producto-cantidad-seleccion"><button onclick="modificarCantidadProductoNuevo(${idx}, -1)">-</button><span>${p.cantidad}</span><button onclick="modificarCantidadProductoNuevo(${idx}, 1)">+</button></div>
            <button class="btn-eliminar-producto" onclick="eliminarProductoNuevo(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}
function modificarCantidadProductoNuevo(idx, cambio) { if (productosTempNuevo[idx]) { productosTempNuevo[idx].cantidad += cambio; if (productosTempNuevo[idx].cantidad <= 0) productosTempNuevo.splice(idx, 1); renderizarProductosNuevo(); actualizarTotalNuevo(); } }
function eliminarProductoNuevo(idx) { productosTempNuevo.splice(idx, 1); renderizarProductosNuevo(); actualizarTotalNuevo(); }
function actualizarTotalNuevo() { const total = productosTempNuevo.reduce((s, p) => s + (p.precio * p.cantidad), 0); document.getElementById('nuevo-total').value = formatearPrecio(total); }
async function guardarNuevoPedido() {
    const cliente_nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
    const cliente_telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
    const direccion = document.getElementById('nuevo-direccion').value.trim();
    const detalles = document.getElementById('nuevo-detalles').value.trim();
    const metodo_pago = document.getElementById('nuevo-metodo-pago').value;
    const total = productosTempNuevo.reduce((s, p) => s + (p.precio * p.cantidad), 0);
    if (!cliente_nombre || !cliente_telefono || !direccion) { mostrarToast('Completá todos los campos', 'error'); return; }
    if (productosTempNuevo.length === 0) { mostrarToast('Agregá al menos un producto', 'error'); return; }
    const data = { vendedor_id: vendedorActual.id, cliente_nombre, cliente_telefono, direccion, detalles, metodo_pago, productos: productosTempNuevo, total };
    try { const response = await postAPI('crearPedidoVendedor', data); if (response && response.success) { mostrarToast('Pedido creado', 'success'); cerrarModalNuevoPedido(); await cargarPedidos(true); } else throw new Error(response?.error || 'Error'); } catch (error) { mostrarToast(error.message, 'error'); }
}

// ===================================================
// SELECCIONAR PRODUCTO MODAL
// ===================================================

let currentCallback = null;
function abrirModalSeleccionarProducto(productosList, callback) {
    currentCallback = callback;
    const select = document.getElementById('select-producto');
    select.innerHTML = '<option value="">Seleccionar...</option>';
    productos.forEach(p => { if (p.disponible === 'SI') select.innerHTML += `<option value="${p.id}" data-precio="${p.precio}" data-nombre="${escapeHTML(p.nombre)}">${escapeHTML(p.nombre)} - ${formatearPrecio(p.precio)}</option>`; });
    document.getElementById('select-cantidad').value = '1';
    document.getElementById('modal-seleccionar-producto').classList.add('active');
}
function cerrarModalSeleccionarProducto() { document.getElementById('modal-seleccionar-producto').classList.remove('active'); currentCallback = null; }
function confirmarAgregarProducto() {
    const select = document.getElementById('select-producto');
    const productoId = select.value;
    const cantidad = parseInt(document.getElementById('select-cantidad').value) || 1;
    if (!productoId) { mostrarToast('Seleccioná un producto', 'error'); return; }
    const producto = productos.find(p => p.id.toString() === productoId);
    if (!producto) return;
    if (currentCallback) currentCallback({ id: producto.id, nombre: producto.nombre, precio: parseFloat(producto.precio), cantidad });
    cerrarModalSeleccionarProducto();
}

// ===================================================
// REGISTRO Y LOGIN
// ===================================================

async function registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile) {
    let logoUrl = null;
    if (logoFile) { logoUrl = await subirImagenACloudinary(logoFile); if (!logoUrl) { mostrarToast('Error al subir el logo', 'error'); return false; } }
    const passwordHash = await hashPassword(password);
    return await postAPI('registrarVendedor', { nombre, email, telefono, direccion, horario, password_hash: passwordHash, logo_url: logoUrl });
}

async function login() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) { mostrarToast('Completá todos los campos', 'error'); return; }
    try {
        mostrarToast('Validando credenciales...', 'info');
        const passwordHash = await hashPassword(password);
        const response = await callAPI('loginVendedor', { email, password: passwordHash }, true);
        if (response.success && response.vendedor) {
            vendedorActual = response.vendedor;
            const rememberMe = document.getElementById('remember-me')?.checked || false;
            if (rememberMe) localStorage.setItem('want_sesion', JSON.stringify({ id: vendedorActual.id, email: vendedorActual.email, nombre: vendedorActual.nombre }));
            else guardarSesion(vendedorActual);
            await iniciarPanel(vendedorActual);
            mostrarToast(`Bienvenido ${vendedorActual.nombre}`, 'success');
        } else throw new Error(response.error || 'Email o contraseña incorrectos');
    } catch (error) { mostrarToast(error.message, 'error'); }
}

// ===================================================
// INICIALIZACIÓN DEL PANEL
// ===================================================

async function iniciarPanel(vendedor) {
    document.getElementById('admin-auth').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('header-admin').style.display = 'block';
    document.getElementById('panel-nombre').textContent = vendedor.nombre;
    document.getElementById('panel-email').textContent = vendedor.email;
    await cargarPedidos();
    await cargarProductos();
    await cargarDeliveries();
    
    document.getElementById('btn-refresh')?.addEventListener('click', async () => { await withLoading(document.getElementById('btn-refresh'), async () => { await cargarPedidos(true); await cargarProductos(true); await cargarDeliveries(true); mostrarToast('Datos actualizados', 'success'); }); });
    document.getElementById('btn-logout')?.addEventListener('click', cerrarSesion);
    document.getElementById('mobile-logout-btn')?.addEventListener('click', cerrarSesion);
    document.getElementById('btn-open-profile')?.addEventListener('click', abrirModalPerfil);
    document.getElementById('btn-agregar-producto')?.addEventListener('click', () => abrirModalProducto());
    document.getElementById('btn-agregar-delivery')?.addEventListener('click', () => abrirModalDelivery());
    document.getElementById('btn-nuevo-pedido')?.addEventListener('click', () => abrirModalNuevoPedido());
    document.getElementById('guardar-producto')?.addEventListener('click', guardarProducto);
    document.getElementById('guardar-delivery')?.addEventListener('click', guardarDelivery);
    document.getElementById('guardar-editar-pedido')?.addEventListener('click', guardarEditarPedido);
    document.getElementById('guardar-nuevo-pedido')?.addEventListener('click', guardarNuevoPedido);
    document.getElementById('btn-confirmar-agregar-producto')?.addEventListener('click', confirmarAgregarProducto);
    document.getElementById('btn-enviar-delivery')?.addEventListener('click', enviarPedidoADelivery);
    document.getElementById('btn-confirmar-tiempo')?.addEventListener('click', enviarConfirmacionWhatsApp);
    document.getElementById('btn-cancelar-tiempo')?.addEventListener('click', cerrarModalTiempo);
    document.getElementById('cerrar-modal-tiempo')?.addEventListener('click', cerrarModalTiempo);
    document.getElementById('btn-agregar-producto-editar')?.addEventListener('click', () => abrirModalSeleccionarProducto(productosTempEdit, (prod) => { const existente = productosTempEdit.find(p => p.id === prod.id); if (existente) existente.cantidad += prod.cantidad; else productosTempEdit.push(prod); renderizarProductosEditar(); actualizarTotalEdit(); }));
    document.getElementById('btn-agregar-producto-nuevo')?.addEventListener('click', () => abrirModalSeleccionarProducto(productosTempNuevo, (prod) => { const existente = productosTempNuevo.find(p => p.id === prod.id); if (existente) existente.cantidad += prod.cantidad; else productosTempNuevo.push(prod); renderizarProductosNuevo(); actualizarTotalNuevo(); }));
    
    inicializarTabs();
    inicializarFiltros();
    inicializarMenuAdmin();
    inicializarBuscador();
    inicializarPaginacion();
}

function inicializarTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
            if (tabId === 'productos') cargarProductos();
            if (tabId === 'delivery') cargarDeliveries();
        });
    });
}

function inicializarFiltros() {
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActual = btn.getAttribute('data-estado');
            resetearPaginacion();
        });
    });
}

function inicializarMenuAdmin() {
    const toggle = document.getElementById('menu-toggle-admin');
    const menu = document.getElementById('mobile-menu-admin');
    const overlay = document.getElementById('menu-overlay-admin');
    const close = document.getElementById('menu-close-admin');
    if (toggle) toggle.onclick = () => { menu.classList.add('active'); overlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
    if (close) close.onclick = () => { menu.classList.remove('active'); overlay.classList.remove('active'); document.body.style.overflow = ''; };
    if (overlay) overlay.onclick = () => { menu.classList.remove('active'); overlay.classList.remove('active'); document.body.style.overflow = ''; };
    document.querySelectorAll('.mobile-tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(t => { t.classList.remove('active'); if (t.getAttribute('data-tab') === tabId) t.classList.add('active'); });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
            menu.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            if (tabId === 'productos') cargarProductos();
            if (tabId === 'delivery') cargarDeliveries();
        });
    });
}

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
        resetearPaginacion();
        if (forceRefresh) mostrarToast('Pedidos actualizados', 'success');
    } catch (error) { if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar pedidos</p></div>`; }
}

async function cargarVendedorPorId(vendedorId) {
    try {
        const response = await callAPI('getVendedores', {}, true);
        if (response.success) {
            const vendedor = response.vendedores.find(v => v.id.toString() === vendedorId.toString());
            if (vendedor && vendedor.activo === 'SI') { vendedorActual = vendedor; await iniciarPanel(vendedorActual); }
            else cerrarSesion();
        }
    } catch (error) { cerrarSesion(); }
}

// ===================================================
// CAMBIAR PANELES DE AUTENTICACIÓN
// ===================================================

function mostrarPanelLogin() { document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active')); document.getElementById('login-panel').classList.add('active'); }
function mostrarPanelRegistro() { document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active')); document.getElementById('register-panel').classList.add('active'); }
function mostrarPanelRecuperacion() { document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active')); document.getElementById('recover-panel').classList.add('active'); }

// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Panel de Vendedor iniciado');
    const sesion = cargarSesionGuardada();
    if (!sesion) { document.getElementById('admin-auth').style.display = 'flex'; }
    
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.getAttribute('data-target'));
            if (input) { const type = input.type === 'password' ? 'text' : 'password'; input.type = type; btn.querySelector('i').classList.toggle('fa-eye'); btn.querySelector('i').classList.toggle('fa-eye-slash'); }
        });
    });
    
    document.getElementById('login-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await login(); });
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('reg-nombre')?.value.trim() || '';
        const email = document.getElementById('reg-email')?.value.trim() || '';
        const telefono = document.getElementById('reg-telefono')?.value.trim() || '';
        const direccion = document.getElementById('reg-direccion')?.value.trim() || '';
        const horario = document.getElementById('reg-horario')?.value.trim() || '';
        const password = document.getElementById('reg-password')?.value || '';
        const password2 = document.getElementById('reg-password2')?.value || '';
        const logoFile = document.getElementById('reg-logo')?.files[0];
        if (password !== password2) { alert('Las contraseñas no coinciden'); return; }
        if (password.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return; }
        const response = await registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile);
        if (response && response.success) { alert('Registro exitoso. Ahora podés iniciar sesión.'); mostrarPanelLogin(); document.getElementById('register-form').reset(); document.getElementById('reg-logo-preview').innerHTML = ''; document.getElementById('login-email').value = email; }
        else alert(response?.error || 'Error al registrar');
    });
    document.getElementById('reg-logo')?.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { const preview = document.getElementById('reg-logo-preview'); if (preview) preview.innerHTML = `<img src="${ev.target.result}" style="max-width: 80px; border-radius: 12px;">`; }; reader.readAsDataURL(file); } });
    
    document.getElementById('recover-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('recover-email')?.value.trim() || '';
        const response = await postAPI('solicitarRecuperacion', { email });
        if (response.success) { alert('Código enviado a tu email'); document.getElementById('recover-code-section').style.display = 'block'; if (response.codigo) console.log('Código de recuperación (demo):', response.codigo); }
        else alert(response.error);
    });
    document.getElementById('btn-reset-password')?.addEventListener('click', async () => {
        const email = document.getElementById('recover-email')?.value.trim() || '';
        const codigo = document.getElementById('recover-code')?.value.trim() || '';
        const newPassword = document.getElementById('recover-new-password')?.value || '';
        const newPassword2 = document.getElementById('recover-new-password2')?.value || '';
        if (newPassword !== newPassword2) { alert('Las contraseñas no coinciden'); return; }
        const response = await postAPI('resetearPassword', { email, codigo, new_password_hash: await hashPassword(newPassword) });
        if (response.success) { alert('Contraseña restablecida. Iniciá sesión.'); mostrarPanelLogin(); document.getElementById('recover-code-section').style.display = 'none'; document.getElementById('recover-form').reset(); }
        else alert(response.error);
    });
    
    document.getElementById('btn-show-register')?.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelRegistro(); });
    document.getElementById('btn-show-recover')?.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelRecuperacion(); });
    document.getElementById('back-to-login')?.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelLogin(); });
    document.getElementById('back-to-login-recover')?.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelLogin(); });
});