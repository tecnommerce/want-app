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

function mostrarModalContacto() {
    const modal = document.getElementById('contacto-modal');
    if (modal) modal.classList.add('active');
}

function cerrarModalContacto() {
    const modal = document.getElementById('contacto-modal');
    if (modal) modal.classList.remove('active');
}

function toggleDropdown() {
    const dropdown = document.getElementById('avatar-dropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

function cerrarDropdown() {
    const dropdown = document.getElementById('avatar-dropdown');
    if (dropdown) dropdown.classList.remove('active');
}

let mobileMenu = null;
let menuOverlay = null;

function openMobileMenu() {
    if (mobileMenu) mobileMenu.classList.add('active');
    if (menuOverlay) menuOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    if (mobileMenu) mobileMenu.classList.remove('active');
    if (menuOverlay) menuOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

async function initAuth() {
    console.log('🔐 Inicializando autenticación de usuarios...');
    
    mobileMenu = document.getElementById('mobile-menu');
    menuOverlay = document.getElementById('menu-overlay');
    
    document.addEventListener('click', (e) => {
        const avatarDesktop = document.getElementById('user-avatar-desktop');
        if (avatarDesktop && !avatarDesktop.contains(e.target)) {
            cerrarDropdown();
        }
    });
    
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

function mostrarPantallaLogin() {
    const loginScreen = document.getElementById('login-screen');
    const registroScreen = document.getElementById('registro-screen');
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    const searchContainer = document.getElementById('search-container');
    const userAvatarDesktop = document.getElementById('user-avatar-desktop');
    const userAvatarMobile = document.getElementById('user-avatar-mobile');
    const navDesktop = document.getElementById('nav-desktop');
    
    if (loginScreen) loginScreen.style.display = 'flex';
    if (registroScreen) registroScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (userAvatarDesktop) userAvatarDesktop.style.display = 'none';
    if (userAvatarMobile) userAvatarMobile.style.display = 'none';
    if (navDesktop) navDesktop.style.display = 'flex';
    closeMobileMenu();
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
    const userAvatarDesktop = document.getElementById('user-avatar-desktop');
    const userAvatarMobile = document.getElementById('user-avatar-mobile');
    const navDesktop = document.getElementById('nav-desktop');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (registroScreen) registroScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'block';
    if (userAvatarDesktop) userAvatarDesktop.style.display = 'flex';
    if (userAvatarMobile) userAvatarMobile.style.display = 'flex';
    if (navDesktop) navDesktop.style.display = 'flex';
    closeMobileMenu();
    
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
    cerrarDropdown();
    closeMobileMenu();
    cargarPedidosUsuario();
}

function mostrarMiCuenta() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    
    if (mainContent) mainContent.style.display = 'none';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'block';
    cerrarDropdown();
    closeMobileMenu();
    cargarDatosUsuarioFormulario();
}

function volverAlHome() {
    const mainContent = document.getElementById('main-content');
    const misPedidosScreen = document.getElementById('mis-pedidos-screen');
    const miCuentaScreen = document.getElementById('mi-cuenta-screen');
    
    if (mainContent) mainContent.style.display = 'block';
    if (misPedidosScreen) misPedidosScreen.style.display = 'none';
    if (miCuentaScreen) miCuentaScreen.style.display = 'none';
    cerrarDropdown();
    closeMobileMenu();
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
        
        if (!nombreCompleto) {
            mostrarToast('Ingresá tu nombre completo', 'error');
            return;
        }
        if (!provincia) {
            mostrarToast('Seleccioná tu provincia', 'error');
            return;
        }
        if (!ciudad) {
            mostrarToast('Seleccioná tu ciudad', 'error');
            return;
        }
        if (!direccion) {
            mostrarToast('Ingresá tu dirección', 'error');
            return;
        }
        if (!telefono) {
            mostrarToast('Ingresá tu número de WhatsApp', 'error');
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
        
        const updateData = {
            nombre: nombre,
            apellido: apellido,
            provincia: provincia,
            ciudad: ciudad,
            direccion: direccion,
            telefono: telefonoLimpio
        };
        
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
    
    const tituloElement = document.getElementById('detalle-pedido-titulo');
    const bodyElement = document.getElementById('detalle-pedido-body');
    
    if (tituloElement) tituloElement.textContent = `Pedido #${pedido.numero_orden || pedido.id}`;
    if (bodyElement) {
        bodyElement.innerHTML = `
            <div class="detalle-estado" style="background: ${estadoColor}20; color: ${estadoColor}; padding: 12px; border-radius: 12px; text-align: center; margin-bottom: 16px;"><strong>${estadoTexto}</strong></div>
            <div class="detalle-seccion"><strong>📅 Fecha:</strong><p>${fecha}</p></div>
            <div class="detalle-seccion"><strong>👤 Cliente:</strong><p>${escapeHTML(pedido.cliente_nombre)}</p></div>
            <div class="detalle-seccion"><strong>📞 Teléfono:</strong><p>${pedido.cliente_telefono}</p></div>
            <div class="detalle-seccion"><strong>📍 Dirección:</strong><p>${escapeHTML(pedido.direccion)}</p></div>
            <div class="detalle-seccion"><strong>💳 Método de pago:</strong><p>${metodoPago}</p></div>
            ${productosHTML}${detallesHTML}
            <div class="detalle-total"><strong>Total:</strong> ${formatearPrecio(pedido.total)}</div>
        `;
    }
    
    const modal = document.getElementById('modal-detalle-pedido');
    if (modal) modal.classList.add('active');
}

function cerrarModalDetallePedido() {
    const modal = document.getElementById('modal-detalle-pedido');
    if (modal) modal.classList.remove('active');
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
        
        if (!nombreCompleto) {
            mostrarToast('Ingresá tu nombre completo', 'error');
            return;
        }
        if (!provincia) {
            mostrarToast('Seleccioná tu provincia', 'error');
            return;
        }
        if (!ciudad) {
            mostrarToast('Seleccioná tu ciudad', 'error');
            return;
        }
        if (!direccion) {
            mostrarToast('Ingresá tu dirección', 'error');
            return;
        }
        if (!telefono) {
            mostrarToast('Ingresá tu número de WhatsApp', 'error');
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
                if (result.conflict === 'email') {
                    mostrarToast(result.error || 'Este email ya está registrado', 'error');
                    setTimeout(() => {
                        if (typeof signOut === 'function') signOut();
                    }, 3000);
                } else {
                    mostrarToast(result.error || 'Error al guardar datos', 'error');
                }
            }
        }
    });
}

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
    
    // ===================================================
    // LOGO - VOLVER AL HOME SIN CERRAR SESIÓN (MUY IMPORTANTE)
    // ===================================================
    const logoHome = document.getElementById('logo-home');
    if (logoHome) {
        logoHome.addEventListener('click', (e) => {
            e.preventDefault();
            volverAlHome();
        });
    }
    
    // Botones de login
    const loginGoogleBtn = document.getElementById('login-google-btn');
    const registerGoogleBtn = document.getElementById('register-google-btn');
    
    if (loginGoogleBtn) {
        loginGoogleBtn.addEventListener('click', async () => {
            if (typeof loginWithGoogle === 'function') {
                const result = await loginWithGoogle();
                if (!result.success) mostrarToast('Error al iniciar sesión', 'error');
            }
        });
    }
    
    if (registerGoogleBtn) {
        registerGoogleBtn.addEventListener('click', async () => {
            if (typeof loginWithGoogle === 'function') {
                const result = await loginWithGoogle();
                if (!result.success) mostrarToast('Error al registrar', 'error');
            }
        });
    }
    
    // Formularios
    const registroForm = document.getElementById('registro-form');
    const cuentaForm = document.getElementById('cuenta-form');
    
    if (registroForm) registroForm.addEventListener('submit', registrarNuevoUsuario);
    if (cuentaForm) cuentaForm.addEventListener('submit', guardarDatosUsuario);
    
    // Navegación escritorio
    const misPedidosDesktop = document.getElementById('mis-pedidos-desktop');
    const miCuentaDesktop = document.getElementById('mi-cuenta-desktop');
    const cerrarSesionDesktop = document.getElementById('cerrar-sesion-desktop');
    
    if (misPedidosDesktop) {
        misPedidosDesktop.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarMisPedidos();
        });
    }
    
    if (miCuentaDesktop) {
        miCuentaDesktop.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarMiCuenta();
        });
    }
    
    if (cerrarSesionDesktop) {
        cerrarSesionDesktop.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }
    
    // Avatar dropdown
    const avatarDesktop = document.getElementById('user-avatar-desktop');
    if (avatarDesktop) {
        avatarDesktop.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
    }
    
    // Navegación móvil
    const misPedidosMobile = document.getElementById('mis-pedidos-mobile');
    const miCuentaMobile = document.getElementById('mi-cuenta-mobile');
    const logoutMobile = document.getElementById('logout-mobile');
    const contactoMobile = document.getElementById('contacto-mobile');
    
    if (misPedidosMobile) {
        misPedidosMobile.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarMisPedidos();
        });
    }
    
    if (miCuentaMobile) {
        miCuentaMobile.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarMiCuenta();
        });
    }
    
    if (logoutMobile) {
        logoutMobile.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }
    
    if (contactoMobile) {
        contactoMobile.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarModalContacto();
        });
    }
    
    // Botones volver
    const backToHome = document.getElementById('back-to-home');
    const backToHomeCuenta = document.getElementById('back-to-home-cuenta');
    
    if (backToHome) {
        backToHome.addEventListener('click', (e) => {
            e.preventDefault();
            volverAlHome();
        });
    }
    
    if (backToHomeCuenta) {
        backToHomeCuenta.addEventListener('click', (e) => {
            e.preventDefault();
            volverAlHome();
        });
    }
    
    // Menú móvil
    const avatarMobile = document.getElementById('user-avatar-mobile');
    const menuClose = document.getElementById('menu-close');
    
    if (avatarMobile) {
        avatarMobile.addEventListener('click', openMobileMenu);
    }
    
    if (menuClose) {
        menuClose.addEventListener('click', closeMobileMenu);
    }
    
    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMobileMenu);
    }
    
    // Tabs de pedidos
    const pedidosTabs = document.querySelectorAll('.pedidos-tab');
    pedidosTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            pedidosTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const actualesContainer = document.getElementById('pedidos-actuales-container');
            const historialContainer = document.getElementById('pedidos-historial-container');
            
            if (actualesContainer) actualesContainer.style.display = tabId === 'actuales' ? 'block' : 'none';
            if (historialContainer) historialContainer.style.display = tabId === 'historial' ? 'block' : 'none';
        });
    });
    
    // Inicializar autenticación
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
window.cerrarSesion = cerrarSesion;