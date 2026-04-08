// ===================================================
// AUTENTICACIÓN DE USUARIOS - WANT
// ===================================================

let usuarioActual = null;
let pedidosUsuario = [];
let authSubscription = null;

// ===================================================
// UTILIDADES
// ===================================================

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
    return fecha.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getEstadoPedidoTexto(estado) {
    const estados = {
        'preparando': 'Pedido tomado',
        'en preparacion': 'Preparando',
        'en camino': 'En camino',
        'entregado': 'Entregado'
    };
    return estados[estado] || estado;
}

function getEstadoColor(estado) {
    const colores = {
        'preparando': '#FF9800',
        'en preparacion': '#2196F3',
        'en camino': '#9C27B0',
        'entregado': '#4CAF50'
    };
    return colores[estado] || '#666';
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===================================================
// EFECTOS DE CARGA EN BOTONES
// ===================================================

async function withLoading(button, callback) {
    if (!button) return await callback();
    const originalText = button.innerHTML;
    const originalDisabled = button.disabled;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + originalText.replace(/<i class="[^"]*"><\/i>\s*/, '');
    button.classList.add('btn-loading');
    try {
        return await callback();
    } finally {
        button.disabled = originalDisabled;
        button.innerHTML = originalText;
        button.classList.remove('btn-loading');
    }
}

// ===================================================
// MODAL DE CONTACTO
// ===================================================

function mostrarModalContacto() {
    document.getElementById('contacto-modal').classList.add('active');
}

function cerrarModalContacto() {
    document.getElementById('contacto-modal').classList.remove('active');
}

// ===================================================
// INICIALIZACIÓN DE AUTENTICACIÓN
// ===================================================

async function initAuth() {
    console.log('🔐 Inicializando autenticación de usuarios...');
    
    if (typeof onAuthStateChange === 'function') {
        authSubscription = onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event, session?.user?.email);
            if (event === 'SIGNED_IN' && session) {
                await handleUserLogin(session.user);
            } else if (event === 'SIGNED_OUT') {
                handleUserLogout();
            }
        });
    }
    
    const sessionGuardada = localStorage.getItem('want_usuario_sesion');
    if (sessionGuardada) {
        try {
            const userData = JSON.parse(sessionGuardada);
            if (userData && userData.id) {
                await cargarUsuarioLogueado(userData.id);
                return;
            }
        } catch (e) {}
    }
    
    if (typeof getCurrentUser === 'function') {
        const user = await getCurrentUser();
        if (user) {
            await handleUserLogin(user);
            return;
        }
    }
    
    mostrarPantallaLogin();
}

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
            mostrarPantallaPrincipal();
            cargarDatosUsuarioUI();
            cargarPedidosUsuario();
        } else {
            window.usuarioAuth = user;
            mostrarPantallaRegistro(user);
        }
    }
}

function handleUserLogout() {
    usuarioActual = null;
    localStorage.removeItem('want_usuario_sesion');
    sessionStorage.removeItem('want_usuario_sesion');
    mostrarPantallaLogin();
}

async function cargarUsuarioLogueado(usuarioId) {
    if (typeof obtenerUsuarioPorAuthId === 'function') {
        const result = await obtenerUsuarioPorAuthId(usuarioId);
        if (result.success && result.usuario) {
            usuarioActual = result.usuario;
            mostrarPantallaPrincipal();
            cargarDatosUsuarioUI();
            cargarPedidosUsuario();
        } else {
            mostrarPantallaLogin();
        }
    }
}

// ===================================================
// MANEJO DE PANTALLAS
// ===================================================

function mostrarPantallaLogin() {
    const loginScreen = document.getElementById('login-screen');
    const registroScreen = document.getElementById('registro-screen');
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    const searchContainer = document.getElementById('search-container');
    const userAvatar = document.getElementById('user-avatar');
    const menuToggle = document.getElementById('menu-toggle');
    const navDesktop = document.getElementById('nav-desktop');
    
    if (loginScreen) loginScreen.style.display = 'flex';
    if (registroScreen) registroScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (userAvatar) userAvatar.style.display = 'none';
    if (menuToggle) menuToggle.style.display = 'none';
    if (navDesktop) navDesktop.style.display = 'flex';
}

function mostrarPantallaRegistro(user) {
    window.usuarioAuth = user;
    const loginScreen = document.getElementById('login-screen');
    const registroScreen = document.getElementById('registro-screen');
    const mainContent = document.getElementById('main-content');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (registroScreen) registroScreen.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'none';
}

function mostrarPantallaPrincipal() {
    const loginScreen = document.getElementById('login-screen');
    const registroScreen = document.getElementById('registro-screen');
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    const searchContainer = document.getElementById('search-container');
    const userAvatar = document.getElementById('user-avatar');
    const menuToggle = document.getElementById('menu-toggle');
    const navDesktop = document.getElementById('nav-desktop');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (registroScreen) registroScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'block';
    if (userAvatar) userAvatar.style.display = 'flex';
    if (menuToggle) menuToggle.style.display = 'flex';
    if (navDesktop) navDesktop.style.display = 'flex';
    
    if (typeof cargarNegocios === 'function') cargarNegocios();
    if (typeof cargarBanners === 'function') cargarBanners();
}

function mostrarMisPedidos() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    
    if (mainContent) mainContent.style.display = 'none';
    if (misPedidosScreen) misPedidosScreen.style.display = 'block';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    cargarPedidosUsuario();
}

function mostrarMiCuenta() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    
    if (mainContent) mainContent.style.display = 'none';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'block';
    cargarDatosUsuarioFormulario();
}

function volverAlHome() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    
    if (mainContent) mainContent.style.display = 'block';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
}

// ===================================================
// CARGA DE DATOS DEL USUARIO
// ===================================================

function cargarDatosUsuarioUI() {
    if (!usuarioActual) return;
    
    const avatarImg = document.getElementById('avatar-img');
    const avatarName = document.getElementById('avatar-name');
    
    if (avatarImg) {
        avatarImg.src = usuarioActual.foto_perfil || 'https://ui-avatars.com/api/?background=FF5A00&color=fff&name=' + encodeURIComponent(usuarioActual.nombre);
        avatarImg.onerror = () => {
            avatarImg.src = 'https://ui-avatars.com/api/?background=FF5A00&color=fff&name=' + encodeURIComponent(usuarioActual.nombre);
        };
    }
    
    if (avatarName) {
        avatarName.textContent = usuarioActual.nombre;
    }
}

function cargarDatosUsuarioFormulario() {
    if (!usuarioActual) return;
    
    document.getElementById('cuenta-nombre').value = usuarioActual.nombre || '';
    document.getElementById('cuenta-apellido').value = usuarioActual.apellido || '';
    document.getElementById('cuenta-email').value = usuarioActual.email || '';
    document.getElementById('cuenta-provincia').value = usuarioActual.provincia || '';
    document.getElementById('cuenta-ciudad').value = usuarioActual.ciudad || '';
    document.getElementById('cuenta-direccion').value = usuarioActual.direccion || '';
    document.getElementById('cuenta-telefono').value = usuarioActual.telefono || '';
    
    const avatarImg = document.getElementById('cuenta-avatar-img');
    if (avatarImg) {
        avatarImg.src = usuarioActual.foto_perfil || 'https://ui-avatars.com/api/?background=FF5A00&color=fff&name=' + encodeURIComponent(usuarioActual.nombre);
    }
}

async function guardarDatosUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-cuenta');
    
    await withLoading(btn, async () => {
        const updateData = {
            nombre: document.getElementById('cuenta-nombre').value.trim(),
            apellido: document.getElementById('cuenta-apellido').value.trim(),
            provincia: document.getElementById('cuenta-provincia').value,
            ciudad: document.getElementById('cuenta-ciudad').value.trim(),
            direccion: document.getElementById('cuenta-direccion').value.trim(),
            telefono: document.getElementById('cuenta-telefono').value.trim()
        };
        
        if (!updateData.nombre || !updateData.apellido || !updateData.provincia || 
            !updateData.ciudad || !updateData.direccion || !updateData.telefono) {
            mostrarToast('Completá todos los campos', 'error');
            return;
        }
        
        const telefonoLimpio = updateData.telefono.replace(/\D/g, '');
        if (!telefonoLimpio.match(/^\d{10,15}$/)) {
            mostrarToast('Ingresá un teléfono válido (10-15 dígitos)', 'error');
            return;
        }
        updateData.telefono = telefonoLimpio;
        
        if (typeof actualizarDatosUsuario === 'function') {
            const result = await actualizarDatosUsuario(usuarioActual.id, updateData);
            if (result.success) {
                usuarioActual = result.usuario;
                mostrarToast('Datos actualizados correctamente', 'success');
                cargarDatosUsuarioUI();
            } else {
                mostrarToast('Error al actualizar datos', 'error');
            }
        }
    });
}

// ===================================================
// PEDIDOS DEL USUARIO
// ===================================================

async function cargarPedidosUsuario() {
    if (!usuarioActual) return;
    
    if (typeof obtenerPedidosUsuario === 'function') {
        const result = await obtenerPedidosUsuario(usuarioActual.id);
        if (result.success) {
            pedidosUsuario = result.pedidos || [];
            renderizarPedidosUsuario();
            actualizarTotalGastado();
        }
    }
}

function renderizarPedidosUsuario() {
    const pedidosActuales = pedidosUsuario.filter(p => p.estado !== 'entregado');
    const pedidosHistorial = pedidosUsuario.filter(p => p.estado === 'entregado');
    
    renderizarListaPedidos(pedidosActuales, 'pedidos-actuales-container');
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
        const fecha = formatearFecha(pedido.fecha);
        
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

// ===================================================
// REGISTRO DE NUEVO USUARIO
// ===================================================

async function registrarNuevoUsuario(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-registrar-usuario');
    
    await withLoading(btn, async () => {
        const nombre = document.getElementById('reg-nombre').value.trim();
        const apellido = document.getElementById('reg-apellido').value.trim();
        const provincia = document.getElementById('reg-provincia').value;
        const ciudad = document.getElementById('reg-ciudad').value.trim();
        const direccion = document.getElementById('reg-direccion').value.trim();
        let telefono = document.getElementById('reg-telefono').value.trim();
        
        if (!nombre || !apellido || !provincia || !ciudad || !direccion || !telefono) {
            mostrarToast('Completá todos los campos', 'error');
            return;
        }
        
        telefono = telefono.replace(/\D/g, '');
        if (!telefono.match(/^\d{10,15}$/)) {
            mostrarToast('Ingresá un teléfono válido (10-15 dígitos)', 'error');
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
                usuarioActual = result.usuario;
                localStorage.setItem('want_usuario_sesion', JSON.stringify({
                    id: usuarioActual.id,
                    email: usuarioActual.email,
                    nombre: usuarioActual.nombre
                }));
                mostrarToast('¡Registro completado!', 'success');
                mostrarPantallaPrincipal();
                cargarDatosUsuarioUI();
                cargarPedidosUsuario();
            } else {
                mostrarToast('Error al guardar datos', 'error');
            }
        }
    });
}

// ===================================================
// CIERRE DE SESIÓN
// ===================================================

async function cerrarSesion() {
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
// EVENT LISTENERS E INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado - Inicializando auth-usuario.js');
    
    // Botones de login
    document.getElementById('login-google-btn')?.addEventListener('click', async () => {
        if (typeof loginWithGoogle === 'function') {
            const result = await loginWithGoogle();
            if (!result.success) mostrarToast('Error al iniciar sesión', 'error');
        }
    });
    
    document.getElementById('register-google-btn')?.addEventListener('click', async () => {
        if (typeof loginWithGoogle === 'function') {
            const result = await loginWithGoogle();
            if (!result.success) mostrarToast('Error al registrar', 'error');
        }
    });
    
    // Formularios
    document.getElementById('registro-form')?.addEventListener('submit', registrarNuevoUsuario);
    document.getElementById('cuenta-form')?.addEventListener('submit', guardarDatosUsuario);
    
    // Navegación
    document.getElementById('mis-pedidos-link-mobile')?.addEventListener('click', (e) => { e.preventDefault(); mostrarMisPedidos(); });
    document.getElementById('mi-cuenta-link-mobile')?.addEventListener('click', (e) => { e.preventDefault(); mostrarMiCuenta(); });
    document.getElementById('logout-link-mobile')?.addEventListener('click', (e) => { e.preventDefault(); cerrarSesion(); });
    document.getElementById('back-to-home')?.addEventListener('click', (e) => { e.preventDefault(); volverAlHome(); });
    document.getElementById('back-to-home-cuenta')?.addEventListener('click', (e) => { e.preventDefault(); volverAlHome(); });
    
    // Contacto
    document.getElementById('contacto-link-desktop')?.addEventListener('click', (e) => { e.preventDefault(); mostrarModalContacto(); });
    document.getElementById('contacto-link-mobile')?.addEventListener('click', (e) => { e.preventDefault(); mostrarModalContacto(); });
    
    // Tabs de pedidos
    document.querySelectorAll('.pedidos-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.pedidos-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('pedidos-actuales-container').style.display = tabId === 'actuales' ? 'block' : 'none';
            document.getElementById('pedidos-historial-container').style.display = tabId === 'historial' ? 'block' : 'none';
        });
    });
    
    // Menú móvil
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuClose = document.getElementById('menu-close');
    
    function openMenu() { mobileMenu?.classList.add('active'); menuOverlay?.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeMenu() { mobileMenu?.classList.remove('active'); menuOverlay?.classList.remove('active'); document.body.style.overflow = ''; }
    
    menuToggle?.addEventListener('click', openMenu);
    menuClose?.addEventListener('click', closeMenu);
    menuOverlay?.addEventListener('click', closeMenu);
    
    // Inicializar
    initAuth();
});

// Funciones globales
window.verDetallePedido = verDetallePedido;
window.cerrarModalDetallePedido = cerrarModalDetallePedido;
window.mostrarMisPedidos = mostrarMisPedidos;
window.mostrarMiCuenta = mostrarMiCuenta;
window.volverAlHome = volverAlHome;
window.mostrarModalContacto = mostrarModalContacto;
window.cerrarModalContacto = cerrarModalContacto;