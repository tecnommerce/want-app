// ===================================================
// SESSION MANAGER - WANT
// Manejo robusto de sesiones, caché y cookies
// ===================================================

const SessionManager = {
    config: {
        sessionKey: 'want_usuario_sesion',
        maxRetries: 3,
        retryDelay: 1000,
        sessionTimeout: 24 * 60 * 60 * 1000,
        version: '1.0.0'
    },
    
    state: {
        isInitialized: false,
        retryCount: 0,
        lastCheck: null
    },
    
    async limpiarCacheCorrupta() {
        console.log('🧹 Limpiando caché corrupta...');
        try {
            const sessionRaw = localStorage.getItem(this.config.sessionKey);
            if (sessionRaw) {
                try {
                    const session = JSON.parse(sessionRaw);
                    if (!session.id || !session.email || !session.nombre) {
                        localStorage.removeItem(this.config.sessionKey);
                    }
                    if (session.timestamp && (Date.now() - session.timestamp > this.config.sessionTimeout)) {
                        localStorage.removeItem(this.config.sessionKey);
                    }
                } catch (e) {
                    localStorage.removeItem(this.config.sessionKey);
                }
            }
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
    
    async verificarSesionSupabase() {
        if (typeof getCurrentUser !== 'function') return null;
        try {
            const user = await getCurrentUser();
            if (user) return user;
        } catch (error) {
            console.error('Error verificando sesión Supabase:', error);
        }
        return null;
    },
    
    verificarSesionLocal() {
        const sessionRaw = localStorage.getItem(this.config.sessionKey);
        if (!sessionRaw) return null;
        try {
            const session = JSON.parse(sessionRaw);
            if (session.id && session.email) return session;
        } catch (e) {
            localStorage.removeItem(this.config.sessionKey);
        }
        return null;
    },
    
    guardarSesion(usuario) {
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
    
    async cerrarSesion() {
        localStorage.removeItem(this.config.sessionKey);
        sessionStorage.removeItem('vendedor_sesion');
        sessionStorage.removeItem('want_sesion');
        document.cookie.split(';').forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            if (name.includes('supabase') || name.includes('want')) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
        });
        if (typeof signOut === 'function') await signOut();
        this.state.isInitialized = false;
        this.state.retryCount = 0;
        return true;
    },
    
    async recuperarUsuarioDesdeSupabase(authId) {
        if (typeof obtenerUsuarioPorAuthId !== 'function') return null;
        try {
            const result = await obtenerUsuarioPorAuthId(authId);
            if (result.success && result.usuario) return result.usuario;
        } catch (error) {
            console.error('Error recuperando usuario:', error);
        }
        return null;
    },
    
    redirigirInteligente(destino, force = false) {
        const currentPath = window.location.pathname;
        if (currentPath.includes(destino) && !force) return false;
        const lastRedirect = sessionStorage.getItem('last_redirect');
        const lastRedirectTime = parseInt(sessionStorage.getItem('last_redirect_time') || '0');
        if (lastRedirect === destino && (Date.now() - lastRedirectTime) < 2000) return false;
        sessionStorage.setItem('last_redirect', destino);
        sessionStorage.setItem('last_redirect_time', Date.now().toString());
        window.location.href = destino;
        return true;
    },
    
    async init() {
        console.log('🚀 Inicializando Session Manager...');
        await this.limpiarCacheCorrupta();
        
        const isLoginPage = window.location.pathname.includes('login.html');
        const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname === '';
        
        const supabaseUser = await this.verificarSesionSupabase();
        
        if (supabaseUser) {
            const usuario = await this.recuperarUsuarioDesdeSupabase(supabaseUser.id);
            if (usuario) {
                this.guardarSesion(usuario);
                window.usuarioActual = usuario;
                if (isLoginPage) {
                    this.redirigirInteligente('index.html');
                    return { success: true, usuario: usuario, page: 'login->index' };
                }
                if (isIndexPage) {
                    if (typeof mostrarPantallaPrincipal === 'function') mostrarPantallaPrincipal();
                    if (typeof cargarDatosUsuarioUI === 'function') cargarDatosUsuarioUI();
                    if (typeof cargarPedidosUsuario === 'function') cargarPedidosUsuario();
                    return { success: true, usuario: usuario, page: 'index' };
                }
                return { success: true, usuario: usuario };
            }
        }
        
        const localSession = this.verificarSesionLocal();
        if (localSession) {
            const usuario = await this.recuperarUsuarioDesdeSupabase(localSession.id);
            if (usuario) {
                window.usuarioActual = usuario;
                if (isLoginPage) {
                    this.redirigirInteligente('index.html');
                    return { success: true, usuario: usuario, page: 'login->index' };
                }
                if (isIndexPage) {
                    if (typeof mostrarPantallaPrincipal === 'function') mostrarPantallaPrincipal();
                    if (typeof cargarDatosUsuarioUI === 'function') cargarDatosUsuarioUI();
                    if (typeof cargarPedidosUsuario === 'function') cargarPedidosUsuario();
                    return { success: true, usuario: usuario, page: 'index' };
                }
                return { success: true, usuario: usuario };
            } else {
                await this.cerrarSesion();
            }
        }
        
        if (isIndexPage) {
            this.redirigirInteligente('login.html');
            return { success: false, page: 'index->login' };
        }
        
        if (isLoginPage) {
            if (typeof mostrarPantallaLogin === 'function') mostrarPantallaLogin();
            return { success: false, page: 'login' };
        }
        
        return { success: false };
    }
};

async function initWantSession() {
    console.log('🎯 Iniciando Want Session Manager...');
    try {
        const result = await SessionManager.init();
        console.log('📊 Resultado inicialización:', result);
        return result;
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
        return { success: false, error: error.message };
    }
}

window.SessionManager = SessionManager;
window.initWantSession = initWantSession;
window.cerrarSesionGlobal = () => SessionManager.cerrarSesion();

console.log('✅ Session Manager cargado correctamente');