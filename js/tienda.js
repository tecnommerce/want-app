// ===================================================
// TIENDA - Lógica de catálogo y carrito
// Con carrito separado por vendedor
// ===================================================

// Variables globales
let vendedorActual = null;
let vendedorIdActual = null;
let productos = [];
let carrito = [];

// ===================================================
// FUNCIONES DE CARRITO POR VENDEDOR
// ===================================================

// Obtener clave única para el carrito del vendedor
function getCarritoKey(vendedorId) {
    return `want_carrito_vendedor_${vendedorId}`;
}

// Cargar carrito del vendedor actual desde localStorage
function cargarCarritoDelVendedor(vendedorId) {
    const carritoKey = getCarritoKey(vendedorId);
    const carritoGuardado = localStorage.getItem(carritoKey);
    
    if (carritoGuardado) {
        try {
            carrito = JSON.parse(carritoGuardado);
            console.log(`🛒 Carrito cargado para vendedor ${vendedorId}:`, carrito);
        } catch (e) {
            console.error('Error al cargar carrito:', e);
            carrito = [];
        }
    } else {
        carrito = [];
        console.log(`🛒 Carrito vacío para vendedor ${vendedorId}`);
    }
    
    actualizarContadorCarrito();
}

// Guardar carrito del vendedor actual en localStorage
function guardarCarritoDelVendedor() {
    if (!vendedorIdActual) {
        console.warn('⚠️ No hay vendedor actual, no se guarda carrito');
        return;
    }
    
    const carritoKey = getCarritoKey(vendedorIdActual);
    localStorage.setItem(carritoKey, JSON.stringify(carrito));
    console.log(`💾 Carrito guardado para vendedor ${vendedorIdActual}:`, carrito);
}

// Limpiar carrito del vendedor actual (después de pedido)
function limpiarCarritoDelVendedor() {
    if (!vendedorIdActual) return;
    
    carrito = [];
    const carritoKey = getCarritoKey(vendedorIdActual);
    localStorage.removeItem(carritoKey);
    actualizarContadorCarrito();
    console.log(`🧹 Carrito limpiado para vendedor ${vendedorIdActual}`);
}

// ===================================================
// FUNCIONES PRINCIPALES
// ===================================================

// Obtener ID del vendedor desde la URL
function obtenerVendedorId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('vendedor');
}

// Cargar datos del vendedor y productos
async function cargarTienda() {
    const vendedorId = obtenerVendedorId();
    
    if (!vendedorId) {
        mostrarToast('No se especificó un negocio', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Guardar ID del vendedor actual
    vendedorIdActual = vendedorId;
    
    // Cargar carrito de ESTE vendedor específico
    cargarCarritoDelVendedor(vendedorIdActual);
    
    try {
        const grid = document.getElementById('productos-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Cargando productos...</p>
                </div>
            `;
        }
        
        const vendedoresRes = await callAPI('getVendedores');
        if (vendedoresRes.success) {
            vendedorActual = vendedoresRes.vendedores.find(v => v.id.toString() === vendedorId);
            if (vendedorActual) {
                const nombreNegocio = document.getElementById('negocio-nombre');
                if (nombreNegocio) {
                    nombreNegocio.textContent = vendedorActual.nombre;
                }
                console.log('✅ Vendedor cargado:', vendedorActual);
            }
        }
        
        const response = await callAPI('getProductos', { vendedorId: vendedorId });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        productos = response.productos || [];
        renderizarProductos();
        
    } catch (error) {
        console.error('Error al cargar tienda:', error);
        const grid = document.getElementById('productos-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="error-mensaje">
                    <p>⚠️ Error al cargar los productos</p>
                    <p style="font-size: 0.8rem; margin-top: 5px;">${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-outline" style="margin-top: 15px;">Reintentar</button>
                </div>
            `;
        }
    }
}

// Renderizar productos en la grilla
function renderizarProductos() {
    const grid = document.getElementById('productos-grid');
    
    if (!grid) return;
    
    if (productos.length === 0) {
        grid.innerHTML = `
            <div class="sin-productos">
                <p>📭 No hay productos disponibles en este negocio</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = productos.map(producto => `
        <div class="producto-card">
            <div class="producto-imagen">
                ${producto.imagen_url ? 
                    `<img src="${producto.imagen_url}" alt="${escapeHTML(producto.nombre)}" loading="lazy">` : 
                    `<div class="placeholder-img">🍕</div>`
                }
            </div>
            <div class="producto-info">
                <h3 class="producto-nombre">${escapeHTML(producto.nombre)}</h3>
                <p class="producto-descripcion">${escapeHTML(producto.descripcion || 'Sin descripción')}</p>
                <p class="producto-precio">${formatearPrecio(parseFloat(producto.precio))}</p>
                <button class="btn-agregar" onclick="agregarAlCarrito(${producto.id})">
                    Agregar al carrito
                </button>
            </div>
        </div>
    `).join('');
}

// Agregar producto al carrito
function agregarAlCarrito(productoId) {
    const producto = productos.find(p => p.id.toString() === productoId.toString());
    
    if (!producto) return;
    
    const itemExistente = carrito.find(item => item.id === producto.id);
    
    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: parseFloat(producto.precio),
            cantidad: 1
        });
    }
    
    // Guardar en localStorage para este vendedor
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    renderizarCarrito();
    mostrarToast(`${producto.nombre} agregado al carrito`, 'success');
}

// Actualizar el contador del carrito en el botón
function actualizarContadorCarrito() {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const cartCountElement = document.getElementById('cart-count');
    
    if (cartCountElement) {
        cartCountElement.textContent = totalItems;
        console.log(`🔄 Contador actualizado: ${totalItems} productos (vendedor ${vendedorIdActual})`);
    }
}

// Renderizar el carrito en el modal
function renderizarCarrito() {
    const container = document.getElementById('carrito-items');
    const totalSpan = document.getElementById('carrito-total');
    
    if (!container) return;
    
    if (carrito.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No hay productos en el carrito</p>';
        if (totalSpan) totalSpan.textContent = formatearPrecio(0);
        return;
    }
    
    let total = 0;
    
    container.innerHTML = carrito.map(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        
        return `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <div class="carrito-item-nombre">${escapeHTML(item.nombre)}</div>
                    <div class="carrito-item-precio">${formatearPrecio(item.precio)} c/u</div>
                </div>
                <div class="carrito-item-cantidad">
                    <button onclick="modificarCantidad(${item.id}, -1)">-</button>
                    <span>${item.cantidad}</span>
                    <button onclick="modificarCantidad(${item.id}, 1)">+</button>
                </div>
                <div class="carrito-item-total">${formatearPrecio(subtotal)}</div>
                <button class="btn-eliminar" onclick="eliminarDelCarrito(${item.id})" title="Eliminar">🗑️</button>
            </div>
        `;
    }).join('');
    
    if (totalSpan) totalSpan.textContent = formatearPrecio(total);
}

// Modificar cantidad de un producto en el carrito
function modificarCantidad(productoId, cambio) {
    const item = carrito.find(i => i.id === productoId);
    
    if (item) {
        item.cantidad += cambio;
        
        if (item.cantidad <= 0) {
            eliminarDelCarrito(productoId);
        } else {
            guardarCarritoDelVendedor();
            actualizarContadorCarrito();
            renderizarCarrito();
        }
    }
}

// Eliminar producto del carrito
function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(item => item.id !== productoId);
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    renderizarCarrito();
    mostrarToast('Producto eliminado', 'info');
}

// Vaciar carrito del vendedor actual
function vaciarCarrito() {
    carrito = [];
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    renderizarCarrito();
    mostrarToast('Carrito vaciado', 'info');
}

// Mostrar formulario de cliente
function mostrarFormularioCliente() {
    if (carrito.length === 0) {
        mostrarToast('El carrito está vacío', 'error');
        return;
    }
    
    const modal = document.getElementById('cliente-modal');
    if (modal) modal.classList.add('active');
}

// Confirmar pedido y enviar a WhatsApp + guardar en Google Sheets
async function confirmarPedido() {
    console.log('🚀 Iniciando confirmación de pedido...');
    
    const nombre = document.getElementById('cliente-nombre')?.value.trim() || '';
    const telefono = document.getElementById('cliente-telefono')?.value.trim() || '';
    const direccion = document.getElementById('cliente-direccion')?.value.trim() || '';
    const metodoPago = document.getElementById('metodo-pago')?.value || '';
    
    if (!nombre) {
        mostrarToast('Completá tu nombre', 'error');
        return;
    }
    if (!telefono) {
        mostrarToast('Completá tu teléfono', 'error');
        return;
    }
    if (!direccion) {
        mostrarToast('Completá tu dirección de entrega', 'error');
        return;
    }
    if (!metodoPago) {
        mostrarToast('Seleccioná un método de pago', 'error');
        return;
    }
    
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (!telefonoLimpio.match(/^\d{10,15}$/)) {
        mostrarToast('Ingresá un teléfono válido (solo números, 10 a 15 dígitos)', 'error');
        return;
    }
    
    if (carrito.length === 0) {
        mostrarToast('El carrito está vacío', 'error');
        return;
    }
    
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    if (!vendedorActual) {
        mostrarToast('Error: No se encontró información del negocio', 'error');
        return;
    }
    
    const telefonoVendedor = vendedorActual.telefono ? vendedorActual.telefono.toString().replace(/\D/g, '') : null;
    
    if (!telefonoVendedor) {
        mostrarToast('El negocio no tiene número de WhatsApp configurado', 'error');
        return;
    }
    
    const mensaje = generarMensajeWhatsApp(nombre, telefonoLimpio, direccion, metodoPago, carrito, total, vendedorActual);
    
    const pedido = {
        cliente_nombre: nombre,
        cliente_telefono: telefonoLimpio,
        direccion: direccion,
        metodo_pago: metodoPago,
        vendedor_id: vendedorActual.id,
        vendedor_nombre: vendedorActual.nombre,
        productos: carrito.map(item => ({
            id: item.id,
            nombre: item.nombre,
            precio: item.precio,
            cantidad: item.cantidad
        })),
        total: total,
        fecha: new Date().toISOString()
    };
    
    // Guardar pedido en histórico (global)
    let pedidosGuardados = JSON.parse(localStorage.getItem('want_pedidos') || '[]');
    const pedidoConId = { ...pedido, id: Date.now(), estado: 'preparando' };
    pedidosGuardados.push(pedidoConId);
    localStorage.setItem('want_pedidos', JSON.stringify(pedidosGuardados));
    
    // Intentar guardar en Google Sheets
    await guardarPedidoEnSheets(pedido);
    
    // Limpiar carrito de ESTE vendedor (NO de otros)
    limpiarCarritoDelVendedor();
    
    // Cerrar modales
    const clienteModal = document.getElementById('cliente-modal');
    const carritoModal = document.getElementById('carrito-modal');
    if (clienteModal) clienteModal.classList.remove('active');
    if (carritoModal) carritoModal.classList.remove('active');
    
    // Limpiar formulario
    const clienteForm = document.getElementById('cliente-form');
    if (clienteForm) clienteForm.reset();
    
    mostrarToast('¡Pedido listo! Redirigiendo a WhatsApp...', 'success');
    
    const urlWhatsApp = `https://wa.me/${telefonoVendedor}?text=${encodeURIComponent(mensaje)}`;
    
    setTimeout(() => {
        window.open(urlWhatsApp, '_blank');
    }, 1000);
}

// Función para guardar en Google Sheets
async function guardarPedidoEnSheets(pedido) {
    try {
        console.log('📤 Intentando guardar en Google Sheets...');
        
        const response = await postAPI('crearPedido', {
            cliente_nombre: pedido.cliente_nombre,
            cliente_telefono: pedido.cliente_telefono,
            direccion: pedido.direccion,
            metodo_pago: pedido.metodo_pago,
            vendedor_id: pedido.vendedor_id,
            productos: pedido.productos,
            total: pedido.total
        });
        
        if (response && response.success) {
            console.log('✅ Pedido guardado en Google Sheets. ID:', response.pedidoId);
            
            let pedidos = JSON.parse(localStorage.getItem('want_pedidos') || '[]');
            const ultimoPedido = pedidos[pedidos.length - 1];
            if (ultimoPedido && ultimoPedido.id === Date.now()) {
                ultimoPedido.sheetsId = response.pedidoId;
                ultimoPedido.sincronizado = true;
                localStorage.setItem('want_pedidos', JSON.stringify(pedidos));
            }
            return { success: true };
        } else {
            console.error('❌ Error al guardar en Sheets:', response?.error || 'Error desconocido');
            return { success: false, error: response?.error };
        }
    } catch (error) {
        console.error('❌ Error en guardarPedidoEnSheets:', error);
        return { success: false, error: error.message };
    }
}

// Generar mensaje para WhatsApp
function generarMensajeWhatsApp(clienteNombre, clienteTelefono, direccion, metodoPago, carrito, total, vendedor) {
    let metodoPagoTexto = '';
    switch(metodoPago) {
        case 'efectivo':
            metodoPagoTexto = 'Efectivo';
            break;
        case 'transferencia':
            metodoPagoTexto = 'Transferencia bancaria';
            break;
        case 'mercado_pago':
            metodoPagoTexto = 'Mercado Pago';
            break;
        default:
            metodoPagoTexto = metodoPago;
    }
    
    let mensaje = `🍕 *NUEVO PEDIDO - WANT* 🍕\n\n`;
    mensaje += `*Cliente:* ${clienteNombre}\n`;
    mensaje += `*Teléfono:* ${clienteTelefono}\n`;
    mensaje += `*Dirección:* ${direccion}\n`;
    mensaje += `*Método de pago:* ${metodoPagoTexto}\n`;
    mensaje += `*Negocio:* ${vendedor.nombre}\n`;
    mensaje += `\n*DETALLE DEL PEDIDO:*\n`;
    
    carrito.forEach(item => {
        mensaje += `• ${item.cantidad}x ${item.nombre} - ${formatearPrecio(item.precio * item.cantidad)}\n`;
    });
    
    mensaje += `\n*TOTAL:* ${formatearPrecio(total)}\n`;
    mensaje += `\n_Estado: Preparando_`;
    
    return mensaje;
}

// ===================================================
// MENÚ MÓVIL Y CONTACTO
// ===================================================

function inicializarMenuTienda() {
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
// EVENT LISTENERS
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Tienda de Want iniciada');
    
    // Cargar tienda (esto también carga el carrito del vendedor)
    cargarTienda();
    
    // Inicializar menú móvil
    inicializarMenuTienda();
    
    // Evento del carrito
    const cartIcon = document.getElementById('cart-icon');
    if (cartIcon) {
        cartIcon.addEventListener('click', (e) => {
            e.preventDefault();
            renderizarCarrito();
            const carritoModal = document.getElementById('carrito-modal');
            if (carritoModal) carritoModal.classList.add('active');
        });
    }
    
    // Cerrar modal carrito
    const cerrarModal = document.getElementById('cerrar-modal');
    if (cerrarModal) {
        cerrarModal.addEventListener('click', () => {
            const carritoModal = document.getElementById('carrito-modal');
            if (carritoModal) carritoModal.classList.remove('active');
        });
    }
    
    // Finalizar pedido desde carrito
    const finalizarPedido = document.getElementById('finalizar-pedido');
    if (finalizarPedido) {
        finalizarPedido.addEventListener('click', () => {
            const carritoModal = document.getElementById('carrito-modal');
            if (carritoModal) carritoModal.classList.remove('active');
            mostrarFormularioCliente();
        });
    }
    
    // Cerrar modal cliente
    const cerrarClienteModal = document.getElementById('cerrar-cliente-modal');
    if (cerrarClienteModal) {
        cerrarClienteModal.addEventListener('click', () => {
            const clienteModal = document.getElementById('cliente-modal');
            if (clienteModal) clienteModal.classList.remove('active');
        });
    }
    
    // Confirmar pedido
    const confirmarPedidoBtn = document.getElementById('confirmar-pedido');
    if (confirmarPedidoBtn) {
        confirmarPedidoBtn.addEventListener('click', confirmarPedido);
    }
    
    // Cerrar modales al hacer clic fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}