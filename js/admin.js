// ===================================================
// ADMIN - Panel de vendedor (versión completa sin emojis)
// ===================================================

// Configuración de Cloudinary
const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r';
const CLOUDINARY_UPLOAD_PRESET = 'want_productos';

// Variables globales
let vendedorActual = null;
let pedidos = [];
let productos = [];
let filtroActual = 'preparando';
let pedidoPendienteConfirmar = null;
let botonPendienteConfirmar = null;

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
// RENDERIZAR PEDIDOS
// ===================================================

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    
    let pedidosFiltrados = pedidos.filter(p => p.estado === filtroActual);
    pedidosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No hay pedidos en esta categoría</p></div>`;
        return;
    }
    
    container.innerHTML = pedidosFiltrados.map(p => {
        const fecha = new Date(p.fecha);
        const metodoPago = p.metodo_pago || 'efectivo';
        const esNuevo = p.estado === 'preparando';
        
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
                        <span class="estado-badge estado-${p.estado.replace(' ', '-')}">${getEstadoTexto(p.estado)}</span>
                    </div>
                    <div class="botones-estado">
                        ${esNuevo ? `<button class="btn-confirmar-whatsapp" onclick="confirmarPedidoWhatsApp(${p.id}, this)"><i class="fab fa-whatsapp"></i> Confirmar pedido</button>` : ''}
                        ${p.estado !== 'preparando' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'preparando', this)">Nuevo</button>` : ''}
                        ${p.estado !== 'en preparacion' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'en preparacion', this)">Preparar</button>` : ''}
                        ${p.estado !== 'en camino' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'en camino', this)">En camino</button>` : ''}
                        ${p.estado !== 'entregado' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'entregado', this)">Entregar</button>` : ''}
                    </div>
                    <div class="botones-acciones">
                        ${p.estado === 'en camino' ? `
                            <button class="btn-notificar-camino" onclick="notificarEnCamino(${p.id}, this)">
                                <i class="fab fa-whatsapp"></i> Notificar llegada
                            </button>
                        ` : ''}
                        <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)">
                            <i class="fas fa-trash-alt"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getEstadoTexto(estado) {
    const textos = { 'preparando': 'NUEVO PEDIDO', 'en preparacion': 'EN PREPARACIÓN', 'en camino': 'EN CAMINO', 'entregado': 'ENTREGADO' };
    return textos[estado] || estado.toUpperCase();
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
            mostrarToast(`Pedido #${pedidoId} actualizado`, 'success');
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
// CONFIRMAR PEDIDO POR WHATSAPP (SIN EMOJIS)
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
    
    let mensaje = `*WANT - Confirmacion de tu pedido*\n\n`;
    mensaje += `Hola ${pedido.cliente_nombre},\n\n`;
    mensaje += `Recibimos tu pedido correctamente!\n\n`;
    mensaje += `DETALLE DE TU PEDIDO:\n`;
    pedido.productos.forEach(p => {
        mensaje += `- ${p.cantidad}x ${p.nombre}\n`;
    });
    
    if (pedido.detalles) {
        mensaje += `\nINDICACIONES ESPECIALES:\n`;
        mensaje += `${pedido.detalles}\n`;
    }
    
    mensaje += `\nTOTAL A PAGAR: $${pedido.total.toLocaleString('es-AR')}\n`;
    mensaje += `NUMERO DE ORDEN: #${pedido.id}\n\n`;
    
    mensaje += `TIEMPO ESTIMADO DE ENTREGA: ${tiempoEntrega}\n\n`;
    
    if (metodoPagoTexto === 'transferencia') {
        mensaje += `Metodo de pago: Transferencia bancaria\n`;
        mensaje += `Te pasaremos nuestro alias y CBU por este mismo medio para que realices el pago.\n\n`;
    } else {
        mensaje += `Metodo de pago: Efectivo\n`;
        mensaje += `Pagaras al recibir tu pedido.\n\n`;
    }
    
    mensaje += `DIRECCION DE ENTREGA: ${pedido.direccion}\n\n`;
    mensaje += `Ahora estamos preparando tu pedido con mucho cuidado.\n`;
    mensaje += `Te avisaremos cuando este en camino.\n\n`;
    mensaje += `Gracias por confiar en nosotros!\n\n`;
    mensaje += `_Cualquier consulta, responde este mensaje._`;
    
    const url = `https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    try {
        const response = await postAPI('actualizarEstado', { pedidoId: pedido.id, estado: 'en preparacion' });
        if (response && response.success) {
            mostrarToast(`Pedido #${pedido.id} confirmado y actualizado a "En preparación"`, 'success');
            pedido.estado = 'en preparacion';
            actualizarContadoresPedidos();
            calcularMetricas();
            renderizarPedidos();
        }
    } catch (error) {
        console.error('Error al actualizar estado:', error);
    }
    
    cerrarModalTiempo();
    
    setTimeout(() => {
        boton.disabled = false;
        boton.innerHTML = originalText;
    }, 2000);
    
    pedidoPendienteConfirmar = null;
    botonPendienteConfirmar = null;
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
// NOTIFICAR CLIENTE QUE EL PEDIDO ESTÁ EN CAMINO (SIN EMOJIS)
// ===================================================

async function notificarEnCamino(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    const originalText = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `*WANT - Actualizacion de tu pedido*\n\n`;
    mensaje += `Hola ${pedido.cliente_nombre},\n\n`;
    mensaje += `Tu pedido esta en camino!\n\n`;
    mensaje += `DETALLE DE TU PEDIDO:\n`;
    pedido.productos.forEach(p => {
        mensaje += `- ${p.cantidad}x ${p.nombre}\n`;
    });
    
    if (pedido.detalles) {
        mensaje += `\nINDICACIONES ESPECIALES:\n`;
        mensaje += `${pedido.detalles}\n`;
    }
    
    mensaje += `\nTOTAL A PAGAR: $${pedido.total.toLocaleString('es-AR')}\n`;
    mensaje += `DIRECCION DE ENTREGA: ${pedido.direccion}\n\n`;
    
    if (metodoPagoTexto === 'transferencia') {
        mensaje += `Metodo de pago: Transferencia bancaria\n`;
    } else {
        mensaje += `Metodo de pago: Efectivo (pagas al recibir)\n`;
    }
    
    mensaje += `\nQuedate atento al delivery!\n`;
    mensaje += `Gracias por tu compra!`;
    
    const url = `https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    setTimeout(() => {
        boton.disabled = false;
        boton.innerHTML = originalText;
    }, 1500);
}

// ===================================================
// GESTIÓN DE PRODUCTOS
// ===================================================

async function cargarProductos(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('productos-admin-grid');
    if (container) container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando productos...</p></div>`;
    
    try {
        const response = await callAPI('getProductos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        productos = response.productos || [];
        renderizarProductosAdmin();
        const badgeProductos = document.getElementById('badge-productos');
        if (badgeProductos) badgeProductos.textContent = productos.length;
    } catch (error) {
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar productos</p></div>`;
    }
}

function renderizarProductosAdmin() {
    const container = document.getElementById('productos-admin-grid');
    if (!container) return;
    if (productos.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No tenés productos cargados</p><button class="btn-primary btn-add-producto" onclick="abrirModalProducto()">Agregar producto</button></div>`;
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
    mostrarToast('Funcionalidad en desarrollo', 'info');
}

async function eliminarProducto(productoId) {
    if (!confirm('¿Eliminar este producto?')) return;
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
    
    if (logoPreview && vendedorActual.logo_url) {
        logoPreview.innerHTML = `<img src="${vendedorActual.logo_url}" style="max-width: 100px; border-radius: 12px;">`;
    }
    
    const btnUploadLogo = document.getElementById('btn-upload-logo');
    const logoInput = document.getElementById('perfil-logo');
    if (btnUploadLogo && logoInput) {
        btnUploadLogo.addEventListener('click', () => logoInput.click());
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && logoPreview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    logoPreview.innerHTML = `<img src="${e.target.result}" style="max-width: 100px; border-radius: 12px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    const perfilForm = document.getElementById('perfil-form');
    if (perfilForm) {
        perfilForm.onsubmit = async (e) => {
            e.preventDefault();
            await actualizarPerfil();
        };
    }
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
        if (!logoUrl) {
            mostrarToast('Error al subir logo', 'error');
            return;
        }
    }
    
    const updateData = { id: vendedorActual.id, nombre, telefono, direccion, horario, logo_url: logoUrl };
    if (newPassword) {
        if (newPassword.length < 6) {
            mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        updateData.password_hash = await hashPassword(newPassword);
    }
    
    try {
        const response = await postAPI('actualizarVendedor', updateData);
        if (response && response.success) {
            mostrarToast('Perfil actualizado', 'success');
            vendedorActual = { ...vendedorActual, nombre, telefono, direccion, horario, logo_url: logoUrl };
            const panelNombre = document.getElementById('panel-nombre');
            const perfilNombreDisplay = document.getElementById('perfil-nombre-display');
            const perfilNewPassword = document.getElementById('perfil-new-password');
            if (panelNombre) panelNombre.textContent = nombre;
            if (perfilNombreDisplay) perfilNombreDisplay.textContent = nombre;
            if (perfilNewPassword) perfilNewPassword.value = '';
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast('Error al actualizar perfil', 'error');
    }
}

// ===================================================
// REGISTRO CON LOGO
// ===================================================

async function registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile) {
    let logoUrl = null;
    
    if (logoFile) {
        mostrarToast('Subiendo logo...', 'info');
        logoUrl = await subirImagenACloudinary(logoFile);
        if (!logoUrl) {
            mostrarToast('Error al subir el logo', 'error');
            return false;
        }
    }
    
    const passwordHash = await hashPassword(password);
    
    const response = await postAPI('registrarVendedor', {
        nombre, email, telefono, direccion, horario,
        password_hash: passwordHash,
        logo_url: logoUrl
    });
    
    return response;
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
    cargarPerfil();
    
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            await cargarPedidos(true);
            await cargarProductos(true);
        });
    }
    
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
    
    const mobileLogout = document.getElementById('mobile-logout-btn');
    if (mobileLogout) mobileLogout.addEventListener('click', cerrarSesion);
    
    const btnAgregar = document.getElementById('btn-agregar-producto');
    if (btnAgregar) btnAgregar.addEventListener('click', () => abrirModalProducto());
    
    inicializarTabs();
    inicializarFiltros();
    inicializarMenuAdmin();
    inicializarModalTiempo();
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
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.classList.add('active');
            if (menuOverlay) menuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    if (menuClose) {
        menuClose.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.classList.remove('active');
            if (menuOverlay) menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.classList.remove('active');
            if (menuOverlay) menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    const mobileTabs = document.querySelectorAll('.mobile-tab-btn');
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(t => {
                t.classList.remove('active');
                if (t.getAttribute('data-tab') === tabId) t.classList.add('active');
            });
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            const tabContent = document.getElementById(`tab-${tabId}`);
            if (tabContent) tabContent.classList.add('active');
            if (mobileMenu) mobileMenu.classList.remove('active');
            if (menuOverlay) menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
            if (tabId === 'productos') cargarProductos();
        });
    });
}

function inicializarModalTiempo() {
    const btnConfirmarTiempo = document.getElementById('btn-confirmar-tiempo');
    const btnCancelarTiempo = document.getElementById('btn-cancelar-tiempo');
    const cerrarModalTiempoBtn = document.getElementById('cerrar-modal-tiempo');
    const tiempoInput = document.getElementById('tiempo-entrega-input');
    
    if (btnConfirmarTiempo) {
        btnConfirmarTiempo.addEventListener('click', enviarConfirmacionWhatsApp);
    }
    if (btnCancelarTiempo) {
        btnCancelarTiempo.addEventListener('click', cerrarModalTiempo);
    }
    if (cerrarModalTiempoBtn) {
        cerrarModalTiempoBtn.addEventListener('click', cerrarModalTiempo);
    }
    if (tiempoInput) {
        tiempoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                enviarConfirmacionWhatsApp();
            }
        });
    }
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
    } catch (error) {
        if (container) container.innerHTML = `<div class="error-mensaje"><p>Error al cargar pedidos</p></div>`;
    }
}

async function cargarVendedorPorId(vendedorId) {
    try {
        const response = await callAPI('getVendedores', {}, true);
        if (response.success) {
            const vendedor = response.vendedores.find(v => v.id.toString() === vendedorId.toString());
            if (vendedor && vendedor.activo === 'SI') {
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
// LOGIN
// ===================================================

async function login() {
    console.log('🔐 Iniciando login...');
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    
    if (!email || !password) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    
    try {
        mostrarToast('Validando credenciales...', 'info');
        
        const passwordHash = await hashPassword(password);
        
        const response = await callAPI('loginVendedor', { email, password: passwordHash }, true);
        
        if (response.success && response.vendedor) {
            vendedorActual = response.vendedor;
            
            const rememberMe = document.getElementById('remember-me')?.checked || false;
            if (rememberMe) {
                localStorage.setItem('want_sesion', JSON.stringify({ id: vendedorActual.id, email: vendedorActual.email, nombre: vendedorActual.nombre }));
            } else {
                guardarSesion(vendedorActual);
            }
            
            await iniciarPanel(vendedorActual);
            mostrarToast(`Bienvenido ${vendedorActual.nombre}`, 'success');
        } else {
            throw new Error(response.error || 'Email o contraseña incorrectos');
        }
    } catch (error) {
        console.error('Error login:', error);
        mostrarToast(error.message, 'error');
    }
}

// ===================================================
// FUNCIONES UTILITARIAS
// ===================================================

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
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '50px';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===================================================
// INICIALIZACIÓN DE AUTENTICACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Panel de Vendedor iniciado');
    
    const sesion = cargarSesionGuardada();
    if (!sesion) {
        const adminAuth = document.getElementById('admin-auth');
        if (adminAuth) adminAuth.style.display = 'flex';
    }
    
    // Toggle password
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                btn.querySelector('i').classList.toggle('fa-eye');
                btn.querySelector('i').classList.toggle('fa-eye-slash');
            }
        });
    });
    
    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await login();
        });
    }
    
    // Register
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
            
            if (password !== password2) {
                alert('Las contraseñas no coinciden');
                return;
            }
            
            if (password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres');
                return;
            }
            
            const response = await registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile);
            
            if (response && response.success) {
                alert('Registro exitoso. Ahora podés iniciar sesión.');
                const loginPanel = document.getElementById('login-panel');
                const registerPanel = document.getElementById('register-panel');
                if (loginPanel) loginPanel.style.display = 'block';
                if (registerPanel) registerPanel.style.display = 'none';
                const regForm = document.getElementById('register-form');
                if (regForm) regForm.reset();
                const regLogoPreview = document.getElementById('reg-logo-preview');
                if (regLogoPreview) regLogoPreview.innerHTML = '';
            } else {
                alert(response?.error || 'Error al registrar');
            }
        });
        
        // Vista previa del logo en registro
        const regLogo = document.getElementById('reg-logo');
        if (regLogo) {
            regLogo.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const preview = document.getElementById('reg-logo-preview');
                        if (preview) preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100px; border-radius: 12px;">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }
    
    // Recover
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
            } else {
                alert(response.error);
            }
        });
    }
    
    // Reset password
    const btnReset = document.getElementById('btn-reset-password');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const email = document.getElementById('recover-email')?.value.trim() || '';
            const codigo = document.getElementById('recover-code')?.value.trim() || '';
            const newPassword = document.getElementById('recover-new-password')?.value || '';
            const newPassword2 = document.getElementById('recover-new-password2')?.value || '';
            
            if (newPassword !== newPassword2) {
                alert('Las contraseñas no coinciden');
                return;
            }
            
            const response = await postAPI('resetearPassword', { email, codigo, new_password_hash: await hashPassword(newPassword) });
            if (response.success) {
                alert('Contraseña restablecida. Iniciá sesión.');
                const recoverPanel = document.getElementById('recover-panel');
                const loginPanel = document.getElementById('login-panel');
                if (recoverPanel) recoverPanel.style.display = 'none';
                if (loginPanel) loginPanel.style.display = 'block';
            } else {
                alert(response.error);
            }
        });
    }
    
    // Tabs de autenticación
    const showRegister = document.getElementById('btn-show-register');
    const showRecover = document.getElementById('btn-show-recover');
    const backToLogin = document.getElementById('back-to-login');
    const backToLoginRecover = document.getElementById('back-to-login-recover');
    
    if (showRegister) {
        showRegister.addEventListener('click', () => {
            const loginPanel = document.getElementById('login-panel');
            const registerPanel = document.getElementById('register-panel');
            if (loginPanel) loginPanel.style.display = 'none';
            if (registerPanel) registerPanel.style.display = 'block';
        });
    }
    if (showRecover) {
        showRecover.addEventListener('click', () => {
            const loginPanel = document.getElementById('login-panel');
            const recoverPanel = document.getElementById('recover-panel');
            if (loginPanel) loginPanel.style.display = 'none';
            if (recoverPanel) recoverPanel.style.display = 'block';
        });
    }
    if (backToLogin) {
        backToLogin.addEventListener('click', () => {
            const loginPanel = document.getElementById('login-panel');
            const registerPanel = document.getElementById('register-panel');
            if (loginPanel) loginPanel.style.display = 'block';
            if (registerPanel) registerPanel.style.display = 'none';
        });
    }
    if (backToLoginRecover) {
        backToLoginRecover.addEventListener('click', () => {
            const loginPanel = document.getElementById('login-panel');
            const recoverPanel = document.getElementById('recover-panel');
            if (loginPanel) loginPanel.style.display = 'block';
            if (recoverPanel) recoverPanel.style.display = 'none';
        });
    }
});