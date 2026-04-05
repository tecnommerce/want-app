// ===================================================
// SUPABASE - TODO EN UN SOLO ARCHIVO (CORREGIDO)
// ===================================================

(function() {
    // ===================================================
    // 1. CONFIGURACIÓN
    // ===================================================
    
    const SUPABASE_URL = 'https://owrpzmgncfrgatzccjlc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cnB6bWduY2ZyZ2F0emNjamxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjIxNTIsImV4cCI6MjA5MDkzODE1Mn0.TOFcl0_Ua3jpISBKnrNdI4skIFMiyitWv0rLDoTzTkQ';
    
    const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r';
    const CLOUDINARY_UPLOAD_PRESET = 'want_productos';
    
    // ===================================================
    // 2. INICIALIZAR CLIENTE
    // ===================================================
    
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // ===================================================
    // 3. FUNCIONES DE API
    // ===================================================
    
    window.callAPI = async function(action, data = {}, forceRefresh = false) {
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
                    
                case 'getProductos':
                    let query = supabaseClient.from('productos').select('*');
                    if (data.vendedorId) {
                        query = query.eq('vendedor_id', data.vendedorId);
                    }
                    const { data: productos, error: pError } = await query.order('nombre');
                    if (pError) throw pError;
                    return { success: true, productos: productos };
                    
                case 'getPedidos':
                    const { data: pedidos, error: pedError } = await supabaseClient
                        .from('pedidos')
                        .select('*')
                        .eq('vendedor_id', data.vendedorId)
                        .order('fecha', { ascending: false });
                    if (pedError) throw pedError;
                    
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
                    
                case 'loginVendedor':
                    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                        email: data.email,
                        password: data.password
                    });
                    if (authError) throw new Error(authError.message);
                    
                    const { data: vendedor, error: vendError } = await supabaseClient
                        .from('vendedores')
                        .select('*')
                        .eq('email', data.email)
                        .single();
                    if (vendError) throw vendError;
                    return { success: true, vendedor: vendedor };
                    
                case 'registrarVendedor':
                    // 1. Registrar en Auth
                    const { data: authReg, error: authRegError } = await supabaseClient.auth.signUp({
                        email: data.email,
                        password: data.password
                    });
                    if (authRegError) throw authRegError;
                    
                    // 2. Registrar en tabla vendedores
                    const { data: newVendedor, error: vendRegError } = await supabaseClient
                        .from('vendedores')
                        .insert([{
                            nombre: data.nombre,
                            email: data.email,
                            telefono: data.telefono,
                            direccion: data.direccion,
                            horario: data.horario,
                            logo_url: data.logo_url,
                            activo: true
                        }])
                        .select()
                        .single();
                    if (vendRegError) throw vendRegError;
                    
                    return { success: true, vendedor: newVendedor };
                    
                case 'actualizarVendedor':
                    const { error: updateError } = await supabaseClient
                        .from('vendedores')
                        .update({
                            nombre: data.nombre,
                            telefono: data.telefono,
                            direccion: data.direccion,
                            horario: data.horario,
                            logo_url: data.logo_url
                        })
                        .eq('id', data.id);
                    if (updateError) throw updateError;
                    return { success: true };
                    
                case 'crearProducto':
                    const { data: newProducto, error: prodCreateError } = await supabaseClient
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
                    if (prodCreateError) throw prodCreateError;
                    return { success: true, productoId: newProducto.id };
                    
                case 'actualizarProducto':
                    const { error: prodUpdateError } = await supabaseClient
                        .from('productos')
                        .update({
                            nombre: data.nombre,
                            descripcion: data.descripcion,
                            precio: data.precio,
                            imagen_url: data.imagen_url,
                            disponible: data.disponible === 'SI'
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
                    
                case 'crearPedido':
                    const { data: ultimoPedido } = await supabaseClient
                        .from('pedidos')
                        .select('numero_orden')
                        .eq('vendedor_id', data.vendedor_id)
                        .order('numero_orden', { ascending: false })
                        .limit(1);
                    const numeroOrden = (ultimoPedido && ultimoPedido[0]?.numero_orden || 0) + 1;
                    
                    const { data: pedidoNuevo, error: pedCreateError } = await supabaseClient
                        .from('pedidos')
                        .insert([{
                            vendedor_id: data.vendedor_id,
                            cliente_nombre: data.cliente_nombre,
                            cliente_telefono: data.cliente_telefono,
                            direccion: data.direccion,
                            metodo_pago: data.metodo_pago,
                            detalles: data.detalles || '',
                            total: data.total,
                            estado: 'preparando',
                            numero_orden: numeroOrden
                        }])
                        .select()
                        .single();
                    if (pedCreateError) throw pedCreateError;
                    
                    for (const producto of data.productos) {
                        await supabaseClient
                            .from('productos_pedido')
                            .insert([{
                                pedido_id: pedidoNuevo.id,
                                producto_id: producto.id,
                                cantidad: producto.cantidad,
                                precio_unitario: producto.precio
                            }]);
                    }
                    return { success: true, pedidoId: pedidoNuevo.id, numeroOrden: numeroOrden };
                    
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
                    
                case 'getDeliveries':
                    const { data: deliveries, error: delError } = await supabaseClient
                        .from('delivery')
                        .select('*')
                        .eq('vendedor_id', data.vendedorId)
                        .eq('activo', true);
                    if (delError) throw delError;
                    return { success: true, deliveries: deliveries };
                    
                case 'crearDelivery':
                    const { data: newDelivery, error: delCreateError } = await supabaseClient
                        .from('delivery')
                        .insert([{
                            vendedor_id: data.vendedor_id,
                            nombre: data.nombre,
                            telefono: data.telefono
                        }])
                        .select()
                        .single();
                    if (delCreateError) throw delCreateError;
                    return { success: true, deliveryId: newDelivery.id };
                    
                case 'eliminarDelivery':
                    const { error: delDeleteError } = await supabaseClient
                        .from('delivery')
                        .update({ activo: false })
                        .eq('id', data.deliveryId);
                    if (delDeleteError) throw delDeleteError;
                    return { success: true };
                    
                case 'getBanners':
                    let bannersQuery = supabaseClient.from('banners').select('*').eq('activo', true).order('orden');
                    if (data.vendedorId) {
                        bannersQuery = bannersQuery.eq('vendedor_id', data.vendedorId);
                    }
                    const { data: banners, error: banError } = await bannersQuery;
                    if (banError) throw banError;
                    return { success: true, banners: banners };
                    
                case 'getAllBanners':
                    const { data: allBanners, error: allBanError } = await supabaseClient
                        .from('banners')
                        .select('*')
                        .order('orden');
                    if (allBanError) throw allBanError;
                    return { success: true, banners: allBanners };
                    
                case 'crearBanner':
                    const { data: newBanner, error: banCreateError } = await supabaseClient
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
                    if (banCreateError) throw banCreateError;
                    return { success: true, bannerId: newBanner.id };
                    
                case 'actualizarBanner':
                    const { error: banUpdateError } = await supabaseClient
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
                    if (banUpdateError) throw banUpdateError;
                    return { success: true };
                    
                case 'eliminarBanner':
                    const { error: banDeleteError } = await supabaseClient
                        .from('banners')
                        .delete()
                        .eq('id', data.bannerId);
                    if (banDeleteError) throw banDeleteError;
                    return { success: true };
                    
                default:
                    console.warn(`⚠️ Acción no implementada: ${action}`);
                    return { success: false, error: `Acción no implementada: ${action}` };
            }
        } catch (error) {
            console.error(`❌ Error en ${action}:`, error);
            return { success: false, error: error.message };
        }
    };
    
    window.postAPI = window.callAPI;
    
    // ===================================================
    // 4. NAVEGACIÓN ENTRE PANELES DE AUTENTICACIÓN
    // ===================================================
    
    window.mostrarPanelLogin = function() {
        const panels = document.querySelectorAll('.auth-panel');
        if (panels.length) {
            panels.forEach(panel => panel.classList.remove('active'));
            const loginPanel = document.getElementById('login-panel');
            if (loginPanel) loginPanel.classList.add('active');
        }
    };
    
    window.mostrarPanelRegistro = function() {
        const panels = document.querySelectorAll('.auth-panel');
        if (panels.length) {
            panels.forEach(panel => panel.classList.remove('active'));
            const registerPanel = document.getElementById('register-panel');
            if (registerPanel) registerPanel.classList.add('active');
        }
    };
    
    window.mostrarPanelRecuperacion = function() {
        const panels = document.querySelectorAll('.auth-panel');
        if (panels.length) {
            panels.forEach(panel => panel.classList.remove('active'));
            const recoverPanel = document.getElementById('recover-panel');
            if (recoverPanel) recoverPanel.classList.add('active');
        }
    };
    
    console.log('✅ Supabase API inicializada');
    console.log('✅ Funciones de navegación de autenticación inicializadas');
})();