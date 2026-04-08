// ===================================================
// SUPABASE - VERSIÓN COMPLETA CON AUTENTICACIÓN GOOGLE
// ===================================================

(function() {
    // ===================================================
    // 1. CONFIGURACIÓN
    // ===================================================
    
    const SUPABASE_URL = 'https://owrpzmgncfrgatzccjlc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cnB6bWduY2ZyZ2F0emNjamxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjIxNTIsImV4cCI6MjA5MDkzODE1Mn0.TOFcl0_Ua3jpISBKnrNdI4skIFMiyitWv0rLDoTzTkQ';
    
    const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r';
    const CLOUDINARY_UPLOAD_PRESET = 'want_productos';
    
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient;
    
    // ===================================================
    // 2. LISTA DE RUBROS DISPONIBLES (con Pancheria)
    // ===================================================
    
    window.RUBROS_DISPONIBLES = [
        'Sandwichería', 'Hamburguesería', 'Pizzería', 'Empanadas', 'Pancheria',
        'Comida casera', 'Kiosco', 'Bebidas', 'Despensa', 'Supermercado',
        'Panadería', 'Verdulería', 'Pollería', 'Carnicería', 'Cafetería',
        'Bar', 'Restaurante', 'Bar y café', 'Heladería', 'Farmacia', 'Mascotas'
    ];
    
    // ===================================================
    // 3. FUNCIONES DE AUTENTICACIÓN CON GOOGLE
    // ===================================================
    
    window.loginWithGoogle = async function() {
        try {
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/index.html'
                }
            });
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error login con Google:', error);
            return { success: false, error: error.message };
        }
    };
    
    window.getCurrentUser = async function() {
        try {
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            if (error) throw error;
            return user;
        } catch (error) {
            return null;
        }
    };
    
    window.signOut = async function() {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            localStorage.removeItem('want_usuario_sesion');
            sessionStorage.removeItem('want_usuario_sesion');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.onAuthStateChange = function(callback) {
        return supabaseClient.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    };
    
    // ===================================================
    // 4. FUNCIONES DE USUARIO
    // ===================================================
    
    window.crearOActualizarUsuario = async function(usuarioData) {
        try {
            // Verificar si el usuario ya existe
            const { data: existingUser, error: findError } = await supabaseClient
                .from('usuarios')
                .select('*')
                .eq('auth_id', usuarioData.auth_id)
                .single();
            
            if (findError && findError.code !== 'PGRST116') {
                throw findError;
            }
            
            if (existingUser) {
                // Actualizar usuario existente
                const { data, error } = await supabaseClient
                    .from('usuarios')
                    .update({
                        nombre: usuarioData.nombre,
                        apellido: usuarioData.apellido,
                        provincia: usuarioData.provincia,
                        ciudad: usuarioData.ciudad,
                        direccion: usuarioData.direccion,
                        telefono: usuarioData.telefono,
                        foto_perfil: usuarioData.foto_perfil,
                        updated_at: new Date()
                    })
                    .eq('auth_id', usuarioData.auth_id)
                    .select()
                    .single();
                
                if (error) throw error;
                return { success: true, usuario: data, isNew: false };
            } else {
                // Crear nuevo usuario
                const { data, error } = await supabaseClient
                    .from('usuarios')
                    .insert([{
                        auth_id: usuarioData.auth_id,
                        email: usuarioData.email,
                        nombre: usuarioData.nombre,
                        apellido: usuarioData.apellido,
                        provincia: usuarioData.provincia,
                        ciudad: usuarioData.ciudad,
                        direccion: usuarioData.direccion,
                        telefono: usuarioData.telefono,
                        foto_perfil: usuarioData.foto_perfil,
                        total_gastado: 0,
                        activo: true
                    }])
                    .select()
                    .single();
                
                if (error) throw error;
                return { success: true, usuario: data, isNew: true };
            }
        } catch (error) {
            console.error('Error creando/actualizando usuario:', error);
            return { success: false, error: error.message };
        }
    };
    
    window.obtenerUsuarioPorAuthId = async function(authId) {
        try {
            const { data, error } = await supabaseClient
                .from('usuarios')
                .select('*')
                .eq('auth_id', authId)
                .single();
            
            if (error) throw error;
            return { success: true, usuario: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.actualizarDatosUsuario = async function(usuarioId, updateData) {
        try {
            const { data, error } = await supabaseClient
                .from('usuarios')
                .update({
                    ...updateData,
                    updated_at: new Date()
                })
                .eq('id', usuarioId)
                .select()
                .single();
            
            if (error) throw error;
            return { success: true, usuario: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.obtenerPedidosUsuario = async function(usuarioId) {
        try {
            const { data, error } = await supabaseClient
                .from('pedidos')
                .select('*')
                .eq('usuario_id', usuarioId)
                .order('fecha', { ascending: false });
            
            if (error) throw error;
            return { success: true, pedidos: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.obtenerTodosUsuarios = async function() {
        try {
            const { data, error } = await supabaseClient
                .from('usuarios')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return { success: true, usuarios: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.suspenderUsuario = async function(usuarioId, activo) {
        try {
            const { error } = await supabaseClient
                .from('usuarios')
                .update({ activo: activo })
                .eq('id', usuarioId);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.eliminarUsuario = async function(usuarioId) {
        try {
            const { error } = await supabaseClient
                .from('usuarios')
                .delete()
                .eq('id', usuarioId);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    window.actualizarTotalGastado = async function(usuarioId, monto) {
        try {
            // Obtener usuario actual
            const { data: usuario, error: findError } = await supabaseClient
                .from('usuarios')
                .select('total_gastado')
                .eq('id', usuarioId)
                .single();
            
            if (findError) throw findError;
            
            const nuevoTotal = (usuario.total_gastado || 0) + monto;
            
            const { error } = await supabaseClient
                .from('usuarios')
                .update({ total_gastado: nuevoTotal })
                .eq('id', usuarioId);
            
            if (error) throw error;
            return { success: true, total_gastado: nuevoTotal };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    
    // ===================================================
    // 5. FUNCIONES DE API EXISTENTES (MODIFICADAS)
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
                    
                case 'getAllVendedores':
                    const { data: allVendedores, error: allVError } = await supabaseClient
                        .from('vendedores')
                        .select('*')
                        .order('nombre');
                    if (allVError) throw allVError;
                    return { success: true, vendedores: allVendedores };
                    
                case 'getProductos':
                    let query = supabaseClient.from('productos').select('*');
                    if (data.vendedorId) {
                        query = query.eq('vendedor_id', data.vendedorId);
                    }
                    const { data: productos, error: pError } = await query.order('nombre');
                    if (pError) throw pError;
                    return { success: true, productos: productos };
                    
                case 'getPedidos':
                    let pedidosQuery = supabaseClient.from('pedidos').select('*');
                    if (data.vendedorId) {
                        pedidosQuery = pedidosQuery.eq('vendedor_id', data.vendedorId);
                    }
                    if (data.usuarioId) {
                        pedidosQuery = pedidosQuery.eq('usuario_id', data.usuarioId);
                    }
                    const { data: pedidos, error: pedError } = await pedidosQuery.order('fecha', { ascending: false });
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
                            numero_orden: numeroOrden,
                            usuario_id: data.usuario_id || null
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
                    
                    // Actualizar total gastado del usuario
                    if (data.usuario_id) {
                        await window.actualizarTotalGastado(data.usuario_id, data.total);
                    }
                    
                    return { success: true, pedidoId: pedidoNuevo.id, numeroOrden: numeroOrden };
                    
                case 'actualizarEstado':
                    const { error: estadoError } = await supabaseClient
                        .from('pedidos')
                        .update({ estado: data.estado })
                        .eq('id', data.pedidoId);
                    if (estadoError) throw estadoError;
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
                    
                case 'actualizarDelivery':
                    const { error: delUpdateError } = await supabaseClient
                        .from('delivery')
                        .update({
                            nombre: data.nombre,
                            telefono: data.telefono
                        })
                        .eq('id', data.id);
                    if (delUpdateError) throw delUpdateError;
                    return { success: true };
                    
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
                    let rubrosArray = data.rubros;
                    if (typeof rubrosArray === 'string') {
                        rubrosArray = rubrosArray.split(',').map(r => r.trim());
                    }
                    if (!rubrosArray || rubrosArray.length === 0) {
                        rubrosArray = [];
                    }
                    
                    const { data: authReg, error: authRegError } = await supabaseClient.auth.signUp({
                        email: data.email,
                        password: data.password
                    });
                    if (authRegError) throw authRegError;
                    
                    const { data: newVendedor, error: vendRegError } = await supabaseClient
                        .from('vendedores')
                        .insert([{
                            nombre: data.nombre,
                            email: data.email,
                            telefono: data.telefono,
                            direccion: data.direccion,
                            horario: data.horario,
                            logo_url: data.logo_url,
                            rubros: rubrosArray,
                            estado_abierto: true,
                            activo: true
                        }])
                        .select()
                        .single();
                    if (vendRegError) throw vendRegError;
                    
                    return { success: true, vendedor: newVendedor };
                    
                case 'actualizarVendedor':
                    const updateData = {
                        nombre: data.nombre,
                        telefono: data.telefono,
                        direccion: data.direccion,
                        horario: data.horario,
                        logo_url: data.logo_url
                    };
                    
                    if (data.rubros !== undefined) {
                        let rubrosArray = data.rubros;
                        if (typeof rubrosArray === 'string') {
                            rubrosArray = rubrosArray.split(',').map(r => r.trim());
                        }
                        updateData.rubros = rubrosArray || [];
                    }
                    
                    if (data.estado_abierto !== undefined) {
                        updateData.estado_abierto = data.estado_abierto === true || data.estado_abierto === 'true';
                    }
                    
                    if (data.password_hash) {
                        const { error: passError } = await supabaseClient.auth.updateUser({
                            password: data.password_hash
                        });
                        if (passError) console.warn('Error actualizando contraseña:', passError);
                    }
                    
                    const { error: updateError } = await supabaseClient
                        .from('vendedores')
                        .update(updateData)
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
                            disponible: data.disponible === true || data.disponible === 'SI' ? true : false
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
                            disponible: data.disponible === true || data.disponible === 'SI' ? true : false
                        })
                        .eq('id', data.id);
                    if (prodUpdateError) throw prodUpdateError;
                    return { success: true };
                    
                case 'eliminarProducto':
                    const { data: productoAEliminar } = await supabaseClient
                        .from('productos')
                        .select('imagen_url')
                        .eq('id', data.productoId)
                        .single();
                    
                    const { error: prodDeleteError } = await supabaseClient
                        .from('productos')
                        .delete()
                        .eq('id', data.productoId);
                    if (prodDeleteError) throw prodDeleteError;
                    
                    if (productoAEliminar && productoAEliminar.imagen_url) {
                        await eliminarImagenCloudinary(productoAEliminar.imagen_url);
                    }
                    return { success: true };
                    
                case 'cancelarPedido':
                    const { error: cancelError } = await supabaseClient
                        .from('pedidos')
                        .delete()
                        .eq('id', data.pedidoId);
                    if (cancelError) throw cancelError;
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
    
    // ===================================================
    // 6. ELIMINAR IMAGEN DE CLOUDINARY
    // ===================================================
    
    async function eliminarImagenCloudinary(imagenUrl) {
        if (!imagenUrl) return false;
        try {
            console.log(`🗑️ Intentando eliminar imagen: ${imagenUrl}`);
            return true;
        } catch (error) {
            console.error('Error eliminando imagen de Cloudinary:', error);
            return false;
        }
    }
    
    window.eliminarImagenCloudinary = eliminarImagenCloudinary;
    window.postAPI = window.callAPI;
    
    console.log('✅ Supabase API con autenticación Google inicializada');
})();