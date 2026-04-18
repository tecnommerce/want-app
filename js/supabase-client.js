// ===================================================
// SUPABASE - CLIENTE (para compradores)
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
    
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = supabaseClient;
    
    // Funciones de autenticación
    window.loginWithGoogle = async function() {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: 'https://wantapp.online/index.html' }
        });
        if (error) throw error;
        return { success: true };
    };
    
    window.getCurrentUser = async function() {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) return null;
        return user;
    };
    
    window.signOut = async function() {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('want_usuario_sesion');
        sessionStorage.removeItem('want_usuario_sesion');
        return { success: true };
    };
    
    window.onAuthStateChange = function(callback) {
        return supabaseClient.auth.onAuthStateChange(callback);
    };
    
    // Funciones de usuario
    window.obtenerUsuarioPorAuthId = async function(authId) {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('auth_id', authId);
        if (error) return { success: false, error: error.message };
        if (data && data.length > 0) return { success: true, usuario: data[0] };
        return { success: false, error: 'Usuario no encontrado', notFound: true };
    };
    
    window.crearOActualizarUsuario = async function(usuarioData) {
        const { data: existing } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('auth_id', usuarioData.auth_id);
        
        if (existing && existing.length > 0) {
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
                .eq('id', existing[0].id)
                .select();
            if (error) return { success: false, error: error.message };
            return { success: true, usuario: data[0], isNew: false };
        } else {
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
                .select();
            if (error) return { success: false, error: error.message };
            return { success: true, usuario: data[0], isNew: true };
        }
    };
    
    window.actualizarDatosUsuario = async function(usuarioId, updateData) {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .update({ ...updateData, updated_at: new Date() })
            .eq('id', usuarioId)
            .select();
        if (error) return { success: false, error: error.message };
        return { success: true, usuario: data[0] };
    };
    
    window.obtenerPedidosUsuario = async function(usuarioId) {
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select('*')
            .eq('usuario_id', usuarioId)
            .order('fecha', { ascending: false });
        if (error) return { success: false, error: error.message };
        return { success: true, pedidos: data || [] };
    };
    
    window.obtenerTodosUsuarios = async function() {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) return { success: false, error: error.message };
        return { success: true, usuarios: data || [] };
    };
    
    window.suspenderUsuario = async function(usuarioId, activo) {
        const { error } = await supabaseClient
            .from('usuarios')
            .update({ activo: activo })
            .eq('id', usuarioId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    };
    
    window.eliminarUsuario = async function(usuarioId) {
        const { error } = await supabaseClient
            .from('usuarios')
            .delete()
            .eq('id', usuarioId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    };
    
    // API para clientes
    window.callAPI = async function(action, data = {}) {
        console.log(`🔄 Cliente API: ${action}`, data);
        
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
                    if (data.vendedorId) query = query.eq('vendedor_id', data.vendedorId);
                    const { data: productos, error: pError } = await query.order('nombre');
                    if (pError) throw pError;
                    return { success: true, productos: productos };
                    
                case 'crearPedido':
                    // Obtener el último número de orden para este vendedor
                    const { data: ultimoPedido } = await supabaseClient
                        .from('pedidos')
                        .select('numero_orden')
                        .eq('vendedor_id', data.vendedor_id)
                        .order('numero_orden', { ascending: false })
                        .limit(1);
                    
                    const numeroOrden = (ultimoPedido?.[0]?.numero_orden || 0) + 1;
                    
                    // ✅ Insertar el pedido CON el campo 'productos'
                    const { data: pedidoNuevo, error: pedError } = await supabaseClient
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
                            usuario_id: data.usuario_id || null,
                            productos: data.productos  // ✅ CORRECCIÓN: Guardar productos en el pedido
                        }])
                        .select()
                        .single();
                    
                    if (pedError) throw pedError;
                    
                    // También guardar en productos_pedido (para mantener compatibilidad)
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
                    
                    return { success: true, pedidoId: pedidoNuevo.id };
                    
                case 'getBanners':
                    const { data: banners, error: banError } = await supabaseClient
                        .from('banners')
                        .select('*')
                        .eq('activo', true)
                        .order('orden');
                    if (banError) throw banError;
                    return { success: true, banners: banners };
                    
                default:
                    return { success: false, error: `Acción no implementada: ${action}` };
            }
        } catch (error) {
            console.error('❌ Error en callAPI:', error);
            return { success: false, error: error.message };
        }
    };
    
    window.postAPI = window.callAPI;
    
    console.log('✅ Supabase Cliente inicializado');
})();