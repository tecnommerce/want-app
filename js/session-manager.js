// ===================================================
// SESSION MANAGER - WANT
// Manejo robusto de sesiones, caché y cookies
// ===================================================

const SessionManager = {
    // Configuración
    config: {
        sessionKey: 'want_usuario_sesion',
        maxRetries: 3,
        retryDelay: 1000,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas
        version: '1.0.0'
    },
    
    // Estado actual
    state: {
        isInitialized: false,
        retryCount: 0,
        lastCheck: null
    },
    
    // ===================================================
    // 1. LIMPIEZA DE CACHÉ Y COOKIES CORRUPTAS
    // ===================================================
    
    async limpiarCacheCorrupta() {
        console.log('🧹 Limpiando caché corrupta...');
        
        try {
            // Verificar si la sesión guardada es válida
            const sessionRaw = localStorage.getItem(this.config.sessionKey);
            if (sessionRaw) {
                try {
                    const session = JSON.parse(sessionRaw);
                    // Verificar si tiene estructura válida
                    if (!session.id || !session.email || !session.nombre) {
                        console.warn('⚠️ Sesión corrupta detectada, limpiando...');
                        localStorage.removeItem(this.config.sessionKey);
                    }
                    // Verificar si expiró
                    if (session.timestamp && (Date.now() - session.timestamp > this.config.sessionTimeout)) {
                        console.warn('⚠️ Sesión expirada, limpiando...');
                        localStorage.removeItem(this.config.sessionKey);
                    }
                } catch (e) {
                    console.warn('⚠️ Sesión corrupta (JSON inválido), limpiando...');
                    localStorage.removeItem(this.config.sessionKey);
                }
            }
            
            // Limpiar sessionStorage corrupto
            const vendedorSession = sessionStorage.getItem('vendedor_sesion');
            if (vendedorSession) {
                try {
                    JSON.parse(vendedorSession);
                } catch (e) {
                    sessionStorage.removeItem('vendedor_sesion');
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error limpiando caché:', error);
            return false;
        }
    },
    
    // ===================================================
    // 2. VERIFICACIÓN DE SESIÓN EN SUPABASE
    // ===================================================
    
    async verificarSesionSupabase() {
        console.log('🔍 Verificando sesión en Supabase...');
        
        if (typeof getCurrentUser !== 'function') {
            console.error('❌ getCurrentUser no disponible');
            return null;
        }
        
        try {
            const user = await getCurrentUser();
            if (user) {
                console.log('✅ Sesión activa en Supabase:', user.email);
                return user;
            }
        } catch (error) {
            console.error('Error verificando sesión Supabase:', error);
        }
        
        return null;
    },
    
    // ===================================================
    // 3. VERIFICACIÓN DE SESIÓN LOCAL
    // ===================================================
    
    verificarSesionLocal() {
        console.log('🔍 Verificando sesión local...');
        
        const sessionRaw = localStorage.getItem(this.config.sessionKey);
        if (!sessionRaw) {
            console.log('⚠️ No hay sesión local');
            return null;
        }
        
        try {
            const session = JSON.parse(sessionRaw);
            if (session.id && session.email) {
                console.log('✅ Sesión local encontrada:', session.email);
                return session;
            }
        } catch (e) {
            console.error('Error parsing sesión local:', e);
            localStorage.removeItem(this.config.sessionKey);
        }
        
        return null;
    },
    
    // ===================================================
    // 4. GUARDAR SESIÓN
    // ===================================================
    
    guardarSesion(usuario) {
        console.log('💾 Guardando sesión para:', usuario.email);
        
        const sessionData = {
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            timestamp: Date.now(),
            version: this.config.version
        };
        
        localStorage.setItem(this.config.sessionKey, JSON.stringify(sessionData));
        this.state.lastCheck = Date.now();
        
        return sessionData;
    },
    
    // ===================================================
    // 5. CERRAR SESIÓN
    // ===================================================
    
    async cerrarSesion() {
        console.log('🚪 Cerrando sesión...');
        
        // Limpiar localStorage
        localStorage.removeItem(this.config.sessionKey);
        
        // Limpiar sessionStorage
        sessionStorage.removeItem('vendedor_sesion');
        sessionStorage.removeItem('want_sesion');
        
        // Limpiar cookies relacionadas (si existen)
        document.cookie.split(';').forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            if (name.includes('supabase') || name.includes('want')) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
        });
        
        // Cerrar sesión en Supabase
        if (typeof signOut === 'function') {
            await signOut();
        }
        
        this.state.isInitialized = false;
        this.state.retryCount = 0;
        
        return true;
    },
    
    // ===================================================
    // 6. RECUPERAR USUARIO DESDE SUPABASE
    // ===================================================
    
    async recuperarUsuarioDesdeSupabase(authId) {
        console.log('📥 Recuperando usuario desde Supabase:', authId);
        
        if (typeof obtenerUsuarioPorAuthId !== 'function') {
            console.error('❌ obtenerUsuarioPorAuthId no disponible');
            return null;
        }
        
        try {
            const result = await obtenerUsuarioPorAuthId(authId);
            if (result.success && result.usuario) {
                console.log('✅ Usuario recuperado:', result.usuario.email);
                return result.usuario;
            }
        } catch (error) {
            console.error('Error recuperando usuario:', error);
        }
        
        return null;
    },
    
    // ===================================================
    // 7. REDIRECCIÓN INTELIGENTE (evita bucles)
    // ===================================================
    
    redirigirInteligente(destino, force = false) {
        const currentPath = window.location.pathname;
        const currentUrl = window.location.href;
        
        // Evitar redirigir si ya estamos en el destino
        if (currentPath.includes(destino) && !force) {
            console.log('🔄 Ya estamos en', destino, ', no redirijo');
            return false;
        }
        
        // Evitar redirigir si acabamos de redirigir (prevenir bucles)
        const lastRedirect = sessionStorage.getItem('last_redirect');
        const lastRedirectTime = parseInt(sessionStorage.getItem('last_redirect_time') || '0');
        
        if (lastRedirect === destino && (Date.now() - lastRedirectTime) < 2000) {
            console.log('🔄 Redirección reciente a', destino, ', evitando bucle');
            return false;
        }
        
        // Registrar redirección
        sessionStorage.setItem('last_redirect', destino);
        sessionStorage.setItem('last_redirect_time', Date.now().toString());
        
        console.log('🔀 Redirigiendo a:', destino);
        window.location.href = destino;
        return true;
    },
    
    // ===================================================
    // 8. INICIALIZACIÓN PRINCIPAL
    // ===================================================
    
    async init() {
        console.log('🚀 Inicializando Session Manager...');
        
        // Limpiar caché corrupta al inicio
        await this.limpiarCacheCorrupta();
        
        // Determinar en qué página estamos
        const isLoginPage = window.location.pathname.includes('login.html');
        const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '';
        
        // 1. Verificar sesión en Supabase (más confiable)
        const supabaseUser = await this.verificarSesionSupabase();
        
        if (supabaseUser) {
            // Hay sesión en Supabase, recuperar usuario
            const usuario = await this.recuperarUsuarioDesdeSupabase(supabaseUser.id);
            
            if (usuario) {
                // Guardar sesión localmente
                this.guardarSesion(usuario);
                window.usuarioActual = usuario;
                
                // Si estamos en login.html, ir a index.html
                if (isLoginPage) {
                    this.redirigirInteligente('index.html');
                    return { success: true, usuario: usuario, page: 'login->index' };
                }
                
                // Si estamos en index.html, mostrar contenido
                if (isIndexPage) {
                    if (typeof mostrarPantallaPrincipal === 'function') {
                        mostrarPantallaPrincipal();
                    }
                    if (typeof cargarDatosUsuarioUI === 'function') {
                        cargarDatosUsuarioUI();
                    }
                    if (typeof cargarPedidosUsuario === 'function') {
                        cargarPedidosUsuario();
                    }
                    return { success: true, usuario: usuario, page: 'index' };
                }
                
                return { success: true, usuario: usuario };
            }
        }
        
        // 2. Verificar sesión local
        const localSession = this.verificarSesionLocal();
        
        if (localSession) {
            // Validar que el usuario aún existe en Supabase
            const usuario = await this.recuperarUsuarioDesdeSupabase(localSession.id);
            
            if (usuario) {
                window.usuarioActual = usuario;
                
                if (isLoginPage) {
                    this.redirigirInteligente('index.html');
                    return { success: true, usuario: usuario, page: 'login->index' };
                }
                
                if (isIndexPage) {
                    if (typeof mostrarPantallaPrincipal === 'function') {
                        mostrarPantallaPrincipal();
                    }
                    if (typeof cargarDatosUsuarioUI === 'function') {
                        cargarDatosUsuarioUI();
                    }
                    if (typeof cargarPedidosUsuario === 'function') {
                        cargarPedidosUsuario();
                    }
                    return { success: true, usuario: usuario, page: 'index' };
                }
                
                return { success: true, usuario: usuario };
            } else {
                // Usuario no existe en Supabase, limpiar sesión
                await this.cerrarSesion();
            }
        }
        
        // 3. No hay sesión válida
        console.log('🔴 No hay sesión válida');
        
        if (isIndexPage) {
            this.redirigirInteligente('login.html');
            return { success: false, page: 'index->login' };
        }
        
        if (isLoginPage) {
            // Mostrar pantalla de login
            if (typeof mostrarPantallaLogin === 'function') {
                mostrarPantallaLogin();
            }
            return { success: false, page: 'login' };
        }
        
        return { success: false };
    }
};

// ===================================================
// FUNCIÓN DE INICIALIZACIÓN GLOBAL
// ===================================================

async function initWantSession() {
    console.log('🎯 Iniciando Want Session Manager...');
    
    try {
        const result = await SessionManager.init();
        console.log('📊 Resultado inicialización:', result);
        return result;
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        
        // Fallback: si hay error, ir a login
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
        return { success: false, error: error.message };
    }
}

// Exponer funciones globales
window.SessionManager = SessionManager;
window.initWantSession = initWantSession;
window.cerrarSesionGlobal = () => SessionManager.cerrarSesion();

console.log('✅ Session Manager cargado correctamente');