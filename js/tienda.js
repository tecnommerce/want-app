// ===================================================
// TIENDA - Lógica de catálogo y carrito (CON ESTADO Y USUARIO)
// ===================================================

// ===================================================
// FUNCIONES PARA URL AMIGABLES
// ===================================================

// Función para crear slug desde nombre
function crearSlug(nombre) {
    return nombre
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

// Función para obtener el identificador del negocio desde la URL
function obtenerIdentificadorNegocio() {
    // Método 1: Leer de la ruta limpia (ej: /pancheria-gourmet)
    let path = window.location.pathname;
    let slug = path.substring(1);
    
    // Si el slug no es vacío y no es una página especial
    if (slug && !slug.includes('.html') && slug !== '' && slug !== 'index') {
        return { tipo: 'slug', valor: slug };
    }
    
    // Método 2: Leer de query string (ej: ?negocio=...)
    const urlParams = new URLSearchParams(window.location.search);
    const negocioQuery = urlParams.get('negocio');
    if (negocioQuery) {
        return { tipo: 'slug', valor: negocioQuery };
    }
    
    // Método 3: Fallback para compatibilidad (ej: ?vendedor=1)
    const vendedorId = urlParams.get('vendedor');
    if (vendedorId) {
        return { tipo: 'id', valor: vendedorId };
    }
    
    return null;
}

let vendedorActual = null;
let productos = [];
let carrito = [];

// ===================================================
// FUNCIONES DE FECHA - ZONA HORARIA ARGENTINA (UTC-3)
// ===================================================

/**
 * FUNCIÓN CRÍTICA: Obtiene la fecha/hora ACTUAL en Argentina (UTC-3)
 * @returns {Date} Objeto Date que representa la hora REAL de Argentina
 */
function getArgentinaDate() {
    const now = new Date();
    const argentinaDate = new Date(now.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires'
    }));
    return argentinaDate;
}

/**
 * Obtiene la fecha actual en Argentina en formato ISO 8601 para base de datos
 * El ISO será UTC correcto (hora Argentina + 3 horas)
 * @returns {string} Fecha en formato ISO: "2026-04-18T05:00:00.000Z"
 */
function getArgentinaDateISO() {
    const argentinaDate = getArgentinaDate();
    // Sumar 3 horas para convertir Argentina (UTC-3) a UTC
    const utcCorrect = new Date(argentinaDate.getTime() + 3 * 60 * 60 * 1000);
    return utcCorrect.toISOString();
}

function obtenerVendedorId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('vendedor');
}

async function cargarTienda() {
        // 🔒 VERIFICAR QUE EL USUARIO ESTÁ LOGUEADO
    let usuarioLogueado = null;
    
    // Verificar en sessionStorage (usuario de Google)
    const sessionGuardada = localStorage.getItem('want_usuario_sesion');
    if (sessionGuardada) {
        try {
            usuarioLogueado = JSON.parse(sessionGuardada);
        } catch(e) {}
    }
    
    // Verificar en window.usuarioActual (global)
    if (!usuarioLogueado && window.usuarioActual) {
        usuarioLogueado = window.usuarioActual;
    }
    
    // Si no hay usuario logueado, redirigir al login
    if (!usuarioLogueado) {
        // Guardar la URL actual para redirigir después del login
        sessionStorage.setItem('redirect_after_login', window.location.pathname);
        mostrarToast('Debes iniciar sesión para ver los productos', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }
    const identificador = obtenerIdentificadorNegocio();
    
    if (!identificador) {
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
        
        let vendedorId = null;
        let vendedorEncontrado = null;
        
        // Si tenemos slug, buscar el vendedor por slug
        if (identificador.tipo === 'slug') {
            const vendedoresRes = await callAPI('getAllVendedores');
            if (vendedoresRes.success) {
                vendedorEncontrado = vendedoresRes.vendedores.find(v => 
                    crearSlug(v.nombre) === identificador.valor
                );
                if (vendedorEncontrado) {
                    vendedorId = vendedorEncontrado.id;
                    vendedorActual = vendedorEncontrado;
                } else {
                    mostrarToast('Negocio no encontrado', 'error');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                    return;
                }
            }
        } else if (identificador.tipo === 'id') {
            vendedorId = identificador.valor;
            // Cargar el vendedor por ID
            const vendedoresRes = await callAPI('getAllVendedores');
            if (vendedoresRes.success) {
                vendedorEncontrado = vendedoresRes.vendedores.find(v => 
                    v.id.toString() === vendedorId.toString()
                );
                if (vendedorEncontrado) {
                    vendedorActual = vendedorEncontrado;
                }
            }
        }
        
        if (!vendedorActual) {
            mostrarToast('Este negocio no está disponible', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        // Redirigir a URL limpia si es necesario
        const slugActual = window.location.pathname.substring(1);
        const slugCorrecto = crearSlug(vendedorActual.nombre);
        
        if (slugCorrecto && slugActual !== slugCorrecto && !window.location.search.includes('vendedor=')) {
            const nuevaUrl = `${window.location.origin}/${slugCorrecto}`;
            window.history.replaceState({}, '', nuevaUrl);
        }
        
        // Mostrar información del vendedor en la página
        const perfilSection = document.getElementById('vendedor-perfil-section');
        if (perfilSection) {
            perfilSection.style.display = 'block';
        }
        
        const nombreElement = document.getElementById('vendedor-nombre-tienda');
        if (nombreElement) {
            nombreElement.textContent = vendedorActual.nombre;
        }
        
        const logoGrande = document.getElementById('vendedor-logo-grande-img');
        const logoGrandeContainer = document.getElementById('vendedor-logo-grande');
        if (logoGrande && vendedorActual.logo_url) {
            logoGrande.src = vendedorActual.logo_url;
            if (logoGrandeContainer) logoGrandeContainer.style.display = 'flex';
        }
        
        const descripcionElement = document.getElementById('vendedor-descripcion-tienda');
        if (descripcionElement && vendedorActual.descripcion) {
            descripcionElement.textContent = vendedorActual.descripcion;
        }
        
        const rubrosContainer = document.getElementById('vendedor-rubros-tienda');
        if (rubrosContainer && vendedorActual.rubros && vendedorActual.rubros.length > 0) {
            rubrosContainer.innerHTML = vendedorActual.rubros.map(r => `<span class="rubro-tag">${escapeHTML(r)}</span>`).join('');
        }
        
        const horarioElement = document.getElementById('vendedor-horario-tienda');
        if (horarioElement && vendedorActual.horario) {
            horarioElement.innerHTML = `<i class="fas fa-clock"></i> <span>${escapeHTML(vendedorActual.horario)}</span>`;
        }
        
        // Cargar productos
        const response = await callAPI('getProductos', { vendedorId: vendedorActual.id });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
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

function renderizarProductos() {
    const grid = document.getElementById('productos-grid');
    
    if (!grid) return;
    
    const estadoAbierto = vendedorActual?.estado_abierto === true || vendedorActual?.estado_abierto === 'true' || vendedorActual?.estado_abierto === 1;
    
    if (!estadoAbierto) {
        grid.innerHTML = `
            <div class="negocio-cerrado-mensaje">
                <i class="fas fa-store-slash" style="font-size: 3rem; color: #ef4444; margin-bottom: 15px;"></i>
                <h3>Este comercio se encuentra cerrado en este momento</h3>
                <p>Pronto volverá a estar disponible.</p>
            </div>
        `;
        return;
    }
    
    if (productos.length === 0) {
        grid.innerHTML = `
            <div class="sin-productos">
                <p>📭 No hay productos disponibles en este negocio</p>
            </div>
        `;
        return;
    }
    
    const isMobile = window.innerWidth <= 768;
    
    grid.innerHTML = productos.map(producto => {
        const descripcion = producto.descripcion || 'Sin descripción';
        const descripcionCorta = isMobile && descripcion.length > 60 
            ? descripcion.substring(0, 60) + '...' 
            : descripcion;
        
        return `
            <div class="producto-card">
                <div class="producto-imagen">
                    ${producto.imagen_url && producto.imagen_url !== '' ? 
                        `<img src="${producto.imagen_url}" alt="${escapeHTML(producto.nombre)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50\' y=\'55\' font-size=\'40\' text-anchor=\'middle\' fill=\'%23ccc\'%3E🍕%3C/text%3E%3C/svg%3E'">` : 
                        `<div class="placeholder-img">🍕</div>`
                    }
                </div>
                <div class="producto-info">
                    <h3 class="producto-nombre">${escapeHTML(producto.nombre)}</h3>
                    <p class="producto-descripcion">${escapeHTML(descripcionCorta)}</p>
                    <p class="producto-precio">${formatearPrecio(parseFloat(producto.precio))}</p>
                    <button class="btn-agregar" onclick="agregarAlCarrito(${producto.id})">
                        Agregar al carrito
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    if (!window.productosResizedListener) {
        window.addEventListener('resize', () => {
            if (productos.length > 0) {
                renderizarProductos();
            }
        });
        window.productosResizedListener = true;
    }
}

function agregarAlCarrito(productoId) {
    const estadoAbierto = vendedorActual?.estado_abierto === true || vendedorActual?.estado_abierto === 'true' || vendedorActual?.estado_abierto === 1;
    
    if (!estadoAbierto) {
        mostrarToast('Este comercio se encuentra cerrado en este momento. Pronto volverá a estar disponible.', 'error');
        return;
    }
    
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
            cantidad: 1,
            imagen_url: producto.imagen_url || null
        });
    }
    
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    actualizarCarritoUI();
    renderizarCarrito();
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
    actualizarCarritoUI();
}

function actualizarContadorCarrito() {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = totalItems;
    }
    
    const cartCountFloating = document.getElementById('cart-count-floating');
    if (cartCountFloating) {
        cartCountFloating.textContent = totalItems;
    }
}

function actualizarCarritoUI() {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const totalPrecio = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    const cartFloatingBtn = document.getElementById('cart-floating-btn');
    const cartTotalFloating = document.getElementById('cart-total-floating');
    
    if (carrito.length > 0) {
        if (cartFloatingBtn) {
            cartFloatingBtn.style.display = 'flex';
        }
        if (cartTotalFloating) {
            cartTotalFloating.textContent = formatearPrecio(totalPrecio);
        }
    } else {
        if (cartFloatingBtn) {
            cartFloatingBtn.style.display = 'none';
        }
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
        
        const imagenHtml = item.imagen_url ? 
            `<img src="${item.imagen_url}" alt="${escapeHTML(item.nombre)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50\' y=\'70\' font-size=\'50\' text-anchor=\'middle\' fill=\'%23ccc\'%3E🍕%3C/text%3E%3C/svg%3E'">` :
            `<div class="placeholder-img">🍕</div>`;
        
        return `
            <div class="carrito-item">
                <div class="carrito-item-imagen">
                    ${imagenHtml}
                </div>
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
                <button class="btn-eliminar" onclick="eliminarDelCarrito(${item.id})" title="Eliminar">
    <i class="fas fa-trash-alt"></i>
</button>
            </div>
        `;
    }).join('');
    
    if (totalSpan) totalSpan.textContent = formatearPrecio(total);
    actualizarCarritoUI();
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
            actualizarCarritoUI();
            renderizarCarrito();
        }
    }
}

function eliminarDelCarrito(productoId) {
    carrito = carrito.filter(item => item.id !== productoId);
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    actualizarCarritoUI();
    renderizarCarrito();
    mostrarToast('Producto eliminado', 'info');
}

function mostrarFormularioCliente() {
    if (carrito.length === 0) {
        mostrarToast('El carrito está vacío', 'error');
        return;
    }
    
    // Cargar automáticamente los datos del usuario si existe
    cargarDatosUsuarioAuto();
    
    document.getElementById('cliente-modal').classList.add('active');
}

function cargarDatosUsuarioAuto() {
    console.log('📝 Cargando datos del usuario automáticamente...');
    
    let usuario = window.usuarioActual;
    
    if (!usuario) {
        const sessionGuardada = localStorage.getItem('want_usuario_sesion');
        if (sessionGuardada) {
            try {
                const userData = JSON.parse(sessionGuardada);
                usuario = userData;
                console.log('📦 Usuario desde localStorage:', usuario.email);
            } catch (e) {}
        }
    }
    
    if (!usuario) {
        console.log('⚠️ No hay sesión activa');
        return;
    }
    
    const nombreInput = document.getElementById('cliente-nombre');
    const telefonoInput = document.getElementById('cliente-telefono');
    const direccionInput = document.getElementById('cliente-direccion');
    
    if (nombreInput && usuario.nombre) {
        nombreInput.value = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim();
    }
    if (telefonoInput && usuario.telefono) {
        telefonoInput.value = usuario.telefono;
    }
    if (direccionInput && usuario.direccion) {
        direccionInput.value = `${usuario.direccion || ''}, ${usuario.ciudad || ''}, ${usuario.provincia || ''}`;
    }
}

function cargarDatosUsuarioEnFormulario() {
    cargarDatosUsuarioAuto();
}

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
    
    let usuarioId = null;
    const usuarioGuardado = localStorage.getItem('want_usuario_sesion');
    if (usuarioGuardado) {
        try {
            const userData = JSON.parse(usuarioGuardado);
            usuarioId = userData.id;
        } catch (e) {}
    }
    
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
            cantidad: item.cantidad,
            imagen_url: item.imagen_url
        })),
        total: total,
        fecha: getArgentinaDateISO(),
        usuario_id: usuarioId
    };
    
    let pedidosGuardados = JSON.parse(localStorage.getItem('want_pedidos') || '[]');
    const pedidoConId = { ...pedido, id: Date.now(), estado: 'preparando' };
    pedidosGuardados.push(pedidoConId);
    localStorage.setItem('want_pedidos', JSON.stringify(pedidosGuardados));
    
    const resultado = await guardarPedidoEnSupabase(pedido);
    
    carrito = [];
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    actualizarCarritoUI();
    document.getElementById('cliente-form').reset();
    document.getElementById('pedido-detalles').value = '';
    
    document.getElementById('cliente-modal').classList.remove('active');
    document.getElementById('carrito-modal').classList.remove('active');
    
    if (resultado && resultado.success) {
        mostrarToast('¡Pedido enviado correctamente!', 'success');
        if (usuarioId && typeof mostrarMisPedidos === 'function') {
            setTimeout(() => {
                mostrarMisPedidos();
            }, 1500);
        }
    } else {
        mostrarToast('¡Pedido guardado localmente! Se sincronizará automáticamente.', 'success');
    }
}

async function guardarPedidoEnSupabase(pedido) {
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
            total: pedido.total,
            usuario_id: pedido.usuario_id || null,
            vendedor_nombre: pedido.vendedor_nombre || null
        });
        
        if (response && response.success) {
            console.log('✅ Pedido guardado en Supabase. ID:', response.pedidoId);
            return { success: true, pedidoId: response.pedidoId };
        } else {
            console.error('❌ Error al guardar en Supabase:', response?.error);
            return { success: false, error: response?.error };
        }
    } catch (error) {
        console.error('❌ Error en guardarPedidoEnSupabase:', error);
        return { success: false, error: error.message };
    }
}

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
    productosContainer.innerHTML = carrito.map(item => {
        const imagenHtml = item.imagen_url ? 
            `<img src="${item.imagen_url}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'30\' height=\'30\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50\' y=\'70\' font-size=\'50\' text-anchor=\'middle\' fill=\'%23ccc\'%3E🍕%3C/text%3E%3C/svg%3E'">` :
            `<div class="placeholder-img" style="font-size: 1rem;">🍕</div>`;
        
        return `
            <div class="producto-item">
                <div class="producto-item-imagen">
                    ${imagenHtml}
                </div>
                <div class="producto-item-info">
                    <div class="producto-item-nombre">${item.cantidad}x ${escapeHTML(item.nombre)}</div>
                </div>
                <div class="producto-item-precio">${formatearPrecio(item.precio * item.cantidad)}</div>
            </div>
        `;
    }).join('');
    
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
    
    let usuarioId = null;
    const usuarioGuardado = localStorage.getItem('want_usuario_sesion');
    if (usuarioGuardado) {
        try {
            const userData = JSON.parse(usuarioGuardado);
            usuarioId = userData.id;
        } catch (e) {}
    }
    
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
            cantidad: item.cantidad,
            imagen_url: item.imagen_url
        })),
        total: total,
        fecha: getArgentinaDateISO(),
        usuario_id: usuarioId
    };
    
    let pedidosGuardados = JSON.parse(localStorage.getItem('want_pedidos') || '[]');
    const pedidoConId = { ...pedido, id: Date.now(), estado: 'preparando' };
    pedidosGuardados.push(pedidoConId);
    localStorage.setItem('want_pedidos', JSON.stringify(pedidosGuardados));
    
    const resultado = await guardarPedidoEnSupabase(pedido);
    
    carrito = [];
    guardarCarritoDelVendedor();
    actualizarContadorCarrito();
    actualizarCarritoUI();
    datosClienteTemp = null;
    
    document.getElementById('confirmacion-modal').classList.remove('active');
    
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = originalText;
    
    if (resultado && resultado.success) {
        mostrarMensajeExito(usuarioId);
    } else {
        mostrarToast('Error al enviar el pedido. Intente nuevamente.', 'error');
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = originalText;
    }
}

function mostrarMensajeExito(usuarioId) {
    const mensaje = document.createElement('div');
    mensaje.className = 'toast-success';
    mensaje.innerHTML = '<i class="fas fa-check-circle"></i> ¡Tu pedido fue enviado correctamente!';
    document.body.appendChild(mensaje);
    
    document.getElementById('cliente-form').reset();
    document.getElementById('pedido-detalles').value = '';
    
    setTimeout(() => {
        mensaje.remove();
        window.location.href = 'index.html#mis-pedidos';
    }, 2000);
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

function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio);
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.textContent = mensaje;
    toast.style.position = 'fixed';
    toast.style.bottom = '80px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : '#FF5A00';
    toast.style.color = 'white';
    toast.style.padding = '10px 16px';
    toast.style.borderRadius = '50px';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '0.75rem';
    toast.style.fontWeight = '500';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    cargarTienda();
    cargarCarritoDelVendedor();
    
    const cartIconDesktop = document.getElementById('cart-icon-desktop');
    if (cartIconDesktop) {
        cartIconDesktop.addEventListener('click', (e) => {
            e.preventDefault();
            renderizarCarrito();
            document.getElementById('carrito-modal').classList.add('active');
        });
    }
    
    const cartFloatingBtn = document.getElementById('cart-floating-btn');
    if (cartFloatingBtn) {
        cartFloatingBtn.addEventListener('click', () => {
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

window.agregarAlCarrito = agregarAlCarrito;
window.modificarCantidad = modificarCantidad;
window.eliminarDelCarrito = eliminarDelCarrito;
window.confirmarPedido = confirmarPedido;
window.cargarDatosUsuarioEnFormulario = cargarDatosUsuarioEnFormulario;