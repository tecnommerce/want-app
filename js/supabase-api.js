// ===================================================
// SUPABASE API - Reemplazo completo de utils.js
// ===================================================

// ===================================================
// FUNCIONES DE AUTENTICACIÓN
// ===================================================

async function loginVendedor(email, password) {
    try {
        // Primero autenticar con Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (authError) throw new Error(authError.message);
        
        // Obtener datos del vendedor desde la tabla
        const { data: vendedor, error: vendedorError } = await supabase
            .from('vendedores')
            .select('*')
            .eq('email', email)
            .single();
        
        if (vendedorError) throw new Error(vendedorError.message);
        
        return { success: true, vendedor: vendedor };
    } catch (error) {
        console.error('Error login:', error);
        return { success: false, error: error.message };
    }
}

async function registrarVendedor(datos) {
    try {
        // Registrar en Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: datos.email,
            password: datos.password
        });
        
        if (authError) throw new Error(authError.message);
        
        // Registrar en tabla vendedores
        const { data: vendedor, error: vendedorError } = await supabase
            .from('vendedores')
            .insert([{
                nombre: datos.nombre,
                email: datos.email,
                telefono: datos.telefono,
                direccion: datos.direccion,
                horario: datos.horario,
                logo_url: datos.logo_url,
                password_hash: datos.password_hash
            }])
            .select()
            .single();
        
        if (vendedorError) throw new Error(vendedorError.message);
        
        return { success: true, vendedor: vendedor };
    } catch (error) {
        console.error('Error registro:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// FUNCIONES DE VENDEDORES
// ===================================================

async function getVendedores() {
    try {
        const { data, error } = await supabase
            .from('vendedores')
            .select('*')
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        return { success: true, vendedores: data };
    } catch (error) {
        console.error('Error getVendedores:', error);
        return { success: false, error: error.message };
    }
}

async function actualizarVendedor(data) {
    try {
        const { error } = await supabase
            .from('vendedores')
            .update({
                nombre: data.nombre,
                telefono: data.telefono,
                direccion: data.direccion,
                horario: data.horario,
                logo_url: data.logo_url
            })
            .eq('id', data.id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error actualizarVendedor:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// FUNCIONES DE PRODUCTOS
// ===================================================

async function getProductos(vendedorId) {
    try {
        let query = supabase.from('productos').select('*');
        
        if (vendedorId) {
            query = query.eq('vendedor_id', vendedorId);
        }
        
        const { data, error } = await query.order('nombre');
        
        if (error) throw error;
        return { success: true, productos: data };
    } catch (error) {
        console.error('Error getProductos:', error);
        return { success: false, error: error.message };
    }
}

async function crearProducto(data) {
    try {
        const { data: producto, error } = await supabase
            .from('productos')
            .insert([{
                vendedor_id: data.vendedor_id,
                nombre: data.nombre,
                descripcion: data.descripcion,
                precio: data.precio,
                imagen_url: data.imagen_url,
                disponible: data.disponible === 'SI'
            }])
            .select()
            .single();
        
        if (error) throw error;
        return { success: true, productoId: producto.id };
    } catch (error) {
        console.error('Error crearProducto:', error);
        return { success: false, error: error.message };
    }
}

async function actualizarProducto(data) {
    try {
        const { error } = await supabase
            .from('productos')
            .update({
                nombre: data.nombre,
                descripcion: data.descripcion,
                precio: data.precio,
                imagen_url: data.imagen_url,
                disponible: data.disponible === 'SI'
            })
            .eq('id', data.id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error actualizarProducto:', error);
        return { success: false, error: error.message };
    }
}

async function eliminarProducto(productoId) {
    try {
        const { error } = await supabase
            .from('productos')
            .delete()
            .eq('id', productoId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error eliminarProducto:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// FUNCIONES DE PEDIDOS
// ===================================================

async function getPedidos(vendedorId) {
    try {
        const { data, error } = await supabase
            .from('pedidos')
            .select('*')
            .eq('vendedor_id', vendedorId)
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        
        // Obtener productos de cada pedido
        for (const pedido of data) {
            const { data: productos, error: prodError } = await supabase
                .from('productos_pedido')
                .select(`
                    cantidad,
                    precio_unitario,
                    productos (id, nombre, precio)
                `)
                .eq('pedido_id', pedido.id);
            
            if (!prodError && productos) {
                pedido.productos = productos.map(pp => ({
                    id: pp.productos.id,
                    nombre: pp.productos.nombre,
                    precio: pp.precio_unitario,
                    cantidad: pp.cantidad
                }));
            } else {
                pedido.productos = [];
            }
        }
        
        return { success: true, pedidos: data };
    } catch (error) {
        console.error('Error getPedidos:', error);
        return { success: false, error: error.message };
    }
}

async function crearPedido(pedido) {
    try {
        // 1. Calcular número de orden para este vendedor
        const { data: ultimoPedido } = await supabase
            .from('pedidos')
            .select('numero_orden')
            .eq('vendedor_id', pedido.vendedor_id)
            .order('numero_orden', { ascending: false })
            .limit(1);
        
        const numeroOrden = (ultimoPedido && ultimoPedido[0]?.numero_orden || 0) + 1;
        
        // 2. Insertar pedido
        const { data: nuevoPedido, error: pedidoError } = await supabase
            .from('pedidos')
            .insert([{
                vendedor_id: pedido.vendedor_id,
                cliente_nombre: pedido.cliente_nombre,
                cliente_telefono: pedido.cliente_telefono,
                direccion: pedido.direccion,
                metodo_pago: pedido.metodo_pago,
                detalles: pedido.detalles || '',
                total: pedido.total,
                estado: 'preparando',
                numero_orden: numeroOrden
            }])
            .select()
            .single();
        
        if (pedidoError) throw pedidoError;
        
        // 3. Insertar productos del pedido
        for (const producto of pedido.productos) {
            const { error: prodError } = await supabase
                .from('productos_pedido')
                .insert([{
                    pedido_id: nuevoPedido.id,
                    producto_id: producto.id,
                    cantidad: producto.cantidad,
                    precio_unitario: producto.precio
                }]);
            
            if (prodError) throw prodError;
        }
        
        return { success: true, pedidoId: nuevoPedido.id, numeroOrden: numeroOrden };
    } catch (error) {
        console.error('Error crearPedido:', error);
        return { success: false, error: error.message };
    }
}

async function actualizarEstado(pedidoId, nuevoEstado) {
    try {
        const { error } = await supabase
            .from('pedidos')
            .update({ estado: nuevoEstado })
            .eq('id', pedidoId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error actualizarEstado:', error);
        return { success: false, error: error.message };
    }
}

async function cancelarPedido(pedidoId) {
    try {
        const { error } = await supabase
            .from('pedidos')
            .delete()
            .eq('id', pedidoId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error cancelarPedido:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// FUNCIONES DE DELIVERY
// ===================================================

async function getDeliveries(vendedorId) {
    try {
        const { data, error } = await supabase
            .from('delivery')
            .select('*')
            .eq('vendedor_id', vendedorId)
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        return { success: true, deliveries: data };
    } catch (error) {
        console.error('Error getDeliveries:', error);
        return { success: false, error: error.message };
    }
}

async function crearDelivery(data) {
    try {
        const { data: delivery, error } = await supabase
            .from('delivery')
            .insert([{
                vendedor_id: data.vendedor_id,
                nombre: data.nombre,
                telefono: data.telefono
            }])
            .select()
            .single();
        
        if (error) throw error;
        return { success: true, deliveryId: delivery.id };
    } catch (error) {
        console.error('Error crearDelivery:', error);
        return { success: false, error: error.message };
    }
}

async function eliminarDelivery(deliveryId) {
    try {
        const { error } = await supabase
            .from('delivery')
            .update({ activo: false })
            .eq('id', deliveryId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error eliminarDelivery:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// FUNCIONES DE BANNERS
// ===================================================

async function getBanners(vendedorId = null) {
    try {
        let query = supabase.from('banners').select('*').eq('activo', true).order('orden');
        
        if (vendedorId) {
            query = query.eq('vendedor_id', vendedorId);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return { success: true, banners: data };
    } catch (error) {
        console.error('Error getBanners:', error);
        return { success: false, error: error.message };
    }
}

async function getAllBanners() {
    try {
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .order('orden');
        
        if (error) throw error;
        return { success: true, banners: data };
    } catch (error) {
        console.error('Error getAllBanners:', error);
        return { success: false, error: error.message };
    }
}

async function crearBanner(data) {
    try {
        const { data: banner, error } = await supabase
            .from('banners')
            .insert([{
                titulo: data.titulo,
                imagen_url: data.imagen_url,
                link: data.link,
                orden: data.orden,
                activo: data.activo === 'SI',
                vendedor_id: data.vendedor_id || null
            }])
            .select()
            .single();
        
        if (error) throw error;
        return { success: true, bannerId: banner.id };
    } catch (error) {
        console.error('Error crearBanner:', error);
        return { success: false, error: error.message };
    }
}

async function actualizarBanner(data) {
    try {
        const { error } = await supabase
            .from('banners')
            .update({
                titulo: data.titulo,
                imagen_url: data.imagen_url,
                link: data.link,
                orden: data.orden,
                activo: data.activo === 'SI',
                vendedor_id: data.vendedor_id || null
            })
            .eq('id', data.id);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error actualizarBanner:', error);
        return { success: false, error: error.message };
    }
}

async function eliminarBanner(bannerId) {
    try {
        const { error } = await supabase
            .from('banners')
            .delete()
            .eq('id', bannerId);
        
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error eliminarBanner:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// FUNCIÓN DE COMPATIBILIDAD (para no romper el código existente)
// ===================================================

async function callAPI(action, data = {}, forceRefresh = false) {
    console.log(`🔄 Llamando a Supabase: ${action}`);
    
    switch(action) {
        case 'getVendedores':
            return await getVendedores();
        case 'getProductos':
            return await getProductos(data.vendedorId);
        case 'getPedidos':
            return await getPedidos(data.vendedorId);
        case 'getAllPedidos':
            return { success: true, pedidos: [] }; // Implementar si es necesario
        case 'getAllProductos':
            return await getProductos();
        case 'loginVendedor':
            return await loginVendedor(data.email, data.password);
        case 'registrarVendedor':
            return await registrarVendedor(data);
        case 'actualizarVendedor':
            return await actualizarVendedor(data);
        case 'crearProducto':
            return await crearProducto(data);
        case 'actualizarProducto':
            return await actualizarProducto(data);
        case 'eliminarProducto':
            return await eliminarProducto(data.productoId);
        case 'crearPedido':
            return await crearPedido(data);
        case 'actualizarEstado':
            return await actualizarEstado(data.pedidoId, data.estado);
        case 'cancelarPedido':
            return await cancelarPedido(data.pedidoId);
        case 'getDeliveries':
            return await getDeliveries(data.vendedorId);
        case 'crearDelivery':
            return await crearDelivery(data);
        case 'eliminarDelivery':
            return await eliminarDelivery(data.deliveryId);
        case 'getBanners':
            return await getBanners(data.vendedorId);
        case 'getAllBanners':
            return await getAllBanners();
        case 'crearBanner':
            return await crearBanner(data);
        case 'actualizarBanner':
            return await actualizarBanner(data);
        case 'eliminarBanner':
            return await eliminarBanner(data.bannerId);
        default:
            console.warn(`⚠️ Acción no implementada en Supabase: ${action}`);
            return { success: false, error: `Acción no implementada: ${action}` };
    }
}

// También mantener postAPI para compatibilidad
async function postAPI(action, data = {}) {
    return await callAPI(action, data);
}

console.log('✅ Supabase API inicializada');