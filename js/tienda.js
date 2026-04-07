// ===================================================
// TIENDA - Lógica de catálogo y carrito
// ===================================================

// Variables globales
let vendedorActual = null;
let productos = [];
let carrito = [];

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
        
        // Obtener vendedores y filtrar por ID (CORREGIDO: activo === true)
        const vendedoresRes = await callAPI('getVendedores');
        if (vendedoresRes.success) {
            vendedorActual = vendedoresRes.vendedores.find(v => 
                v.id.toString() === vendedorId && v.activo === true
            );
            
            if (vendedorActual) {
                const nombreNegocio = document.getElementById('negocio-nombre');
                if (nombreNegocio) {
                    nombreNegocio.textContent = vendedorActual.nombre;
                }
                
                // Mostrar logo del vendedor en el header
                const logoHeader = document.getElementById('vendedor-logo-header');
                const logoImg = document.getElementById('vendedor-logo-img');
                if (logoHeader && logoImg && vendedorActual.logo_url) {
                    logoImg.src = vendedorActual.logo_url;
                    logoHeader.style.display = 'flex';
                }
                
                console.log('✅ Vendedor cargado:', vendedorActual);
            } else {
                mostrarToast('Este negocio no está disponible', 'error');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
                return;
            }
        }
        
        // Obtener productos del vendedor
        const response = await callAPI('getProductos', { vendedorId: vendedorId });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        // CORREGIDO: Filtrar productos disponibles (disponible === true)
        productos = (response.productos || []).filter(p => p.disponible === true);
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
                ${producto.imagen_url && producto.imagen_url !== '' ? 
                    `<img src="${producto.imagen_url}" alt="${escapeHTML(producto.nombre)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50\' y=\'55\' font-size=\'40\' text-anchor=\'middle\' fill=\'%23ccc\'%3E🍕%3C/text%3E%3C/svg%3E'">` : 
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
    
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    renderizarCarrito();
    mostrarToast(`${producto.nombre} agregado al carrito`, 'success');
}

function guardarCarritoDelVendedor() {
    if (!vendedorActual) return;
    const carritoKey = `want_carrito_vendedor_${vendedorActual.id}`;
    localStorage.setItem(carritoKey, JSON.stringify(carrito));
}

function cargarCarritoDelVendedor() {
    if (!vendedorActual) return;
    const carritoKey = `want_carrito_vendedor_${vendedorActual.id}`;
    const carritoGuardado = localStorage.getItem(carritoKey);
    if (carritoGuardado) {
        try {
            carrito = JSON.parse(carritoGuardado);
        } catch(e) {
            carrito = [];
        }
    } else {
        carrito = [];
    }
    actualizarContadorCarrito();
}

function actualizarContadorCarrito() {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = totalItems;
    }
}

function renderizarCarrito() {
    const container = document.getElementById('carrito-items');
    const totalSpan = document.getElementById('carrito-total');
    const finalizarBtn = document.getElementById('finalizar-pedido');
    
    if (!container) return;
    
    if (carrito.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No hay productos en el carrito</p>';
        if (totalSpan) totalSpan.textContent = formatearPrecio(0);
        if (finalizarBtn) finalizarBtn.disabled = true;
        return;
    }
    
    if (finalizarBtn) finalizarBtn.disabled = false;
    
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

function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(item => item.id !== productoId);
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    renderizarCarrito();
    mostrarToast('Producto eliminado', 'info');
}

function mostrarFormularioCliente() {
    if (carrito.length === 0) {
        mostrarToast('El carrito está vacío', 'error');
        return;
    }
    document.getElementById('cliente-modal').classList.add('active');
}

// Confirmar pedido
async function confirmarPedido() {
    const nombre = document.getElementById('cliente-nombre')?.value.trim() || '';
    const telefono = document.getElementById('cliente-telefono')?.value.trim() || '';
    const direccion = document.getElementById('cliente-direccion')?.value.trim() || '';
    const metodoPago = document.getElementById('metodo-pago')?.value || '';
    const detalles = document.getElementById('pedido-detalles')?.value.trim() || '';
    
    if (!nombre || !telefono || !direccion || !metodoPago) {
        mostrarToast('Completá todos los campos', 'error');
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
    
    const pedido = {
        cliente_nombre: nombre,
        cliente_telefono: telefonoLimpio,
        direccion: direccion,
        metodo_pago: metodoPago,
        detalles: detalles,
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
    
    // Guardar en localStorage
    let pedidosGuardados = JSON.parse(localStorage.getItem('want_pedidos') || '[]');
    const pedidoConId = { ...pedido, id: Date.now(), estado: 'preparando' };
    pedidosGuardados.push(pedidoConId);
    localStorage.setItem('want_pedidos', JSON.stringify(pedidosGuardados));
    
    // Guardar en Google Sheets / Supabase
    const resultadoSheets = await guardarPedidoEnSheets(pedido);
    
    // Limpiar carrito y formulario
    carrito = [];
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    document.getElementById('cliente-form').reset();
    document.getElementById('pedido-detalles').value = '';
    
    // Cerrar modales
    document.getElementById('cliente-modal').classList.remove('active');
    document.getElementById('carrito-modal').classList.remove('active');
    
    if (resultadoSheets && resultadoSheets.success) {
        mostrarToast('¡Pedido enviado correctamente! El vendedor lo recibirá en su panel.', 'success');
    } else {
        mostrarToast('¡Pedido guardado localmente! Se sincronizará automáticamente.', 'success');
    }
}

async function guardarPedidoEnSheets(pedido) {
    try {
        console.log('📤 Intentando guardar en Supabase...');
        
        const response = await postAPI('crearPedido', {
            cliente_nombre: pedido.cliente_nombre,
            cliente_telefono: pedido.cliente_telefono,
            direccion: pedido.direccion,
            metodo_pago: pedido.metodo_pago,
            detalles: pedido.detalles || '',
            vendedor_id: pedido.vendedor_id,
            productos: pedido.productos,
            total: pedido.total
        });
        
        if (response && response.success) {
            console.log('✅ Pedido guardado en Supabase. ID:', response.pedidoId);
            return { success: true };
        } else {
            console.error('❌ Error al guardar en Supabase:', response?.error || 'Error desconocido');
            return { success: false, error: response?.error };
        }
    } catch (error) {
        console.error('❌ Error en guardarPedidoEnSheets:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// TICKET DE CONFIRMACIÓN
// ===================================================

let datosClienteTemp = null;

function mostrarTicketConfirmacion() {
    const nombre = document.getElementById('cliente-nombre').value.trim();
    const telefono = document.getElementById('cliente-telefono').value.trim();
    const direccion = document.getElementById('cliente-direccion').value.trim();
    const metodoPago = document.getElementById('metodo-pago').value;
    const detalles = document.getElementById('pedido-detalles').value.trim();
    const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    datosClienteTemp = { nombre, telefono, direccion, metodoPago, detalles, total };
    
    document.getElementById('confirm-nombre').textContent = nombre;
    document.getElementById('confirm-telefono').textContent = telefono;
    document.getElementById('confirm-direccion').textContent = direccion;
    document.getElementById('confirm-pago').textContent = metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia bancaria';
    document.getElementById('confirm-total').textContent = formatearPrecio(total);
    
    const productosContainer = document.getElementById('confirm-productos');
    productosContainer.innerHTML = carrito.map(item => `
        <div class="producto-item">
            <span>${item.cantidad}x ${escapeHTML(item.nombre)}</span>
            <span>${formatearPrecio(item.precio * item.cantidad)}</span>
        </div>
    `).join('');
    
    const detallesSection = document.getElementById('confirm-detalles-section');
    const detallesSpan = document.getElementById('confirm-detalles');
    if (detalles) {
        detallesSpan.textContent = detalles;
        detallesSection.style.display = 'block';
    } else {
        detallesSection.style.display = 'none';
    }
    
    document.getElementById('cliente-modal').classList.remove('active');
    document.getElementById('confirmacion-modal').classList.add('active');
}

async function enviarPedido() {
    if (!datosClienteTemp) return;
    
    const btnEnviar = document.getElementById('btn-enviar-pedido');
    const originalText = btnEnviar.innerHTML;
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    const total = datosClienteTemp.total;
    const telefonoLimpio = datosClienteTemp.telefono.replace(/\D/g, '');
    
    const pedido = {
        cliente_nombre: datosClienteTemp.nombre,
        cliente_telefono: telefonoLimpio,
        direccion: datosClienteTemp.direccion,
        metodo_pago: datosClienteTemp.metodoPago,
        detalles: datosClienteTemp.detalles || '',
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
    
    let pedidosGuardados = JSON.parse(localStorage.getItem('want_pedidos') || '[]');
    const pedidoConId = { ...pedido, id: Date.now(), estado: 'preparando' };
    pedidosGuardados.push(pedidoConId);
    localStorage.setItem('want_pedidos', JSON.stringify(pedidosGuardados));
    
    await guardarPedidoEnSheets(pedido);
    
    carrito = [];
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    datosClienteTemp = null;
    
    document.getElementById('confirmacion-modal').classList.remove('active');
    
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = originalText;
    
    mostrarMensajeExito();
}

function mostrarMensajeExito() {
    const mensaje = document.createElement('div');
    mensaje.className = 'toast-success';
    mensaje.innerHTML = '<i class="fas fa-check-circle"></i> ¡Tu pedido fue enviado correctamente! El vendedor te confirmará tu pedido por WhatsApp.';
    document.body.appendChild(mensaje);
    
    document.getElementById('cliente-form').reset();
    document.getElementById('pedido-detalles').value = '';
    
    setTimeout(() => {
        mensaje.remove();
        window.location.href = 'index.html';
    }, 3000);
}

// ===================================================
// EVENT LISTENERS
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    cargarTienda();
    cargarCarritoDelVendedor();
    
    const cartIcon = document.getElementById('cart-icon');
    if (cartIcon) {
        cartIcon.addEventListener('click', (e) => {
            e.preventDefault();
            renderizarCarrito();
            document.getElementById('carrito-modal').classList.add('active');
        });
    }
    
    const cerrarModal = document.getElementById('cerrar-modal');
    if (cerrarModal) {
        cerrarModal.addEventListener('click', () => {
            document.getElementById('carrito-modal').classList.remove('active');
        });
    }
    
    const finalizarPedido = document.getElementById('finalizar-pedido');
    if (finalizarPedido) {
        finalizarPedido.addEventListener('click', () => {
            document.getElementById('carrito-modal').classList.remove('active');
            mostrarFormularioCliente();
        });
    }
    
    const cerrarClienteModal = document.getElementById('cerrar-cliente-modal');
    if (cerrarClienteModal) {
        cerrarClienteModal.addEventListener('click', () => {
            document.getElementById('cliente-modal').classList.remove('active');
        });
    }
    
    const btnContinuar = document.getElementById('btn-continuar-pago');
    if (btnContinuar) {
        btnContinuar.addEventListener('click', () => {
            const nombre = document.getElementById('cliente-nombre').value.trim();
            const telefono = document.getElementById('cliente-telefono').value.trim();
            const direccion = document.getElementById('cliente-direccion').value.trim();
            const metodoPago = document.getElementById('metodo-pago').value;
            
            if (!nombre || !telefono || !direccion || !metodoPago) {
                mostrarToast('Completá todos los campos obligatorios', 'error');
                return;
            }
            
            const telefonoLimpio = telefono.replace(/\D/g, '');
            if (!telefonoLimpio.match(/^\d{10,15}$/)) {
                mostrarToast('Ingresá un teléfono válido (solo números, 10 a 15 dígitos)', 'error');
                return;
            }
            
            mostrarTicketConfirmacion();
        });
    }
    
    const cerrarConfirmacionModal = document.getElementById('cerrar-confirmacion-modal');
    if (cerrarConfirmacionModal) {
        cerrarConfirmacionModal.addEventListener('click', () => {
            document.getElementById('confirmacion-modal').classList.remove('active');
        });
    }
    
    const btnEditar = document.getElementById('btn-editar-pedido');
    if (btnEditar) {
        btnEditar.addEventListener('click', () => {
            document.getElementById('confirmacion-modal').classList.remove('active');
            document.getElementById('cliente-modal').classList.add('active');
        });
    }
    
    const btnEnviar = document.getElementById('btn-enviar-pedido');
    if (btnEnviar) {
        btnEnviar.addEventListener('click', enviarPedido);
    }
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});

// ===================================================
// FUNCIONES UTILITARIAS
// ===================================================

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio);
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