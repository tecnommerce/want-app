// ===================================================
// ADMIN GLOBAL - Versión Supabase (CON GESTIÓN DE USUARIOS)
// ===================================================

// ===================================================
// FUNCIONES DE FECHA - ZONA HORARIA ARGENTINA (UTC-3)
// ===================================================

/**
 * Obtiene la fecha/hora ACTUAL en Argentina (UTC-3)
 * Parsea correctamente sin crear Dates inválidas
 * @returns {Date} Objeto Date que representa la hora REAL de Argentina
 */
function getArgentinaDate() {
    const now = new Date();
    const localeStr = now.toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
    const matches = localeStr.match(/(\d+)\/(\d+)\/(\d+)\s(\d+):(\d+):(\d+)/);
    if (!matches) {
        console.warn('⚠️ Error parseando fecha Argentina');
        return now;
    }
    const [, day, month, year, hours, minutes, seconds] = matches;
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
}

/**
 * Obtiene la fecha actual en Argentina en formato ISO 8601 para base de datos
 * @returns {string} Fecha en formato ISO: "2026-04-18T05:00:00.000Z"
 */
function getArgentinaDateISO() {
    const argentinaDate = getArgentinaDate();
    if (isNaN(argentinaDate.getTime())) {
        console.error('❌ Error: Fecha Argentina inválida');
        return new Date().toISOString();
    }
    const utcCorrect = new Date(argentinaDate.getTime() + 3 * 60 * 60 * 1000);
    return utcCorrect.toISOString();
}

// ===================================================
// SISTEMA DE NOTIFICACIONES - UNA SOLA A LA VEZ
// ===================================================

let toastActivo = false;
let toastPendiente = null;

function mostrarToastUnico(mensaje, tipo = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    // Si hay un toast activo, guardar el nuevo para después
    if (toastActivo) {
        toastPendiente = { mensaje, tipo };
        return;
    }
    
    toastActivo = true;
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${tipo}`;
    toast.textContent = mensaje;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
        toastActivo = false;
        
        // Mostrar el siguiente toast pendiente
        if (toastPendiente) {
            mostrarToastUnico(toastPendiente.mensaje, toastPendiente.tipo);
            toastPendiente = null;
        }
    }, 3000);
}

// Reemplazar la función mostrarToast original
window.mostrarToastOriginal = window.mostrarToast;
window.mostrarToast = mostrarToastUnico;

// ===================================================
// VARIABLES GLOBALES
// ===================================================

let allVendedores = [];
let allPedidos = [];
let allProductos = [];
let allUsuarios = [];
let banners = [];

// Lista de rubros disponibles (con Pancheria)
const RUBROS_DISPONIBLES = [
    'Sandwichería', 'Hamburguesería', 'Pizzería', 'Empanadas', 'Pancheria',
    'Comida casera', 'Kiosco', 'Bebidas', 'Despensa', 'Supermercado',
    'Panadería', 'Verdulería', 'Pollería', 'Carnicería', 'Cafetería',
    'Bar', 'Restaurante', 'Bar y café', 'Heladería', 'Farmacia', 'Mascotas'
];

// ===================================================
// SUSCRIPCIONES EN TIEMPO REAL
// ===================================================

let realtimeSubscriptions = [];

function iniciarRealtime() {
    console.log('🔄 Iniciando suscripciones en tiempo real...');
    
    // Suscripción a cambios en vendedores
    const vendedoresChannel = supabaseClient
        .channel('vendedores-realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'vendedores' },
            (payload) => {
                console.log('📢 Cambio en vendedores:', payload.eventType);
                cargarTodosLosDatos();
            }
        )
        .subscribe();
    
    // Suscripción a cambios en pedidos
    const pedidosChannel = supabaseClient
        .channel('pedidos-realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'pedidos' },
            (payload) => {
                console.log('📢 Cambio en pedidos:', payload.eventType);
                cargarTodosLosDatos();
            }
        )
        .subscribe();
    
    // Suscripción a cambios en productos
    const productosChannel = supabaseClient
        .channel('productos-realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'productos' },
            (payload) => {
                console.log('📢 Cambio en productos:', payload.eventType);
                cargarTodosLosDatos();
            }
        )
        .subscribe();
    
    // Suscripción a cambios en usuarios
    const usuariosChannel = supabaseClient
        .channel('usuarios-realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'usuarios' },
            (payload) => {
                console.log('📢 Cambio en usuarios:', payload.eventType);
                cargarUsuarios();
                actualizarDashboard();
            }
        )
        .subscribe();
    
    // Suscripción a cambios en banners
    const bannersChannel = supabaseClient
        .channel('banners-realtime')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'banners' },
            (payload) => {
                console.log('📢 Cambio en banners:', payload.eventType);
                if (document.getElementById('section-web').style.display !== 'none') {
                    cargarBanners();
                }
            }
        )
        .subscribe();
    
    realtimeSubscriptions = [
        vendedoresChannel, 
        pedidosChannel, 
        productosChannel, 
        usuariosChannel,
        bannersChannel
    ];
}

function detenerRealtime() {
    console.log('🔕 Deteniendo suscripciones en tiempo real...');
    realtimeSubscriptions.forEach(channel => {
        supabaseClient.removeChannel(channel);
    });
    realtimeSubscriptions = [];
}

// ===================================================
// UTILITARIAS
// ===================================================

function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(precio);
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return 'N/A';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-AR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

function getEstadoTexto(estado) {
    const textos = { 'preparando': 'Nuevo', 'en preparacion': 'En preparación', 'en camino': 'En camino', 'entregado': 'Entregado' };
    return textos[estado] || estado || 'Nuevo';
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatearRubrosParaLista(rubros) {
    if (!rubros || rubros.length === 0) return '-';
    return rubros.slice(0, 2).join(', ') + (rubros.length > 2 ? ` +${rubros.length - 2}` : '');
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

async function withLoading(button, callback) {
    if (!button) return await callback();
    const originalText = button.innerHTML;
    const originalDisabled = button.disabled;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
    try {
        return await callback();
    } finally {
        button.disabled = originalDisabled;
        button.innerHTML = originalText;
    }
}

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===================================================
// FUNCIONES DE USUARIOS
// ===================================================

async function cargarUsuarios() {
    const tbody = document.getElementById('usuarios-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="loading-text">Cargando usuarios...</td></tr>';
    
    try {
        const response = await window.obtenerTodosUsuarios();
        if (response.success) {
            allUsuarios = response.usuarios || [];
            renderizarUsuarios();
            actualizarTopUsuarios();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="loading-text">Error: ${error.message}</td></tr>`;
    }
}

function renderizarUsuarios() {
    const tbody = document.getElementById('usuarios-tbody');
    if (!tbody) return;
    
    if (allUsuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-text">No hay usuarios registrados</td></tr>';
        return;
    }
    
    const pedidosPorUsuario = {};
    allPedidos.forEach(p => {
        if (p.usuario_id) {
            if (!pedidosPorUsuario[p.usuario_id]) pedidosPorUsuario[p.usuario_id] = 0;
            pedidosPorUsuario[p.usuario_id]++;
        }
    });
    
    tbody.innerHTML = allUsuarios.map(u => `
        <tr>
            <td>${u.id.substring(0, 8)}...</td>
            <td><strong>${escapeHTML(u.nombre)} ${escapeHTML(u.apellido)}</strong></td>
            <td>${escapeHTML(u.email)}</td>
            <td><a href="https://wa.me/${u.telefono}" target="_blank" class="btn-whatsapp-link" style="color: #25D366;">${u.telefono}</a></td>
            <td>${escapeHTML(u.direccion)}, ${escapeHTML(u.ciudad)}, ${escapeHTML(u.provincia)}</td>
            <td>${formatearPrecio(u.total_gastado || 0)}</td>
            <td>${pedidosPorUsuario[u.id] || 0}</td>
            <td><span class="status-badge ${u.activo === true ? 'status-activo' : 'status-inactivo'}">${u.activo === true ? 'Activo' : 'Suspendido'}</span></td>
            <td>
                <button class="btn-edit" onclick="editarUsuario('${u.id}')"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-toggle-status" onclick="suspenderUsuario('${u.id}', ${!u.activo})"><i class="fas fa-${u.activo === true ? 'ban' : 'check-circle'}"></i> ${u.activo === true ? 'Suspender' : 'Habilitar'}</button>
                <button class="btn-delete" onclick="eliminarUsuario('${u.id}')"><i class="fas fa-trash"></i> Eliminar</button>
                <a href="https://wa.me/${u.telefono}" target="_blank" class="btn-whatsapp" style="background: #25D366; color: white; padding: 6px 10px; border-radius: 40px; display: inline-block; text-decoration: none; font-size: 0.7rem;"><i class="fab fa-whatsapp"></i> WhatsApp</a>
               </td>
        </tr>
    `).join('');
}

function actualizarTopUsuarios() {
    const topUsuarios = [...allUsuarios]
        .sort((a, b) => (b.total_gastado || 0) - (a.total_gastado || 0))
        .slice(0, 5);
    
    const topUsuariosContainer = document.getElementById('top-usuarios-list');
    if (topUsuariosContainer) {
        if (topUsuarios.length === 0) {
            topUsuariosContainer.innerHTML = '<p class="loading-text">No hay datos</p>';
        } else {
            topUsuariosContainer.innerHTML = topUsuarios.map(u => `
                <div class="top-item">
                    <span>${escapeHTML(u.nombre)} ${escapeHTML(u.apellido)}</span>
                    <span>${formatearPrecio(u.total_gastado || 0)}</span>
                </div>
            `).join('');
        }
    }
}

function editarUsuario(usuarioId) {
    const usuario = allUsuarios.find(u => u.id === usuarioId);
    if (!usuario) return;
    
    document.getElementById('edit-usuario-id').value = usuario.id;
    document.getElementById('edit-usuario-nombre').value = usuario.nombre || '';
    document.getElementById('edit-usuario-apellido').value = usuario.apellido || '';
    document.getElementById('edit-usuario-email').value = usuario.email || '';
    document.getElementById('edit-usuario-telefono').value = usuario.telefono || '';
    document.getElementById('edit-usuario-provincia').value = usuario.provincia || '';
    document.getElementById('edit-usuario-ciudad').value = usuario.ciudad || '';
    document.getElementById('edit-usuario-direccion').value = usuario.direccion || '';
    document.getElementById('edit-usuario-activo').value = usuario.activo === true ? 'SI' : 'NO';
    
    document.getElementById('modal-editar-usuario').classList.add('active');
}

async function guardarEditarUsuario() {
    const btn = document.getElementById('guardar-editar-usuario');
    await withLoading(btn, async () => {
        const data = {
            id: document.getElementById('edit-usuario-id').value,
            nombre: document.getElementById('edit-usuario-nombre').value.trim(),
            apellido: document.getElementById('edit-usuario-apellido').value.trim(),
            email: document.getElementById('edit-usuario-email').value.trim(),
            telefono: document.getElementById('edit-usuario-telefono').value.trim(),
            provincia: document.getElementById('edit-usuario-provincia').value.trim(),
            ciudad: document.getElementById('edit-usuario-ciudad').value.trim(),
            direccion: document.getElementById('edit-usuario-direccion').value.trim(),
            activo: document.getElementById('edit-usuario-activo').value === 'SI'
        };
        
        try {
            const result = await window.actualizarDatosUsuario(data.id, data);
            if (result.success) {
                mostrarToast('Usuario actualizado', 'success');
                cerrarModal('modal-editar-usuario');
                await cargarUsuarios();
            } else {
                mostrarToast(result.error || 'Error al actualizar', 'error');
            }
        } catch (error) {
            mostrarToast('Error al actualizar', 'error');
        }
    });
}

async function suspenderUsuario(usuarioId, activo) {
    if (!confirm(`¿${activo ? 'Habilitar' : 'Suspender'} este usuario?`)) return;
    
    const result = await window.suspenderUsuario(usuarioId, activo);
    if (result.success) {
        if (typeof window.guardarLogAuditoria === 'function') {
            await window.guardarLogAuditoria(
                activo ? 'usuario_habilitado' : 'usuario_suspendido',
                'usuario',
                usuarioId,
                { estado_nuevo: activo }
            );
        }
        mostrarToast(`Usuario ${activo ? 'habilitado' : 'suspendido'}`, 'success');
        await cargarUsuarios();
    } else {
        mostrarToast('Error al cambiar estado', 'error');
    }
}

async function eliminarUsuario(usuarioId) {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer y eliminará todos sus pedidos.')) return;
    
    const result = await window.eliminarUsuario(usuarioId);
    if (result.success) {
        mostrarToast('Usuario eliminado', 'success');
        await cargarUsuarios();
        await cargarTodosLosDatos();
    } else {
        mostrarToast('Error al eliminar usuario', 'error');
    }
}

// ===================================================
// FUNCIÓN CONFIRMAR ELIMINAR USUARIO (FALTANTE)
// ===================================================

async function confirmarEliminarUsuario() {
    if (!window.usuarioAEliminar) return;
    
    const btn = document.getElementById('confirmar-eliminar-usuario');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
    }
    
    try {
        const result = await window.eliminarUsuario(window.usuarioAEliminar);
        if (result.success) {
            mostrarToast('Usuario eliminado', 'success');
            cerrarModal('modal-confirmar-usuario');
            await cargarUsuarios();
            await actualizarDashboard();
        } else {
            mostrarToast(result.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al eliminar usuario', 'error');
    }
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Eliminar';
    }
    window.usuarioAEliminar = null;
}

// ===================================================
// FUNCIONES DE API CON SUPABASE
// ===================================================

async function callAPI(action, data = {}) {
    console.log(`🔄 Llamando a Supabase: ${action}`, data);
    
    try {
        switch(action) {
            case 'getVendedores':
                const { data: vendedores, error: vError } = await supabaseClient
                    .from('vendedores')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');
                if (vError) throw vError;
                return { success: true, vendedores: vendedores };
                
            case 'getAllVendedores':
                const { data: allVendedores, error: allVError } = await supabaseClient
                    .from('vendedores')
                    .select('*')
                    .order('nombre');
                if (allVError) throw allVError;
                return { success: true, vendedores: allVendedores };
                
            case 'getAllPedidos':
                const { data: pedidos, error: pError } = await supabaseClient
                    .from('pedidos')
                    .select('*')
                    .order('fecha', { ascending: false });
                if (pError) throw pError;
                
                for (const pedido of pedidos) {
                    const { data: prodPedido } = await supabaseClient
                        .from('productos_pedido')
                        .select(`
                            cantidad,
                            precio_unitario,
                            productos (id, nombre, precio)
                        `)
                        .eq('pedido_id', pedido.id);
                    
                    if (prodPedido && prodPedido.length > 0) {
                        pedido.productos = prodPedido.map(pp => ({
                            id: pp.productos.id,
                            nombre: pp.productos.nombre,
                            precio: pp.precio_unitario,
                            cantidad: pp.cantidad
                        }));
                    } else {
                        pedido.productos = [];
                    }
                }
                return { success: true, pedidos: pedidos };
                
            case 'getAllProductos':
                const { data: productos, error: prodError } = await supabaseClient
                    .from('productos')
                    .select('*, vendedores(nombre)')
                    .order('nombre');
                if (prodError) throw prodError;
                
                const productosConVendedor = productos.map(p => ({
                    ...p,
                    vendedor_nombre: p.vendedores?.nombre || 'Desconocido'
                }));
                return { success: true, productos: productosConVendedor };
                
            case 'actualizarVendedor':
                let rubrosArray = data.rubros;
                if (typeof rubrosArray === 'string') {
                    rubrosArray = rubrosArray.split(',').map(r => r.trim());
                }
                
                const updateData = {
                    nombre: data.nombre,
                    email: data.email,
                    telefono: data.telefono,
                    direccion: data.direccion,
                    horario: data.horario,
                    rubros: rubrosArray || [],
                    activo: data.activo === 'SI' ? true : false
                };
                
                if (data.estado_abierto !== undefined) {
                    updateData.estado_abierto = data.estado_abierto === true || data.estado_abierto === 'true';
                }
                
                const { error: updateError } = await supabaseClient
                    .from('vendedores')
                    .update(updateData)
                    .eq('id', data.id);
                if (updateError) throw updateError;
                return { success: true };
                
            case 'eliminarVendedor':
                const { error: deleteError } = await supabaseClient
                    .from('vendedores')
                    .delete()
                    .eq('id', data.vendedorId);
                if (deleteError) throw deleteError;
                return { success: true };
                
            case 'actualizarProducto':
                const { error: prodUpdateError } = await supabaseClient
                    .from('productos')
                    .update({
                        nombre: data.nombre,
                        descripcion: data.descripcion,
                        precio: data.precio,
                        disponible: data.disponible === 'SI' ? true : false
                    })
                    .eq('id', data.id);
                if (prodUpdateError) throw prodUpdateError;
                return { success: true };
                
            case 'eliminarProducto':
                const { error: prodDeleteError } = await supabaseClient
                    .from('productos')
                    .delete()
                    .eq('id', data.productoId);
                if (prodDeleteError) throw prodDeleteError;
                return { success: true };
                
            case 'actualizarEstado':
                const { error: estadoError } = await supabaseClient
                    .from('pedidos')
                    .update({ estado: data.estado })
                    .eq('id', data.pedidoId);
                if (estadoError) throw estadoError;
                return { success: true };
                
            case 'cancelarPedido':
                const { error: cancelError } = await supabaseClient
                    .from('pedidos')
                    .delete()
                    .eq('id', data.pedidoId);
                if (cancelError) throw cancelError;
                return { success: true };
                
            case 'getAllBanners':
                const { data: bannersData, error: banError } = await supabaseClient
                    .from('banners')
                    .select('*')
                    .order('orden');
                if (banError) throw banError;
                return { success: true, banners: bannersData };
                
            case 'crearBanner':
                const { data: newBanner, error: createBanError } = await supabaseClient
                    .from('banners')
                    .insert([{
                        titulo: data.titulo,
                        imagen_url: data.imagen_url,
                        link: data.link,
                        orden: data.orden,
                        activo: data.activo === 'SI' ? true : false,
                        vendedor_id: data.vendedor_id || null
                    }])
                    .select()
                    .single();
                if (createBanError) throw createBanError;
                return { success: true, bannerId: newBanner.id };
                
            case 'actualizarBanner':
                const { error: updateBanError } = await supabaseClient
                    .from('banners')
                    .update({
                        titulo: data.titulo,
                        imagen_url: data.imagen_url,
                        link: data.link,
                        orden: data.orden,
                        activo: data.activo === 'SI' ? true : false,
                        vendedor_id: data.vendedor_id || null
                    })
                    .eq('id', data.id);
                if (updateBanError) throw updateBanError;
                return { success: true };
                
            case 'eliminarBanner':
                const { error: deleteBanError } = await supabaseClient
                    .from('banners')
                    .delete()
                    .eq('id', data.bannerId);
                if (deleteBanError) throw deleteBanError;
                return { success: true };
                
            default:
                console.warn(`⚠️ Acción no implementada: ${action}`);
                return { success: false, error: `Acción no implementada: ${action}` };
        }
    } catch (error) {
        console.error(`❌ Error en ${action}:`, error);
        return { success: false, error: error.message };
    }
}

async function postAPI(action, data = {}) {
    return await callAPI(action, data);
}

// ===================================================
// CARGA DE DATOS
// ===================================================

async function cargarTodosLosDatos() {
    console.log('🔄 Cargando todos los datos...');
    try {
        const vendedoresRes = await callAPI('getAllVendedores');
        if (vendedoresRes.success) allVendedores = vendedoresRes.vendedores || [];
        
        const pedidosRes = await callAPI('getAllPedidos');
        if (pedidosRes.success) allPedidos = pedidosRes.pedidos || [];
        
        const productosRes = await callAPI('getAllProductos');
        if (productosRes.success) allProductos = productosRes.productos || [];
        
        await cargarUsuarios();
        
        actualizarDashboard();
        renderizarVendedores();
        renderizarPedidos();
        renderizarProductos();
        cargarFiltros();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

async function actualizarDatosManual() {
    const btnRefresh = document.getElementById('btn-refresh-data');
    await withLoading(btnRefresh, async () => {
        mostrarToast('Actualizando datos...', 'info');
        try {
            const vendedoresRes = await callAPI('getAllVendedores');
            if (vendedoresRes.success) allVendedores = vendedoresRes.vendedores || [];
            const pedidosRes = await callAPI('getAllPedidos');
            if (pedidosRes.success) allPedidos = pedidosRes.pedidos || [];
            const productosRes = await callAPI('getAllProductos');
            if (productosRes.success) allProductos = productosRes.productos || [];
            await cargarUsuarios();
            actualizarDashboard(); 
            renderizarVendedores(); 
            renderizarPedidos(); 
            renderizarProductos(); 
            cargarFiltros();
            mostrarToast('Datos actualizados', 'success');
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

// ===================================================
// DASHBOARD
// ===================================================

function actualizarDashboard() {
    // Estadísticas básicas
    document.getElementById('total-vendedores').textContent = allVendedores.length;
    document.getElementById('total-usuarios').textContent = allUsuarios.length;
    document.getElementById('total-pedidos').textContent = allPedidos.length;
    document.getElementById('total-productos').textContent = allProductos.length;
    const ingresos = allPedidos.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
    document.getElementById('total-ingresos').textContent = formatearPrecio(ingresos);
    
    // TOP 10 VENDEDORES (por ingresos)
    const ventasPorVendedor = {};
    allPedidos.forEach(p => {
        const nombre = p.vendedor_nombre || 'Desconocido';
        const id = p.vendedor_id;
        if (!ventasPorVendedor[id]) {
            ventasPorVendedor[id] = { nombre: nombre, ingresos: 0, pedidos: 0 };
        }
        ventasPorVendedor[id].ingresos += parseFloat(p.total) || 0;
        ventasPorVendedor[id].pedidos++;
    });
    
    const topVendedores = Object.entries(ventasPorVendedor)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.ingresos - a.ingresos)
        .slice(0, 10);
    
    const topVendedoresContainer = document.getElementById('top-vendedores-list');
    if (topVendedoresContainer) {
        if (topVendedores.length === 0) {
            topVendedoresContainer.innerHTML = '<div class="loading-text">No hay datos de ventas</div>';
        } else {
            topVendedoresContainer.innerHTML = topVendedores.map((v, index) => {
                let posClass = '';
                if (index === 0) posClass = 'top-1';
                else if (index === 1) posClass = 'top-2';
                else if (index === 2) posClass = 'top-3';
                
                return `
                    <div class="top-vendedor-item">
                        <div class="top-vendedor-nombre">
                            <div class="top-vendedor-posicion ${posClass}">${index + 1}</div>
                            <div class="top-vendedor-info">
                                <strong>${escapeHTML(v.nombre)}</strong>
                                <small>${v.pedidos} pedidos</small>
                            </div>
                        </div>
                        <div class="top-vendedor-ingresos">${formatearPrecio(v.ingresos)}</div>
                    </div>
                `;
            }).join('');
        }
    }
    
    // TOP 5 PRODUCTOS
    const ventasPorProducto = {};
    allPedidos.forEach(p => {
        if (p.productos) {
            p.productos.forEach(prod => {
                const nombre = prod.nombre;
                if (!ventasPorProducto[nombre]) {
                    ventasPorProducto[nombre] = { cantidad: 0, ingresos: 0 };
                }
                ventasPorProducto[nombre].cantidad += prod.cantidad;
                ventasPorProducto[nombre].ingresos += (prod.precio * prod.cantidad);
            });
        }
    });
    const topProductos = Object.entries(ventasPorProducto)
        .map(([nombre, data]) => ({ nombre, ...data }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);
    
    const topProductosContainer = document.getElementById('top-productos-list');
    if (topProductosContainer) {
        if (topProductos.length === 0) {
            topProductosContainer.innerHTML = '<div class="loading-text">No hay datos</div>';
        } else {
            topProductosContainer.innerHTML = topProductos.map(p => `
                <div class="top-item">
                    <span>${escapeHTML(p.nombre)}</span>
                    <span>${p.cantidad} unidades (${formatearPrecio(p.ingresos)})</span>
                </div>
            `).join('');
        }
    }
    
    // TOP 5 USUARIOS
    const topUsuarios = [...allUsuarios]
        .sort((a, b) => (b.total_gastado || 0) - (a.total_gastado || 0))
        .slice(0, 5);
    
    const topUsuariosContainer = document.getElementById('top-usuarios-list');
    if (topUsuariosContainer) {
        if (topUsuarios.length === 0) {
            topUsuariosContainer.innerHTML = '<div class="loading-text">No hay datos</div>';
        } else {
            topUsuariosContainer.innerHTML = topUsuarios.map(u => `
                <div class="top-item">
                    <span>${escapeHTML(u.nombre)} ${escapeHTML(u.apellido || '')}</span>
                    <span>${formatearPrecio(u.total_gastado || 0)}</span>
                </div>
            `).join('');
        }
    }
}

// ===================================================
// VENDEDORES
// ===================================================

function renderizarVendedores() {
    const tbody = document.getElementById('vendedores-tbody');
    if (!tbody) return;
    const stats = {};
    allPedidos.forEach(p => { const id = p.vendedor_id; if (!stats[id]) stats[id] = { pedidos: 0, ingresos: 0 }; stats[id].pedidos++; stats[id].ingresos += parseFloat(p.total) || 0; });
    
    tbody.innerHTML = allVendedores.map(v => `
        <tr>
            <td>${v.id}</td>
            <td><strong>${escapeHTML(v.nombre)}</strong></td>
            <td>${escapeHTML(v.email || '-')}</td>
            <td>${v.telefono || '-'}</td>
            <td>${escapeHTML(v.direccion || '-')}</td>
            <td>${formatearRubrosParaLista(v.rubros)}</td>
            <td><span class="status-badge ${v.activo === true ? 'status-activo' : 'status-inactivo'}">${v.activo === true ? 'Activo' : 'Inactivo'}</span></td>
            <td><span class="status-badge ${v.estado_abierto === true ? 'status-abierto' : 'status-cerrado'}">${v.estado_abierto === true ? 'Atendiendo' : 'Cerrado'}</span></td>
            <td>${stats[v.id]?.pedidos || 0}</td>
            <td>${formatearPrecio(stats[v.id]?.ingresos || 0)}</td>
            <td>
                <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-toggle-status" onclick="toggleVendedorStatus(${v.id}, this)"><i class="fas fa-${v.activo === true ? 'ban' : 'check-circle'}"></i> ${v.activo === true ? 'Suspender' : 'Habilitar'}</button>
                <button class="btn-delete" onclick="eliminarVendedor(${v.id}, this)"><i class="fas fa-trash"></i> Eliminar</button>
               </td>
          </tr>
    `).join('');
}

function editarVendedor(id) {
    const v = allVendedores.find(v => v.id.toString() === id.toString());
    if (!v) return;
    
    document.getElementById('edit-vendedor-id').value = v.id;
    document.getElementById('edit-vendedor-nombre').value = v.nombre || '';
    document.getElementById('edit-vendedor-email').value = v.email || '';
    document.getElementById('edit-vendedor-telefono').value = v.telefono || '';
    document.getElementById('edit-vendedor-direccion').value = v.direccion || '';
    document.getElementById('edit-vendedor-horario').value = v.horario || '';
    document.getElementById('edit-vendedor-activo').value = v.activo === true ? 'SI' : 'NO';
    document.getElementById('edit-vendedor-estado').value = v.estado_abierto === true ? 'abierto' : 'cerrado';
    
    const rubrosContainer = document.getElementById('edit-vendedor-rubros');
    if (rubrosContainer) {
        rubrosContainer.innerHTML = RUBROS_DISPONIBLES.map(rubro => `
            <label class="rubro-checkbox">
                <input type="checkbox" value="${rubro}" ${(v.rubros || []).includes(rubro) ? 'checked' : ''}>
                <span>${rubro}</span>
            </label>
        `).join('');
    }
    
    document.getElementById('modal-editar-vendedor').classList.add('active');
}

async function guardarEditarVendedor() {
    const btn = document.getElementById('guardar-editar-vendedor');
    await withLoading(btn, async () => {
        const rubrosSeleccionados = [];
        document.querySelectorAll('#edit-vendedor-rubros input[type="checkbox"]:checked').forEach(cb => {
            rubrosSeleccionados.push(cb.value);
        });
        
        const estadoAbierto = document.getElementById('edit-vendedor-estado')?.value === 'abierto';
        
        const data = {
            id: parseInt(document.getElementById('edit-vendedor-id').value),
            nombre: document.getElementById('edit-vendedor-nombre').value.trim(),
            email: document.getElementById('edit-vendedor-email').value.trim(),
            telefono: document.getElementById('edit-vendedor-telefono').value.trim(),
            direccion: document.getElementById('edit-vendedor-direccion').value.trim(),
            horario: document.getElementById('edit-vendedor-horario').value.trim(),
            activo: document.getElementById('edit-vendedor-activo')?.value || 'SI',
            rubros: rubrosSeleccionados,
            estado_abierto: estadoAbierto
        };
        try {
            const res = await callAPI('actualizarVendedor', data);
            if (res && res.success) { 
                mostrarToast('Vendedor actualizado', 'success'); 
                cerrarModal('modal-editar-vendedor'); 
                await actualizarDatosManual(); 
            }
            else { mostrarToast(res?.error || 'Error al actualizar', 'error'); }
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

async function toggleVendedorStatus(id, button) {
    const v = allVendedores.find(v => v.id.toString() === id.toString());
    if (!v) return;
    const nuevoEstado = v.activo === true ? false : true;
    
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    }
    
    try {
        const rubrosArray = v.rubros || [];
        const res = await callAPI('actualizarVendedor', {
            id: id,
            nombre: v.nombre || '',
            email: v.email || '',
            telefono: v.telefono || '',
            direccion: v.direccion || '',
            horario: v.horario || '',
            rubros: rubrosArray,
            activo: nuevoEstado ? 'SI' : 'NO'
        });
        
        if (res && res.success) {
            if (typeof window.guardarLogAuditoria === 'function') {
                await window.guardarLogAuditoria(
                    nuevoEstado ? 'vendedor_habilitado' : 'vendedor_suspendido',
                    'vendedor',
                    id,
                    { estado_nuevo: nuevoEstado }
                );
            }
            mostrarToast(`Vendedor ${nuevoEstado ? 'habilitado' : 'suspendido'}`, 'success');
            await actualizarDatosManual();
        } else {
            mostrarToast(res?.error || 'Error al cambiar estado', 'error');
            if (button) {
                button.disabled = false;
                button.innerHTML = `<i class="fas fa-${v.activo === true ? 'ban' : 'check-circle'}"></i> ${v.activo === true ? 'Suspender' : 'Habilitar'}`;
            }
        }
    } catch (error) {
        mostrarToast('Error al cambiar estado', 'error');
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i class="fas fa-${v.activo === true ? 'ban' : 'check-circle'}"></i> ${v.activo === true ? 'Suspender' : 'Habilitar'}`;
        }
    }
}

function eliminarVendedor(id, button) {
    window.vendedorAEliminar = id;
    document.getElementById('modal-confirmar-vendedor').classList.add('active');
}

async function confirmarEliminarVendedor() {
    if (!window.vendedorAEliminar) return;
    const btn = document.getElementById('confirmar-eliminar-vendedor');
    await withLoading(btn, async () => {
        try {
            const res = await callAPI('eliminarVendedor', { vendedorId: window.vendedorAEliminar });
            if (res && res.success) {
                if (typeof window.guardarLogAuditoria === 'function') {
                    await window.guardarLogAuditoria(
                        'vendedor_eliminado',
                        'vendedor',
                        window.vendedorAEliminar,
                        {}
                    );
                }
                mostrarToast('Vendedor eliminado', 'success');
                cerrarModal('modal-confirmar-vendedor');
                await actualizarDatosManual();
            }
        } catch (error) {
            mostrarToast('Error al eliminar', 'error');
        }
        window.vendedorAEliminar = null;
    });
}

// ===================================================
// PRODUCTOS
// ===================================================

function renderizarProductos() {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    const filtroVendedor = document.getElementById('filtro-vendedor-prod')?.value;
    const searchTerm = document.getElementById('search-producto')?.value.toLowerCase();
    let filtered = [...allProductos];
    if (filtroVendedor) filtered = filtered.filter(p => p.vendedor_id?.toString() === filtroVendedor);
    if (searchTerm) filtered = filtered.filter(p => p.nombre?.toLowerCase().includes(searchTerm) || p.descripcion?.toLowerCase().includes(searchTerm));
    const ventasPorProducto = {};
    allPedidos.forEach(p => { if (p.productos) p.productos.forEach(prod => { const key = `${prod.id}_${p.vendedor_id}`; ventasPorProducto[key] = (ventasPorProducto[key] || 0) + prod.cantidad; }); });
    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.imagen_url ? `<img src="${p.imagen_url}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;">` : '<span>📷</span>'}</td>
            <td><strong>${escapeHTML(p.nombre)}</strong></td>
            <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
            <td>${formatearPrecio(p.precio)}</td>
            <td>${ventasPorProducto[`${p.id}_${p.vendedor_id}`] || 0}</td>
            <td><span class="status-badge ${p.disponible === true ? 'status-activo' : 'status-inactivo'}">${p.disponible === true ? 'Disponible' : 'No disponible'}</span></td>
            <td><button class="btn-edit" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i> Editar</button><button class="btn-delete" onclick="eliminarProducto(${p.id}, this)"><i class="fas fa-trash"></i> Eliminar</button></td>
        </tr>
    `).join('');
}

function editarProducto(id) {
    const p = allProductos.find(p => p.id.toString() === id.toString());
    if (!p) return;
    document.getElementById('edit-producto-id').value = p.id;
    document.getElementById('edit-producto-nombre').value = p.nombre || '';
    document.getElementById('edit-producto-descripcion').value = p.descripcion || '';
    document.getElementById('edit-producto-precio').value = p.precio || '';
    document.getElementById('edit-producto-disponible').value = p.disponible === true ? 'SI' : 'NO';
    document.getElementById('modal-editar-producto').classList.add('active');
}

async function guardarEditarProducto() {
    const btn = document.getElementById('guardar-editar-producto');
    await withLoading(btn, async () => {
        const data = {
            id: parseInt(document.getElementById('edit-producto-id').value),
            nombre: document.getElementById('edit-producto-nombre').value.trim(),
            descripcion: document.getElementById('edit-producto-descripcion').value.trim(),
            precio: parseFloat(document.getElementById('edit-producto-precio').value),
            disponible: document.getElementById('edit-producto-disponible').value
        };
        try {
            const res = await callAPI('actualizarProducto', data);
            if (res && res.success) { 
                mostrarToast('Producto actualizado', 'success'); 
                cerrarModal('modal-editar-producto'); 
                await actualizarDatosManual(); 
            }
            else { mostrarToast(res?.error || 'Error al actualizar', 'error'); }
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

function eliminarProducto(id, button) {
    window.productoAEliminar = id;
    document.getElementById('modal-confirmar-producto').classList.add('active');
}

async function confirmarEliminarProducto() {
    if (!window.productoAEliminar) return;
    const btn = document.getElementById('confirmar-eliminar-producto');
    await withLoading(btn, async () => {
        try {
            const res = await callAPI('eliminarProducto', { productoId: window.productoAEliminar });
            if (res && res.success) { 
                mostrarToast('Producto eliminado', 'success'); 
                cerrarModal('modal-confirmar-producto'); 
                await actualizarDatosManual(); 
            }
            else { mostrarToast(res?.error || 'Error al eliminar', 'error'); }
        } catch (error) { mostrarToast('Error al eliminar', 'error'); }
        window.productoAEliminar = null;
    });
}

// ===================================================
// PEDIDOS
// ===================================================

function renderizarPedidos() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;
    let filtered = [...allPedidos];
    const filtroVendedor = document.getElementById('filtro-vendedor')?.value;
    const filtroEstado = document.getElementById('filtro-estado')?.value;
    const filtroFecha = document.getElementById('filtro-fecha')?.value;
    if (filtroVendedor) filtered = filtered.filter(p => p.vendedor_id?.toString() === filtroVendedor);
    if (filtroEstado) filtered = filtered.filter(p => p.estado === filtroEstado);
    if (filtroFecha) filtered = filtered.filter(p => p.fecha && p.fecha.split('T')[0] === filtroFecha);
    filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    tbody.innerHTML = filtered.slice(0, 100).map(p => `
        <tr>
            <td>#${p.id}</td>
            <td>${formatearFecha(p.fecha)}</td>
            <td>${escapeHTML(p.cliente_nombre || 'N/A')}</td>
            <td>${escapeHTML(p.vendedor_nombre || 'N/A')}</td>
            <td>${formatearPrecio(p.total)}</td>
            <td><span class="status-badge status-${p.estado || 'preparando'}">${getEstadoTexto(p.estado)}</span></td>
            <td>${p.productos ? p.productos.length : 0} productos</td>
            <td><button class="btn-edit" onclick="editarPedido(${p.id})"><i class="fas fa-edit"></i> Editar</button><button class="btn-delete" onclick="eliminarPedido(${p.id}, this)"><i class="fas fa-trash"></i> Eliminar</button></td>
        </tr>
    `).join('');
}

function editarPedido(id) {
    const p = allPedidos.find(p => p.id.toString() === id.toString());
    if (!p) return;
    document.getElementById('edit-pedido-id').value = p.id;
    document.getElementById('edit-pedido-cliente').value = p.cliente_nombre || '';
    document.getElementById('edit-pedido-telefono').value = p.cliente_telefono || '';
    document.getElementById('edit-pedido-direccion').value = p.direccion || '';
    document.getElementById('edit-pedido-total').value = p.total || '';
    document.getElementById('edit-pedido-estado').value = p.estado || 'preparando';
    document.getElementById('modal-editar-pedido').classList.add('active');
}

async function guardarEditarPedido() {
    const btn = document.getElementById('guardar-editar-pedido');
    await withLoading(btn, async () => {
        const id = document.getElementById('edit-pedido-id').value;
        const nuevoEstado = document.getElementById('edit-pedido-estado').value;
        try {
            const res = await callAPI('actualizarEstado', { pedidoId: parseInt(id), estado: nuevoEstado });
            if (res && res.success) { 
                mostrarToast('Pedido actualizado', 'success'); 
                cerrarModal('modal-editar-pedido'); 
                await actualizarDatosManual(); 
            }
            else { mostrarToast(res?.error || 'Error al actualizar', 'error'); }
        } catch (error) { mostrarToast('Error al actualizar', 'error'); }
    });
}

function eliminarPedido(id, button) {
    window.pedidoAEliminar = id;
    document.getElementById('modal-confirmar-pedido').classList.add('active');
}

async function confirmarEliminarPedido() {
    if (!window.pedidoAEliminar) return;
    const btn = document.getElementById('confirmar-eliminar-pedido');
    await withLoading(btn, async () => {
        try {
            const res = await callAPI('cancelarPedido', { pedidoId: window.pedidoAEliminar });
            if (res && res.success) { 
                mostrarToast('Pedido eliminado', 'success'); 
                cerrarModal('modal-confirmar-pedido'); 
                await actualizarDatosManual(); 
            }
            else { mostrarToast(res?.error || 'Error al eliminar', 'error'); }
        } catch (error) { mostrarToast('Error al eliminar', 'error'); }
        window.pedidoAEliminar = null;
    });
}

// ===================================================
// BANNERS
// ===================================================

async function cargarBanners() {
    const tbody = document.getElementById('banners-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="loading-text">Cargando banners...</td></tr>';
    
    try {
        const response = await callAPI('getAllBanners');
        if (response.success) {
            banners = response.banners || [];
            renderizarBanners();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="loading-text">Error: ${error.message}</td></tr>`;
    }
}

function renderizarBanners() {
    const tbody = document.getElementById('banners-tbody');
    if (!tbody) return;
    
    if (banners.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No hay banners registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = banners.map(b => `
        <tr>
            <td>${b.id}</td>
            <td><img src="${b.imagen_url}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 8px;"></td>
            <td>${escapeHTML(b.titulo || '-')}</td>
            <td>${b.orden || 999}</td>
            <td><span class="status-badge ${b.activo === true ? 'status-activo' : 'status-inactivo'}">${b.activo === true ? 'Activo' : 'Inactivo'}</span></td>
            <td>
                <button class="btn-edit" onclick="editarBanner(${b.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-delete" onclick="eliminarBanner(${b.id}, this)"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function abrirModalBanner(bannerId = null) {
    if (bannerId) {
        const banner = banners.find(b => b.id.toString() === bannerId.toString());
        if (banner) {
            document.getElementById('banner-id').value = banner.id;
            document.getElementById('banner-titulo').value = banner.titulo || '';
            document.getElementById('banner-link').value = banner.link || '';
            document.getElementById('banner-orden').value = banner.orden || 999;
            document.getElementById('banner-activo').value = banner.activo === true ? 'SI' : 'NO';
            const preview = document.getElementById('banner-imagen-preview');
            if (preview && banner.imagen_url) {
                preview.innerHTML = `<img src="${banner.imagen_url}" style="max-width: 150px; border-radius: 8px;">`;
            }
            document.getElementById('modal-banner-title').textContent = 'Editar banner';
        }
    } else {
        document.getElementById('banner-form').reset();
        document.getElementById('banner-id').value = '';
        document.getElementById('banner-imagen-preview').innerHTML = '';
        document.getElementById('banner-orden').value = 999;
        document.getElementById('banner-activo').value = 'SI';
        document.getElementById('modal-banner-title').textContent = 'Nuevo banner';
    }
    
    const selectVendedor = document.getElementById('banner-vendedor');
    if (selectVendedor && allVendedores.length) {
        selectVendedor.innerHTML = '<option value="">Todos los vendedores</option>' + 
            allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    }
    
    document.getElementById('modal-banner').classList.add('active');
}

function cerrarModalBanner() {
    document.getElementById('modal-banner').classList.remove('active');
}

function editarBanner(id) {
    abrirModalBanner(id);
}

async function guardarBanner() {
    const id = document.getElementById('banner-id').value;
    const titulo = document.getElementById('banner-titulo').value.trim();
    const link = document.getElementById('banner-link').value.trim();
    const orden = parseInt(document.getElementById('banner-orden').value) || 999;
    const activo = document.getElementById('banner-activo').value;
    const vendedorId = document.getElementById('banner-vendedor').value;
    const imagenFile = document.getElementById('banner-imagen').files[0];
    
    let imagenUrl = null;
    
    if (imagenFile) {
        mostrarToast('Subiendo imagen...', 'info');
        const formData = new FormData();
        formData.append('file', imagenFile);
        formData.append('upload_preset', 'want_productos');
        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/dlsmvyz8r/image/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            imagenUrl = data.secure_url;
        } catch (error) {
            mostrarToast('Error al subir imagen', 'error');
            return;
        }
        if (!imagenUrl) {
            mostrarToast('Error al subir imagen', 'error');
            return;
        }
    } else if (!id) {
        mostrarToast('Debes seleccionar una imagen', 'error');
        return;
    }
    
    const data = {
        titulo: titulo,
        link: link,
        orden: orden,
        activo: activo
    };
    
    if (vendedorId) data.vendedor_id = vendedorId;
    if (imagenUrl) data.imagen_url = imagenUrl;
    if (id) data.id = parseInt(id);
    
    const action = id ? 'actualizarBanner' : 'crearBanner';
    
    try {
        const response = await callAPI(action, data);
        if (response && response.success) {
            mostrarToast(id ? 'Banner actualizado' : 'Banner creado', 'success');
            cerrarModalBanner();
            await cargarBanners();
        } else {
            throw new Error(response?.error || 'Error al guardar');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
    }
}

async function eliminarBanner(bannerId, button) {
    if (!confirm('¿Eliminar este banner?')) return;
    
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    try {
        const response = await callAPI('eliminarBanner', { bannerId });
        if (response.success) {
            mostrarToast('Banner eliminado', 'success');
            await cargarBanners();
        } else {
            throw new Error(response?.error || 'Error al eliminar');
        }
    } catch (error) {
        mostrarToast(error.message, 'error');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        }
    }
}

// ===================================================
// FILTROS Y EXPORTAR
// ===================================================

function cargarFiltros() {
    const options = '<option value="">Todos los vendedores</option>' + allVendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nombre)}</option>`).join('');
    const filtroVendedor = document.getElementById('filtro-vendedor');
    const filtroVendedorProd = document.getElementById('filtro-vendedor-prod');
    if (filtroVendedor) filtroVendedor.innerHTML = options;
    if (filtroVendedorProd) filtroVendedorProd.innerHTML = options;
}

async function exportarVendedores() {
    const btn = document.getElementById('export-vendedores');
    await withLoading(btn, async () => {
        const data = allVendedores.map(v => ({ 
            ID: v.id, 
            Nombre: v.nombre, 
            Email: v.email, 
            Telefono: v.telefono,
            Direccion: v.direccion,
            Rubros: (v.rubros || []).join(', '),
            Estado_activo: v.activo === true ? 'Activo' : 'Inactivo',
            Estado_atencion: v.estado_abierto === true ? 'Atendiendo' : 'Cerrado',
            Horario: v.horario,
            Pedidos: allPedidos.filter(p => p.vendedor_id === v.id).length,
            Ingresos: allPedidos.filter(p => p.vendedor_id === v.id).reduce((s, p) => s + (parseFloat(p.total) || 0), 0)
        }));
        downloadCSV(data, 'vendedores_want.csv');
    });
}

async function exportarUsuarios() {
    const btn = document.getElementById('export-usuarios');
    await withLoading(btn, async () => {
        const pedidosPorUsuario = {};
        allPedidos.forEach(p => {
            if (p.usuario_id) {
                if (!pedidosPorUsuario[p.usuario_id]) pedidosPorUsuario[p.usuario_id] = 0;
                pedidosPorUsuario[p.usuario_id]++;
            }
        });
        
        const data = allUsuarios.map(u => ({
            ID: u.id,
            Nombre: u.nombre,
            Apellido: u.apellido,
            Email: u.email,
            Telefono: u.telefono,
            Provincia: u.provincia,
            Ciudad: u.ciudad,
            Direccion: u.direccion,
            Total_Gastado: u.total_gastado || 0,
            Pedidos: pedidosPorUsuario[u.id] || 0,
            Estado: u.activo === true ? 'Activo' : 'Suspendido',
            Registrado: u.created_at
        }));
        downloadCSV(data, 'usuarios_want.csv');
    });
}

async function exportarPedidos() {
    const btn = document.getElementById('export-pedidos');
    await withLoading(btn, async () => {
        const data = allPedidos.map(p => ({ ID: p.id, Fecha: p.fecha, Cliente: p.cliente_nombre, Telefono: p.cliente_telefono, Vendedor: p.vendedor_nombre, Direccion: p.direccion, MetodoPago: p.metodo_pago, Total: p.total, Estado: p.estado }));
        downloadCSV(data, 'pedidos_want.csv');
    });
}

async function exportarProductos() {
    const btn = document.getElementById('export-productos');
    await withLoading(btn, async () => {
        const data = allProductos.map(p => ({ ID: p.id, Nombre: p.nombre, Vendedor: p.vendedor_nombre, Precio: p.precio, Descripcion: p.descripcion, Disponible: p.disponible === true ? 'Sí' : 'No' }));
        downloadCSV(data, 'productos_want.csv');
    });
}

function downloadCSV(data, filename) {
    if (!data || !data.length) return mostrarToast('No hay datos para exportar', 'error');
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(h => JSON.stringify(obj[h] || '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    mostrarToast('Exportado correctamente', 'success');
}

// ===================================================
// FUNCIONES PARA LOGS DE AUDITORÍA
// ===================================================

async function cargarLogs() {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Cargando logs...</td></tr>';
    
    try {
        const { data, error } = await supabaseClient
            .from('logs_auditoria')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No hay logs registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(log => {
            let detallesTexto = '-';
            if (log.detalles) {
                try {
                    const detalles = typeof log.detalles === 'string' ? JSON.parse(log.detalles) : log.detalles;
                    detallesTexto = Object.entries(detalles).map(([k, v]) => `${k}: ${v}`).join(', ');
                    if (detallesTexto.length > 100) detallesTexto = detallesTexto.substring(0, 100) + '...';
                } catch(e) {
                    detallesTexto = String(log.detalles).substring(0, 100);
                }
            }
            
            let icono = '';
            if (log.accion.includes('eliminado')) icono = '🗑️';
            else if (log.accion.includes('suspendido') || log.accion.includes('habilitado')) icono = '⚠️';
            else if (log.accion.includes('login')) icono = '🔐';
            else icono = '📝';
            
            return `
                <tr>
                    <td style="white-space: nowrap;">${new Date(log.created_at).toLocaleString('es-AR', {timeZone: 'America/Argentina/Buenos_Aires'})}</td>
                    <td><strong>${escapeHTML(log.usuario_email)}</strong><br><small style="color:#888">${log.usuario_tipo}</small></td>
                    <td>${icono} ${escapeHTML(log.accion)}</td>
                    <td>${escapeHTML(log.entidad)} ${log.entidad_id ? `#${log.entidad_id}` : ''}</td>
                    <td><small>${escapeHTML(detallesTexto)}</small></td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando logs:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="loading-text">Error: ${error.message}</td></tr>`;
    }
}

async function exportarLogs() {
    try {
        const { data, error } = await supabaseClient
            .from('logs_auditoria')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            mostrarToast('No hay logs para exportar', 'error');
            return;
        }
        
        const exportData = data.map(log => ({
            Fecha: new Date(log.created_at).toLocaleString('es-AR', {timeZone: 'America/Argentina/Buenos_Aires'}),
            Usuario: log.usuario_email,
            Tipo: log.usuario_tipo,
            Accion: log.accion,
            Entidad: log.entidad,
            EntidadID: log.entidad_id,
            Detalles: log.detalles ? JSON.stringify(log.detalles) : '',
            IP: log.ip_address || ''
        }));
        
        downloadCSV(exportData, 'logs_auditoria_want.csv');
        mostrarToast('Logs exportados', 'success');
        
    } catch (error) {
        console.error('Error exportando logs:', error);
        mostrarToast('Error al exportar', 'error');
    }
}

function cambiarSeccion(seccionId) {
    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
    document.getElementById(`section-${seccionId}`).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === seccionId) item.classList.add('active');
    });
    
    if (seccionId === 'web') {
        cargarBanners();
        if (allVendedores.length === 0) cargarTodosLosDatos();
    }
    if (seccionId === 'usuarios') {
        cargarUsuarios();
    }
    if (seccionId === 'configuracion') {
        cargarLogs();
    }
}

// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Panel Administrativo Global iniciado');
    
    if (typeof supabaseClient === 'undefined') {
        console.error('❌ supabaseClient no está definido');
        return;
    }
    
    await cargarTodosLosDatos();
    iniciarRealtime();
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => cambiarSeccion(item.getAttribute('data-section')));
    });
    
   
    document.getElementById('filtro-vendedor')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-estado')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-fecha')?.addEventListener('change', () => renderizarPedidos());
    document.getElementById('filtro-vendedor-prod')?.addEventListener('change', () => renderizarProductos());
    document.getElementById('search-producto')?.addEventListener('input', () => renderizarProductos());
    
    document.getElementById('btn-agregar-banner')?.addEventListener('click', () => abrirModalBanner());
    document.getElementById('guardar-banner')?.addEventListener('click', guardarBanner);
    
    document.querySelectorAll('.submenu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sub = btn.getAttribute('data-sub');
            document.querySelectorAll('.submenu-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.web-subcontent').forEach(c => c.classList.remove('active'));
            document.getElementById(`sub-${sub}`).classList.add('active');
            if (sub === 'banners') cargarBanners();
        });
    });
    
    const btnRefreshLogs = document.getElementById('btn-refresh-logs');
    if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener('click', () => cargarLogs());
    }
    
    const btnExportLogs = document.getElementById('btn-export-logs');
    if (btnExportLogs) {
        btnExportLogs.addEventListener('click', () => exportarLogs());
    }
    
    // Buscador de vendedores
    document.getElementById('search-vendedor')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allVendedores.filter(v => v.nombre?.toLowerCase().includes(term) || v.email?.toLowerCase().includes(term));
        const tbody = document.getElementById('vendedores-tbody');
        if (!tbody) return;
        if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="11" class="loading-text">No hay vendedores</td></tr>'; return; }
        const stats = {};
        allPedidos.forEach(p => { const id = p.vendedor_id; if (!stats[id]) stats[id] = { pedidos: 0, ingresos: 0 }; stats[id].pedidos++; stats[id].ingresos += parseFloat(p.total) || 0; });
        tbody.innerHTML = filtered.map(v => `
            <tr>
                <td>${v.id}</td>
                <td><strong>${escapeHTML(v.nombre)}</strong></td>
                <td>${escapeHTML(v.email || '-')}</td>
                <td>${v.telefono || '-'}</td>
                <td>${escapeHTML(v.direccion || '-')}</td>
                <td>${formatearRubrosParaLista(v.rubros)}</td>
                <td><span class="status-badge ${v.activo === true ? 'status-activo' : 'status-inactivo'}">${v.activo === true ? 'Activo' : 'Inactivo'}</span></td>
                <td><span class="status-badge ${v.estado_abierto === true ? 'status-abierto' : 'status-cerrado'}">${v.estado_abierto === true ? 'Atendiendo' : 'Cerrado'}</span></td>
                <td>${stats[v.id]?.pedidos || 0}</td>
                <td>${formatearPrecio(stats[v.id]?.ingresos || 0)}</td>
                <td>
                    <button class="btn-edit" onclick="editarVendedor(${v.id})"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-toggle-status" onclick="toggleVendedorStatus(${v.id}, this)"><i class="fas fa-${v.activo === true ? 'ban' : 'check-circle'}"></i> ${v.activo === true ? 'Suspender' : 'Habilitar'}</button>
                    <button class="btn-delete" onclick="eliminarVendedor(${v.id}, this)"><i class="fas fa-trash"></i> Eliminar</button>
                </td>
            </tr>
        `).join('');
    });
    
    // Buscador de usuarios
    document.getElementById('search-usuario')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const pedidosPorUsuario = {};
        allPedidos.forEach(p => {
            if (p.usuario_id) {
                if (!pedidosPorUsuario[p.usuario_id]) pedidosPorUsuario[p.usuario_id] = 0;
                pedidosPorUsuario[p.usuario_id]++;
            }
        });
        
        const filtered = allUsuarios.filter(u => 
            u.nombre?.toLowerCase().includes(term) || 
            u.apellido?.toLowerCase().includes(term) || 
            u.email?.toLowerCase().includes(term)
        );
        const tbody = document.getElementById('usuarios-tbody');
        if (!tbody) return;
        if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="9" class="loading-text">No hay usuarios</td></tr>'; return; }
        tbody.innerHTML = filtered.map(u => `
            <tr>
                <td>${u.id.substring(0, 8)}...</td>
                <td><strong>${escapeHTML(u.nombre)} ${escapeHTML(u.apellido)}</strong></td>
                <td>${escapeHTML(u.email)}</td>
                <td><a href="https://wa.me/${u.telefono}" target="_blank" style="color: #25D366;">${u.telefono}</a></td>
                <td>${escapeHTML(u.direccion)}, ${escapeHTML(u.ciudad)}, ${escapeHTML(u.provincia)}</td>
                <td>${formatearPrecio(u.total_gastado || 0)}</td>
                <td>${pedidosPorUsuario[u.id] || 0}</td>
                <td><span class="status-badge ${u.activo === true ? 'status-activo' : 'status-inactivo'}">${u.activo === true ? 'Activo' : 'Suspendido'}</span></td>
                <td>
                    <button class="btn-edit" onclick="editarUsuario('${u.id}')"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-toggle-status" onclick="suspenderUsuario('${u.id}', ${!u.activo})"><i class="fas fa-${u.activo === true ? 'ban' : 'check-circle'}"></i> ${u.activo === true ? 'Suspender' : 'Habilitar'}</button>
                    <button class="btn-delete" onclick="eliminarUsuario('${u.id}')"><i class="fas fa-trash"></i> Eliminar</button>
                    <a href="https://wa.me/${u.telefono}" target="_blank" class="btn-whatsapp" style="background: #25D366; color: white; padding: 6px 10px; border-radius: 40px; display: inline-block; text-decoration: none; font-size: 0.7rem;"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                </td>
            </tr>
        `).join('');
    });
    
    document.getElementById('export-vendedores')?.addEventListener('click', exportarVendedores);
    document.getElementById('export-usuarios')?.addEventListener('click', exportarUsuarios);
    document.getElementById('export-pedidos')?.addEventListener('click', exportarPedidos);
    document.getElementById('export-productos')?.addEventListener('click', exportarProductos);
    
    document.getElementById('guardar-editar-vendedor')?.addEventListener('click', guardarEditarVendedor);
    document.getElementById('guardar-editar-usuario')?.addEventListener('click', guardarEditarUsuario);
    document.getElementById('guardar-editar-producto')?.addEventListener('click', guardarEditarProducto);
    document.getElementById('guardar-editar-pedido')?.addEventListener('click', guardarEditarPedido);
    document.getElementById('confirmar-eliminar-vendedor')?.addEventListener('click', confirmarEliminarVendedor);
    document.getElementById('confirmar-eliminar-usuario')?.addEventListener('click', confirmarEliminarUsuario);
    document.getElementById('confirmar-eliminar-producto')?.addEventListener('click', confirmarEliminarProducto);
    document.getElementById('confirmar-eliminar-pedido')?.addEventListener('click', confirmarEliminarPedido);
    
    document.querySelectorAll('.modal-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')));
    });
    
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        sessionStorage.removeItem('admin_session');
        window.location.href = 'login.html';
    });
    
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        document.addEventListener('click', (e) => { if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== menuToggle) sidebar.classList.remove('active'); });
    }
});