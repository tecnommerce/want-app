// ===================================================
// ADMIN.JS - COMPLETO CON MEJORAS
// ===================================================

console.log('🚀 admin.js cargado correctamente');

// Variables globales
let vendedorActual = null;
let productosGlobal = [];
let deliveriesGlobal = [];
let pedidosGlobal = [];
let filtroEstadoActual = 'preparando';
let busquedaActual = '';

// ===================================================
// FUNCIONES DE MODALES (CORREGIDAS)
// ===================================================

function abrirModal(modalId) {
    // Cerrar todos los modales primero
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    // Abrir el modal deseado
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Función para cerrar todos los modales
function cerrarTodosModales() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = '';
}

// ===================================================
// FUNCIONES DE LOADING EN BOTONES
// ===================================================

async function withLoading(btn, callback) {
    if (!btn) return await callback();
    
    const textoOriginal = btn.innerHTML;
    const disabledOriginal = btn.disabled;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
    btn.classList.add('btn-loading');
    
    try {
        return await callback();
    } finally {
        btn.disabled = disabledOriginal;
        btn.innerHTML = textoOriginal;
        btn.classList.remove('btn-loading');
    }
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    // Eliminar notificaciones existentes
    const notificacionesExistentes = document.querySelectorAll('.notificacion');
    notificacionesExistentes.forEach(notif => notif.remove());
    
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.innerHTML = `
        <i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${mensaje}</span>
    `;
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        notificacion.remove();
    }, 3000);
}

// ===================================================
// GUARDAR SOLO DESCRIPCIÓN (CORREGIDO)
// ===================================================

async function guardarSoloDescripcion() {
    console.log('🖊️ Guardando solo descripción...');
    
    // Obtener ID desde sessionStorage
    let vendedorId = null;
    const vendedorSesion = sessionStorage.getItem('vendedor_sesion');
    if (vendedorSesion) {
        try {
            const vendedor = JSON.parse(vendedorSesion);
            vendedorId = vendedor.id;
        } catch(e) {}
    }
    
    if (!vendedorId) {
        const vendedorObj = localStorage.getItem('vendedor');
        if (vendedorObj) {
            try {
                const v = JSON.parse(vendedorObj);
                vendedorId = v.id;
            } catch(e) {}
        }
    }
    
    if (!vendedorId) {
        mostrarNotificacion('Error: No hay sesión activa', 'error');
        return;
    }
    
    const descripcion = document.getElementById('perfil-descripcion').value;
    const statusSpan = document.getElementById('descripcion-status');
    
    if (statusSpan) {
        statusSpan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        statusSpan.style.color = '#007bff';
    }
    
    try {
        const result = await window.callAPI('actualizarVendedor', {
            id: parseInt(vendedorId),
            descripcion: descripcion
        });
        
        if (result.success) {
            if (statusSpan) {
                statusSpan.innerHTML = '<i class="fas fa-check-circle"></i> ¡Descripción guardada!';
                statusSpan.style.color = 'green';
                setTimeout(() => statusSpan.innerHTML = '', 3000);
            }
            mostrarNotificacion('Descripción guardada correctamente', 'success');
        } else {
            if (statusSpan) {
                statusSpan.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error: ' + (result.error || 'No se pudo guardar');
                statusSpan.style.color = 'red';
            }
            mostrarNotificacion('Error al guardar descripción', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        if (statusSpan) {
            statusSpan.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error de conexión';
            statusSpan.style.color = 'red';
        }
    }
}

// ===================================================
// FUNCIONES DEL PANEL
// ===================================================

async function cargarDatosIniciales() {
    const vendedorId = obtenerVendedorId();
    if (!vendedorId) return;
    
    // Cargar productos, pedidos y deliveries en paralelo
    const [productosRes, pedidosRes, deliveriesRes] = await Promise.all([
        window.callAPI('getProductos', { vendedorId: vendedorId }),
        window.callAPI('getPedidos', { vendedorId: vendedorId }),
        window.callAPI('getDeliveries', { vendedorId: vendedorId })
    ]);
    
    if (productosRes.success) {
        productosGlobal = productosRes.productos || [];
        actualizarContadorProductos();
        renderProductos();
    }
    
    if (pedidosRes.success) {
        pedidosGlobal = pedidosRes.pedidos || [];
        actualizarMetricas();
        renderPedidos();
    }
    
    if (deliveriesRes.success) {
        deliveriesGlobal = deliveriesRes.deliveries || [];
        actualizarContadorDelivery();
        renderDeliveries();
    }
}

function obtenerVendedorId() {
    try {
        const sesion = sessionStorage.getItem('vendedor_sesion');
        if (sesion) {
            const v = JSON.parse(sesion);
            return v.id;
        }
    } catch(e) {}
    
    const vendedorId = localStorage.getItem('vendedorId');
    if (vendedorId) return parseInt(vendedorId);
    
    return null;
}

function actualizarMetricas() {
    const hoy = new Date().toISOString().split('T')[0];
    const semanaStart = new Date();
    semanaStart.setDate(semanaStart.getDate() - 7);
    const mesStart = new Date();
    mesStart.setMonth(mesStart.getMonth() - 1);
    
    let ventasHoy = 0, ventasSemana = 0, ventasMes = 0;
    let entregados = 0, pendientes = 0;
    
    pedidosGlobal.forEach(pedido => {
        const fechaPedido = pedido.fecha?.split('T')[0];
        
        if (pedido.estado === 'entregado') {
            entregados++;
            if (fechaPedido === hoy) ventasHoy += pedido.total || 0;
            if (new Date(pedido.fecha) >= semanaStart) ventasSemana += pedido.total || 0;
            if (new Date(pedido.fecha) >= mesStart) ventasMes += pedido.total || 0;
        } else {
            pendientes++;
        }
    });
    
    document.getElementById('ventas-hoy').textContent = `$${ventasHoy.toLocaleString()}`;
    document.getElementById('ventas-semana').textContent = `$${ventasSemana.toLocaleString()}`;
    document.getElementById('ventas-mes').textContent = `$${ventasMes.toLocaleString()}`;
    document.getElementById('pedidos-entregados').textContent = entregados;
    document.getElementById('pedidos-pendientes').textContent = pendientes;
    
    // Reportes
    document.getElementById('reporte-ventas-hoy').textContent = `$${ventasHoy.toLocaleString()}`;
    document.getElementById('reporte-ventas-semana').textContent = `$${ventasSemana.toLocaleString()}`;
    document.getElementById('reporte-ventas-mes').textContent = `$${ventasMes.toLocaleString()}`;
    document.getElementById('reporte-pedidos-entregados').textContent = entregados;
    document.getElementById('reporte-pedidos-pendientes').textContent = pendientes;
    document.getElementById('reporte-total-pedidos').textContent = pedidosGlobal.length;
}

function actualizarContadorProductos() {
    const badge = document.getElementById('badge-productos');
    if (badge) badge.textContent = productosGlobal.length;
}

function actualizarContadorDelivery() {
    const badge = document.getElementById('badge-delivery');
    if (badge) badge.textContent = deliveriesGlobal.length;
}

function renderProductos() {
    const container = document.getElementById('productos-admin-grid');
    if (!container) return;
    
    if (productosGlobal.length === 0) {
        container.innerHTML = '<div class="loading"><p>No hay productos aún. ¡Agregá tu primer producto!</p></div>';
        return;
    }
    
    container.innerHTML = productosGlobal.map(producto => `
        <div class="producto-card">
            ${producto.imagen_url ? `<img src="${producto.imagen_url}" class="producto-imagen" alt="${producto.nombre}">` : '<div class="producto-imagen" style="background: var(--gray-100); display: flex; align-items: center; justify-content: center;"><i class="fas fa-image" style="font-size: 40px; color: var(--gray-400);"></i></div>'}
            <div class="producto-info">
                <div class="producto-nombre">${producto.nombre}</div>
                <div class="producto-precio">$${producto.precio?.toLocaleString()}</div>
                <div class="producto-acciones">
                    <button class="btn-outline" onclick="editarProducto(${producto.id})" style="padding: 5px 10px; font-size: 12px;"><i class="fas fa-edit"></i></button>
                    <button class="btn-danger" onclick="eliminarProducto(${producto.id})" style="padding: 5px 10px; font-size: 12px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPedidos() {
    const container = document.getElementById('pedidos-container');
    if (!container) return;
    
    let pedidosFiltrados = pedidosGlobal;
    
    // Filtrar por estado
    if (filtroEstadoActual !== 'todos') {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.estado === filtroEstadoActual);
    }
    
    // Filtrar por búsqueda
    if (busquedaActual) {
        const busqueda = busquedaActual.toLowerCase();
        pedidosFiltrados = pedidosFiltrados.filter(p => 
            p.id.toString().includes(busqueda) ||
            p.cliente_nombre?.toLowerCase().includes(busqueda) ||
            p.cliente_telefono?.includes(busqueda)
        );
    }
    
    // Ordenar por fecha (más reciente primero)
    pedidosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = '<div class="loading"><p>No hay pedidos en esta categoría</p></div>';
        return;
    }
    
    container.innerHTML = pedidosFiltrados.map(pedido => `
        <div class="pedido-card">
            <div class="pedido-header">
                <div class="pedido-numero">#${pedido.numero_orden || pedido.id}</div>
                <div class="pedido-estado estado-${pedido.estado?.replace(' ', '-') || 'preparando'}">${getEstadoTexto(pedido.estado)}</div>
            </div>
            <div class="pedido-body">
                <div><strong>Cliente:</strong> ${pedido.cliente_nombre || 'N/A'}</div>
                <div><strong>Teléfono:</strong> ${pedido.cliente_telefono || 'N/A'}</div>
                <div><strong>Dirección:</strong> ${pedido.direccion || 'N/A'}</div>
                <div><strong>Total:</strong> $${pedido.total?.toLocaleString() || 0}</div>
            </div>
            <div class="pedido-footer">
                <button class="btn-outline" onclick="verDetallePedido(${pedido.id})" style="padding: 5px 10px;"><i class="fas fa-eye"></i> Ver</button>
                <button class="btn-primary" onclick="editarPedido(${pedido.id})" style="padding: 5px 10px;"><i class="fas fa-edit"></i> Editar</button>
                ${pedido.estado !== 'entregado' ? `<button class="btn-success" onclick="actualizarEstadoPedido(${pedido.id}, 'entregado')" style="padding: 5px 10px;"><i class="fas fa-check"></i> Completar</button>` : ''}
            </div>
        </div>
    `).join('');
    
    // Actualizar contadores
    actualizarContadoresPedidos();
}

function getEstadoTexto(estado) {
    const estados = {
        'preparando': 'Nuevo',
        'en preparacion': 'En preparación',
        'en camino': 'En camino',
        'entregado': 'Entregado'
    };
    return estados[estado] || estado;
}

function actualizarContadoresPedidos() {
    const counts = {
        preparando: 0,
        'en preparacion': 0,
        'en camino': 0,
        entregado: 0
    };
    
    pedidosGlobal.forEach(p => {
        if (counts[p.estado] !== undefined) counts[p.estado]++;
    });
    
    document.getElementById('count-preparando').textContent = counts.preparando;
    document.getElementById('count-preparacion').textContent = counts['en preparacion'];
    document.getElementById('count-camino').textContent = counts['en camino'];
    document.getElementById('count-entregado').textContent = counts.entregado;
    document.getElementById('badge-pedidos').textContent = pedidosGlobal.length;
}

function renderDeliveries() {
    const container = document.getElementById('delivery-grid');
    if (!container) return;
    
    if (deliveriesGlobal.length === 0) {
        container.innerHTML = '<div class="loading"><p>No hay deliveries registrados. ¡Agregá uno!</p></div>';
        return;
    }
    
    container.innerHTML = deliveriesGlobal.map(delivery => `
        <div class="delivery-card">
            <div class="delivery-nombre">${delivery.nombre}</div>
            <div class="delivery-telefono"><i class="fab fa-whatsapp"></i> ${delivery.telefono}</div>
            <div class="delivery-acciones">
                <button class="btn-outline" onclick="editarDelivery(${delivery.id})" style="padding: 5px 10px;"><i class="fas fa-edit"></i></button>
                <button class="btn-danger" onclick="eliminarDelivery(${delivery.id})" style="padding: 5px 10px;"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

// ===================================================
// FUNCIONES DE PERFIL
// ===================================================

async function cargarPerfil() {
    const vendedorId = obtenerVendedorId();
    if (!vendedorId) return;
    
    try {
        const result = await window.callAPI('getAllVendedores', {});
        if (result.success && result.vendedores) {
            const vendedor = result.vendedores.find(v => v.id === vendedorId);
            if (vendedor) {
                vendedorActual = vendedor;
                
                document.getElementById('perfil-nombre-display').textContent = vendedor.nombre;
                document.getElementById('perfil-email-display').textContent = vendedor.email;
                document.getElementById('perfil-nombre').value = vendedor.nombre || '';
                document.getElementById('perfil-telefono').value = vendedor.telefono || '';
                document.getElementById('perfil-direccion').value = vendedor.direccion || '';
                document.getElementById('perfil-horario').value = vendedor.horario || '';
                document.getElementById('perfil-descripcion').value = vendedor.descripcion || '';
                
                // Mostrar rubros
                const rubrosContainer = document.getElementById('perfil-rubros-container');
                if (rubrosContainer && vendedor.rubros && vendedor.rubros.length) {
                    rubrosContainer.innerHTML = vendedor.rubros.map(rubro => 
                        `<span class="rubro-tag">${rubro} <i class="fas fa-times" onclick="eliminarRubro('${rubro}')"></i></span>`
                    ).join('');
                } else if (rubrosContainer) {
                    rubrosContainer.innerHTML = '<span class="rubro-tag">No hay rubros seleccionados</span>';
                }
                
                // Logo
                if (vendedor.logo_url) {
                    const headerLogo = document.getElementById('header-logo-img');
                    if (headerLogo) {
                        headerLogo.src = vendedor.logo_url;
                        headerLogo.style.display = 'block';
                    }
                    const avatarContainer = document.getElementById('perfil-avatar-container');
                    if (avatarContainer) {
                        avatarContainer.innerHTML = `<img src="${vendedor.logo_url}" class="perfil-avatar-img" alt="Logo"><button type="button" class="btn-cambiar-avatar" id="btn-cambiar-logo" title="Cambiar logo"><i class="fas fa-pencil-alt"></i></button><input type="file" id="perfil-logo-input" accept="image/*" style="display: none;">`;
                        // Reasignar evento
                        document.getElementById('btn-cambiar-logo')?.addEventListener('click', () => {
                            document.getElementById('perfil-logo-input')?.click();
                        });
                    }
                }
                
                document.getElementById('header-nombre-negocio').textContent = vendedor.nombre;
                const toggleSwitch = document.getElementById('toggle-estado-switch');
                if (toggleSwitch) toggleSwitch.checked = vendedor.estado_abierto === true;
            }
        }
    } catch (error) {
        console.error('Error cargando perfil:', error);
    }
}

// ===================================================
// EVENT LISTENERS
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, configurando event listeners');
    
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const result = await window.callAPI('loginVendedor', { email, password });
            if (result.success) {
                sessionStorage.setItem('vendedor_sesion', JSON.stringify(result.vendedor));
                document.getElementById('admin-auth').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'block';
                document.getElementById('header-admin').style.display = 'block';
                vendedorActual = result.vendedor;
                await cargarDatosIniciales();
                await cargarPerfil();
                mostrarNotificacion('Bienvenido ' + result.vendedor.nombre, 'success');
            } else {
                mostrarNotificacion('Error: ' + result.error, 'error');
            }
        });
    }
    
    // Toggle password
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            if (target) {
                target.type = target.type === 'password' ? 'text' : 'password';
                btn.querySelector('i').classList.toggle('fa-eye');
                btn.querySelector('i').classList.toggle('fa-eye-slash');
            }
        });
    });
    
    // Botón perfil
    const btnProfile = document.getElementById('btn-open-profile');
    if (btnProfile) {
        btnProfile.addEventListener('click', async () => {
            await cargarPerfil();
            abrirModal('modal-perfil');
            setTimeout(() => {
                const btnDesc = document.getElementById('btn-guardar-descripcion');
                if (btnDesc) {
                    btnDesc.removeEventListener('click', guardarSoloDescripcion);
                    btnDesc.addEventListener('click', guardarSoloDescripcion);
                }
            }, 100);
        });
    }
    
    // Guardar perfil completo
    const perfilForm = document.getElementById('perfil-form');
    if (perfilForm) {
        perfilForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const vendedorId = obtenerVendedorId();
            if (!vendedorId) return;
            
            const btn = e.submitter;
            await withLoading(btn, async () => {
                const result = await window.callAPI('actualizarVendedor', {
                    id: vendedorId,
                    nombre: document.getElementById('perfil-nombre').value,
                    telefono: document.getElementById('perfil-telefono').value,
                    direccion: document.getElementById('perfil-direccion').value,
                    horario: document.getElementById('perfil-horario').value,
                    descripcion: document.getElementById('perfil-descripcion').value
                });
                
                if (result.success) {
                    mostrarNotificacion('Perfil actualizado correctamente', 'success');
                    cerrarModal('modal-perfil');
                    await cargarPerfil();
                } else {
                    mostrarNotificacion('Error: ' + result.error, 'error');
                }
            });
        });
    }
    
    // Botón editar rubros
    const btnEditarRubros = document.getElementById('btn-editar-rubros');
    if (btnEditarRubros) {
        btnEditarRubros.addEventListener('click', () => {
            abrirModal('modal-rubros');
        });
    }
    
    // Cerrar modal con overlay
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cerrarModal(modal.id);
            }
        });
    });
    
    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarTodosModales();
        }
    });
    
    console.log('✅ Event listeners configurados');
});

console.log('✅ Script de admin cargado correctamente');