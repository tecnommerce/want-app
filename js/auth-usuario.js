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
// INICIALIZACIÓN DE AUTENTICACIÓN
// ===================================================

async function initAuth() {
    // Escuchar cambios de autenticación
    authSubscription = onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, session);
        
        if (event === 'SIGNED_IN' && session) {
            await handleUserLogin(session.user);
        } else if (event === 'SIGNED_OUT') {
            handleUserLogout();
        }
    });
    
    // Verificar si hay sesión guardada
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
    
    // Verificar sesión activa de Supabase
    const user = await getCurrentUser();
    if (user) {
        await handleUserLogin(user);
    }
}

async function handleUserLogin(user) {
    console.log('Usuario logueado:', user);
    
    // Verificar si el usuario ya existe en nuestra tabla
    const result = await obtenerUsuarioPorAuthId(user.id);
    
    if (result.success && result.usuario) {
        // Usuario ya existe, cargar sus datos
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
        // Usuario nuevo, mostrar formulario de registro
        mostrarPantallaRegistro(user);
    }
}

function handleUserLogout() {
    usuarioActual = null;
    localStorage.removeItem('want_usuario_sesion');
    sessionStorage.removeItem('want_usuario_sesion');
    mostrarPantallaLogin();
}

async function cargarUsuarioLogueado(usuarioId) {
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

// ===================================================
// MANEJO DE PANTALLAS
// ===================================================

function mostrarPantallaLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('registro-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('mis-pedidos-screen').style.display = 'none';
    document.getElementById('mi-cuenta-screen').style.display = 'none';
    document.getElementById('search-container').style.display = 'none';
    document.getElementById('user-avatar').style.display = 'none';
    document.getElementById('menu-toggle').style.display = 'none';
    document.getElementById('nav-desktop').style.display = 'flex';
}

function mostrarPantallaRegistro(user) {
    window.usuarioAuth = user;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('registro-screen').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
}

function mostrarPantallaPrincipal() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('registro-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('mis-pedidos-screen').style.display = 'none';
    document.getElementById('mi-cuenta-screen').style.display = 'none';
    document.getElementById('search-container').style.display = 'block';
    document.getElementById('user-avatar').style.display = 'flex';
    document.getElementById('menu-toggle').style.display = 'flex';
    document.getElementById('nav-desktop').style.display = 'none';
    
    // Recargar datos
    if (typeof cargarNegocios === 'function') {
        cargarNegocios();
    }
    if (typeof cargarBanners === 'function') {
        cargarBanners();
    }
}

function mostrarMisPedidos() {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('mis-pedidos-screen').style.display = 'block';
    document.getElementById('mi-cuenta-screen').style.display = 'none';
    cargarPedidosUsuario();
}

function mostrarMiCuenta() {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('mis-pedidos-screen').style.display = 'none';
    document.getElementById('mi-cuenta-screen').style.display = 'block';
    cargarDatosUsuarioFormulario();
}

function volverAlHome() {
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('mis-pedidos-screen').style.display = 'none';
    document.getElementById('mi-cuenta-screen').style.display = 'none';
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
    
    const updateData = {
        nombre: document.getElementById('cuenta-nombre').value.trim(),
        apellido: document.getElementById('cuenta-apellido').value.trim(),
        provincia: document.getElementById('cuenta-provincia').value,
        ciudad: document.getElementById('cuenta-ciudad').value.trim(),
        direccion: document.getElementById('cuenta-direccion').value.trim(),
        telefono: document.getElementById('cuenta-telefono').value.trim()
    };
    
    // Validaciones
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
    
    const result = await actualizarDatosUsuario(usuarioActual.id, updateData);
    
    if (result.success) {
        usuarioActual = result.usuario;
        mostrarToast('Datos actualizados correctamente', 'success');
        cargarDatosUsuarioUI();
    } else {
        mostrarToast('Error al actualizar datos', 'error');
    }
}

// ===================================================
// PEDIDOS DEL USUARIO
// ===================================================

async function cargarPedidosUsuario() {
    if (!usuarioActual) return;
    
    const result = await obtenerPedidosUsuario(usuarioActual.id);
    
    if (result.success) {
        pedidosUsuario = result.pedidos || [];
        renderizarPedidosUsuario();
        actualizarTotalGastado();
    } else {
        console.error('Error cargando pedidos:', result.error);
    }
}

function renderizarPedidosUsuario() {
    // Separar pedidos actuales (no entregados) y historial (entregados)
    const pedidosActuales = pedidosUsuario.filter(p => p.estado !== 'entregado');
    const pedidosHistorial = pedidosUsuario.filter(p => p.estado === 'entregado');
    
    renderizarListaPedidos(pedidosActuales, 'pedidos-actuales-container');
    renderizarListaPedidos(pedidosHistorial, 'pedidos-historial-container');
}

function renderizarListaPedidos(pedidos, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!pedidos || pedidos.length === 0) {
        container.innerHTML = `
            <div class="sin-pedidos">
                <i class="fas fa-inbox"></i>
                <p>No hay pedidos en esta sección</p>
            </div>
        `;
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
            if (pedido.productos.length > 2) {
                productosResumen += ` +${pedido.productos.length - 2} más`;
            }
        }
        
        return `
            <div class="pedido-card" onclick="verDetallePedido(${pedido.id})">
                <div class="pedido-card-header">
                    <span class="pedido-numero">Pedido #${pedido.numero_orden || pedido.id}</span>
                    <span class="pedido-estado" style="background: ${estadoColor}20; color: ${estadoColor};">
                        ${estadoTexto}
                    </span>
                </div>
                <div class="pedido-card-body">
                    <div class="pedido-fecha">📅 ${fecha}</div>
                    <div class="pedido-negocio">🏪 ${escapeHTML(pedido.vendedor_nombre || 'Negocio')}</div>
                    <div class="pedido-productos">📦 ${escapeHTML(productosResumen)}</div>
                    <div class="pedido-total">💰 ${formatearPrecio(pedido.total)}</div>
                </div>
                <div class="pedido-card-footer">
                    <button class="btn-ver-detalle" onclick="event.stopPropagation(); verDetallePedido(${pedido.id})">
                        Ver detalle <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarTotalGastado() {
    const totalGastado = pedidosUsuario
        .filter(p => p.estado === 'entregado')
        .reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    
    const totalElement = document.getElementById('total-gastado-valor');
    if (totalElement) {
        totalElement.textContent = formatearPrecio(totalGastado);
    }
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
                    ${pedido.productos.map(pr => `
                        <div class="producto-detalle-item">
                            <span>${pr.cantidad}x ${escapeHTML(pr.nombre)}</span>
                            <span>${formatearPrecio(pr.precio * pr.cantidad)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    let detallesHTML = '';
    if (pedido.detalles && pedido.detalles.trim()) {
        detallesHTML = `
            <div class="detalle-seccion">
                <strong>📝 Detalles adicionales:</strong>
                <p>${escapeHTML(pedido.detalles)}</p>
            </div>
        `;
    }
    
    document.getElementById('detalle-pedido-titulo').textContent = `Pedido #${pedido.numero_orden || pedido.id}`;
    document.getElementById('detalle-pedido-body').innerHTML = `
        <div class="detalle-estado" style="background: ${estadoColor}20; color: ${estadoColor}; padding: 12px; border-radius: 12px; text-align: center; margin-bottom: 16px;">
            <strong>${estadoTexto}</strong>
        </div>
        <div class="detalle-seccion">
            <strong>📅 Fecha:</strong>
            <p>${fecha}</p>
        </div>
        <div class="detalle-seccion">
            <strong>👤 Cliente:</strong>
            <p>${escapeHTML(pedido.cliente_nombre)}</p>
        </div>
        <div class="detalle-seccion">
            <strong>📞 Teléfono:</strong>
            <p>${pedido.cliente_telefono}</p>
        </div>
        <div class="detalle-seccion">
            <strong>📍 Dirección de entrega:</strong>
            <p>${escapeHTML(pedido.direccion)}</p>
        </div>
        <div class="detalle-seccion">
            <strong>💳 Método de pago:</strong>
            <p>${metodoPago}</p>
        </div>
        ${productosHTML}
        ${detallesHTML}
        <div class="detalle-total">
            <strong>Total:</strong> ${formatearPrecio(pedido.total)}
        </div>
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
    
    const nombre = document.getElementById('reg-nombre').value.trim();
    const apellido = document.getElementById('reg-apellido').value.trim();
    const provincia = document.getElementById('reg-provincia').value;
    const ciudad = document.getElementById('reg-ciudad').value.trim();
    const direccion = document.getElementById('reg-direccion').value.trim();
    let telefono = document.getElementById('reg-telefono').value.trim();
    
    // Validaciones
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
        mostrarToast('Error de autenticación. Por favor, intentá nuevamente.', 'error');
        return;
    }
    
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

// ===================================================
// CIERRE DE SESIÓN
// ===================================================

async function cerrarSesion() {
    const result = await signOut();
    if (result.success) {
        mostrarToast('Sesión cerrada', 'info');
        handleUserLogout();
    } else {
        mostrarToast('Error al cerrar sesión', 'error');
    }
}

// ===================================================
// EVENT LISTENERS Y INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    // Botones de login
    const loginBtn = document.getElementById('login-google-btn');
    const registerBtn = document.getElementById('register-google-btn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const result = await loginWithGoogle();
            if (!result.success) {
                mostrarToast('Error al iniciar sesión', 'error');
            }
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const result = await loginWithGoogle();
            if (!result.success) {
                mostrarToast('Error al registrar', 'error');
            }
        });
    }
    
    // Formulario de registro
    const registroForm = document.getElementById('registro-form');
    if (registroForm) {
        registroForm.addEventListener('submit', registrarNuevoUsuario);
    }
    
    // Formulario de cuenta
    const cuentaForm = document.getElementById('cuenta-form');
    if (cuentaForm) {
        cuentaForm.addEventListener('submit', guardarDatosUsuario);
    }
    
    // Navegación
    const misPedidosLink = document.getElementById('mis-pedidos-link');
    const miCuentaLink = document.getElementById('mi-cuenta-link');
    const backToHome = document.getElementById('back-to-home');
    const backToHomeCuenta = document.getElementById('back-to-home-cuenta');
    const logoutLink = document.getElementById('logout-link');
    
    if (misPedidosLink) {
        misPedidosLink.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarMisPedidos();
        });
    }
    
    if (miCuentaLink) {
        miCuentaLink.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarMiCuenta();
        });
    }
    
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
    
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }
    
    // Tabs de pedidos
    const tabs = document.querySelectorAll('.pedidos-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.getElementById('pedidos-actuales-container').style.display = tabId === 'actuales' ? 'block' : 'none';
            document.getElementById('pedidos-historial-container').style.display = tabId === 'historial' ? 'block' : 'none';
        });
    });
    
    // Inicializar autenticación
    initAuth();
});

// Funciones globales
window.verDetallePedido = verDetallePedido;
window.cerrarModalDetallePedido = cerrarModalDetallePedido;