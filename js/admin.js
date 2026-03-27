// ===================================================
// ADMIN - Panel de vendedor con estados corregidos
// ===================================================

// Variables globales
let vendedorActual = null;
let pedidos = [];
let filtroActual = 'preparando';
let cargandoPedidos = false;

// Normalización de estados (por si vienen con acentos)
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
// AUTENTICACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Panel de administración iniciado');
    inicializarMenu();
    
    const btnIngresar = document.getElementById('btn-ingresar');
    if (btnIngresar) {
        btnIngresar.addEventListener('click', ingresarVendedor);
    }
    
    const inputId = document.getElementById('vendedor-id');
    if (inputId) {
        inputId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                ingresarVendedor();
            }
        });
    }
});

async function ingresarVendedor() {
    const vendedorId = document.getElementById('vendedor-id').value.trim();
    
    if (!vendedorId) {
        mostrarToast('Ingresá un ID de vendedor', 'error');
        return;
    }
    
    try {
        const response = await callAPI('getVendedores', {}, true);
        
        if (response.error || !response.success) {
            throw new Error(response.error || 'Error al cargar vendedores');
        }
        
        const vendedores = response.vendedores || [];
        const vendedor = vendedores.find(v => v.id.toString() === vendedorId);
        
        if (!vendedor) {
            mostrarToast('ID de vendedor no válido', 'error');
            return;
        }
        
        vendedorActual = vendedor;
        
        document.getElementById('admin-auth').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        document.getElementById('vendedor-info').innerHTML = `
            <p><strong>${escapeHTML(vendedor.nombre)}</strong> | Tel: ${vendedor.telefono}</p>
        `;
        
        mostrarToast(`Bienvenido ${vendedor.nombre}`, 'success');
        
        const btnRefresh = document.getElementById('btn-refresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                actualizarPedidos();
            });
        }
        
        await cargarPedidos();
        inicializarFiltros();
        
    } catch (error) {
        console.error('Error al ingresar:', error);
        mostrarToast('Error al conectar con el servidor', 'error');
    }
}

// ===================================================
// CARGAR PEDIDOS
// ===================================================

async function cargarPedidos(forceRefresh = false) {
    if (!vendedorActual) return;
    if (cargandoPedidos) return;
    
    cargandoPedidos = true;
    
    const container = document.getElementById('pedidos-container');
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Cargando pedidos...</p>
        </div>
    `;
    
    try {
        const response = await callAPI('getPedidos', { vendedorId: vendedorActual.id }, forceRefresh);
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        // Normalizar estados al cargar
        pedidos = (response.pedidos || []).map(pedido => ({
            ...pedido,
            estado: normalizarEstado(pedido.estado)
        }));
        
        console.log(`📦 Cargados ${pedidos.length} pedidos`);
        
        actualizarContadores();
        renderizarPedidos();
        
        if (forceRefresh) {
            mostrarToast('Pedidos actualizados', 'success');
        }
        
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        container.innerHTML = `
            <div class="error-mensaje">
                <p>⚠️ Error al cargar pedidos</p>
                <p style="font-size: 0.8rem;">${error.message}</p>
                <button onclick="cargarPedidos(true)" class="btn btn-outline">Reintentar</button>
            </div>
        `;
    } finally {
        cargandoPedidos = false;
    }
}

async function actualizarPedidos() {
    if (!vendedorActual) return;
    
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    }
    
    await cargarPedidos(true);
    
    if (btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
    }
}

// ===================================================
// ACTUALIZAR CONTADORES
// ===================================================

function actualizarContadores() {
    const contarPorEstado = {
        preparando: 0,
        'en preparacion': 0,
        'en camino': 0,
        entregado: 0
    };
    
    pedidos.forEach(pedido => {
        const estado = pedido.estado || 'preparando';
        if (contarPorEstado[estado] !== undefined) {
            contarPorEstado[estado]++;
        }
    });
    
    const btnPreparando = document.querySelector('.filtro-btn[data-estado="preparando"]');
    const btnEnPreparacion = document.querySelector('.filtro-btn[data-estado="en preparacion"]');
    const btnEnCamino = document.querySelector('.filtro-btn[data-estado="en camino"]');
    const btnEntregado = document.querySelector('.filtro-btn[data-estado="entregado"]');
    
    if (btnPreparando) btnPreparando.innerHTML = `📦 Nuevos pedidos (${contarPorEstado.preparando})`;
    if (btnEnPreparacion) btnEnPreparacion.innerHTML = `👨‍🍳 En preparación (${contarPorEstado['en preparacion']})`;
    if (btnEnCamino) btnEnCamino.innerHTML = `🚚 En camino (${contarPorEstado['en camino']})`;
    if (btnEntregado) btnEntregado.innerHTML = `✅ Entregados (${contarPorEstado.entregado})`;
}

// ===================================================
// RENDERIZAR PEDIDOS
// ===================================================

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    
    let pedidosFiltrados = pedidos;
    if (filtroActual !== 'todos') {
        pedidosFiltrados = pedidos.filter(p => p.estado === filtroActual);
    }
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="sin-pedidos">
                <p>📭 No hay pedidos ${filtroActual !== 'todos' ? `con estado "${filtroActual}"` : ''}</p>
                <button onclick="actualizarPedidos()" class="btn btn-outline" style="margin-top: 15px;">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pedidosFiltrados.map(pedido => `
        <div class="pedido-card" data-id="${pedido.id}" data-estado="${pedido.estado}">
            <div class="pedido-header">
                <div class="pedido-id">Pedido #${pedido.id}</div>
                <div class="pedido-fecha">${formatearFecha(pedido.fecha)}</div>
            </div>
            <div class="pedido-cliente">
                <strong><i class="fas fa-user"></i> ${escapeHTML(pedido.cliente_nombre)}</strong>
                <span><i class="fas fa-phone"></i> ${pedido.cliente_telefono}</span>
                <span><i class="fas fa-map-marker-alt"></i> ${escapeHTML(pedido.direccion || 'Sin dirección')}</span>
                <span><i class="fas fa-money-bill-wave"></i> ${formatearMetodoPago(pedido.metodo_pago)}</span>
            </div>
            <div class="pedido-productos">
                <strong>Productos:</strong>
                <ul>
                    ${pedido.productos ? pedido.productos.map(p => `
                        <li>${p.cantidad}x ${escapeHTML(p.nombre)} - ${formatearPrecio(p.precio * p.cantidad)}</li>
                    `).join('') : '<li>No hay detalles</li>'}
                </ul>
                <div class="pedido-total">Total: ${formatearPrecio(pedido.total)}</div>
            </div>
            <div class="pedido-actions">
                <div class="estado-actual">
                    <span class="estado-badge estado-${pedido.estado.replace(' ', '-')}">${getEstadoTexto(pedido.estado)}</span>
                </div>
                <div class="botones-estado">
                    ${pedido.estado !== 'preparando' ? `<button class="btn-estado" onclick="actualizarEstado(${pedido.id}, 'preparando', this)">📦 Nuevo</button>` : ''}
                    ${pedido.estado !== 'en preparacion' ? `<button class="btn-estado" onclick="actualizarEstado(${pedido.id}, 'en preparacion', this)">👨‍🍳 Preparar</button>` : ''}
                    ${pedido.estado !== 'en camino' ? `<button class="btn-estado" onclick="actualizarEstado(${pedido.id}, 'en camino', this)">🚚 En camino</button>` : ''}
                    ${pedido.estado !== 'entregado' ? `<button class="btn-estado" onclick="actualizarEstado(${pedido.id}, 'entregado', this)">✅ Entregar</button>` : ''}
                </div>
                <div class="botones-acciones">
                    <button class="btn-notificar" onclick="notificarCliente(${pedido.id}, this)">
                        <i class="fab fa-whatsapp"></i> Notificar
                    </button>
                    <button class="btn-cancelar" onclick="cancelarPedido(${pedido.id}, this)">
                        <i class="fas fa-trash-alt"></i> Cancelar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
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

// ===================================================
// ACTUALIZAR ESTADO (con loading)
// ===================================================

async function actualizarEstado(pedidoId, nuevoEstado, boton) {
    if (!boton) return;
    
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        console.log(`📝 Actualizando pedido ${pedidoId} a estado: ${nuevoEstado}`);
        
        const response = await postAPI('actualizarEstado', {
            pedidoId: pedidoId,
            estado: nuevoEstado
        });
        
        if (response && response.success) {
            mostrarToast(`Pedido #${pedidoId} actualizado`, 'success');
            
            const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
            if (pedido) {
                pedido.estado = nuevoEstado;
            }
            
            actualizarContadores();
            renderizarPedidos();
            
        } else {
            throw new Error(response?.error || 'Error al actualizar');
        }
        
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        mostrarToast('Error al actualizar el estado', 'error');
        boton.innerHTML = textoOriginal;
        boton.disabled = false;
    }
}

// ===================================================
// CANCELAR PEDIDO (con confirmación y loading)
// ===================================================

async function cancelarPedido(pedidoId, boton) {
    const confirmar = confirm('⚠️ ¿Estás seguro que querés cancelar este pedido?\n\nEsta acción eliminará el pedido permanentemente de la base de datos y no se podrá recuperar.');
    
    if (!confirmar) return;
    
    if (boton) {
        const textoOriginal = boton.innerHTML;
        boton.disabled = true;
        boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelando...';
        
        try {
            console.log(`🗑️ Cancelando pedido ${pedidoId}`);
            
            const response = await postAPI('cancelarPedido', {
                pedidoId: pedidoId
            });
            
            console.log('Respuesta cancelar:', response);
            
            if (response && response.success) {
                mostrarToast(`Pedido #${pedidoId} cancelado y eliminado`, 'success');
                
                // Eliminar de la lista local
                pedidos = pedidos.filter(p => p.id.toString() !== pedidoId.toString());
                
                actualizarContadores();
                renderizarPedidos();
                
            } else {
                throw new Error(response?.error || 'Error al cancelar');
            }
            
        } catch (error) {
            console.error('Error al cancelar pedido:', error);
            mostrarToast('Error al cancelar el pedido: ' + error.message, 'error');
            boton.innerHTML = textoOriginal;
            boton.disabled = false;
        }
    }
}

// ===================================================
// NOTIFICAR CLIENTE (con loading)
// ===================================================

function notificarCliente(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    
    if (!pedido) {
        mostrarToast('Pedido no encontrado', 'error');
        return;
    }
    
    if (boton) {
        const textoOriginal = boton.innerHTML;
        boton.disabled = true;
        boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Abriendo...';
        
        const mensaje = generarMensajeNotificacion(pedido);
        const telefonoCliente = pedido.cliente_telefono;
        
        if (!telefonoCliente) {
            mostrarToast('El cliente no tiene número de teléfono registrado', 'error');
            boton.innerHTML = textoOriginal;
            boton.disabled = false;
            return;
        }
        
        const urlWhatsApp = `https://wa.me/${telefonoCliente}?text=${encodeURIComponent(mensaje)}`;
        
        setTimeout(() => {
            window.open(urlWhatsApp, '_blank');
            boton.innerHTML = textoOriginal;
            boton.disabled = false;
        }, 500);
    }
}

function generarMensajeNotificacion(pedido) {
    const estadoTexto = {
        'preparando': '🍳 hemos recibido tu pedido y comenzaremos a prepararlo pronto',
        'en preparacion': '👨‍🍳 estamos preparando tu pedido',
        'en camino': '🚚 tu pedido está en camino',
        'entregado': '✅ tu pedido ha sido entregado. ¡Gracias por elegirnos!'
    };
    
    let mensaje = `🍕 *WANT - Actualización de pedido* 🍕\n\n`;
    mensaje += `Hola ${pedido.cliente_nombre},\n`;
    mensaje += `${estadoTexto[pedido.estado] || `tu pedido está ${pedido.estado}`}.\n\n`;
    mensaje += `*Pedido #${pedido.id}*\n`;
    mensaje += `*Total:* ${formatearPrecio(pedido.total)}\n\n`;
    
    if (pedido.estado === 'entregado') {
        mensaje += `¡Esperamos que disfrutes tu pedido!\n`;
        mensaje += `❤️ Want - Pedidos simples y rápidos`;
    } else {
        mensaje += `Cualquier consulta, respondé este mensaje.`;
    }
    
    return mensaje;
}

// ===================================================
// FILTROS
// ===================================================

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
// FUNCIONES UTILITARIAS
// ===================================================

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'Fecha no disponible';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatearMetodoPago(metodo) {
    const metodos = {
        'efectivo': 'Efectivo',
        'transferencia': 'Transferencia',
        'mercado_pago': 'Mercado Pago'
    };
    return metodos[metodo] || metodo || 'No especificado';
}

// ===================================================
// MENÚ MÓVIL
// ===================================================

function inicializarMenu() {
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

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}