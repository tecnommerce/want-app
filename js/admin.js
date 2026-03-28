// ===================================================
// ADMIN - Panel con autenticación (email + contraseña)
// Versión completa con nuevo diseño
// ===================================================

// Configuración de Cloudinary
const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r'; // Reemplazá con tu cloud name
const CLOUDINARY_UPLOAD_PRESET = 'want_productos';

// Variables globales
let vendedorActual = null;
let pedidos = [];
let productos = [];
let filtroActual = 'preparando';
let cargandoPedidos = false;
let tabActual = 'pedidos';

// ===================================================
// UTILIDADES DE AUTENTICACIÓN
// ===================================================

// Función para hashear contraseñas (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Guardar sesión
function guardarSesion(vendedor) {
    sessionStorage.setItem('vendedor_sesion', JSON.stringify({
        id: vendedor.id,
        email: vendedor.email,
        nombre: vendedor.nombre
    }));
}

// Cargar sesión
function cargarSesion() {
    const sesion = sessionStorage.getItem('vendedor_sesion');
    if (sesion) {
        return JSON.parse(sesion);
    }
    return null;
}

// Cerrar sesión
function cerrarSesion() {
    sessionStorage.removeItem('vendedor_sesion');
    // Ocultar header y menú móvil
    document.getElementById('header-admin').style.display = 'none';
    document.getElementById('mobile-menu-admin').style.display = 'none';
    document.getElementById('menu-overlay-admin').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('admin-auth').style.display = 'flex';
    // Limpiar formularios
    document.getElementById('login-form').reset();
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
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Panel de administración iniciado');
    inicializarMenuGeneral();
    inicializarAuthTabs();
    
    // Verificar sesión guardada
    const sesion = cargarSesion();
    if (sesion) {
        cargarVendedorPorId(sesion.id);
    }
});

// ===================================================
// MENÚ GENERAL (fuera del login)
// ===================================================

function inicializarMenuGeneral() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuClose = document.getElementById('menu-close');
    const contactoLink = document.getElementById('contacto-link');
    const contactoLinkMobile = document.getElementById('contacto-link-mobile');
    const contactoSection = document.getElementById('contacto-section');

    function openMenu() { 
        if (mobileMenu) mobileMenu.classList.add('active'); 
        if (menuOverlay) menuOverlay.classList.add('active'); 
        document.body.style.overflow = 'hidden'; 
    }
    
    function closeMenu() { 
        if (mobileMenu) mobileMenu.classList.remove('active'); 
        if (menuOverlay) menuOverlay.classList.remove('active'); 
        document.body.style.overflow = ''; 
    }
    
    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
    
    function mostrarContacto(e) { 
        e.preventDefault(); 
        closeMenu(); 
        if (contactoSection) { 
            contactoSection.style.display = 'block'; 
            contactoSection.scrollIntoView({ behavior: 'smooth' }); 
        } 
    }
    
    if (contactoLink) contactoLink.addEventListener('click', mostrarContacto);
    if (contactoLinkMobile) contactoLinkMobile.addEventListener('click', mostrarContacto);
}

// ===================================================
// UI ADMIN - Control de menú móvil después del login
// ===================================================

function inicializarUIAdmin() {
    const menuToggle = document.getElementById('menu-toggle-admin');
    const mobileMenu = document.getElementById('mobile-menu-admin');
    const menuOverlay = document.getElementById('menu-overlay-admin');
    const menuClose = document.getElementById('menu-close-admin');
    
    function openMenu() {
        if (mobileMenu) mobileMenu.classList.add('active');
        if (menuOverlay) menuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeMenu() {
        if (mobileMenu) mobileMenu.classList.remove('active');
        if (menuOverlay) menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
    
    // Mobile tabs
    const mobileTabs = document.querySelectorAll('.mobile-tab-btn');
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            cambiarTab(tabId);
            closeMenu();
        });
    });
    
    // Mobile logout
    const mobileLogout = document.getElementById('mobile-logout-btn');
    if (mobileLogout) {
        mobileLogout.addEventListener('click', () => {
            cerrarSesion();
        });
    }
}

function mostrarPanelDespuesLogin(vendedor) {
    // Mostrar header admin
    const headerAdmin = document.getElementById('header-admin');
    if (headerAdmin) headerAdmin.style.display = 'block';
    
    // Mostrar menú móvil admin
    const mobileMenu = document.getElementById('mobile-menu-admin');
    const menuOverlay = document.getElementById('menu-overlay-admin');
    if (mobileMenu) mobileMenu.style.display = 'flex';
    if (menuOverlay) menuOverlay.style.display = 'block';
}

// ===================================================
// TABS
// ===================================================

function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            cambiarTab(tabId);
        });
    });
}

function cambiarTab(tabId) {
    tabActual = tabId;
    
    // Actualizar botones escritorio
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });
    
    // Actualizar botones móvil
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });
    
    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'productos') {
        cargarProductos();
    }
}

// ===================================================
// AUTENTICACIÓN - TABS
// ===================================================

function inicializarAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.auth-panel').forEach(panel => panel.style.display = 'none');
            document.getElementById(`${tabId}-panel`).style.display = 'block';
        });
    });
    
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await login();
        });
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await register();
        });
    }
    
    // Recover form
    const recoverForm = document.getElementById('recover-form');
    if (recoverForm) {
        recoverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await solicitarRecuperacion();
        });
    }
    
    // Reset password button
    const btnReset = document.getElementById('btn-reset-password');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            await resetearPassword();
        });
    }
}

// ===================================================
// LOGIN
// ===================================================

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    
    try {
        mostrarToast('Validando credenciales...', 'info');
        
        const response = await callAPI('loginVendedor', { email, password: await hashPassword(password) }, true);
        
        if (response.success && response.vendedor) {
            vendedorActual = response.vendedor;
            guardarSesion(vendedorActual);
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
// REGISTRO
// ===================================================

async function register() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const direccion = document.getElementById('reg-direccion').value.trim();
    const horario = document.getElementById('reg-horario').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    
    if (!nombre || !email || !telefono || !direccion || !password) {
        mostrarToast('Completá todos los campos obligatorios', 'error');
        return;
    }
    
    if (password !== password2) {
        mostrarToast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (password.length < 6) {
        mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    if (!telefono.match(/^\d{10,15}$/)) {
        mostrarToast('Teléfono inválido (solo números, 10-15 dígitos)', 'error');
        return;
    }
    
    try {
        mostrarToast('Creando cuenta...', 'info');
        
        const response = await postAPI('registrarVendedor', {
            nombre,
            email,
            telefono,
            direccion,
            horario,
            password_hash: await hashPassword(password)
        });
        
        if (response.success) {
            mostrarToast('¡Registro exitoso! Ahora podés iniciar sesión', 'success');
            document.querySelector('.auth-tab[data-tab="login"]').click();
            document.getElementById('login-email').value = email;
        } else {
            throw new Error(response.error || 'Error al registrar');
        }
    } catch (error) {
        console.error('Error registro:', error);
        mostrarToast(error.message, 'error');
    }
}

// ===================================================
// RECUPERACIÓN DE CONTRASEÑA
// ===================================================

async function solicitarRecuperacion() {
    const email = document.getElementById('recover-email').value.trim();
    
    if (!email) {
        mostrarToast('Ingresá tu email', 'error');
        return;
    }
    
    try {
        mostrarToast('Enviando código...', 'info');
        
        const response = await postAPI('solicitarRecuperacion', { email });
        
        if (response.success) {
            mostrarToast('Código de recuperación enviado', 'success');
            document.getElementById('recover-code-section').style.display = 'block';
            if (response.codigo) {
                console.log('Código (testing):', response.codigo);
            }
        } else {
            throw new Error(response.error || 'Email no encontrado');
        }
    } catch (error) {
        console.error('Error recuperación:', error);
        mostrarToast(error.message, 'error');
    }
}

async function resetearPassword() {
    const email = document.getElementById('recover-email').value.trim();
    const codigo = document.getElementById('recover-code').value.trim();
    const newPassword = document.getElementById('recover-new-password').value;
    const newPassword2 = document.getElementById('recover-new-password2').value;
    
    if (!codigo || !newPassword) {
        mostrarToast('Completá todos los campos', 'error');
        return;
    }
    
    if (newPassword !== newPassword2) {
        mostrarToast('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    try {
        mostrarToast('Restableciendo contraseña...', 'info');
        
        const response = await postAPI('resetearPassword', {
            email,
            codigo,
            new_password_hash: await hashPassword(newPassword)
        });
        
        if (response.success) {
            mostrarToast('Contraseña restablecida. Ahora podés iniciar sesión', 'success');
            document.querySelector('.auth-tab[data-tab="login"]').click();
            document.getElementById('login-email').value = email;
            document.getElementById('recover-code-section').style.display = 'none';
            document.getElementById('recover-form').reset();
        } else {
            throw new Error(response.error || 'Código inválido');
        }
    } catch (error) {
        console.error('Error reset password:', error);
        mostrarToast(error.message, 'error');
    }
}

// ===================================================
// CARGAR VENDEDOR POR ID (para sesión guardada)
// ===================================================

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
        console.error('Error cargar vendedor:', error);
        cerrarSesion();
    }
}

// ===================================================
// INICIAR PANEL PRINCIPAL (DESPUÉS DEL LOGIN)
// ===================================================

async function iniciarPanel(vendedor) {
    // Ocultar autenticación y mostrar panel
    document.getElementById('admin-auth').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    
    // Mostrar header admin y menú móvil
    mostrarPanelDespuesLogin(vendedor);
    
    // Actualizar información del panel
    document.getElementById('panel-nombre').textContent = vendedor.nombre;
    document.getElementById('panel-email').textContent = vendedor.email;
    document.getElementById('perfil-nombre-display').textContent = vendedor.nombre;
    document.getElementById('perfil-email-display').textContent = vendedor.email;
    
    // Cargar datos del vendedor
    await cargarPedidos();
    await cargarProductos();
    cargarPerfil();
    
    // Botón actualizar datos
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        const newBtnRefresh = btnRefresh.cloneNode(true);
        btnRefresh.parentNode.replaceChild(newBtnRefresh, btnRefresh);
        newBtnRefresh.addEventListener('click', () => {
            actualizarPedidos();
            cargarProductos(true);
        });
    }
    
    // Botón agregar producto
    const btnAgregar = document.getElementById('btn-agregar-producto');
    if (btnAgregar) {
        const newBtnAgregar = btnAgregar.cloneNode(true);
        btnAgregar.parentNode.replaceChild(newBtnAgregar, btnAgregar);
        newBtnAgregar.addEventListener('click', () => mostrarModalProducto());
    }
    
    // Botón cerrar sesión (escritorio)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        const newBtnLogout = btnLogout.cloneNode(true);
        btnLogout.parentNode.replaceChild(newBtnLogout, btnLogout);
        newBtnLogout.addEventListener('click', () => {
            cerrarSesion();
        });
    }
    
    // Inicializar filtros y tabs
    inicializarFiltros();
    inicializarTabs();
    
    // Inicializar UI admin (menú móvil)
    inicializarUIAdmin();
}

// ===================================================
// PEDIDOS
// ===================================================

async function cargarPedidos(forceRefresh = false) {
    if (!vendedorActual) return;
    if (cargandoPedidos) return;
    
    cargandoPedidos = true;
    const container = document.getElementById('pedidos-container');
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando pedidos...</p></div>`;
    
    try {
        const response = await callAPI('getPedidos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        
        pedidos = (response.pedidos || []).map(p => ({ ...p, estado: normalizarEstado(p.estado) }));
        actualizarContadores();
        actualizarBadges();
        renderizarPedidos();
        
        if (forceRefresh) mostrarToast('Pedidos actualizados', 'success');
    } catch (error) {
        console.error('Error cargar pedidos:', error);
        container.innerHTML = `<div class="error-mensaje"><p>⚠️ Error al cargar pedidos</p></div>`;
    } finally {
        cargandoPedidos = false;
    }
}

async function actualizarPedidos() {
    if (!vendedorActual) return;
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    await cargarPedidos(true);
    if (btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i>';
    }
}

function actualizarContadores() {
    const contarPorEstado = { preparando: 0, 'en preparacion': 0, 'en camino': 0, entregado: 0 };
    pedidos.forEach(p => { if (contarPorEstado[p.estado] !== undefined) contarPorEstado[p.estado]++; });
    
    // Filtros escritorio
    const btnPreparando = document.querySelector('.filtro-btn[data-estado="preparando"]');
    const btnEnPreparacion = document.querySelector('.filtro-btn[data-estado="en preparacion"]');
    const btnEnCamino = document.querySelector('.filtro-btn[data-estado="en camino"]');
    const btnEntregado = document.querySelector('.filtro-btn[data-estado="entregado"]');
    
    if (btnPreparando) btnPreparando.innerHTML = `📦 Nuevos <span class="filtro-count">${contarPorEstado.preparando}</span>`;
    if (btnEnPreparacion) btnEnPreparacion.innerHTML = `👨‍🍳 Preparación <span class="filtro-count">${contarPorEstado['en preparacion']}</span>`;
    if (btnEnCamino) btnEnCamino.innerHTML = `🚚 En camino <span class="filtro-count">${contarPorEstado['en camino']}</span>`;
    if (btnEntregado) btnEntregado.innerHTML = `✅ Entregados <span class="filtro-count">${contarPorEstado.entregado}</span>`;
    
    // Contadores móvil
    const countPreparando = document.getElementById('count-preparando');
    const countPreparacion = document.getElementById('count-preparacion');
    const countCamino = document.getElementById('count-camino');
    const countEntregado = document.getElementById('count-entregado');
    
    if (countPreparando) countPreparando.textContent = contarPorEstado.preparando;
    if (countPreparacion) countPreparacion.textContent = contarPorEstado['en preparacion'];
    if (countCamino) countCamino.textContent = contarPorEstado['en camino'];
    if (countEntregado) countEntregado.textContent = contarPorEstado.entregado;
}

function actualizarBadges() {
    const badgePedidos = document.getElementById('badge-pedidos');
    if (badgePedidos) badgePedidos.textContent = pedidos.length;
    
    const badgeProductos = document.getElementById('badge-productos');
    if (badgeProductos) badgeProductos.textContent = productos.length;
}

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    let pedidosFiltrados = filtroActual !== 'todos' ? pedidos.filter(p => p.estado === filtroActual) : pedidos;
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>📭 No hay pedidos</p></div>`;
        return;
    }
    
    container.innerHTML = pedidosFiltrados.map(p => `
        <div class="pedido-card">
            <div class="pedido-header">
                <div class="pedido-id">Pedido #${p.id}</div>
                <div class="pedido-fecha">${formatearFecha(p.fecha)}</div>
            </div>
            <div class="pedido-cliente">
                <strong><i class="fas fa-user"></i> ${escapeHTML(p.cliente_nombre)}</strong>
                <span><i class="fas fa-phone"></i> ${p.cliente_telefono}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${escapeHTML(p.direccion || 'Sin dirección')}</span>
                <span><i class="fas fa-money-bill-wave"></i> ${formatearMetodoPago(p.metodo_pago)}</span>
            </div>
            <div class="pedido-productos">
                <strong>Productos:</strong>
                <ul>${p.productos ? p.productos.map(pr => `<li>${pr.cantidad}x ${escapeHTML(pr.nombre)} - ${formatearPrecio(pr.precio * pr.cantidad)}</li>`).join('') : '<li>No hay detalles</li>'}</ul>
                <div class="pedido-total">Total: ${formatearPrecio(p.total)}</div>
            </div>
            <div class="pedido-actions">
                <div class="estado-actual"><span class="estado-badge estado-${p.estado.replace(' ', '-')}">${getEstadoTexto(p.estado)}</span></div>
                <div class="botones-estado">
                    ${p.estado !== 'preparando' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'preparando', this)">📦 Nuevo</button>` : ''}
                    ${p.estado !== 'en preparacion' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'en preparacion', this)">👨‍🍳 Preparar</button>` : ''}
                    ${p.estado !== 'en camino' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'en camino', this)">🚚 En camino</button>` : ''}
                    ${p.estado !== 'entregado' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'entregado', this)">✅ Entregar</button>` : ''}
                </div>
                <div class="botones-acciones">
                    <button class="btn-notificar" onclick="notificarCliente(${p.id}, this)"><i class="fab fa-whatsapp"></i> Notificar</button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${p.id}, this)"><i class="fas fa-trash-alt"></i> Cancelar</button>
                </div>
            </div>
        </div>
    `).join('');
}

function getEstadoTexto(estado) {
    const textos = { 'preparando': 'NUEVO PEDIDO', 'en preparacion': 'EN PREPARACIÓN', 'en camino': 'EN CAMINO', 'entregado': 'ENTREGADO' };
    return textos[estado] || estado.toUpperCase();
}

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
            actualizarContadores();
            renderizarPedidos();
        } else throw new Error(response?.error || 'Error');
    } catch (error) {
        mostrarToast('Error al actualizar', 'error');
        boton.innerHTML = textoOriginal;
        boton.disabled = false;
    }
}

async function cancelarPedido(pedidoId, boton) {
    if (!confirm('⚠️ ¿Cancelar este pedido? Se eliminará permanentemente.')) return;
    if (!boton) return;
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const response = await postAPI('cancelarPedido', { pedidoId });
        if (response && response.success) {
            mostrarToast(`Pedido #${pedidoId} cancelado`, 'success');
            pedidos = pedidos.filter(p => p.id.toString() !== pedidoId.toString());
            actualizarContadores();
            renderizarPedidos();
        } else throw new Error(response?.error || 'Error');
    } catch (error) {
        mostrarToast('Error al cancelar', 'error');
        boton.innerHTML = textoOriginal;
        boton.disabled = false;
    }
}

function notificarCliente(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    if (!boton) return;
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    const estadoTexto = {
        'preparando': '🍳 hemos recibido tu pedido',
        'en preparacion': '👨‍🍳 estamos preparando tu pedido',
        'en camino': '🚚 tu pedido está en camino',
        'entregado': '✅ tu pedido ha sido entregado'
    };
    const mensaje = `🍕 *WANT* 🍕\nHola ${pedido.cliente_nombre},\n${estadoTexto[pedido.estado] || `tu pedido está ${pedido.estado}`}.\n\nPedido #${pedido.id}\nTotal: ${formatearPrecio(pedido.total)}`;
    const url = `https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
    setTimeout(() => { window.open(url, '_blank'); boton.innerHTML = textoOriginal; boton.disabled = false; }, 500);
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

// ===================================================
// PRODUCTOS - CRUD
// ===================================================

async function cargarProductos(forceRefresh = false) {
    if (!vendedorActual) return;
    
    const container = document.getElementById('productos-admin-grid');
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando productos...</p></div>`;
    
    try {
        const response = await callAPI('getProductos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        
        productos = response.productos || [];
        renderizarProductosAdmin();
        actualizarBadges();
        
    } catch (error) {
        console.error('Error cargar productos:', error);
        container.innerHTML = `<div class="error-mensaje"><p>⚠️ Error al cargar productos</p></div>`;
    }
}

function renderizarProductosAdmin() {
    const container = document.getElementById('productos-admin-grid');
    
    if (productos.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>📭 No tenés productos cargados</p><button class="btn-primary btn-add-producto" onclick="mostrarModalProducto()"><i class="fas fa-plus"></i> Agregar producto</button></div>`;
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
                    <button class="btn-editar" onclick="mostrarModalProducto(${p.id})">✏️ Editar</button>
                    <button class="btn-eliminar" onclick="eliminarProducto(${p.id})">🗑️ Eliminar</button>
                </div>
            </div>
        </div>
    `).join('');
}

function mostrarModalProducto(productoId = null) {
    const producto = productoId ? productos.find(p => p.id.toString() === productoId.toString()) : null;
    
    const modalHTML = `
        <div class="modal active" id="modal-producto" style="display: flex;">
            <div class="modal-content modal-producto">
                <div class="modal-header">
                    <h3>${producto ? 'Editar producto' : 'Nuevo producto'}</h3>
                    <button class="modal-close" onclick="cerrarModalProducto()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="producto-form">
                        <div class="form-group">
                            <label>Nombre del producto *</label>
                            <input type="text" id="producto-nombre" value="${producto ? escapeHTML(producto.nombre) : ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Descripción</label>
                            <textarea id="producto-descripcion">${producto ? escapeHTML(producto.descripcion || '') : ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Precio *</label>
                            <input type="number" id="producto-precio" value="${producto ? producto.precio : ''}" step="100" required>
                        </div>
                        <div class="form-group">
                            <label>Imagen del producto</label>
                            <input type="file" id="producto-imagen" accept="image/*">
                            <div id="producto-imagen-preview" class="image-preview">
                                ${producto && producto.imagen_url ? `<img src="${producto.imagen_url}" style="max-width: 100%; max-height: 150px;">` : ''}
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Disponible</label>
                            <select id="producto-disponible">
                                <option value="SI" ${producto && producto.disponible === 'SI' ? 'selected' : ''}>Sí</option>
                                <option value="NO" ${producto && producto.disponible === 'NO' ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="guardarProducto(${producto ? producto.id : 'null'})">Guardar</button>
                    <button class="btn-outline" onclick="cerrarModalProducto()">Cancelar</button>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-producto-container';
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    const inputImagen = document.getElementById('producto-imagen');
    if (inputImagen) {
        inputImagen.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('producto-imagen-preview').innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 150px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function cerrarModalProducto() {
    const modal = document.getElementById('modal-producto-container');
    if (modal) modal.remove();
}

async function guardarProducto(productoId) {
    const nombre = document.getElementById('producto-nombre')?.value.trim();
    const descripcion = document.getElementById('producto-descripcion')?.value.trim();
    const precio = parseFloat(document.getElementById('producto-precio')?.value);
    const disponible = document.getElementById('producto-disponible')?.value;
    const imagenFile = document.getElementById('producto-imagen')?.files[0];
    
    if (!nombre || !precio) {
        mostrarToast('Completá nombre y precio', 'error');
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
    } else if (productoId) {
        const productoExistente = productos.find(p => p.id.toString() === productoId.toString());
        if (productoExistente && productoExistente.imagen_url) {
            imagenUrl = productoExistente.imagen_url;
        }
    }
    
    const producto = {
        nombre,
        descripcion,
        precio,
        disponible,
        imagen_url: imagenUrl,
        vendedor_id: vendedorActual.id
    };
    
    try {
        mostrarToast('Guardando producto...', 'info');
        
        let response;
        if (productoId) {
            response = await postAPI('actualizarProducto', { ...producto, id: productoId });
        } else {
            response = await postAPI('crearProducto', producto);
        }
        
        if (response && response.success) {
            mostrarToast(`Producto ${productoId ? 'actualizado' : 'creado'} correctamente`, 'success');
            cerrarModalProducto();
            await cargarProductos(true);
        } else {
            throw new Error(response?.error || 'Error al guardar');
        }
    } catch (error) {
        console.error('Error guardar producto:', error);
        mostrarToast('Error al guardar producto', 'error');
    }
}

async function eliminarProducto(productoId) {
    const confirmar = confirm('¿Eliminar este producto permanentemente?');
    if (!confirmar) return;
    
    try {
        const response = await postAPI('eliminarProducto', { productoId });
        if (response && response.success) {
            mostrarToast('Producto eliminado', 'success');
            await cargarProductos(true);
        } else {
            throw new Error(response?.error || 'Error al eliminar');
        }
    } catch (error) {
        console.error('Error eliminar producto:', error);
        mostrarToast('Error al eliminar producto', 'error');
    }
}

// ===================================================
// CLOUDINARY - SUBIR IMAGEN
// ===================================================

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
        if (data.secure_url) {
            return data.secure_url;
        } else {
            console.error('Error Cloudinary:', data);
            return null;
        }
    } catch (error) {
        console.error('Error subir imagen:', error);
        return null;
    }
}

// ===================================================
// PERFIL
// ===================================================

function cargarPerfil() {
    if (!vendedorActual) return;
    
    document.getElementById('perfil-nombre').value = vendedorActual.nombre || '';
    document.getElementById('perfil-telefono').value = vendedorActual.telefono || '';
    document.getElementById('perfil-direccion').value = vendedorActual.direccion || '';
    document.getElementById('perfil-horario').value = vendedorActual.horario || '';
    
    if (vendedorActual.logo_url) {
        document.getElementById('logo-preview').innerHTML = `<img src="${vendedorActual.logo_url}" style="max-width: 100px; border-radius: 12px;">`;
    }
    
    // Botón subir logo
    const btnUploadLogo = document.getElementById('btn-upload-logo');
    const logoInput = document.getElementById('perfil-logo');
    if (btnUploadLogo && logoInput) {
        btnUploadLogo.addEventListener('click', () => {
            logoInput.click();
        });
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('logo-preview').innerHTML = `<img src="${e.target.result}" style="max-width: 100px; border-radius: 12px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    const form = document.getElementById('perfil-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            await actualizarPerfil();
        };
    }
}

async function actualizarPerfil() {
    const nombre = document.getElementById('perfil-nombre').value.trim();
    const telefono = document.getElementById('perfil-telefono').value.trim();
    const direccion = document.getElementById('perfil-direccion').value.trim();
    const horario = document.getElementById('perfil-horario').value.trim();
    const newPassword = document.getElementById('perfil-new-password').value;
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
    
    const updateData = {
        id: vendedorActual.id,
        nombre,
        telefono,
        direccion,
        horario,
        logo_url: logoUrl
    };
    
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
            document.getElementById('panel-nombre').textContent = nombre;
            document.getElementById('perfil-nombre-display').textContent = nombre;
            document.getElementById('perfil-new-password').value = '';
        } else {
            throw new Error(response?.error || 'Error al actualizar');
        }
    } catch (error) {
        console.error('Error actualizar perfil:', error);
        mostrarToast('Error al actualizar perfil', 'error');
    }
}

// ===================================================
// UTILITARIAS
// ===================================================

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'Fecha no disponible';
    return new Date(fechaISO).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatearMetodoPago(metodo) {
    const metodos = { 'efectivo': 'Efectivo', 'transferencia': 'Transferencia', 'mercado_pago': 'Mercado Pago' };
    return metodos[metodo] || metodo || 'No especificado';
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}