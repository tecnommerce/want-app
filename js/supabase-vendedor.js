// ===================================================
// SUPABASE - VENDEDOR (para panel de administración)
// ===================================================

(function() {
    const SUPABASE_URL = 'https://owrpzmgncfrgatzccjlc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cnB6bWduY2ZyZ2F0emNjamxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjIxNTIsImV4cCI6MjA5MDkzODE1Mn0.TOFcl0_Ua3jpISBKnrNdI4skIFMiyitWv0rLDoTzTkQ';
    
    // ===================================================
    // FUNCIONES DE FECHA - ZONA HORARIA ARGENTINA (UTC-3)
    // ===================================================
    function getArgentinaDateISO() {
        const now = new Date();
        const localeStr = now.toLocaleString('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires'
        });
        const matches = localeStr.match(/(\d+)\/(\d+)\/(\d+)[,\s]+(\d+):(\d+):(\d+)/);
        if (!matches) return new Date().toISOString();
        const [, day, month, year, hours, minutes, seconds] = matches;
        const dateAsUTC = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`);
        if (isNaN(dateAsUTC.getTime())) return new Date().toISOString();
        const utcCorrect = new Date(dateAsUTC.getTime() + 3 * 60 * 60 * 1000);
        return utcCorrect.toISOString();
    }
    
    const supabaseVendedorClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: window.localStorage,
            autoRefreshToken: true,
            persistSession: true
        }
    });
    window.supabaseVendedorClient = supabaseVendedorClient;
    
    // API para vendedores
    window.callAPIVendedor = async function(action, data = {}) {
        console.log(`🔄 Vendedor API: ${action}`, data);
        
        try {
            switch(action) {
                case 'getVendedores':
                    const { data: vendedores, error: vError } = await supabaseVendedorClient
                        .from('vendedores')
                        .select('*')
                        .eq('activo', true)
                        .order('nombre');
                    if (vError) throw vError;
                    return { success: true, vendedores: vendedores };
                    
                case 'getAllVendedores':
                    const { data: allVendedores, error: allVError } = await supabaseVendedorClient
                        .from('vendedores')
                        .select('*')
                        .order('nombre');
                    if (allVError) throw allVError;
                    return { success: true, vendedores: allVendedores };
                    
                case 'getPedidos':
                    // ✅ CORREGIDO: Trae los pedidos con la columna 'productos' incluida
                    let pedidosQuery = supabaseVendedorClient.from('pedidos').select('*');
                    if (data.vendedorId) pedidosQuery = pedidosQuery.eq('vendedor_id', data.vendedorId);
                    const { data: pedidos, error: pedError } = await pedidosQuery.order('fecha', { ascending: false });
                    if (pedError) throw pedError;
                    
                    // Los productos ya vienen en la columna 'productos' del pedido
                    return { success: true, pedidos: pedidos || [] };
                    
                case 'getProductos':
                    let query = supabaseVendedorClient.from('productos').select('*');
                    if (data.vendedorId) query = query.eq('vendedor_id', data.vendedorId);
                    const { data: productos, error: pError } = await query.order('nombre');
                    if (pError) throw pError;
                    return { success: true, productos: productos };
                    
                case 'getDeliveries':
                    const { data: deliveries, error: dError } = await supabaseVendedorClient
                        .from('delivery')
                        .select('*')
                        .eq('vendedor_id', data.vendedorId)
                        .eq('activo', true);
                    if (dError) throw dError;
                    return { success: true, deliveries: deliveries };
                    
                case 'loginVendedor':
                    const { data: authData, error: authError } = await supabaseVendedorClient.auth.signInWithPassword({
                        email: data.email,
                        password: data.password
                    });
                    if (authError) throw new Error(authError.message);
                    
                    const { data: vendedor, error: vendError } = await supabaseVendedorClient
                        .from('vendedores')
                        .select('*')
                        .eq('email', data.email)
                        .single();
                    if (vendError) throw vendError;
                    return { success: true, vendedor: vendedor };
                    
                case 'actualizarVendedor':
                    const updateData = {};
                    if (data.nombre !== undefined) updateData.nombre = data.nombre;
                    if (data.telefono !== undefined) updateData.telefono = data.telefono;
                    if (data.direccion !== undefined) updateData.direccion = data.direccion;
                    if (data.horario !== undefined) updateData.horario = data.horario;
                    if (data.logo_url !== undefined) updateData.logo_url = data.logo_url;
                    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
                    if (data.estado_abierto !== undefined) updateData.estado_abierto = data.estado_abierto;
                    if (data.rubros !== undefined) updateData.rubros = data.rubros;
                    
                    const { error: updateError } = await supabaseVendedorClient
                        .from('vendedores')
                        .update(updateData)
                        .eq('id', data.id);
                    if (updateError) throw updateError;
                    return { success: true };
                    
                case 'crearProducto':
                    const { data: newProducto, error: createError } = await supabaseVendedorClient
                        .from('productos')
                        .insert([{
                            vendedor_id: data.vendedor_id,
                            nombre: data.nombre,
                            descripcion: data.descripcion,
                            precio: data.precio,
                            imagen_url: data.imagen_url,
                            disponible: data.disponible === true || data.disponible === 'SI'
                        }])
                        .select()
                        .single();
                    if (createError) throw createError;
                    return { success: true, productoId: newProducto.id };
                    
                case 'actualizarProducto':
                    const { error: prodUpdateError } = await supabaseVendedorClient
                        .from('productos')
                        .update({
                            nombre: data.nombre,
                            descripcion: data.descripcion,
                            precio: data.precio,
                            imagen_url: data.imagen_url,
                            disponible: data.disponible === true || data.disponible === 'SI'
                        })
                        .eq('id', data.id);
                    if (prodUpdateError) throw prodUpdateError;
                    return { success: true };
                    
                case 'eliminarProducto':
                    const { error: deleteError } = await supabaseVendedorClient
                        .from('productos')
                        .delete()
                        .eq('id', data.productoId);
                    if (deleteError) throw deleteError;
                    return { success: true };
                    
                case 'actualizarEstado':
                    const { error: estadoError } = await supabaseVendedorClient
                        .from('pedidos')
                        .update({ estado: data.estado })
                        .eq('id', data.pedidoId);
                    if (estadoError) throw estadoError;
                    return { success: true };
                    
                case 'cancelarPedido':
                    const { error: cancelError } = await supabaseVendedorClient
                        .from('pedidos')
                        .delete()
                        .eq('id', data.pedidoId);
                    if (cancelError) throw cancelError;
                    return { success: true };
                    
                case 'crearDelivery':
                    const { data: newDelivery, error: delError } = await supabaseVendedorClient
                        .from('delivery')
                        .insert([{
                            vendedor_id: data.vendedor_id,
                            nombre: data.nombre,
                            telefono: data.telefono
                        }])
                        .select()
                        .single();
                    if (delError) throw delError;
                    return { success: true, deliveryId: newDelivery.id };
                    
                case 'actualizarDelivery':
                    const { error: updDeliveryError } = await supabaseVendedorClient
                        .from('delivery')
                        .update({ nombre: data.nombre, telefono: data.telefono })
                        .eq('id', data.id);
                    if (updDeliveryError) throw updDeliveryError;
                    return { success: true };
                    
                case 'eliminarDelivery':
                    const { error: delDeliveryError } = await supabaseVendedorClient
                        .from('delivery')
                        .update({ activo: false })
                        .eq('id', data.deliveryId);
                    if (delDeliveryError) throw delDeliveryError;
                    return { success: true };
                    
                case 'actualizarPedidoCompleto':
                    const { error: updPedidoError } = await supabaseVendedorClient
                        .from('pedidos')
                        .update({
                            cliente_nombre: data.cliente_nombre,
                            cliente_telefono: data.cliente_telefono,
                            direccion: data.direccion,
                            metodo_pago: data.metodo_pago,
                            detalles: data.detalles || '',
                            estado: data.estado,
                            total: data.total,
                            productos: data.productos  // ✅ Actualizar también la columna productos
                        })
                        .eq('id', data.id);
                    if (updPedidoError) throw updPedidoError;
                    
                    // También actualizar productos_pedido para mantener compatibilidad
                    await supabaseVendedorClient
                        .from('productos_pedido')
                        .delete()
                        .eq('pedido_id', data.id);
                    
                    for (const producto of data.productos) {
                        await supabaseVendedorClient
                            .from('productos_pedido')
                            .insert([{
                                pedido_id: data.id,
                                producto_id: producto.id,
                                cantidad: producto.cantidad,
                                precio_unitario: producto.precio
                            }]);
                    }
                    return { success: true };
                    
                case 'crearPedidoVendedor':
                    const { data: ultimoOrden } = await supabaseVendedorClient
                        .from('pedidos')
                        .select('numero_orden')
                        .eq('vendedor_id', data.vendedor_id)
                        .order('numero_orden', { ascending: false })
                        .limit(1);
                    const nuevoNumero = (ultimoOrden?.[0]?.numero_orden || 0) + 1;
                    
                    const { data: nuevoPedido, error: createPedError } = await supabaseVendedorClient
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
                            numero_orden: nuevoNumero,
                            usuario_id: data.usuario_id || null,
                            productos: data.productos,
                            fecha: getArgentinaDateISO()
                        }])
                        .select()
                        .single();
                    if (createPedError) throw createPedError;
                    
                    for (const producto of data.productos) {
                        await supabaseVendedorClient
                            .from('productos_pedido')
                            .insert([{
                                pedido_id: nuevoPedido.id,
                                producto_id: producto.id,
                                cantidad: producto.cantidad,
                                precio_unitario: producto.precio
                            }]);
                    }
                    return { success: true, pedidoId: nuevoPedido.id };
                    
                default:
                    return { success: false, error: `Acción no implementada: ${action}` };
            }
        } catch (error) {
            console.error('❌ Error en callAPIVendedor:', error);
            return { success: false, error: error.message };
        }
    };
    
    window.postAPIVendedor = window.callAPIVendedor;
    
    console.log('✅ Supabase Vendedor inicializado');
})();