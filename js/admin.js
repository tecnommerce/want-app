// ===================================================
// ADMIN - Panel de vendedor (versión completa con Delivery, Editar pedido, Nuevo pedido)
// ===================================================

// Configuración de Cloudinary
const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r';
const CLOUDINARY_UPLOAD_PRESET = 'want_productos';

// Variables globales
let vendedorActual = null;
let pedidos = [];
let productos = [];
let deliveries = [];
let filtroActual = 'preparando';
let terminoBusqueda = '';
let pedidoPendienteConfirmar = null;
let botonPendienteConfirmar = null;

// Variables para editar/nuevo pedido
let productosTemp = [];
let modoEdicionPedido = null; // 'editar' o 'nuevo'
let pedidoEditandoId = null;

// ===================================================
// UTILIDADES DE AUTENTICACIÓN
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
        console.error('Error subir imagen:', error);
        return null;
    }
}

// ===================================================
// NORMALIZACIÓN DE ESTADOS
// ===================================================

function normalizarEstado(estado) {
    if (!estado) return 'preparando';
    const estadoLower = estado.toLowerCase().trim();
    if (estadoLower === 'preparando' || estadoLower === 'nuevo') return 'preparando';
    if (estadoLower === 'en preparacion' || estadoLower === 'en preparación') return 'en preparacion';
    if (estadoLower === 'en camino') return 'en camino';
    if (estadoLower === 'entregado') return 'entregado';
    return estadoLower;
}

// ===================================================
// MÉTRICAS POR PERÍODO
// ===================================================

function calcularMetricas() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    let ventasHoy = 0;
    let ventasSemana = 0;
    let ventasMes = 0;
    let pedidosEntregados = 0;
    let pedidosPendientes = 0;
    
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
    
    const ventasHoyEl = document.getElementById('ventas-hoy');
    const ventasSemanaEl = document.getElementById('ventas-semana');
    const ventasMesEl = document.getElementById('ventas-mes');
    const pedidosEntregadosEl = document.getElementById('pedidos-entregados');
    const pedidosPendientesEl = document.getElementById('pedidos-pendientes');
    
    if (ventasHoyEl) ventasHoyEl.textContent = formatearPrecio(ventasHoy);
    if (ventasSemanaEl) ventasSemanaEl.textContent = formatearPrecio(ventasSemana);
    if (ventasMesEl) ventasMesEl.textContent = formatearPrecio(ventasMes);
    if (pedidosEntregadosEl) pedidosEntregadosEl.textContent = pedidosEntregados;
    if (pedidosPendientesEl) pedidosPendientesEl.textContent = pedidosPendientes;
}

// ===================================================
// CONTADORES DE PEDIDOS
// ===================================================

function actualizarContadoresPedidos() {
    const contarPorEstado = {
        preparando: 0,
        'en preparacion': 0,
        'en camino': 0,
        entregado: 0
    };
    
    pedidos.forEach(p => {
        const estado = p.estado || 'preparando';
        if (contarPorEstado[estado] !== undefined) contarPorEstado[estado]++;
    });
    
    const countPreparando = document.getElementById('count-preparando');
    const countPreparacion = document.getElementById('count-preparacion');
    const countCamino = document.getElementById('count-camino');
    const countEntregado = document.getElementById('count-entregado');
    const badgePedidos = document.getElementById('badge-pedidos');
    
    if (countPreparando) countPreparando.textContent = contarPorEstado.preparando;
    if (countPreparacion) countPreparacion.textContent = contarPorEstado['en preparacion'];
    if (countCamino) countCamino.textContent = contarPorEstado['en camino'];
    if (countEntregado) countEntregado.textContent = contarPorEstado.entregado;
    if (badgePedidos) badgePedidos.textContent = contarPorEstado.preparando;
}

// ===================================================
// BUSCADOR DE PEDIDOS
// ===================================================

function filtrarPedidosPorBusqueda(pedidosLista) {
    if (!terminoBusqueda.trim()) return pedidosLista;
    
    const termino = terminoBusqueda.toLowerCase().trim();
    return pedidosLista.filter(p => {
        return p.id.toString().includes(termino) ||
               (p.cliente_nombre && p.cliente_nombre.toLowerCase().includes(termino)) ||
               (p.cliente_telefono && p.cliente_telefono.includes(termino));
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
            if (buscadorInput) buscadorInput.value = '';
            terminoBusqueda = '';
            renderizarPedidos();
        });
    }
}

// ===================================================
// RENDERIZAR PEDIDOS (con botones por estado)
// ===================================================

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    
    let pedidosFiltrados = pedidos.filter(p => p.estado === filtroActual);
    pedidosFiltrados = filtrarPedidosPorBusqueda(pedidosFiltrados);
    pedidosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No hay pedidos en esta categoría</p></div>`;
        return;
    }
    
    container.innerHTML = pedidosFiltrados.map(p => {
        const fecha = new Date(p.fecha);
        const metodoPago = p.metodo_pago || 'efectivo';
        const estado = p.estado;
        
        // Determinar qué botones mostrar según el estado
        let botonesHTML = '';
        
        if (estado === 'preparando') {
            // NUEVO: confirmar pedido, preparar pedido, editar, cancelar
            botonesHTML = `
                <div class="botones-estado">
                    <button class="btn-confirmar-whatsapp" onclick="confirmarPedidoWhatsApp(${p.id}, this)">
                        <i class="fab fa-whatsapp"></i> Confirmar pedido
                    </button>
                    <button class="btn-preparar-pedido" onclick="actualizarEstado(${p.id}, 'en preparacion', this)">
                        <i class="fas fa-utensils"></i> Preparar pedido
                    </button>
                </div>
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)">
                        <i class="fas fa-trash-alt"></i> Cancelar
                    </button>
                </div>
            `;
        } 
        else if (estado === 'en preparacion') {
            // PREPARACIÓN: Pedido listo (verde), editar, cancelar
            botonesHTML = `
                <div class="botones-estado">
                    <button class="btn-pedido-listo" onclick="abrirModalAsignarDelivery(${p.id})">
                        <i class="fas fa-check-circle"></i> Pedido listo
                    </button>
                </div>
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)">
                        <i class="fas fa-trash-alt"></i> Cancelar
                    </button>
                </div>
            `;
        }
        else if (estado === 'en camino') {
            // EN CAMINO: Notificar Envío, Confirmar entrega, editar, cancelar
            botonesHTML = `
                <div class="botones-estado">
                    <button class="btn-notificar-camino" onclick="notificarEnCamino(${p.id}, this)">
                        <i class="fab fa-whatsapp"></i> Notificar Envío
                    </button>
                    <button class="btn-confirmar-entrega" onclick="actualizarEstado(${p.id}, 'entregado', this)">
                        <i class="fas fa-check-double"></i> Confirmar entrega
                    </button>
                </div>
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)">
                        <i class="fas fa-trash-alt"></i> Cancelar
                    </button>
                </div>
            `;
        }
        else if (estado === 'entregado') {
            // ENTREGADO: solo editar y cancelar
            botonesHTML = `
                <div class="botones-acciones">
                    <button class="btn-editar-pedido" onclick="abrirModalEditarPedido(${p.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)">
                        <i class="fas fa-trash-alt"></i> Cancelar
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="pedido-card">
                <div class="pedido-header">
                    <div class="pedido-id">Pedido #${p.id}</div>
                    <div class="pedido-fecha">${fecha.toLocaleString('es-AR')}</div>
                </div>
                <div class="pedido-cliente">
                    <strong><i class="fas fa-user"></i> ${escapeHTML(p.cliente_nombre)}</strong>
                    <span><i class="fas fa-phone"></i> ${p.cliente_telefono}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHTML(p.direccion || 'Sin dirección')}</span>
                    <span><i class="fas fa-money-bill-wave"></i> ${metodoPago === 'transferencia' ? 'Transferencia' : 'Efectivo'}</span>
                </div>
                <div class="pedido-productos">
                    <strong>Productos:</strong>
                    <ul>
                        ${p.productos ? p.productos.map(pr => `
                            <li>${pr.cantidad}x ${escapeHTML(pr.nombre)} - ${formatearPrecio(pr.precio * pr.cantidad)}</li>
                        `).join('') : '<li>No hay detalles</li>'}
                    </ul>
                    ${p.detalles ? `
                        <div class="pedido-detalles">
                            <strong>Detalles del pedido:</strong>
                            <p>${escapeHTML(p.detalles)}</p>
                        </div>
                    ` : ''}
                    <div class="pedido-total">Total: ${formatearPrecio(p.total)}</div>
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
// ACTUALIZAR ESTADO
// ===================================================

async function actualizarEstado(pedidoId, nuevoEstado, boton) {
    if (!boton) return;
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const response = await postAPI('actualizarEstado', { pedidoId, estado: nuevoEstado });
        if (response && response.success) {
            mostrarToast(`Pedido #${pedidoId} actualizado a ${getEstadoTexto(nuevoEstado)}`, 'success');
            const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
            if (pedido) pedido.estado = nuevoEstado;
            actualizarContadoresPedidos();
            calcularMetricas();
            renderizarPedidos();
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast('Error al actualizar', 'error');
        boton.innerHTML = textoOriginal;
        boton.disabled = false;
    }
}

async function cancelarPedido(pedidoId, boton) {
    if (!confirm('¿Cancelar este pedido? Se eliminará permanentemente.')) return;
    if (!boton) return;
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const response = await postAPI('cancelarPedido', { pedidoId });
        if (response && response.success) {
            mostrarToast(`Pedido #${pedidoId} cancelado`, 'success');
            pedidos = pedidos.filter(p => p.id.toString() !== pedidoId.toString());
            actualizarContadoresPedidos();
            calcularMetricas();
            renderizarPedidos();
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast('Error al cancelar', 'error');
        boton.innerHTML = textoOriginal;
        boton.disabled = false;
    }
}

// ===================================================
// CONFIRMAR PEDIDO POR WHATSAPP (sin cambiar estado)
// ===================================================

async function confirmarPedidoWhatsApp(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    pedidoPendienteConfirmar = pedido;
    botonPendienteConfirmar = boton;
    
    const input = document.getElementById('tiempo-entrega-input');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    const modal = document.getElementById('modal-tiempo-entrega');
    if (modal) modal.classList.add('active');
}

async function enviarConfirmacionWhatsApp() {
    const input = document.getElementById('tiempo-entrega-input');
    const tiempoEntrega = input?.value.trim();
    
    if (!tiempoEntrega) {
        mostrarToast('Ingrese un tiempo estimado de entrega', 'error');
        input?.focus();
        return;
    }
    
    if (!pedidoPendienteConfirmar || !botonPendienteConfirmar) {
        mostrarToast('Error: No hay pedido seleccionado', 'error');
        cerrarModalTiempo();
        return;
    }
    
    const pedido = pedidoPendienteConfirmar;
    const boton = botonPendienteConfirmar;
    
    const originalText = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `*CONFIRMACIÓN DE TU PEDIDO*\n\n`;
    mensaje += `Hola ${pedido.cliente_nombre},\n\n`;
    mensaje += `Recibimos tu pedido correctamente!\n\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `*DETALLE DE TU PEDIDO:*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
    pedido.productos.forEach(p => {
        mensaje += `• ${p.cantidad}x ${p.nombre}\n`;
    });
    
    if (pedido.detalles) {
        mensaje += `\n*INDICACIONES ESPECIALES:*\n`;
        mensaje += `${pedido.detalles}\n`;
    }
    
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `*TOTAL:* $${pedido.total.toLocaleString('es-AR')}\n`;
    mensaje += `*NUMERO DE ORDEN:* #${pedido.id}\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    mensaje += `*TIEMPO ESTIMADO DE ENTREGA:* ${tiempoEntrega}\n\n`;
    
    if (metodoPagoTexto === 'transferencia') {
        mensaje += `*MÉTODO DE PAGO:* Transferencia bancaria\n`;
        mensaje += `Te pasaremos nuestro alias y CBU por este mismo medio para que realices el pago.\n\n`;
    } else {
        mensaje += `*MÉTODO DE PAGO:* Efectivo\n`;
        mensaje += `Pagaras al recibir tu pedido.\n\n`;
    }
    
    mensaje += `*DIRECCIÓN DE ENTREGA:* ${pedido.direccion}\n\n`;
    mensaje += `Ahora estamos preparando tu pedido con mucho cuidado.\n`;
    mensaje += `Te avisaremos cuando esté en camino.\n\n`;
    mensaje += `*Gracias por confiar en nosotros!*\n\n`;
    mensaje += `_Cualquier consulta, responde este mensaje._`;
    
    const url = `https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    cerrarModalTiempo();
    
    setTimeout(() => {
        boton.disabled = false;
        boton.innerHTML = originalText;
    }, 2000);
    
    pedidoPendienteConfirmar = null;
    botonPendienteConfirmar = null;
}

// ===================================================
// NOTIFICAR EN CAMINO (mensaje mejorado)
// ===================================================

async function notificarEnCamino(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    const originalText = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `*ACTUALIZACIÓN DE TU PEDIDO*\n\n`;
    mensaje += `Hola ${pedido.cliente_nombre},\n\n`;
    mensaje += `*¡Tu pedido está en camino!*\n\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `*DETALLE DE TU PEDIDO:*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
    pedido.productos.forEach(p => {
        mensaje += `• ${p.cantidad}x ${p.nombre}\n`;
    });
    
    if (pedido.detalles) {
        mensaje += `\n*INDICACIONES ESPECIALES:*\n`;
        mensaje += `${pedido.detalles}\n`;
    }
    
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `*DIRECCIÓN DE ENTREGA:* ${pedido.direccion}\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (metodoPagoTexto === 'transferencia') {
        mensaje += `*PAGO:* Transferencia bancaria (YA REALIZADA)\n\n`;
    } else {
        mensaje += `*PAGO:* Efectivo - *DEBES PAGAR $${pedido.total.toLocaleString('es-AR')} AL DELIVERY*\n\n`;
    }
    
    mensaje += `Quedate atento al delivery!\n`;
    mensaje += `*Gracias por tu compra!*`;
    
    const url = `https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    setTimeout(() => {
        boton.disabled = false;
        boton.innerHTML = originalText;
    }, 1500);
}

function cerrarModalTiempo() {
    const modal = document.getElementById('modal-tiempo-entrega');
    if (modal) modal.classList.remove('active');
    const input = document.getElementById('tiempo-entrega-input');
    if (input) input.value = '';
    pedidoPendienteConfirmar = null;
    botonPendienteConfirmar = null;
}

// ===================================================
// ASIGNAR DELIVERY (Pedido listo)
// ===================================================

let pedidoParaAsignar = null;

function abrirModalAsignarDelivery(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    pedidoParaAsignar = pedido;
    
    document.getElementById('asignar-pedido-id').textContent = pedido.id;
    document.getElementById('asignar-cliente-nombre').textContent = pedido.cliente_nombre;
    document.getElementById('asignar-total').textContent = formatearPrecio(pedido.total);
    
    const selectDelivery = document.getElementById('select-delivery');
    if (selectDelivery) {
        selectDelivery.innerHTML = '<option value="">Seleccionar...</option>';
        deliveries.forEach(d => {
            selectDelivery.innerHTML += `<option value="${d.id}" data-telefono="${d.telefono}" data-nombre="${escapeHTML(d.nombre)}">${escapeHTML(d.nombre)} - ${d.telefono}</option>`;
        });
    }
    
    document.getElementById('modal-asignar-delivery').classList.add('active');
}

function cerrarModalAsignarDelivery() {
    document.getElementById('modal-asignar-delivery').classList.remove('active');
    pedidoParaAsignar = null;
}

async function enviarPedidoADelivery() {
    const selectDelivery = document.getElementById('select-delivery');
    const selectedOption = selectDelivery.options[selectDelivery.selectedIndex];
    const deliveryId = selectDelivery.value;
    const deliveryTelefono = selectedOption?.getAttribute('data-telefono');
    const deliveryNombre = selectedOption?.getAttribute('data-nombre');
    
    if (!deliveryId || !pedidoParaAsignar) {
        mostrarToast('Selecciona un delivery', 'error');
        return;
    }
    
    const pedido = pedidoParaAsignar;
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `*NUEVO PEDIDO PARA ENTREGAR*\n\n`;
    mensaje += `Hola ${deliveryNombre},\n\n`;
    mensaje += `Tienes un nuevo pedido para entregar:\n\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `*PEDIDO #${pedido.id}*\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `*Cliente:* ${pedido.cliente_nombre}\n`;
    mensaje += `*Teléfono:* ${pedido.cliente_telefono}\n`;
    mensaje += `*Dirección:* ${pedido.direccion}\n\n`;
    mensaje += `*Productos:*\n`;
    pedido.productos.forEach(p => {
        mensaje += `• ${p.cantidad}x ${p.nombre}\n`;
    });
    
    if (pedido.detalles) {
        mensaje += `\n*Indicaciones:* ${pedido.detalles}\n`;
    }
    
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `*Total:* $${pedido.total.toLocaleString('es-AR')}\n`;
    
    if (metodoPagoTexto === 'transferencia') {
        mensaje += `*PAGO:* Transferencia bancaria (YA REALIZADA)\n`;
    } else {
        mensaje += `*PAGO:* Efectivo - *DEBES COBRAR $${pedido.total.toLocaleString('es-AR')}*\n`;
    }
    mensaje += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    mensaje += `Por favor, confirma que recibiste este pedido.`;
    
    const url = `https://wa.me/${deliveryTelefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    // Cambiar estado del pedido a "en camino"
    await actualizarEstado(pedido.id, 'en camino', { disabled: false, innerHTML: '' });
    
    mostrarToast(`Pedido #${pedido.id} asignado a ${deliveryNombre}`, 'success');
    cerrarModalAsignarDelivery();
}

// ===================================================
// GESTIÓN DE DELIVERY
// ===================================================

async function cargarDeliveries(forceRefresh = false) {
    if (!vendedorActual) return;
    
    const container = document.getElementById('delivery-grid');
    if (container) {
        container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando deliveries...</p></div>`;
    }
    
    try {
        const response = await callAPI('getDeliveries', { vendedorId: vendedorActual.id }, forceRefresh);
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        deliveries = response.deliveries || [];
        
        renderizarDeliveries();
        
        const badgeDelivery = document.getElementById('badge-delivery');
        if (badgeDelivery) {
            badgeDelivery.textContent = deliveries.length;
        }
        
    } catch (error) {
        console.error('Error al cargar deliveries:', error);
        if (container) {
            container.innerHTML = `<div class="error-mensaje"><p>Error al cargar deliveries: ${error.message}</p></div>`;
        }
    }
}

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
                <button class="btn-wa-delivery" onclick="whatsappDelivery('${d.telefono}', '${escapeHTML(d.nombre)}')" title="WhatsApp">
                    <i class="fab fa-whatsapp"></i>
                </button>
                <button class="btn-delete-delivery" onclick="eliminarDelivery(${d.id})" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function abrirModalDelivery(deliveryId = null) {
    if (deliveryId) {
        const delivery = deliveries.find(d => d.id === deliveryId);
        if (delivery) {
            document.getElementById('delivery-id').value = delivery.id;
            document.getElementById('delivery-nombre').value = delivery.nombre;
            document.getElementById('delivery-telefono').value = delivery.telefono;
            document.getElementById('modal-delivery-title').textContent = 'Editar delivery';
        }
    } else {
        document.getElementById('delivery-form').reset();
        document.getElementById('delivery-id').value = '';
        document.getElementById('modal-delivery-title').textContent = 'Nuevo delivery';
    }
    document.getElementById('modal-delivery').classList.add('active');
}

function cerrarModalDelivery() {
    document.getElementById('modal-delivery').classList.remove('active');
}

async function guardarDelivery() {
    const deliveryId = document.getElementById('delivery-id').value;
    const nombre = document.getElementById('delivery-nombre').value.trim();
    const telefono = document.getElementById('delivery-telefono').value.trim();
    
    if (!nombre || !telefono) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    
    const data = {
        vendedor_id: vendedorActual.id,
        nombre: nombre,
        telefono: telefono
    };
    
    if (deliveryId) data.id = parseInt(deliveryId);
    
    const action = deliveryId ? 'actualizarDelivery' : 'crearDelivery';
    
    try {
        const response = await postAPI(action, data);
        if (response && response.success) {
            mostrarToast(deliveryId ? 'Delivery actualizado' : 'Delivery creado', 'success');
            cerrarModalDelivery();
            await cargarDeliveries(true);
        } else {
            throw new Error(response?.error || 'Error al guardar');
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
        } else {
            throw new Error(response?.error || 'Error al eliminar');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

function whatsappDelivery(telefono, nombre) {
    const mensaje = `Hola ${nombre}, soy del negocio. Necesito contactarte.`;
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// ===================================================
// EDICIÓN DE PEDIDO COMPLETO
// ===================================================

let productosTempEdit = [];

function abrirModalEditarPedido(pedidoId) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    modoEdicionPedido = 'editar';
    pedidoEditandoId = pedido.id;
    productosTempEdit = JSON.parse(JSON.stringify(pedido.productos || []));
    
    document.getElementById('edit-pedido-id').value = pedido.id;
    document.getElementById('edit-pedido-id-display').textContent = pedido.id;
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

function cerrarModalEditarPedido() {
    document.getElementById('modal-editar-pedido').classList.remove('active');
    modoEdicionPedido = null;
    pedidoEditandoId = null;
    productosTempEdit = [];
}

function renderizarProductosEditar() {
    const container = document.getElementById('productos-editar-container');
    if (!container) return;
    
    if (productosTempEdit.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">No hay productos agregados</p>';
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
            <button class="btn-eliminar-producto" onclick="eliminarProductoEdit(${idx})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function modificarCantidadProductoEdit(index, cambio) {
    if (productosTempEdit[index]) {
        productosTempEdit[index].cantidad += cambio;
        if (productosTempEdit[index].cantidad <= 0) {
            productosTempEdit.splice(index, 1);
        }
        renderizarProductosEditar();
        actualizarTotalEdit();
    }
}

function eliminarProductoEdit(index) {
    productosTempEdit.splice(index, 1);
    renderizarProductosEditar();
    actualizarTotalEdit();
}

function actualizarTotalEdit() {
    const total = productosTempEdit.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
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
    const total = productosTempEdit.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
    
    if (!cliente_nombre || !cliente_telefono || !direccion) {
        mostrarToast('Completá todos los campos obligatorios', 'error');
        return;
    }
    
    const data = {
        id: pedidoId,
        cliente_nombre: cliente_nombre,
        cliente_telefono: cliente_telefono,
        direccion: direccion,
        detalles: detalles,
        metodo_pago: metodo_pago,
        estado: estado,
        productos: productosTempEdit,
        total: total
    };
    
    try {
        const response = await postAPI('actualizarPedidoCompleto', data);
        if (response && response.success) {
            mostrarToast('Pedido actualizado correctamente', 'success');
            cerrarModalEditarPedido();
            await cargarPedidos(true);
        } else {
            throw new Error(response?.error || 'Error al actualizar');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

// ===================================================
// CREAR NUEVO PEDIDO DESDE PANEL
// ===================================================

let productosTempNuevo = [];

function abrirModalNuevoPedido() {
    modoEdicionPedido = 'nuevo';
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

function cerrarModalNuevoPedido() {
    document.getElementById('modal-nuevo-pedido').classList.remove('active');
    modoEdicionPedido = null;
    productosTempNuevo = [];
}

function renderizarProductosNuevo() {
    const container = document.getElementById('productos-nuevo-container');
    if (!container) return;
    
    if (productosTempNuevo.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">No hay productos agregados</p>';
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
            <button class="btn-eliminar-producto" onclick="eliminarProductoNuevo(${idx})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function modificarCantidadProductoNuevo(index, cambio) {
    if (productosTempNuevo[index]) {
        productosTempNuevo[index].cantidad += cambio;
        if (productosTempNuevo[index].cantidad <= 0) {
            productosTempNuevo.splice(index, 1);
        }
        renderizarProductosNuevo();
        actualizarTotalNuevo();
    }
}

function eliminarProductoNuevo(index) {
    productosTempNuevo.splice(index, 1);
    renderizarProductosNuevo();
    actualizarTotalNuevo();
}

function actualizarTotalNuevo() {
    const total = productosTempNuevo.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
    document.getElementById('nuevo-total').value = formatearPrecio(total);
}

async function guardarNuevoPedido() {
    const cliente_nombre = document.getElementById('nuevo-cliente-nombre').value.trim();
    const cliente_telefono = document.getElementById('nuevo-cliente-telefono').value.trim();
    const direccion = document.getElementById('nuevo-direccion').value.trim();
    const detalles = document.getElementById('nuevo-detalles').value.trim();
    const metodo_pago = document.getElementById('nuevo-metodo-pago').value;
    const total = productosTempNuevo.reduce((sum, p) => sum + (p.precio * p.cantidad), 0);
    
    if (!cliente_nombre || !cliente_telefono || !direccion) {
        mostrarToast('Completá todos los campos obligatorios', 'error');
        return;
    }
    
    if (productosTempNuevo.length === 0) {
        mostrarToast('Agregá al menos un producto', 'error');
        return;
    }
    
    const data = {
        vendedor_id: vendedorActual.id,
        cliente_nombre: cliente_nombre,
        cliente_telefono: cliente_telefono,
        direccion: direccion,
        detalles: detalles,
        metodo_pago: metodo_pago,
        productos: productosTempNuevo,
        total: total
    };
    
    try {
        const response = await postAPI('crearPedidoVendedor', data);
        if (response && response.success) {
            mostrarToast('Pedido creado correctamente', 'success');
            cerrarModalNuevoPedido();
            await cargarPedidos(true);
        } else {
            throw new Error(response?.error || 'Error al crear pedido');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

// ===================================================
// MODAL PARA SELECCIONAR PRODUCTO (AGREGAR A PEDIDO)
// ===================================================

let currentProductosList = null;
let currentCallback = null;

function abrirModalSeleccionarProducto(productosList, callback) {
    currentProductosList = productosList;
    currentCallback = callback;
    
    const select = document.getElementById('select-producto');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar...</option>';
        productos.forEach(p => {
            if (p.disponible === 'SI') {
                select.innerHTML += `<option value="${p.id}" data-precio="${p.precio}" data-nombre="${escapeHTML(p.nombre)}">${escapeHTML(p.nombre)} - ${formatearPrecio(p.precio)}</option>`;
            }
        });
    }
    
    document.getElementById('select-cantidad').value = '1';
    document.getElementById('modal-seleccionar-producto').classList.add('active');
}

function cerrarModalSeleccionarProducto() {
    document.getElementById('modal-seleccionar-producto').classList.remove('active');
    currentProductosList = null;
    currentCallback = null;
}

function confirmarAgregarProducto() {
    const select = document.getElementById('select-producto');
    const selectedOption = select.options[select.selectedIndex];
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
            cantidad: cantidad
        });
    }
    
    cerrarModalSeleccionarProducto();
}

// ===================================================
// GESTIÓN DE PRODUCTOS
// ===================================================

function limpiarCacheProductos() {
    console.log('🧹 Limpiando caché de productos...');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('getProductos') || key.includes('productos'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) console.log(`✅ Caché limpiado: ${keysToRemove.length} items`);
}

function verificarProductosPropios() {
    if (!vendedorActual || !productos.length) return;
    let productosInvalidos = 0;
    productos.forEach(producto => {
        const productoVendedorId = producto.vendedor_id ? producto.vendedor_id.toString() : null;
        const vendedorActualId = vendedorActual.id.toString();
        if (productoVendedorId !== vendedorActualId) {
            console.warn(`⚠️ Producto inválido: ${producto.id} (${producto.nombre}) - Vendedor: ${productoVendedorId}, Esperado: ${vendedorActualId}`);
            productosInvalidos++;
        }
    });
    if (productosInvalidos > 0) {
        productos = productos.filter(p => {
            const pid = p.vendedor_id ? p.vendedor_id.toString() : null;
            return pid === vendedorActual.id.toString();
        });
        renderizarProductosAdmin();
    }
}

async function cargarProductos(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('productos-admin-grid');
    if (container) container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando productos...</p></div>`;
    
    try {
        if (forceRefresh) limpiarCacheProductos();
        const response = await callAPI('getProductos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        
        let productosRecibidos = response.productos || [];
        productosRecibidos = productosRecibidos.filter(p => {
            const pid = p.vendedor_id ? p.vendedor_id.toString() : null;
            return pid === vendedorActual.id.toString();
        });
        
        productos = productosRecibidos;
        renderizarProductosAdmin();
        
        const badgeProductos = document.getElementById('badge-productos');
        if (badgeProductos) badgeProductos.textContent = productos.length;
    } catch (error) {
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar productos: ${error.message}</p></div>`;
    }
}

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
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
            document.getElementById('producto-id').value = producto.id;
            document.getElementById('producto-nombre').value = producto.nombre;
            document.getElementById('producto-descripcion').value = producto.descripcion || '';
            document.getElementById('producto-precio').value = producto.precio;
            document.getElementById('producto-disponible').value = producto.disponible || 'SI';
            const preview = document.getElementById('producto-imagen-preview');
            if (preview && producto.imagen_url) preview.innerHTML = `<img src="${producto.imagen_url}" style="max-width: 100px; border-radius: 8px;">`;
            document.getElementById('modal-producto-title').textContent = 'Editar producto';
        }
    } else {
        document.getElementById('producto-form').reset();
        document.getElementById('producto-id').value = '';
        document.getElementById('producto-imagen-preview').innerHTML = '';
        document.getElementById('producto-disponible').value = 'SI';
        document.getElementById('modal-producto-title').textContent = 'Nuevo producto';
    }
    document.getElementById('modal-producto').classList.add('active');
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').classList.remove('active');
}

async function guardarProducto() {
    if (!vendedorActual) return;
    const productoId = document.getElementById('producto-id').value;
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
    
    const data = { vendedor_id: vendedorActual.id, nombre, descripcion, precio, disponible };
    if (imagenUrl) data.imagen_url = imagenUrl;
    if (productoId) data.id = parseInt(productoId);
    const action = productoId ? 'actualizarProducto' : 'crearProducto';
    
    try {
        const response = await postAPI(action, data);
        if (response && response.success) {
            mostrarToast(productoId ? 'Producto actualizado' : 'Producto creado', 'success');
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
    if (!confirm(`¿Eliminar el producto "${producto.nombre}"?`)) return;
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

function inicializarModalProducto() {
    const modal = document.getElementById('modal-producto');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModalProducto(); });
    const imagenInput = document.getElementById('producto-imagen');
    if (imagenInput) {
        imagenInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('producto-imagen-preview');
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (ev) => preview.innerHTML = `<img src="${ev.target.result}" style="max-width: 100px; border-radius: 8px;">`;
                reader.readAsDataURL(file);
            }
        });
    }
}

// ===================================================
// PERFIL
// ===================================================

function cargarPerfil() {
    if (!vendedorActual) return;
    const perfilNombre = document.getElementById('perfil-nombre');
    const perfilTelefono = document.getElementById('perfil-telefono');
    const perfilDireccion = document.getElementById('perfil-direccion');
    const perfilHorario = document.getElementById('perfil-horario');
    const logoPreview = document.getElementById('logo-preview');
    
    if (perfilNombre) perfilNombre.value = vendedorActual.nombre || '';
    if (perfilTelefono) perfilTelefono.value = vendedorActual.telefono || '';
    if (perfilDireccion) perfilDireccion.value = vendedorActual.direccion || '';
    if (perfilHorario) perfilHorario.value = vendedorActual.horario || '';
    if (logoPreview && vendedorActual.logo_url) logoPreview.innerHTML = `<img src="${vendedorActual.logo_url}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">`;
    
    const btnUploadLogo = document.getElementById('btn-upload-logo');
    const logoInput = document.getElementById('perfil-logo');
    if (btnUploadLogo && logoInput) {
        btnUploadLogo.addEventListener('click', () => logoInput.click());
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && logoPreview) {
                const reader = new FileReader();
                reader.onload = (e) => logoPreview.innerHTML = `<img src="${e.target.result}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">`;
                reader.readAsDataURL(file);
            }
        });
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
    if (logoFile) {
        mostrarToast('Subiendo logo...', 'info');
        logoUrl = await subirImagenACloudinary(logoFile);
        if (!logoUrl) { mostrarToast('Error al subir logo', 'error'); return; }
    }
    
    const updateData = { id: vendedorActual.id, nombre, telefono, direccion, horario, logo_url: logoUrl };
    if (newPassword) {
        if (newPassword.length < 6) { mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
        updateData.password_hash = await hashPassword(newPassword);
    }
    
    try {
        const response = await postAPI('actualizarVendedor', updateData);
        if (response && response.success) {
            mostrarToast('Perfil actualizado', 'success');
            vendedorActual = { ...vendedorActual, nombre, telefono, direccion, horario, logo_url: logoUrl };
            const panelNombre = document.getElementById('panel-nombre');
            const perfilNombreDisplay = document.getElementById('perfil-nombre-display');
            if (panelNombre) panelNombre.textContent = nombre;
            if (perfilNombreDisplay) perfilNombreDisplay.textContent = nombre;
            document.getElementById('perfil-new-password').value = '';
        } else throw new Error(response?.error || 'Error');
    } catch (error) { mostrarToast('Error al actualizar perfil', 'error'); }
}

// ===================================================
// REGISTRO CON LOGO
// ===================================================

async function registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile) {
    let logoUrl = null;
    if (logoFile) {
        mostrarToast('Subiendo logo...', 'info');
        logoUrl = await subirImagenACloudinary(logoFile);
        if (!logoUrl) { mostrarToast('Error al subir el logo', 'error'); return false; }
    }
    const passwordHash = await hashPassword(password);
    return await postAPI('registrarVendedor', { nombre, email, telefono, direccion, horario, password_hash: passwordHash, logo_url: logoUrl });
}

// ===================================================
// INICIALIZACIÓN DEL PANEL
// ===================================================

async function iniciarPanel(vendedor) {
    const adminAuth = document.getElementById('admin-auth');
    const adminPanel = document.getElementById('admin-panel');
    const panelNombre = document.getElementById('panel-nombre');
    const panelEmail = document.getElementById('panel-email');
    const perfilNombreDisplay = document.getElementById('perfil-nombre-display');
    const perfilEmailDisplay = document.getElementById('perfil-email-display');
    
    if (adminAuth) adminAuth.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'block';
    if (panelNombre) panelNombre.textContent = vendedor.nombre;
    if (panelEmail) panelEmail.textContent = vendedor.email;
    if (perfilNombreDisplay) perfilNombreDisplay.textContent = vendedor.nombre;
    if (perfilEmailDisplay) perfilEmailDisplay.textContent = vendedor.email;
    
    await cargarPedidos();
    await cargarProductos();
    await cargarDeliveries();
    cargarPerfil();
    
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', async () => {
        const btn = btnRefresh;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
        await cargarPedidos(true);
        await cargarProductos(true);
        await cargarDeliveries(true);
        btn.innerHTML = originalText;
        btn.disabled = false;
        mostrarToast('Datos actualizados', 'success');
    });
    
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
    const mobileLogout = document.getElementById('mobile-logout-btn');
    if (mobileLogout) mobileLogout.addEventListener('click', cerrarSesion);
    
    const btnAgregarProducto = document.getElementById('btn-agregar-producto');
    if (btnAgregarProducto) btnAgregarProducto.addEventListener('click', () => abrirModalProducto());
    
    const btnAgregarDelivery = document.getElementById('btn-agregar-delivery');
    if (btnAgregarDelivery) btnAgregarDelivery.addEventListener('click', () => abrirModalDelivery());
    
    const btnNuevoPedido = document.getElementById('btn-nuevo-pedido');
    if (btnNuevoPedido) btnNuevoPedido.addEventListener('click', () => abrirModalNuevoPedido());
    
    inicializarTabs();
    inicializarFiltros();
    inicializarMenuAdmin();
    inicializarModalTiempo();
    inicializarModalProducto();
    inicializarBuscador();
    
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
    
    const btnAgregarProductoEditar = document.getElementById('btn-agregar-producto-editar');
    if (btnAgregarProductoEditar) {
        btnAgregarProductoEditar.addEventListener('click', () => {
            abrirModalSeleccionarProducto(productosTempEdit, (producto) => {
                const existente = productosTempEdit.find(p => p.id === producto.id);
                if (existente) existente.cantidad += producto.cantidad;
                else productosTempEdit.push(producto);
                renderizarProductosEditar();
                actualizarTotalEdit();
            });
        });
    }
    
    const btnAgregarProductoNuevo = document.getElementById('btn-agregar-producto-nuevo');
    if (btnAgregarProductoNuevo) {
        btnAgregarProductoNuevo.addEventListener('click', () => {
            abrirModalSeleccionarProducto(productosTempNuevo, (producto) => {
                const existente = productosTempNuevo.find(p => p.id === producto.id);
                if (existente) existente.cantidad += producto.cantidad;
                else productosTempNuevo.push(producto);
                renderizarProductosNuevo();
                actualizarTotalNuevo();
            });
        });
    }
    
    const btnEnviarDelivery = document.getElementById('btn-enviar-delivery');
    if (btnEnviarDelivery) btnEnviarDelivery.addEventListener('click', enviarPedidoADelivery);
}

function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            const tabContent = document.getElementById(`tab-${tabId}`);
            if (tabContent) tabContent.classList.add('active');
            if (tabId === 'productos') cargarProductos();
            if (tabId === 'delivery') cargarDeliveries();
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
    const menuToggle = document.getElementById('menu-toggle-admin');
    const mobileMenu = document.getElementById('mobile-menu-admin');
    const menuOverlay = document.getElementById('menu-overlay-admin');
    const menuClose = document.getElementById('menu-close-admin');
    
    if (menuToggle) menuToggle.addEventListener('click', () => { mobileMenu.classList.add('active'); menuOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; });
    if (menuClose) menuClose.addEventListener('click', () => { mobileMenu.classList.remove('active'); menuOverlay.classList.remove('active'); document.body.style.overflow = ''; });
    if (menuOverlay) menuOverlay.addEventListener('click', () => { mobileMenu.classList.remove('active'); menuOverlay.classList.remove('active'); document.body.style.overflow = ''; });
    
    const mobileTabs = document.querySelectorAll('.mobile-tab-btn');
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(t => { t.classList.remove('active'); if (t.getAttribute('data-tab') === tabId) t.classList.add('active'); });
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
            mobileMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
            if (tabId === 'productos') cargarProductos();
            if (tabId === 'delivery') cargarDeliveries();
        });
    });
}

function inicializarModalTiempo() {
    const btnConfirmarTiempo = document.getElementById('btn-confirmar-tiempo');
    const btnCancelarTiempo = document.getElementById('btn-cancelar-tiempo');
    const cerrarModalTiempoBtn = document.getElementById('cerrar-modal-tiempo');
    const tiempoInput = document.getElementById('tiempo-entrega-input');
    if (btnConfirmarTiempo) btnConfirmarTiempo.addEventListener('click', enviarConfirmacionWhatsApp);
    if (btnCancelarTiempo) btnCancelarTiempo.addEventListener('click', cerrarModalTiempo);
    if (cerrarModalTiempoBtn) cerrarModalTiempoBtn.addEventListener('click', cerrarModalTiempo);
    if (tiempoInput) tiempoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); enviarConfirmacionWhatsApp(); } });
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
        renderizarPedidos();
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
// LOGIN
// ===================================================

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
            limpiarCacheProductos();
            const rememberMe = document.getElementById('remember-me')?.checked || false;
            if (rememberMe) localStorage.setItem('want_sesion', JSON.stringify({ id: vendedorActual.id, email: vendedorActual.email, nombre: vendedorActual.nombre }));
            else guardarSesion(vendedorActual);
            await iniciarPanel(vendedorActual);
            mostrarToast(`Bienvenido ${vendedorActual.nombre}`, 'success');
            setTimeout(() => verificarProductosPropios(), 1000);
        } else throw new Error(response.error || 'Email o contraseña incorrectos');
    } catch (error) { mostrarToast(error.message, 'error'); }
}

// ===================================================
// FUNCIONES PARA CAMBIAR PANELES DE AUTENTICACIÓN
// ===================================================

function mostrarPanelLogin() { document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active')); document.getElementById('login-panel').classList.add('active'); }
function mostrarPanelRegistro() { document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active')); document.getElementById('register-panel').classList.add('active'); }
function mostrarPanelRecuperacion() { document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active')); document.getElementById('recover-panel').classList.add('active'); }

// ===================================================
// FUNCIONES UTILITARIAS
// ===================================================

function formatearPrecio(precio) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio); }
function escapeHTML(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
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
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===================================================
// INICIALIZACIÓN DE AUTENTICACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Panel de Vendedor iniciado');
    const sesion = cargarSesionGuardada();
    if (!sesion) { const adminAuth = document.getElementById('admin-auth'); if (adminAuth) adminAuth.style.display = 'flex'; }
    
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) { const type = input.getAttribute('type') === 'password' ? 'text' : 'password'; input.setAttribute('type', type); btn.querySelector('i').classList.toggle('fa-eye'); btn.querySelector('i').classList.toggle('fa-eye-slash'); }
        });
    });
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', async (e) => { e.preventDefault(); await login(); });
    
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
            if (password !== password2) { alert('Las contraseñas no coinciden'); return; }
            if (password.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return; }
            const response = await registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile);
            if (response && response.success) {
                alert('Registro exitoso. Ahora podés iniciar sesión.');
                mostrarPanelLogin();
                document.getElementById('register-form').reset();
                document.getElementById('reg-logo-preview').innerHTML = '';
                document.getElementById('login-email').value = email;
            } else alert(response?.error || 'Error al registrar');
        });
        const regLogo = document.getElementById('reg-logo');
        if (regLogo) regLogo.addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => { const preview = document.getElementById('reg-logo-preview'); if (preview) preview.innerHTML = `<img src="${e.target.result}" style="max-width: 80px; border-radius: 12px;">`; }; reader.readAsDataURL(file); } });
    }
    
    const recoverForm = document.getElementById('recover-form');
    if (recoverForm) {
        recoverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('recover-email')?.value.trim() || '';
            const response = await postAPI('solicitarRecuperacion', { email });
            if (response.success) {
                alert('Código enviado a tu email');
                const recoverCodeSection = document.getElementById('recover-code-section');
                if (recoverCodeSection) recoverCodeSection.style.display = 'block';
                if (response.codigo) console.log('Código de recuperación (demo):', response.codigo);
            } else alert(response.error);
        });
    }
    
    const btnReset = document.getElementById('btn-reset-password');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const email = document.getElementById('recover-email')?.value.trim() || '';
            const codigo = document.getElementById('recover-code')?.value.trim() || '';
            const newPassword = document.getElementById('recover-new-password')?.value || '';
            const newPassword2 = document.getElementById('recover-new-password2')?.value || '';
            if (newPassword !== newPassword2) { alert('Las contraseñas no coinciden'); return; }
            const response = await postAPI('resetearPassword', { email, codigo, new_password_hash: await hashPassword(newPassword) });
            if (response.success) {
                alert('Contraseña restablecida. Iniciá sesión.');
                mostrarPanelLogin();
                document.getElementById('recover-code-section').style.display = 'none';
                document.getElementById('recover-form').reset();
            } else alert(response.error);
        });
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