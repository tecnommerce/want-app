// ===================================================
// ADMIN - Panel de vendedor con gestión de productos
// ===================================================

// Configuración de Cloudinary
const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r';
const CLOUDINARY_UPLOAD_PRESET = 'want_productos';

// Variables globales
let vendedorActual = null;
let pedidos = [];
let productos = [];
let filtroActual = 'preparando';

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
    
    document.getElementById('ventas-hoy').textContent = formatearPrecio(ventasHoy);
    document.getElementById('ventas-semana').textContent = formatearPrecio(ventasSemana);
    document.getElementById('ventas-mes').textContent = formatearPrecio(ventasMes);
    document.getElementById('pedidos-entregados').textContent = pedidosEntregados;
    document.getElementById('pedidos-pendientes').textContent = pedidosPendientes;
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
    
    document.getElementById('count-preparando').textContent = contarPorEstado.preparando;
    document.getElementById('count-preparacion').textContent = contarPorEstado['en preparacion'];
    document.getElementById('count-camino').textContent = contarPorEstado['en camino'];
    document.getElementById('count-entregado').textContent = contarPorEstado.entregado;
    document.getElementById('badge-pedidos').textContent = contarPorEstado.preparando;
}

// ===================================================
// RENDERIZAR PEDIDOS
// ===================================================

function renderizarPedidos() {
    const container = document.getElementById('pedidos-container');
    
    let pedidosFiltrados = pedidos.filter(p => p.estado === filtroActual);
    pedidosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>No hay pedidos en esta categoría</p></div>`;
        return;
    }
    
    container.innerHTML = pedidosFiltrados.map(p => {
        const fecha = new Date(p.fecha);
        const metodoPago = p.metodo_pago || 'efectivo';
        
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
                        ${p.estado !== 'preparando' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'preparando', this)">Nuevo</button>` : ''}
                        ${p.estado !== 'en preparacion' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'en preparacion', this)">Preparar</button>` : ''}
                        ${p.estado !== 'en camino' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'en camino', this)">En camino</button>` : ''}
                        ${p.estado !== 'entregado' ? `<button class="btn-estado" onclick="actualizarEstado(${p.id}, 'entregado', this)">Entregar</button>` : ''}
                    </div>
                    <div class="botones-acciones">
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
// NOTIFICAR CLIENTE
// ===================================================

async function notificarCliente(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    let tiempoEntrega = '';
    let mensaje = '';
    
    if (pedido.estado === 'preparando') {
        tiempoEntrega = prompt('Ingrese el tiempo estimado de entrega (ej: 45 minutos, 1 hora):', '45 minutos');
        if (!tiempoEntrega) {
            mostrarToast('Debe ingresar un tiempo de entrega', 'error');
            return;
        }
        
        const productosTexto = pedido.productos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
        const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
        
        mensaje = `Hola ${pedido.cliente_nombre}, como estas? Recibimos tu pedido: ${productosTexto}. Ahora lo estamos preparando y te lo enviamos en aproximadamente ${tiempoEntrega}. Numero de orden: #${pedido.id}. Total a pagar: ${formatearPrecio(pedido.total)}.`;
        
        if (metodoPagoTexto === 'transferencia') {
            mensaje += ` Te pasamos nuestro alias y CBU para que nos realices el pago.`;
        } else {
            mensaje += ` Nos indicaste que pagarias con efectivo. Debes pagarle a nuestro delivery cuando te entregue el pedido. Muchas gracias por tu compra. Te avisamos cuando el pedido este en camino.`;
        }
        
    } else if (pedido.estado === 'en camino') {
        mensaje = `Hola ${pedido.cliente_nombre}, tu pedido esta en camino. Quedate pendiente al delivery. Muchas gracias por tu compra.`;
    } else {
        mostrarToast('No se puede notificar en este estado', 'error');
        return;
    }
    
    if (boton) {
        const originalText = boton.innerHTML;
        boton.disabled = true;
        boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        
        const url = `https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
        setTimeout(() => {
            window.open(url, '_blank');
            boton.innerHTML = originalText;
            boton.disabled = false;
        }, 500);
    }
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
// GESTIÓN DE PRODUCTOS
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
        document.getElementById('badge-productos').textContent = productos.length;
    } catch (error) {
        container.innerHTML = `<div class="error-mensaje"><p>Error al cargar productos</p></div>`;
    }
}

function renderizarProductosAdmin() {
    const container = document.getElementById('productos-admin-grid');
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
    const modal = document.getElementById('modal-producto');
    const title = document.getElementById('modal-producto-title');
    const idField = document.getElementById('producto-id');
    const nombreField = document.getElementById('producto-nombre');
    const descripcionField = document.getElementById('producto-descripcion');
    const precioField = document.getElementById('producto-precio');
    const disponibleField = document.getElementById('producto-disponible');
    const previewDiv = document.getElementById('producto-imagen-preview');
    const imagenInput = document.getElementById('producto-imagen');
    
    if (productoId) {
        const producto = productos.find(p => p.id.toString() === productoId.toString());
        if (producto) {
            title.textContent = 'Editar producto';
            idField.value = producto.id;
            nombreField.value = producto.nombre || '';
            descripcionField.value = producto.descripcion || '';
            precioField.value = producto.precio || '';
            disponibleField.value = producto.disponible || 'SI';
            if (producto.imagen_url) {
                previewDiv.innerHTML = `<img src="${producto.imagen_url}" style="max-width: 100%; max-height: 150px;">`;
            } else {
                previewDiv.innerHTML = '';
            }
        }
    } else {
        title.textContent = 'Nuevo producto';
        idField.value = '';
        nombreField.value = '';
        descripcionField.value = '';
        precioField.value = '';
        disponibleField.value = 'SI';
        previewDiv.innerHTML = '';
        imagenInput.value = '';
    }
    
    modal.classList.add('active');
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').classList.remove('active');
    document.getElementById('producto-imagen').value = '';
    document.getElementById('producto-imagen-preview').innerHTML = '';
}

async function guardarProducto() {
    const productoId = document.getElementById('producto-id').value;
    const nombre = document.getElementById('producto-nombre').value.trim();
    const descripcion = document.getElementById('producto-descripcion').value.trim();
    const precio = parseFloat(document.getElementById('producto-precio').value);
    const disponible = document.getElementById('producto-disponible').value;
    const imagenFile = document.getElementById('producto-imagen').files[0];
    
    if (!nombre || !precio) {
        mostrarToast('Completá nombre y precio', 'error');
        return;
    }
    
    const btnGuardar = document.getElementById('btn-guardar-producto');
    const originalText = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    try {
        let imagenUrl = null;
        
        if (imagenFile) {
            mostrarToast('Subiendo imagen...', 'info');
            imagenUrl = await subirImagenACloudinary(imagenFile);
            if (!imagenUrl) {
                mostrarToast('Error al subir imagen', 'error');
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = originalText;
                return;
            }
        } else if (productoId) {
            const productoExistente = productos.find(p => p.id.toString() === productoId.toString());
            if (productoExistente && productoExistente.imagen_url) {
                imagenUrl = productoExistente.imagen_url;
            }
        }
        
        const productoData = {
            nombre: nombre,
            descripcion: descripcion,
            precio: precio,
            disponible: disponible,
            imagen_url: imagenUrl,
            vendedor_id: vendedorActual.id
        };
        
        let response;
        if (productoId) {
            response = await postAPI('actualizarProducto', { ...productoData, id: parseInt(productoId) });
        } else {
            response = await postAPI('crearProducto', productoData);
        }
        
        if (response && response.success) {
            mostrarToast(`Producto ${productoId ? 'actualizado' : 'creado'} correctamente`, 'success');
            cerrarModalProducto();
            await cargarProductos(true);
        } else {
            throw new Error(response?.error || 'Error al guardar');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al guardar producto', 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = originalText;
    }
}

async function eliminarProducto(productoId) {
    if (!confirm('¿Eliminar este producto?')) return;
    
    try {
        const response = await postAPI('eliminarProducto', { productoId });
        if (response && response.success) {
            mostrarToast('Producto eliminado', 'success');
            await cargarProductos(true);
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast('Error al eliminar', 'error');
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
    
    const btnUploadLogo = document.getElementById('btn-upload-logo');
    const logoInput = document.getElementById('perfil-logo');
    if (btnUploadLogo && logoInput) {
        btnUploadLogo.addEventListener('click', () => logoInput.click());
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
            document.getElementById('panel-nombre').textContent = nombre;
            document.getElementById('perfil-nombre-display').textContent = nombre;
            document.getElementById('perfil-new-password').value = '';
        } else {
            throw new Error(response?.error || 'Error');
        }
    } catch (error) {
        mostrarToast('Error al actualizar perfil', 'error');
    }
}

// ===================================================
// INICIALIZACIÓN
// ===================================================

async function iniciarPanel(vendedor) {
    document.getElementById('admin-auth').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('panel-nombre').textContent = vendedor.nombre;
    document.getElementById('panel-email').textContent = vendedor.email;
    document.getElementById('perfil-nombre-display').textContent = vendedor.nombre;
    document.getElementById('perfil-email-display').textContent = vendedor.email;
    
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
    
    document.getElementById('btn-guardar-producto')?.addEventListener('click', guardarProducto);
    
    inicializarTabs();
    inicializarFiltros();
    inicializarMenuAdmin();
}

function inicializarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
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
            mobileMenu.classList.add('active');
            menuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    if (menuClose) {
        menuClose.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    if (menuOverlay) {
        menuOverlay.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
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
            document.getElementById(`tab-${tabId}`).classList.add('active');
            mobileMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
            if (tabId === 'productos') cargarProductos();
        });
    });
}

async function cargarPedidos(forceRefresh = false) {
    if (!vendedorActual) return;
    const container = document.getElementById('pedidos-container');
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Cargando pedidos...</p></div>`;
    
    try {
        const response = await callAPI('getPedidos', { vendedorId: vendedorActual.id }, forceRefresh);
        if (response.error) throw new Error(response.error);
        pedidos = (response.pedidos || []).map(p => ({ ...p, estado: normalizarEstado(p.estado) }));
        actualizarContadoresPedidos();
        calcularMetricas();
        renderizarPedidos();
        if (forceRefresh) mostrarToast('Pedidos actualizados', 'success');
    } catch (error) {
        container.innerHTML = `<div class="error-mensaje"><p>Error al cargar pedidos</p></div>`;
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
    const sesion = cargarSesionGuardada();
    if (!sesion) {
        document.getElementById('admin-auth').style.display = 'flex';
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
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const rememberMe = document.getElementById('remember-me')?.checked || false;
            
            const response = await callAPI('loginVendedor', { email, password: await hashPassword(password) }, true);
            if (response.success && response.vendedor) {
                vendedorActual = response.vendedor;
                if (rememberMe) {
                    localStorage.setItem('want_sesion', JSON.stringify({ id: vendedorActual.id, email: vendedorActual.email, nombre: vendedorActual.nombre }));
                } else {
                    guardarSesion(vendedorActual);
                }
                await iniciarPanel(vendedorActual);
            } else {
                alert('Email o contraseña incorrectos');
            }
        });
    }
    
    // Register
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('reg-nombre').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const telefono = document.getElementById('reg-telefono').value.trim();
            const direccion = document.getElementById('reg-direccion').value.trim();
            const horario = document.getElementById('reg-horario').value.trim();
            const password = document.getElementById('reg-password').value;
            const password2 = document.getElementById('reg-password2').value;
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
                document.getElementById('register-panel').style.display = 'none';
                document.getElementById('login-panel').style.display = 'block';
                document.getElementById('register-form').reset();
                document.getElementById('reg-logo-preview').innerHTML = '';
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
                        document.getElementById('reg-logo-preview').innerHTML = `<img src="${e.target.result}" style="max-width: 100px; border-radius: 12px;">`;
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
            const email = document.getElementById('recover-email').value.trim();
            const response = await postAPI('solicitarRecuperacion', { email });
            if (response.success) {
                alert('Código enviado a tu email');
                document.getElementById('recover-code-section').style.display = 'block';
            } else {
                alert(response.error);
            }
        });
    }
    
    // Reset password
    const btnReset = document.getElementById('btn-reset-password');
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            const email = document.getElementById('recover-email').value.trim();
            const codigo = document.getElementById('recover-code').value.trim();
            const newPassword = document.getElementById('recover-new-password').value;
            const newPassword2 = document.getElementById('recover-new-password2').value;
            
            if (newPassword !== newPassword2) {
                alert('Las contraseñas no coinciden');
                return;
            }
            
            const response = await postAPI('resetearPassword', { email, codigo, new_password_hash: await hashPassword(newPassword) });
            if (response.success) {
                alert('Contraseña restablecida. Iniciá sesión.');
                document.getElementById('recover-panel').style.display = 'none';
                document.getElementById('login-panel').style.display = 'block';
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
    
    if (showRegister) showRegister.addEventListener('click', () => {
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('register-panel').style.display = 'block';
    });
    if (showRecover) showRecover.addEventListener('click', () => {
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('recover-panel').style.display = 'block';
    });
    if (backToLogin) backToLogin.addEventListener('click', () => {
        document.getElementById('login-panel').style.display = 'block';
        document.getElementById('register-panel').style.display = 'none';
    });
    if (backToLoginRecover) backToLoginRecover.addEventListener('click', () => {
        document.getElementById('login-panel').style.display = 'block';
        document.getElementById('recover-panel').style.display = 'none';
    });
});