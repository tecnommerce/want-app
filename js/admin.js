// ===================================================
// ADMIN - Panel completo con gestión de productos
// ===================================================

// Configuración de Cloudinary
const CLOUDINARY_CLOUD_NAME = 'TU_CLOUD_NAME'; // Reemplazá con tu cloud name
const CLOUDINARY_UPLOAD_PRESET = 'want_productos';

// Variables globales
let vendedorActual = null;
let pedidos = [];
let productos = [];
let filtroActual = 'preparando';
let cargandoPedidos = false;
let tabActual = 'pedidos';

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
            if (e.key === 'Enter') ingresarVendedor();
        });
    }
    
    // Inicializar tabs
    inicializarTabs();
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
        
        // Cargar datos
        await cargarPedidos();
        await cargarProductos();
        cargarPerfil();
        
        // Botón actualizar
        const btnRefresh = document.getElementById('btn-refresh');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                actualizarPedidos();
                cargarProductos(true);
            });
        }
        
        // Botón nuevo producto
        const btnAgregar = document.getElementById('btn-agregar-producto');
        if (btnAgregar) {
            btnAgregar.addEventListener('click', () => mostrarModalProducto());
        }
        
        inicializarFiltros();
        
    } catch (error) {
        console.error('Error al ingresar:', error);
        mostrarToast('Error al conectar con el servidor', 'error');
    }
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
    
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
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
    
    // Recargar datos si es necesario
    if (tabId === 'productos') {
        cargarProductos();
    }
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
        
    } catch (error) {
        console.error('Error cargar productos:', error);
        container.innerHTML = `<div class="error-mensaje"><p>⚠️ Error al cargar productos</p></div>`;
    }
}

function renderizarProductosAdmin() {
    const container = document.getElementById('productos-admin-grid');
    
    if (productos.length === 0) {
        container.innerHTML = `<div class="sin-pedidos"><p>📭 No tenés productos cargados</p><button class="btn-primary" onclick="mostrarModalProducto()">Agregar primer producto</button></div>`;
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
    
    // Agregar modal al body
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-producto-container';
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Evento para subir imagen
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
    
    // Subir imagen a Cloudinary si hay
    if (imagenFile) {
        mostrarToast('Subiendo imagen...', 'info');
        imagenUrl = await subirImagenACloudinary(imagenFile);
        if (!imagenUrl) {
            mostrarToast('Error al subir imagen', 'error');
            return;
        }
    } else if (productoId) {
        // Si es edición y no se subió nueva imagen, mantener la existente
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
            // Actualizar producto existente
            response = await postAPI('actualizarProducto', { ...producto, id: productoId });
        } else {
            // Crear nuevo producto
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
// PERFIL - Actualizar datos del negocio
// ===================================================

function cargarPerfil() {
    if (!vendedorActual) return;
    
    document.getElementById('perfil-nombre').value = vendedorActual.nombre || '';
    document.getElementById('perfil-telefono').value = vendedorActual.telefono || '';
    document.getElementById('perfil-direccion').value = vendedorActual.direccion || '';
    document.getElementById('perfil-horario').value = vendedorActual.horario || '';
    
    if (vendedorActual.logo_url) {
        document.getElementById('logo-preview').innerHTML = `<img src="${vendedorActual.logo_url}" style="max-width: 150px;">`;
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
    
    try {
        const response = await postAPI('actualizarVendedor', {
            id: vendedorActual.id,
            nombre,
            telefono,
            direccion,
            horario,
            logo_url: logoUrl
        });
        
        if (response && response.success) {
            mostrarToast('Perfil actualizado', 'success');
            vendedorActual = { ...vendedorActual, nombre, telefono, direccion, horario, logo_url: logoUrl };
            document.getElementById('vendedor-info').innerHTML = `<p><strong>${escapeHTML(nombre)}</strong> | Tel: ${telefono}</p>`;
        } else {
            throw new Error(response?.error || 'Error al actualizar');
        }
    } catch (error) {
        console.error('Error actualizar perfil:', error);
        mostrarToast('Error al actualizar perfil', 'error');
    }
}

// ===================================================
// PEDIDOS (funciones existentes)
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
        btnRefresh.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    }
    await cargarPedidos(true);
    if (btnRefresh) {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';
    }
}

function actualizarContadores() {
    const contarPorEstado = { preparando: 0, 'en preparacion': 0, 'en camino': 0, entregado: 0 };
    pedidos.forEach(p => { if (contarPorEstado[p.estado] !== undefined) contarPorEstado[p.estado]++; });
    
    const btnPreparando = document.querySelector('.filtro-btn[data-estado="preparando"]');
    const btnEnPreparacion = document.querySelector('.filtro-btn[data-estado="en preparacion"]');
    const btnEnCamino = document.querySelector('.filtro-btn[data-estado="en camino"]');
    const btnEntregado = document.querySelector('.filtro-btn[data-estado="entregado"]');
    
    if (btnPreparando) btnPreparando.innerHTML = `📦 Nuevos pedidos (${contarPorEstado.preparando})`;
    if (btnEnPreparacion) btnEnPreparacion.innerHTML = `👨‍🍳 En preparación (${contarPorEstado['en preparacion']})`;
    if (btnEnCamino) btnEnCamino.innerHTML = `🚚 En camino (${contarPorEstado['en camino']})`;
    if (btnEntregado) btnEntregado.innerHTML = `✅ Entregados (${contarPorEstado.entregado})`;
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

function inicializarMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuClose = document.getElementById('menu-close');
    const contactoLink = document.getElementById('contacto-link');
    const contactoLinkMobile = document.getElementById('contacto-link-mobile');
    const contactoSection = document.getElementById('contacto-section');

    function openMenu() { if (mobileMenu) mobileMenu.classList.add('active'); if (menuOverlay) menuOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeMenu() { if (mobileMenu) mobileMenu.classList.remove('active'); if (menuOverlay) menuOverlay.classList.remove('active'); document.body.style.overflow = ''; }
    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
    function mostrarContacto(e) { e.preventDefault(); closeMenu(); if (contactoSection) { contactoSection.style.display = 'block'; contactoSection.scrollIntoView({ behavior: 'smooth' }); } }
    if (contactoLink) contactoLink.addEventListener('click', mostrarContacto);
    if (contactoLinkMobile) contactoLinkMobile.addEventListener('click', mostrarContacto);
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}