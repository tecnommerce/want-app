// ===================================================
// ADMIN - Panel de vendedor (COMPLETO CON ESTADO Y MODAL RUBROS)
// ===================================================

console.log('🚀 admin.js cargado correctamente');

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

// ===================================================
// RUBROS - LISTA Y FUNCIONES (con Pancheria)
// ===================================================

const RUBROS_DISPONIBLES = [
    'Sandwichería', 'Hamburguesería', 'Pizzería', 'Empanadas', 'Pancheria',
    'Comida casera', 'Kiosco', 'Bebidas', 'Despensa', 'Supermercado',
    'Panadería', 'Verdulería', 'Pollería', 'Carnicería', 'Cafetería',
    'Bar', 'Restaurante', 'Bar y café', 'Heladería', 'Farmacia', 'Mascotas'
];

// ===================================================
// MODAL SELECTOR DE RUBROS
// ===================================================

let rubrosTemporales = [];
let rubrosCallback = null;

function abrirModalRubros(rubrosActuales, callback) {
    rubrosTemporales = [...(rubrosActuales || [])];
    rubrosCallback = callback;
    
    // Cerrar modal padre (perfil) temporalmente si está abierto
    const modalPerfil = document.getElementById('modal-perfil');
    const modalPerfilEstabaAbierto = modalPerfil && modalPerfil.classList.contains('active');
    
    if (modalPerfilEstabaAbierto) {
        modalPerfil.classList.remove('active');
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
    
    document.getElementById('modal-rubros').classList.add('active');
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
    document.getElementById('modal-rubros').classList.remove('active');
    rubrosCallback = null;
    
    // Reabrir modal padre (perfil) si estaba abierto
    if (window.modalPerfilAbierto) {
        document.getElementById('modal-perfil').classList.add('active');
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
// ESTADO ABIERTO/CERRADO (TOGGLE SWITCH)
// ===================================================

async function toggleEstadoAbierto() {
    if (!vendedorActual) return;
    
    const nuevoEstado = !vendedorActual.estado_abierto;
    const btnToggle = document.getElementById('toggle-estado-switch');
    
    await withLoading(btnToggle, async () => {
        try {
            const response = await postAPI('actualizarVendedor', {
                id: vendedorActual.id,
                estado_abierto: nuevoEstado
            });
            
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
    
    if (toggleSwitch) {
        toggleSwitch.checked = estadoAbierto;
    }
    
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
    pedidos.forEach(p => { const estado = p.estado || 'preparando'; if (contarPorEstado[estado] !== undefined) contarPorEstado[estado]++; });
    
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

// ===================================================
// FILTRAR PEDIDOS
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

// ===================================================
// RENDERIZAR PEDIDOS - DETECCIÓN MÓVIL/DESKTOP
// ===================================================

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    
    // Detectar si es móvil (ancho de pantalla <= 768px)
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
    
    let html = `
        <table class="pedidos-tabla">
            <thead>
                <tr>
                    <th class="col-id">ID</th>
                    <th class="col-fecha">Fecha</th>
                    <th class="col-cliente">Cliente</th>
                    <th class="col-telefono">Teléfono</th>
                    <th class="col-direccion">Dirección</th>
                    <th class="col-pago">Pago</th>
                    <th class="col-productos">Productos</th>
                    <th class="col-total">Total</th>
                    <th class="col-estado">Estado</th>
                    <th class="col-acciones">Acciones</th>
                 </tr>
            </thead>
            <tbody>
    `;
    
    for (const p of pedidosFiltrados) {
        const fecha = new Date(p.fecha);
        const metodoPago = p.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo';
        const estado = p.estado || 'preparando';
        const numeroMostrar = p.numero_orden || p.id;
        
        let productosResumen = '';
        if (p.productos && Array.isArray(p.productos) && p.productos.length > 0) {
            const primeros = p.productos.slice(0, 2);
            productosResumen = primeros.map(pr => `${pr.cantidad}x ${pr.nombre}`).join(', ');
            if (p.productos.length > 2) {
                productosResumen += ` +${p.productos.length - 2} más`;
            }
        } else {
            productosResumen = 'Sin productos';
        }
        
        const total = formatearPrecio(p.total || 0);
        
        let botonesHTML = '';
        
        if (estado === 'preparando') {
            botonesHTML = `
                <button class="btn-tabla btn-whatsapp" onclick="confirmarPedidoWhatsApp(${p.id}, this)"><i class="fab fa-whatsapp"></i> Confirmar</button>
                <button class="btn-tabla btn-preparar" onclick="actualizarEstado(${p.id}, 'en preparacion', this)"><i class="fas fa-utensils"></i> Preparar</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        } else if (estado === 'en preparacion') {
            botonesHTML = `
                <button class="btn-tabla btn-pedido-listo" onclick="abrirModalAsignarDelivery(${p.id})"><i class="fas fa-check-circle"></i> Listo</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        } else if (estado === 'en camino') {
            botonesHTML = `
                <button class="btn-tabla btn-notificar" onclick="notificarEnCamino(${p.id}, this)"><i class="fab fa-whatsapp"></i> Notificar</button>
                <button class="btn-tabla btn-entregar" onclick="actualizarEstado(${p.id}, 'entregado', this)"><i class="fas fa-check-double"></i> Entregar</button>
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        } else if (estado === 'entregado') {
            botonesHTML = `
                <button class="btn-tabla btn-editar" onclick="abrirModalEditarPedido(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-tabla btn-cancelar-tabla" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i></button>
            `;
        }
        
        html += `
            <tr onclick="verPedidoCompleto(${p.id})" style="cursor: pointer;">
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
            </tr>
        `;
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// ===================================================
// RENDERIZAR PEDIDOS EN MÓVIL (TARJETAS)
// ===================================================

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
        const fecha = new Date(p.fecha);
        const estado = p.estado || 'preparando';
        const numeroMostrar = p.numero_orden || p.id;
        
        let productosResumen = '';
        if (p.productos && Array.isArray(p.productos) && p.productos.length > 0) {
            const primeros = p.productos.slice(0, 2);
            productosResumen = primeros.map(pr => `${pr.cantidad}x ${pr.nombre}`).join(', ');
            if (p.productos.length > 2) {
                productosResumen += ` +${p.productos.length - 2} más`;
            }
        } else {
            productosResumen = 'Sin productos';
        }
        
        let estadoTexto = '';
        let estadoClase = '';
        if (estado === 'preparando') {
            estadoTexto = 'NUEVO';
            estadoClase = 'estado-preparando';
        } else if (estado === 'en preparacion') {
            estadoTexto = 'EN PREPARACIÓN';
            estadoClase = 'estado-en-preparacion';
        } else if (estado === 'en camino') {
            estadoTexto = 'EN CAMINO';
            estadoClase = 'estado-en-camino';
        } else if (estado === 'entregado') {
            estadoTexto = 'ENTREGADO';
            estadoClase = 'estado-entregado';
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
                    <div class="pedido-resumen-movil">💰 ${formatearPrecio(p.total || 0)}</div>
                </div>
                <div class="pedido-card-footer">
                    <button class="btn-ver-pedido-movil" onclick="verPedidoCompletoMovil(${p.id})">
                        <i class="fas fa-eye"></i> Ver pedido
                    </button>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

// ===================================================
// VER PEDIDO COMPLETO MÓVIL CON BOTONES DE ACCIÓN
// ===================================================

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
            productosHTML += `
                <div class="producto-detalle">
                    <span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span>
                    <span>${formatearPrecio(pr.precio * pr.cantidad)}</span>
                </div>
            `;
        });
    } else {
        productosHTML = '<p>No hay productos</p>';
    }
    
    let detallesHTML = '';
    if (pedido.detalles && pedido.detalles.trim()) {
        detallesHTML = `
            <div class="detalle-seccion">
                <strong><i class="fas fa-pen"></i> Detalles:</strong>
                <p>${escapeHTML(pedido.detalles)}</p>
            </div>
        `;
    }
    
    // Generar botones según el estado
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
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-calendar"></i> Fecha:</strong>
                        <p>${fecha.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-user"></i> Cliente:</strong>
                        <p>${escapeHTML(pedido.cliente_nombre || 'Sin nombre')}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-phone"></i> Teléfono:</strong>
                        <p>${pedido.cliente_telefono || 'Sin teléfono'}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong>
                        <p>${escapeHTML(pedido.direccion || 'Sin dirección')}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-money-bill-wave"></i> Pago:</strong>
                        <p>${metodoPago}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-box"></i> Productos:</strong>
                        <div class="productos-detalle">${productosHTML}</div>
                    </div>
                    ${detallesHTML}
                    <div class="detalle-seccion total">
                        <strong><i class="fas fa-calculator"></i> Total:</strong>
                        <p class="total-monto">${formatearPrecio(pedido.total || 0)}</p>
                    </div>
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
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModalPedidoCompletoMovil();
    });
}

function cerrarModalPedidoCompletoMovil() {
    const modal = document.getElementById('modal-pedido-completo-movil');
    if (modal) modal.remove();
}

// ===================================================
// VER PEDIDO COMPLETO (MODAL DESKTOP)
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
            productosHTML += `
                <div class="producto-detalle">
                    <span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span>
                    <span>${formatearPrecio(pr.precio * pr.cantidad)}</span>
                </div>
            `;
        });
    } else {
        productosHTML = '<p>No hay productos</p>';
    }
    
    let detallesHTML = '';
    if (pedido.detalles && pedido.detalles.trim()) {
        detallesHTML = `
            <div class="detalle-seccion">
                <strong><i class="fas fa-pen"></i> Detalles del pedido:</strong>
                <p>${escapeHTML(pedido.detalles)}</p>
            </div>
        `;
    }
    
    const modalContent = `
        <div class="modal" id="modal-pedido-completo" style="display: flex;">
            <div class="modal-content" style="max-width: 550px;">
                <div class="modal-header">
                    <h3><i class="fas fa-receipt"></i> Pedido #${numeroMostrar}</h3>
                    <button class="modal-close" onclick="cerrarModalPedidoCompleto()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-calendar"></i> Fecha:</strong>
                        <p>${fecha.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-user"></i> Cliente:</strong>
                        <p>${escapeHTML(pedido.cliente_nombre || 'Sin nombre')}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-phone"></i> Teléfono:</strong>
                        <p>${pedido.cliente_telefono || 'Sin teléfono'}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong>
                        <p>${escapeHTML(pedido.direccion || 'Sin dirección')}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-money-bill-wave"></i> Método de pago:</strong>
                        <p>${metodoPago}</p>
                    </div>
                    <div class="detalle-seccion">
                        <strong><i class="fas fa-box"></i> Productos:</strong>
                        <div class="productos-detalle">${productosHTML}</div>
                    </div>
                    ${detallesHTML}
                    <div class="detalle-seccion total">
                        <strong><i class="fas fa-calculator"></i> Total:</strong>
                        <p class="total-monto">${formatearPrecio(pedido.total || 0)}</p>
                    </div>
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
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModalPedidoCompleto();
    });
}

function cerrarModalPedidoCompleto() {
    const modal = document.getElementById('modal-pedido-completo');
    if (modal) modal.remove();
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
                renderizarPedidos();
                actualizarReportes();
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
                renderizarPedidos();
                actualizarReportes();
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
    if (select) {
        select.innerHTML = '<option value="">Seleccionar...</option>';
        deliveries.forEach(d => { select.innerHTML += `<option value="${d.id}" data-telefono="${d.telefono}" data-nombre="${escapeHTML(d.nombre)}">${escapeHTML(d.nombre)} - ${d.telefono}</option>`; });
    }
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
        const badge = document.getElementById('badge-delivery');
        if (badge) badge.textContent = deliveries.length;
    } catch (error) { 
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar deliveries</p></div>`; 
    }
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
                <button class="btn-edit-delivery" onclick="abrirModalDelivery(${d.id})"><i class="fas fa-edit"></i></button>
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
        const badge = document.getElementById('badge-productos');
        if (badge) badge.textContent = productos.length;
    } catch (error) { 
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar productos</p></div>`; 
    }
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
    if (productoId) { const p = productos.find(p => p.id === productoId); if (p) { document.getElementById('producto-id').value = p.id; document.getElementById('producto-nombre').value = p.nombre; document.getElementById('producto-descripcion').value = p.descripcion || ''; document.getElementById('producto-precio').value = p.precio; document.getElementById('producto-disponible').value = p.disponible ? 'SI' : 'NO'; const preview = document.getElementById('producto-imagen-preview'); if (preview && p.imagen_url) preview.innerHTML = `<img src="${p.imagen_url}" style="max-width: 100px;">`; document.getElementById('modal-producto-title').textContent = 'Editar producto'; } }
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
        nombre: nombre,
        descripcion: descripcion,
        precio: precio,
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
async function eliminarProducto(productoId) { const producto = productos.find(p => p.id === productoId); if (!producto) return; if (!confirm(`¿Eliminar "${producto.nombre}"?`)) return; try { const response = await postAPI('eliminarProducto', { productoId }); if (response.success) { mostrarToast('Producto eliminado', 'success'); await cargarProductos(true); } } catch (error) { mostrarToast('Error al eliminar', 'error'); } }

// ===================================================
// PERFIL (con Modal de Rubros)
// ===================================================

let rubrosTempPerfil = [];

function abrirModalPerfil() { cargarPerfil(); document.getElementById('modal-perfil').classList.add('active'); }
function cerrarModalPerfil() { document.getElementById('modal-perfil').classList.remove('active'); }

function cargarPerfil() {
    if (!vendedorActual) return;
    const pn = document.getElementById('perfil-nombre');
    const pt = document.getElementById('perfil-telefono');
    const pd = document.getElementById('perfil-direccion');
    const ph = document.getElementById('perfil-horario');
    const pnd = document.getElementById('perfil-nombre-display');
    const ped = document.getElementById('perfil-email-display');
    
    if (pn) pn.value = vendedorActual.nombre || '';
    if (pt) pt.value = vendedorActual.telefono || '';
    if (pd) pd.value = vendedorActual.direccion || '';
    if (ph) ph.value = vendedorActual.horario || '';
    if (pnd) pnd.textContent = vendedorActual.nombre || '';
    if (ped) ped.textContent = vendedorActual.email || '';
    
    // Mostrar rubros actuales como tags
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
    
    // Configurar botón para abrir modal
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
    
    const rubrosSeleccionados = rubrosTempPerfil;
    
    let logoUrl = vendedorActual.logo_url;
    if (logoFile) { 
        mostrarToast('Subiendo logo...', 'info'); 
        logoUrl = await subirImagenACloudinary(logoFile); 
        if (!logoUrl) { 
            mostrarToast('Error al subir logo', 'error'); 
            return; 
        } 
    }
    
    const updateData = { 
        id: vendedorActual.id, 
        nombre, 
        telefono, 
        direccion, 
        horario, 
        logo_url: logoUrl,
        rubros: rubrosSeleccionados
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
            vendedorActual = { ...vendedorActual, nombre, telefono, direccion, horario, logo_url: logoUrl, rubros: rubrosSeleccionados }; 
            const pn = document.getElementById('panel-nombre'); 
            if (pn) pn.textContent = nombre; 
            const pnd = document.getElementById('perfil-nombre-display'); 
            if (pnd) pnd.textContent = nombre; 
            const pnp = document.getElementById('perfil-new-password'); 
            if (pnp) pnp.value = ''; 
            cerrarModalPerfil(); 
        }
        else throw new Error(response?.error || 'Error');
    } catch (error) { 
        mostrarToast('Error al actualizar perfil', 'error'); 
    }
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
    productos.forEach(p => { if (p.disponible === true || p.disponible === 'SI') select.innerHTML += `<option value="${p.id}" data-precio="${p.precio}" data-nombre="${escapeHTML(p.nombre)}">${escapeHTML(p.nombre)} - ${formatearPrecio(p.precio)}</option>`; });
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
// REGISTRO Y LOGIN (con Modal de Rubros)
// ===================================================

let rubrosTempRegistro = [];

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
        nombre: nombre,
        email: email,
        telefono: telefono,
        direccion: direccion,
        horario: horario,
        password: password,
        logo_url: logoUrl,
        rubros: rubros
    });
    
    console.log('Respuesta registro:', response);
    return response;
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

// ===================================================
// MOSTRAR PANEL REGISTRO (con rubros funcionales)
// ===================================================

function mostrarPanelRegistro() { 
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active')); 
    document.getElementById('register-panel').classList.add('active'); 
    
    // Resetear rubros temporales
    rubrosTempRegistro = [];
    
    // Generar botones de rubros para registro
    const rubrosContainer = document.getElementById('rubros-selector-registro');
    if (rubrosContainer) {
        rubrosContainer.innerHTML = RUBROS_DISPONIBLES.map(rubro => `
            <button type="button" class="btn-rubro-registro ${rubrosTempRegistro.includes(rubro) ? 'selected' : ''}" data-rubro="${rubro}">
                ${rubro}
            </button>
        `).join('');
        
        // Agregar event listeners a los botones
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

// ===================================================
// FUNCIONES PARA REPORTES
// ===================================================

function actualizarReportes() {
    if (!pedidos) return;
    
    // Calcular métricas para reportes
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
    
    // Actualizar elementos del DOM de reportes
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
    
    // Top productos más vendidos
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
    
    const topProductos = Object.entries(ventasPorProducto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
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
    
    // Ventas por día (últimos 7 días)
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const ventasPorDia = Array(7).fill(0);
    const hoyDate = new Date();
    
    pedidos.forEach(pedido => {
        if (pedido.estado === 'entregado') {
            const fechaPedido = new Date(pedido.fecha);
            const diffDias = Math.floor((hoyDate - fechaPedido) / (1000 * 60 * 60 * 24));
            if (diffDias >= 0 && diffDias < 7) {
                const diaIndex = fechaPedido.getDay();
                ventasPorDia[diaIndex] += parseFloat(pedido.total) || 0;
            }
        }
    });
    
    const ventasDiasContainer = document.getElementById('reporte-ventas-dias');
    if (ventasDiasContainer) {
        ventasDiasContainer.innerHTML = diasSemana.map((dia, i) => `
            <div class="dia-item">
                <span class="dia-nombre">${dia}</span>
                <span class="dia-valor">${formatearPrecio(ventasPorDia[i])}</span>
            </div>
        `).join('');
    }
    
    // Últimos 10 pedidos
    const ultimosPedidos = [...pedidos]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 10);
    
    const ultimosPedidosContainer = document.getElementById('reporte-ultimos-pedidos');
    if (ultimosPedidosContainer) {
        if (ultimosPedidos.length === 0) {
            ultimosPedidosContainer.innerHTML = '<div class="loading-small">No hay pedidos</div>';
        } else {
            ultimosPedidosContainer.innerHTML = ultimosPedidos.map(p => `
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
    
    // Actualizar nombre y logo en el header
    const headerNombreNegocio = document.getElementById('header-nombre-negocio');
    if (headerNombreNegocio) headerNombreNegocio.textContent = vendedor.nombre;
    
    const headerLogoImg = document.getElementById('header-logo-img');
    if (headerLogoImg && vendedor.logo_url) {
        headerLogoImg.src = vendedor.logo_url;
        headerLogoImg.style.display = 'block';
    }
    
    const panelNombre = document.getElementById('panel-nombre');
    const panelEmail = document.getElementById('panel-email');
    if (panelNombre) panelNombre.textContent = vendedor.nombre;
    if (panelEmail) panelEmail.textContent = vendedor.email;
    
    // Actualizar UI del estado abierto/cerrado
    actualizarUIEstadoAbierto();
    
    await cargarPedidos();
    await cargarProductos();
    await cargarDeliveries();
    actualizarReportes();
    
    // Event listeners
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
    if (btnCancelarTiempo) btnCancelarTiempo.addEventListener('click', cerrarModalTiempo);
    
    const cerrarModalTiempoBtn = document.getElementById('cerrar-modal-tiempo');
    if (cerrarModalTiempoBtn) cerrarModalTiempoBtn.addEventListener('click', cerrarModalTiempo);
    
    const btnAgregarProductoEditar = document.getElementById('btn-agregar-producto-editar');
    if (btnAgregarProductoEditar) {
        btnAgregarProductoEditar.addEventListener('click', () => {
            abrirModalSeleccionarProducto(productosTempEdit, (prod) => {
                const existente = productosTempEdit.find(p => p.id === prod.id);
                if (existente) existente.cantidad += prod.cantidad;
                else productosTempEdit.push(prod);
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
                if (existente) existente.cantidad += prod.cantidad;
                else productosTempNuevo.push(prod);
                renderizarProductosNuevo();
                actualizarTotalNuevo();
            });
        });
    }
    
    // Event listener para el toggle de estado
    const toggleSwitch = document.getElementById('toggle-estado-switch');
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', toggleEstadoAbierto);
    }
    
    inicializarTabs();
    inicializarFiltros();
    inicializarMenuAdmin();
    inicializarBuscador();
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
            
            // Actualizar clase activa en tabs móviles
            mobileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Cambiar tab activo en desktop
            document.querySelectorAll('.tab-btn').forEach(t => {
                t.classList.remove('active');
                if (t.getAttribute('data-tab') === tabId) t.classList.add('active');
            });
            
            // Ocultar todos los tab-content y mostrar el seleccionado
            document.querySelectorAll('.tab-content').forEach(c => {
                c.classList.remove('active');
            });
            const tabContent = document.getElementById(`tab-${tabId}`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // Cargar datos según el tab
            if (tabId === 'productos') cargarProductos();
            if (tabId === 'delivery') cargarDeliveries();
            if (tabId === 'reportes') actualizarReportes();
            
            closeMenu();
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
        renderizarPedidos();
        actualizarReportes();
        
        if (forceRefresh) mostrarToast('Pedidos actualizados', 'success');
    } catch (error) { 
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar pedidos: ${error.message}</p></div>`; 
    }
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
// INICIALIZAR BUSCADOR (con botón limpiar corregido)
// ===================================================

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
// INICIALIZACIÓN PRINCIPAL
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, configurando event listeners');
    
    // Cargar sesión guardada
    const sesion = cargarSesionGuardada();
    if (!sesion) { 
        const adminAuth = document.getElementById('admin-auth');
        if (adminAuth) adminAuth.style.display = 'flex'; 
    }
    
    // Detectar cambio de tamaño de pantalla para cambiar entre vista móvil y desktop
    window.addEventListener('resize', () => {
        if (pedidos.length > 0) {
            renderizarPedidos();
        }
    });
    
    // Toggle password
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
    
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            await login(); 
        });
        console.log('✅ Login form configurado');
    }
    
    // Register form
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
            
            if (password !== password2) { alert('Las contraseñas no coinciden'); return; }
            if (password.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return; }
            if (rubrosSeleccionados.length === 0) { alert('Selecciona al menos un rubro'); return; }
            
            const response = await registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile, rubrosSeleccionados);
            
            if (response && response.success) { 
                alert('Registro exitoso. Ahora podés iniciar sesión.'); 
                mostrarPanelLogin(); 
                registerForm.reset(); 
                rubrosTempRegistro = [];
                const rubrosContainer = document.getElementById('rubros-selector-registro');
                if (rubrosContainer) rubrosContainer.innerHTML = '';
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
    
    // Botones de navegación
    const showRegister = document.getElementById('btn-show-register');
    if (showRegister) showRegister.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelRegistro(); });
    
    const showRecover = document.getElementById('btn-show-recover');
    if (showRecover) showRecover.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelRecuperacion(); });
    
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) backToLogin.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelLogin(); });
    
    const backToLoginRecover = document.getElementById('back-to-login-recover');
    if (backToLoginRecover) backToLoginRecover.addEventListener('click', (e) => { e.preventDefault(); mostrarPanelLogin(); });
});

// Exponer funciones globalmente
window.login = login;
window.registrarVendedorConLogo = registrarVendedorConLogo;
window.mostrarPanelRegistro = mostrarPanelRegistro;
window.mostrarPanelRecuperacion = mostrarPanelRecuperacion;
window.mostrarPanelLogin = mostrarPanelLogin;
window.cargarPedidos = cargarPedidos;
window.cargarProductos = cargarProductos;
window.cargarDeliveries = cargarDeliveries;
window.abrirModalRubros = abrirModalRubros;
window.cerrarModalRubros = cerrarModalRubros;
window.confirmarRubros = confirmarRubros;
window.toggleEstadoAbierto = toggleEstadoAbierto;
window.verPedidoCompletoMovil = verPedidoCompletoMovil;
window.cerrarModalPedidoCompletoMovil = cerrarModalPedidoCompletoMovil;