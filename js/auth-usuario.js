// ===================================================
// AUTENTICACIÓN DE USUARIOS - WANT
// ===================================================

let usuarioActual = null;
let pedidosUsuario = [];
let authSubscription = null;
let notificacionesAbiertas = false;
let notificacionesActuales = [];
let realtimeCanalPedidos = null;  // ✅ Canal de tiempo real para pedidos

// ===================================================
// UTILIDADES
// ===================================================

function formatearFechaArgentina(fechaISO) {
    if (!fechaISO) return 'N/A';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
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
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio);
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'N/A';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-AR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

function getEstadoPedidoTexto(estado) {
    const estados = {
        'preparando': 'Pedido tomado',
        'en preparacion': 'Preparando',
        'en camino': 'En camino',
        'entregado': 'Entregado',
        'cancelado': 'Pedido cancelado'
    };
    return estados[estado] || estado;
}

function getEstadoColor(estado) {
    const colores = {
        'preparando': '#FF9800',
        'en preparacion': '#2196F3',
        'en camino': '#9C27B0',
        'entregado': '#4CAF50',
        'cancelado': '#EF4444'
    };
    return colores[estado] || '#666';
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

// ===================================================
// FUNCIONES GLOBALES PARA NAVEGACIÓN
// ===================================================

function mostrarMisPedidos() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    const searchContainer = document.getElementById('search-container');
    
    if (mainContent) mainContent.style.display = 'none';
    if (misPedidosScreen) misPedidosScreen.style.display = 'block';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    
    // Ocultar buscador en Mis Pedidos
    if (searchContainer) searchContainer.style.display = 'none';
    
    cargarPedidosUsuario();
}

function mostrarMiCuenta() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    const searchContainer = document.getElementById('search-container');
    
    if (mainContent) mainContent.style.display = 'none';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'block';
    
    // Ocultar buscador en Mi Cuenta
    if (searchContainer) searchContainer.style.display = 'none';
    
    // ✅ Detener tiempo real al salir de Mis pedidos
    detenerRealtimePedidosUsuario();
    
    forzarCargaDatosUsuario().then(() => {
        cargarDatosUsuarioFormulario();
    });
}

function volverAlHome() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    const searchContainer = document.getElementById('search-container');
    
    if (mainContent) mainContent.style.display = 'block';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    
    // Mostrar buscador en el home
    if (searchContainer) searchContainer.style.display = 'block';
    
    // ✅ Detener tiempo real al salir de Mis pedidos
    detenerRealtimePedidosUsuario();
    
    if (typeof cargarNegocios === 'function') cargarNegocios();
    if (typeof cargarBanners === 'function') cargarBanners();
}

function mostrarModalContacto() {
    const modal = document.getElementById('contacto-modal');
    if (modal) modal.classList.add('active');
}

function cerrarModalContacto() {
    const modal = document.getElementById('contacto-modal');
    if (modal) modal.classList.remove('active');
}

// ===================================================
// FORZAR RECARGA DE DATOS DEL USUARIO
// ===================================================

async function forzarCargaDatosUsuario() {
    console.log('🔄 Forzando carga de datos de usuario...');
    
    const sessionGuardada = localStorage.getItem('want_usuario_sesion');
    if (!sessionGuardada) {
        console.log('⚠️ No hay sesión guardada');
        return false;
    }
    
    try {
        const userData = JSON.parse(sessionGuardada);
        const result = await obtenerUsuarioPorAuthId(userData.id);
        
        if (result.success && result.usuario) {
            usuarioActual = result.usuario;
            console.log('✅ Usuario recargado:', usuarioActual.email);
            cargarDatosUsuarioUI();
            return true;
        }
    } catch (error) {
        console.error('Error forzando carga:', error);
    }
    
    return false;
}

// ===================================================
// FUNCIONES DE AUTENTICACIÓN
// ===================================================

async function handleUserLogin(user) {
    console.log('👤 Usuario logueado:', user.email);
    
    if (typeof obtenerUsuarioPorAuthId === 'function') {
        const result = await obtenerUsuarioPorAuthId(user.id);
        
        if (result.success && result.usuario) {
            usuarioActual = result.usuario;
            localStorage.setItem('want_usuario_sesion', JSON.stringify({
                id: usuarioActual.id,
                email: usuarioActual.email,
                nombre: usuarioActual.nombre
            }));
            
            // Redirigir según si hay URL guardada
            const redirectUrl = sessionStorage.getItem('redirect_after_login');
            if (redirectUrl) {
                sessionStorage.removeItem('redirect_after_login');
                window.location.href = redirectUrl;
            } else {
                window.location.href = 'index.html';
            }
        } else {
            window.usuarioAuth = user;
            window.location.href = 'login.html#registro';
        }
    }
}

function handleUserLogout() {
    usuarioActual = null;
    localStorage.removeItem('want_usuario_sesion');
    sessionStorage.removeItem('want_usuario_sesion');
    window.location.href = 'login.html';
}

function mostrarPantallaPrincipal() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    const searchContainer = document.getElementById('search-container');
    const userAvatarDesktop = document.getElementById('user-avatar-desktop');
    const userAvatarMobile = document.getElementById('user-avatar-mobile');
    const navDesktop = document.getElementById('nav-desktop');
    
    if (mainContent) mainContent.style.display = 'block';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'block';
    if (userAvatarDesktop) userAvatarDesktop.style.display = 'flex';
    if (userAvatarMobile) userAvatarMobile.style.display = 'flex';
    if (navDesktop) navDesktop.style.display = 'flex';
    
    if (typeof cargarNegocios === 'function') cargarNegocios();
    if (typeof cargarBanners === 'function') cargarBanners();
}

function cargarDatosUsuarioUI() {
    if (!usuarioActual) return;
    
    const avatarUrl = usuarioActual.foto_perfil || 'https://ui-avatars.com/api/?background=FF5A00&color=fff&name=' + encodeURIComponent(usuarioActual.nombre);
    
    const avatarImgDesktop = document.getElementById('avatar-img-desktop');
    const avatarNameDesktop = document.getElementById('avatar-name-desktop');
    if (avatarImgDesktop) {
        avatarImgDesktop.src = avatarUrl;
        avatarImgDesktop.onerror = () => {
            avatarImgDesktop.src = 'https://ui-avatars.com/api/?background=FF5A00&color=fff&name=' + encodeURIComponent(usuarioActual.nombre);
        };
    }
    if (avatarNameDesktop) avatarNameDesktop.textContent = usuarioActual.nombre;
    
    const avatarImgMobile = document.getElementById('avatar-img-mobile');
    if (avatarImgMobile) {
        avatarImgMobile.src = avatarUrl;
        avatarImgMobile.onerror = () => {
            avatarImgMobile.src = 'https://ui-avatars.com/api/?background=FF5A00&color=fff&name=' + encodeURIComponent(usuarioActual.nombre);
        };
    }
}

function cargarDatosUsuarioFormulario() {
    if (!usuarioActual) return;
    
    const nombreCompleto = `${usuarioActual.nombre || ''} ${usuarioActual.apellido || ''}`.trim();
    
    const nombreInput = document.getElementById('cuenta-nombre');
    const emailInput = document.getElementById('cuenta-email');
    const provinciaSelect = document.getElementById('cuenta-provincia');
    const ciudadSelect = document.getElementById('cuenta-ciudad');
    const direccionInput = document.getElementById('cuenta-direccion');
    const telefonoInput = document.getElementById('cuenta-telefono');
    const avatarImg = document.getElementById('cuenta-avatar-img');
    
    if (nombreInput) nombreInput.value = nombreCompleto;
    if (emailInput) emailInput.value = usuarioActual.email || '';
    if (provinciaSelect) provinciaSelect.value = usuarioActual.provincia || '';
    if (ciudadSelect) ciudadSelect.value = usuarioActual.ciudad || '';
    if (direccionInput) direccionInput.value = usuarioActual.direccion || '';
    if (telefonoInput) telefonoInput.value = usuarioActual.telefono || '';
    
    if (avatarImg) {
        avatarImg.src = usuarioActual.foto_perfil || 'https://ui-avatars.com/api/?background=FF5A00&color=fff&name=' + encodeURIComponent(usuarioActual.nombre);
    }
}

async function guardarDatosUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-cuenta');
    
    await withLoading(btn, async () => {
        const nombreCompleto = document.getElementById('cuenta-nombre')?.value.trim() || '';
        const provincia = document.getElementById('cuenta-provincia')?.value || '';
        const ciudad = document.getElementById('cuenta-ciudad')?.value || '';
        const direccion = document.getElementById('cuenta-direccion')?.value.trim() || '';
        let telefono = document.getElementById('cuenta-telefono')?.value.trim() || '';
        
        if (!nombreCompleto || !provincia || !ciudad || !direccion || !telefono) {
            mostrarToast('Completá todos los campos', 'error');
            return;
        }
        
        const nombreParts = nombreCompleto.split(' ');
        const nombre = nombreParts[0] || '';
        const apellido = nombreParts.slice(1).join(' ') || '';
        
        if (!apellido) {
            mostrarToast('Ingresá tu nombre y apellido completo', 'error');
            return;
        }
        
        const telefonoLimpio = telefono.replace(/\D/g, '');
        if (!telefonoLimpio.match(/^\d{10,15}$/)) {
            mostrarToast('Ingresá un teléfono válido (10-15 dígitos)', 'error');
            return;
        }
        
        const updateData = { nombre, apellido, provincia, ciudad, direccion, telefono: telefonoLimpio };
        
        const result = await actualizarDatosUsuario(usuarioActual.id, updateData);
        if (result.success) {
            usuarioActual = result.usuario;
            localStorage.setItem('want_usuario_sesion', JSON.stringify({
                id: usuarioActual.id,
                email: usuarioActual.email,
                nombre: usuarioActual.nombre
            }));
            mostrarToast('Datos actualizados correctamente', 'success');
            cargarDatosUsuarioUI();
        } else {
            mostrarToast('Error al actualizar datos', 'error');
        }
    });
}

// ===================================================
// FUNCIONES DE PEDIDOS DEL USUARIO
// ===================================================

async function cargarPedidosUsuario() {
    if (!usuarioActual) return;
    
    const result = await obtenerPedidosUsuario(usuarioActual.id);
    if (result.success) {
        pedidosUsuario = result.pedidos || [];
        renderizarPedidosUsuario();
        actualizarTotalGastado();
        
        // ✅ Iniciar tiempo real para los pedidos de este usuario
        iniciarRealtimePedidosUsuario();
    }
}

// ✅ NUEVA FUNCIÓN: Iniciar tiempo real para pedidos del usuario
function iniciarRealtimePedidosUsuario() {
    if (!usuarioActual) return;
    
    // Cerrar canal anterior si existe
    if (realtimeCanalPedidos) {
        supabaseClient.removeChannel(realtimeCanalPedidos);
    }
    
    console.log('🔄 Iniciando tiempo real para pedidos del usuario:', usuarioActual.id);
    
    realtimeCanalPedidos = supabaseClient
        .channel('usuario-pedidos-' + usuarioActual.id)
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'pedidos',
                filter: `usuario_id=eq.${usuarioActual.id}`
            },
            (payload) => {
                console.log('📢 Pedido actualizado en tiempo real:', payload.new);
                const pedidoActualizado = payload.new;
                
                // Actualizar el pedido en el array local
                const index = pedidosUsuario.findIndex(p => p.id === pedidoActualizado.id);
                if (index !== -1) {
                    // Mantener los productos si no vienen en el payload
                    if (!pedidoActualizado.productos && pedidosUsuario[index].productos) {
                        pedidoActualizado.productos = pedidosUsuario[index].productos;
                    }
                    pedidosUsuario[index] = pedidoActualizado;
                } else {
                    // Si no existe, agregarlo
                    pedidosUsuario.push(pedidoActualizado);
                }
                
                // Re-renderizar la lista de pedidos
                renderizarPedidosUsuario();
                actualizarTotalGastado();
                
                // Mostrar notificación del cambio
                const estadoTexto = getEstadoPedidoTexto(pedidoActualizado.estado);
                const mensaje = `📦 Pedido #${pedidoActualizado.numero_orden || pedidoActualizado.id}: ${estadoTexto}`;
                
                // Si la pantalla de mis pedidos está visible, mostrar toast
                const misPedidosScreen = document.getElementById('mis-pedidos-screen');
                if (misPedidosScreen && misPedidosScreen.style.display === 'block') {
                    mostrarToast(mensaje, 'info');
                }
            }
        )
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'pedidos',
                filter: `usuario_id=eq.${usuarioActual.id}`
            },
            (payload) => {
                console.log('📢 Nuevo pedido en tiempo real:', payload.new);
                const nuevoPedido = payload.new;
                
                // Agregar al array local
                pedidosUsuario.unshift(nuevoPedido);
                
                // Re-renderizar
                renderizarPedidosUsuario();
                actualizarTotalGastado();
                
                // Mostrar notificación
                const mensaje = `🎉 ¡Nuevo pedido #${nuevoPedido.numero_orden || nuevoPedido.id} registrado!`;
                mostrarToast(mensaje, 'success');
            }
        )
        .subscribe();
}

// ✅ NUEVA FUNCIÓN: Detener tiempo real
function detenerRealtimePedidosUsuario() {
    if (realtimeCanalPedidos) {
        console.log('🛑 Deteniendo tiempo real de pedidos');
        supabaseClient.removeChannel(realtimeCanalPedidos);
        realtimeCanalPedidos = null;
    }
}

function renderizarPedidosUsuario() {
    const pedidosActuales = pedidosUsuario.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
    const pedidosCancelados = pedidosUsuario.filter(p => p.estado === 'cancelado');
    const pedidosHistorial = pedidosUsuario.filter(p => p.estado === 'entregado');
    
    renderizarListaPedidos(pedidosActuales, 'pedidos-actuales-container');
    if (pedidosCancelados.length > 0) {
        const container = document.getElementById('pedidos-actuales-container');
        if (container) {
            const pedidosCanceladosHTML = pedidosCancelados.map(pedido => {
                const estadoTexto = getEstadoPedidoTexto(pedido.estado);
                const estadoColor = getEstadoColor(pedido.estado);
                const fecha = formatearFechaArgentina(pedido.fecha);
                
                let productosResumen = '';
                if (pedido.productos && pedido.productos.length > 0) {
                    const primeros = pedido.productos.slice(0, 2);
                    productosResumen = primeros.map(pr => `${pr.cantidad}x ${pr.nombre}`).join(', ');
                    if (pedido.productos.length > 2) productosResumen += ` +${pedido.productos.length - 2} más`;
                }
                
                return `
                    <div class="pedido-card" onclick="verDetallePedido(${pedido.id})">
                        <div class="pedido-card-header">
                            <span class="pedido-numero">Pedido #${pedido.numero_orden || pedido.id}</span>
                            <span class="pedido-estado" style="background: ${estadoColor}20; color: ${estadoColor};">${estadoTexto}</span>
                        </div>
                        <div class="pedido-card-body">
                            <div class="pedido-fecha">📅 ${fecha}</div>
                            <div class="pedido-negocio">🏪 ${escapeHTML(pedido.vendedor_nombre || 'Negocio')}</div>
                            <div class="pedido-productos">📦 ${escapeHTML(productosResumen)}</div>
                            <div class="pedido-total">💰 ${formatearPrecio(pedido.total)}</div>
                        </div>
                        <div class="pedido-card-footer">
                            <button class="btn-ver-detalle" onclick="event.stopPropagation(); verDetallePedido(${pedido.id})">Ver detalle <i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
            
            if (container.innerHTML === `<div class="sin-pedidos"><i class="fas fa-inbox"></i><p>No hay pedidos en esta sección</p></div>`) {
                container.innerHTML = pedidosCanceladosHTML;
            } else {
                container.innerHTML += pedidosCanceladosHTML;
            }
        }
    }
    renderizarListaPedidos(pedidosHistorial, 'pedidos-historial-container');
}

function renderizarListaPedidos(pedidos, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!pedidos || pedidos.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><i class="fas fa-inbox"></i><p>No hay pedidos en esta sección</p></div>`;
        return;
    }
    
    container.innerHTML = pedidos.map(pedido => {
        const estadoTexto = getEstadoPedidoTexto(pedido.estado);
        const estadoColor = getEstadoColor(pedido.estado);
        const fecha = formatearFechaArgentina(pedido.fecha);
        
        let productosResumen = '';
        if (pedido.productos && pedido.productos.length > 0) {
            const primeros = pedido.productos.slice(0, 2);
            productosResumen = primeros.map(pr => `${pr.cantidad}x ${pr.nombre}`).join(', ');
            if (pedido.productos.length > 2) productosResumen += ` +${pedido.productos.length - 2} más`;
        }
        
        return `
            <div class="pedido-card" onclick="verDetallePedido(${pedido.id})">
                <div class="pedido-card-header">
                    <span class="pedido-numero">Pedido #${pedido.numero_orden || pedido.id}</span>
                    <span class="pedido-estado" style="background: ${estadoColor}20; color: ${estadoColor};">${estadoTexto}</span>
                </div>
                <div class="pedido-card-body">
                    <div class="pedido-fecha">📅 ${fecha}</div>
                    <div class="pedido-negocio">🏪 ${escapeHTML(pedido.vendedor_nombre || 'Negocio')}</div>
                    <div class="pedido-productos">📦 ${escapeHTML(productosResumen)}</div>
                    <div class="pedido-total">💰 ${formatearPrecio(pedido.total)}</div>
                </div>
                <div class="pedido-card-footer">
                    <button class="btn-ver-detalle" onclick="event.stopPropagation(); verDetallePedido(${pedido.id})">Ver detalle <i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarTotalGastado() {
    const totalGastado = pedidosUsuario.filter(p => p.estado === 'entregado').reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    const totalElement = document.getElementById('total-gastado-valor');
    if (totalElement) totalElement.textContent = formatearPrecio(totalGastado);
}

function verDetallePedido(pedidoId) {
    const pedido = pedidosUsuario.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    const estadoTexto = getEstadoPedidoTexto(pedido.estado);
    const estadoColor = getEstadoColor(pedido.estado);
    const fecha = formatearFecha(pedido.fecha);
    const metodoPago = pedido.metodo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo';
    
    let productosHTML = '';
    if (pedido.productos && pedido.productos.length > 0) {
        productosHTML = `
            <div class="detalle-productos">
                <strong>Productos:</strong>
                <div class="productos-lista-detalle">
                    ${pedido.productos.map(pr => `<div class="producto-detalle-item"><span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span><span>${formatearPrecio(pr.precio * pr.cantidad)}</span></div>`).join('')}
                </div>
            </div>
        `;
    }
    
    let detallesHTML = '';
    if (pedido.detalles && pedido.detalles.trim()) {
        detallesHTML = `<div class="detalle-seccion"><strong>📝 Detalles adicionales:</strong><p>${escapeHTML(pedido.detalles)}</p></div>`;
    }
    
    document.getElementById('detalle-pedido-titulo').textContent = `Pedido #${pedido.numero_orden || pedido.id}`;
    document.getElementById('detalle-pedido-body').innerHTML = `
        <div class="detalle-estado" style="background: ${estadoColor}20; color: ${estadoColor}; padding: 12px; border-radius: 12px; text-align: center; margin-bottom: 16px;"><strong>${estadoTexto}</strong></div>
        <div class="detalle-seccion"><strong>📅 Fecha:</strong><p>${fecha}</p></div>
        <div class="detalle-seccion"><strong>👤 Cliente:</strong><p>${escapeHTML(pedido.cliente_nombre)}</p></div>
        <div class="detalle-seccion"><strong>📞 Teléfono:</strong><p>${pedido.cliente_telefono}</p></div>
        <div class="detalle-seccion"><strong>📍 Dirección:</strong><p>${escapeHTML(pedido.direccion)}</p></div>
        <div class="detalle-seccion"><strong>💳 Método de pago:</strong><p>${metodoPago}</p></div>
        ${productosHTML}${detallesHTML}
        <div class="detalle-total"><strong>Total:</strong> ${formatearPrecio(pedido.total)}</div>
    `;
    
    document.getElementById('modal-detalle-pedido').classList.add('active');
}

function cerrarModalDetallePedido() {
    document.getElementById('modal-detalle-pedido').classList.remove('active');
}

async function cerrarSesion() {
    // ✅ Detener tiempo real al cerrar sesión
    detenerRealtimePedidosUsuario();
    
    if (typeof signOut === 'function') {
        const result = await signOut();
        if (result.success) {
            mostrarToast('Sesión cerrada', 'info');
            handleUserLogout();
        } else {
            mostrarToast('Error al cerrar sesión', 'error');
        }
    }
}

// ===================================================
// FUNCIONES PARA LOGIN.HTML
// ===================================================

async function iniciarLoginConGoogle() {
    if (typeof loginWithGoogle === 'function') {
        const result = await loginWithGoogle();
        if (!result.success) {
            mostrarToast('Error al iniciar sesión', 'error');
        }
    }
}

async function iniciarRegistroConGoogle() {
    if (typeof loginWithGoogle === 'function') {
        const result = await loginWithGoogle();
        if (!result.success) {
            mostrarToast('Error al registrar', 'error');
        }
    }
}

async function registrarNuevoUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-registrar-usuario');
    
    await withLoading(btn, async () => {
        const nombreCompleto = document.getElementById('reg-nombre').value.trim();
        const provincia = document.getElementById('reg-provincia').value;
        const ciudad = document.getElementById('reg-ciudad').value;
        const direccion = document.getElementById('reg-direccion').value.trim();
        let telefono = document.getElementById('reg-telefono').value.trim();
        
        if (!nombreCompleto || !provincia || !ciudad || !direccion || !telefono) {
            mostrarToast('Completá todos los campos', 'error');
            return;
        }
        
        telefono = telefono.replace(/\D/g, '');
        if (!telefono.match(/^\d{10,15}$/)) {
            mostrarToast('Ingresá un teléfono válido (10-15 dígitos)', 'error');
            return;
        }
        
        const nombreParts = nombreCompleto.split(' ');
        const nombre = nombreParts[0];
        const apellido = nombreParts.slice(1).join(' ');
        
        if (!apellido) {
            mostrarToast('Ingresá nombre y apellido completo (ej: Juan Pérez)', 'error');
            return;
        }
        
        const user = window.usuarioAuth;
        if (!user) {
            mostrarToast('Error de autenticación', 'error');
            return;
        }
        
        if (typeof crearOActualizarUsuario === 'function') {
            const result = await crearOActualizarUsuario({
                auth_id: user.id,
                email: user.email,
                nombre: nombre,
                apellido: apellido,
                provincia: provincia,
                ciudad: ciudad,
                direccion: direccion,
                telefono: telefono,
                foto_perfil: user.user_metadata?.avatar_url || null
            });
            
            if (result.success) {
                localStorage.setItem('want_usuario_sesion', JSON.stringify({
                    id: result.usuario.id,
                    email: result.usuario.email,
                    nombre: result.usuario.nombre
                }));
                mostrarToast('¡Registro completado!', 'success');
                window.location.href = 'index.html';
            } else {
                if (result.conflict === 'email') {
                    mostrarToast('Este email ya está registrado', 'error');
                } else {
                    mostrarToast(result.error || 'Error al guardar datos', 'error');
                }
            }
        }
    });
}

// ===================================================
// NOTIFICACIONES - FUNCIONES
// ===================================================

function obtenerContadorNotificaciones() {
    const notificaciones = JSON.parse(localStorage.getItem('want_notificaciones') || '[]');
    const noLeidas = notificaciones.filter(n => !n.leida).length;
    return noLeidas;
}

function actualizarContadorNotificaciones() {
    const contador = document.getElementById('notificaciones-count');
    const total = obtenerContadorNotificaciones();
    
    if (contador) {
        if (total > 0) {
            contador.textContent = total > 99 ? '99+' : total;
            contador.style.display = 'flex';
        } else {
            contador.style.display = 'none';
        }
    }
}

function mostrarNotificacionTemporal(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `notificacion-toast ${tipo}`;
    toast.innerHTML = `
        <i class="fas ${tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-bell'}"></i>
        <span>${mensaje}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function toggleNotificaciones() {
    const panel = document.getElementById('notificaciones-panel');
    const overlay = document.getElementById('notificaciones-overlay');
    const isMobile = window.innerWidth <= 768;
    
    if (!panel) return;
    
    if (notificacionesAbiertas) {
        panel.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        notificacionesAbiertas = false;
    } else {
        cargarListaNotificaciones();
        panel.classList.add('active');
        if (isMobile && overlay) overlay.classList.add('active');
        notificacionesAbiertas = true;
    }
}

function cerrarPanelNotificaciones() {
    const panel = document.getElementById('notificaciones-panel');
    const overlay = document.getElementById('notificaciones-overlay');
    if (panel) {
        panel.classList.remove('active');
        notificacionesAbiertas = false;
    }
    if (overlay) overlay.classList.remove('active');
}

function cargarListaNotificaciones() {
    const container = document.getElementById('notificaciones-lista');
    if (!container) return;
    
    notificacionesActuales = JSON.parse(localStorage.getItem('want_notificaciones') || '[]');
    
    if (notificacionesActuales.length === 0) {
        container.innerHTML = `
            <div class="notificaciones-vacio">
                <i class="fas fa-bell-slash"></i>
                <p>No hay notificaciones</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notificacionesActuales.map(notif => {
        const fecha = new Date(notif.fecha);
        const fechaStr = fecha.toLocaleString('es-AR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let icono = 'fa-truck';
        let color = '#FF5A00';
        
        if (notif.estadoNuevo === 'entregado') {
            icono = 'fa-check-circle';
            color = '#10b981';
        } else if (notif.estadoNuevo === 'en camino') {
            icono = 'fa-truck';
            color = '#3b82f6';
        } else if (notif.estadoNuevo === 'en preparacion') {
            icono = 'fa-utensils';
            color = '#f59e0b';
        }
        
        return `
            <div class="notificacion-item ${notif.leida ? 'leida' : ''}" data-id="${notif.id}" onclick="window.irAMisPedidosDesdeNotificacion(${notif.id})">
                <div class="notificacion-icono" style="background: ${color}20; color: ${color};">
                    <i class="fas ${icono}"></i>
                </div>
                <div class="notificacion-contenido">
                    <div class="notificacion-mensaje">${escapeHTML(notif.mensaje)}</div>
                    <div class="notificacion-fecha">${fechaStr}</div>
                </div>
                <button class="notificacion-eliminar" onclick="event.stopPropagation(); window.eliminarNotificacionItem(${notif.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
    
    // Marcar como leídas al abrir
    setTimeout(() => {
        notificacionesActuales.forEach(n => {
            if (!n.leida) {
                window.marcarNotificacionLeida(n.id);
            }
        });
        actualizarContadorNotificaciones();
    }, 500);
}

function eliminarNotificacionItem(notificacionId) {
    window.eliminarNotificacion(notificacionId);
    cargarListaNotificaciones();
    actualizarContadorNotificaciones();
}

function irAMisPedidosDesdeNotificacion(notificacionId) {
    // Marcar como leída
    window.marcarNotificacionLeida(notificacionId);
    actualizarContadorNotificaciones();
    
    // Cerrar panel de notificaciones
    cerrarPanelNotificaciones();
    
    // Ir a Mis pedidos
    if (typeof mostrarMisPedidos === 'function') {
        mostrarMisPedidos();
    } else {
        window.location.href = 'index.html#mis-pedidos';
    }
}

// Escuchar eventos de notificaciones
window.addEventListener('nuevaNotificacion', () => {
    console.log('🔔 Evento nuevaNotificacion recibido');
    actualizarContadorNotificaciones();
    if (notificacionesAbiertas) {
        cargarListaNotificaciones();
    }
});

window.addEventListener('notificacionLeida', () => {
    actualizarContadorNotificaciones();
    if (notificacionesAbiertas) {
        cargarListaNotificaciones();
    }
});

// ===================================================
// FUNCIÓN PARA RECIBIR USUARIO DESDE SESSION-MANAGER
// ===================================================

window.setUsuarioActual = function(usuario) {
    console.log('📝 Recibiendo usuario desde SessionManager:', usuario?.email);
    if (!usuario) return;
    
    usuarioActual = usuario;
    cargarDatosUsuarioUI();
    
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    if (miCuentaScreen && miCuentaScreen.style.display === 'block') {
        cargarDatosUsuarioFormulario();
    }
    
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    if (misPedidosScreen && misPedidosScreen.style.display === 'block') {
        cargarPedidosUsuario();
    }
};

document.addEventListener('usuarioActualizado', (event) => {
    console.log('📢 Evento usuarioActualizado recibido:', event.detail?.usuario);
    if (event.detail && event.detail.usuario) {
        usuarioActual = event.detail.usuario;
        cargarDatosUsuarioUI();
    }
});

window.onSessionClosed = function() {
    console.log('🔴 Sesión cerrada por SessionManager');
    detenerRealtimePedidosUsuario();  // ✅ Detener tiempo real
    usuarioActual = null;
    window.location.href = 'login.html';
};

// ===================================================
// EVENT LISTENERS
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado - Inicializando auth-usuario.js');
    
    const isLoginPage = window.location.pathname.includes('login.html');
    const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '';
    
    if (isLoginPage) {
        const loginBtn = document.getElementById('login-google-btn');
        const registerBtn = document.getElementById('register-google-btn');
        const registroForm = document.getElementById('registro-form');
        
        if (loginBtn) loginBtn.addEventListener('click', iniciarLoginConGoogle);
        if (registerBtn) registerBtn.addEventListener('click', iniciarRegistroConGoogle);
        if (registroForm) registroForm.addEventListener('submit', registrarNuevoUsuario);
        
        if (window.location.hash === '#registro') {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('registro-screen').style.display = 'flex';
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('registro-screen').style.display = 'none';
        }
    }
    
    if (isIndexPage) {
        const logoHome = document.getElementById('logo-home');
        if (logoHome) logoHome.addEventListener('click', (e) => { e.preventDefault(); volverAlHome(); });
        
        document.getElementById('mis-pedidos-desktop')?.addEventListener('click', (e) => { e.preventDefault(); mostrarMisPedidos(); });
        document.getElementById('mi-cuenta-desktop')?.addEventListener('click', (e) => { e.preventDefault(); mostrarMiCuenta(); });
        document.getElementById('cerrar-sesion-desktop')?.addEventListener('click', (e) => { e.preventDefault(); cerrarSesion(); });
        
        const avatarDesktop = document.getElementById('user-avatar-desktop');
        if (avatarDesktop) {
            avatarDesktop.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('avatar-dropdown');
                if (dropdown) dropdown.classList.toggle('active');
            });
        }
        
        document.addEventListener('click', () => {
            const dropdown = document.getElementById('avatar-dropdown');
            if (dropdown) dropdown.classList.remove('active');
        });
        
        document.getElementById('mis-pedidos-mobile')?.addEventListener('click', (e) => { e.preventDefault(); mostrarMisPedidos(); });
        document.getElementById('mi-cuenta-mobile')?.addEventListener('click', (e) => { e.preventDefault(); mostrarMiCuenta(); });
        document.getElementById('logout-mobile')?.addEventListener('click', (e) => { e.preventDefault(); cerrarSesion(); });
        document.getElementById('back-to-home')?.addEventListener('click', (e) => { e.preventDefault(); volverAlHome(); });
        document.getElementById('back-to-home-cuenta')?.addEventListener('click', (e) => { e.preventDefault(); volverAlHome(); });
        
        const avatarMobile = document.getElementById('user-avatar-mobile');
        const mobileMenu = document.getElementById('mobile-menu');
        const menuOverlay = document.getElementById('menu-overlay');
        const menuClose = document.getElementById('menu-close');
        
        if (avatarMobile) {
            avatarMobile.addEventListener('click', () => {
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
        
        document.getElementById('cuenta-form')?.addEventListener('submit', guardarDatosUsuario);
        
        document.querySelectorAll('.pedidos-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                document.querySelectorAll('.pedidos-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const actualesContainer = document.getElementById('pedidos-actuales-container');
                const historialContainer = document.getElementById('pedidos-historial-container');
                if (actualesContainer) actualesContainer.style.display = tabId === 'actuales' ? 'block' : 'none';
                if (historialContainer) historialContainer.style.display = tabId === 'historial' ? 'block' : 'none';
            });
        });
    }
});

// Exponer funciones globales
window.verDetallePedido = verDetallePedido;
window.cerrarModalDetallePedido = cerrarModalDetallePedido;
window.mostrarMisPedidos = mostrarMisPedidos;
window.mostrarMiCuenta = mostrarMiCuenta;
window.volverAlHome = volverAlHome;
window.mostrarModalContacto = mostrarModalContacto;
window.cerrarModalContacto = cerrarModalContacto;
window.cerrarSesion = cerrarSesion;
window.forzarCargaDatosUsuario = forzarCargaDatosUsuario;
window.handleUserLogin = handleUserLogin;
window.mostrarPantallaPrincipal = mostrarPantallaPrincipal;
window.cargarDatosUsuarioUI = cargarDatosUsuarioUI;
window.cargarPedidosUsuario = cargarPedidosUsuario;
window.toggleNotificaciones = toggleNotificaciones;
window.cerrarPanelNotificaciones = cerrarPanelNotificaciones;
window.eliminarNotificacionItem = eliminarNotificacionItem;
window.actualizarContadorNotificaciones = actualizarContadorNotificaciones;
window.mostrarNotificacionTemporal = mostrarNotificacionTemporal;
window.irAMisPedidosDesdeNotificacion = irAMisPedidosDesdeNotificacion;