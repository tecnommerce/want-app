// ===================================================
// UTILS - Funciones para la app Want
// Con caché en localStorage para mejorar velocidad
// ===================================================

// Tiempo de expiración de caché en milisegundos (5 minutos)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// ===================================================
// FUNCIÓN GET CON CACHÉ
// ===================================================

async function callAPI(action, data = {}, forceRefresh = false) {
    try {
        // Crear clave única para el caché
        const cacheKey = `want_${action}_${JSON.stringify(data)}`;
        
        // Si no se fuerza actualización, buscar en localStorage
        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const { timestamp, data: cachedData } = JSON.parse(cached);
                // Si el caché no expiró, usarlo
                if (Date.now() - timestamp < CACHE_EXPIRATION) {
                    console.log(`📦 Usando caché para ${action}`);
                    return cachedData;
                } else {
                    console.log(`⏰ Caché expirado para ${action}`);
                }
            }
        }
        
        // Si no hay caché o expiró, hacer petición a la API
        console.log(`📡 Petición real a API: ${action}`);
        
        let url = `${window.WANT_CONFIG.apiUrl}?action=${action}`;
        
        if (data && Object.keys(data).length > 0) {
            for (let key in data) {
                url += `&${key}=${encodeURIComponent(data[key])}`;
            }
        }
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Guardar en caché con timestamp
        const cacheData = {
            timestamp: Date.now(),
            data: result
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
        console.log(`✅ Datos guardados en caché para ${action}`);
        return result;
        
    } catch (error) {
        console.error('❌ Error en callAPI:', error);
        
        // Si hay error de red pero tenemos caché expirado, devolver caché igualmente
        const cached = localStorage.getItem(`want_${action}_${JSON.stringify(data)}`);
        if (cached) {
            console.log(`⚠️ Error de red, usando caché expirado como respaldo`);
            const { data: cachedData } = JSON.parse(cached);
            return cachedData;
        }
        
        return { error: error.message };
    }
}

// ===================================================
// FUNCIÓN POST (crear pedidos)
// ===================================================

async function postAPI(action, data = {}) {
    try {
        const url = window.WANT_CONFIG.apiUrl;
        
        console.log('📡 POST a:', url);
        console.log('📦 Datos enviados:', { action, ...data });
        
        const jsonData = JSON.stringify({ action, ...data });
        
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: jsonData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📥 Respuesta POST:', result);
        
        // Si el POST fue exitoso, invalidar caché de pedidos (opcional)
        if (result.success && action === 'crearPedido') {
            // Opcional: invalidar caché de listados si es necesario
            console.log('📝 Pedido guardado correctamente');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error en postAPI:', error);
        return { success: false, error: error.message };
    }
}

// ===================================================
// FUNCIÓN PARA FORZAR ACTUALIZACIÓN DE DATOS
// ===================================================

async function refreshAllData() {
    console.log('🔄 Forzando actualización de todos los datos...');
    
    // Limpiar todo el caché de want_
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('want_')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ Limpiados ${keysToRemove.length} elementos de caché`);
    
    // Recargar datos principales
    const vendedores = await callAPI('getVendedores', {}, true);
    console.log('✅ Datos actualizados');
    
    return vendedores;
}

// ===================================================
// FUNCIÓN PARA VER ESTADO DEL CACHÉ
// ===================================================

function getCacheStatus() {
    const cacheItems = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('want_')) {
            const cached = JSON.parse(localStorage.getItem(key));
            const age = Math.round((Date.now() - cached.timestamp) / 1000);
            cacheItems.push({
                key: key,
                age_seconds: age,
                expired: age > (CACHE_EXPIRATION / 1000)
            });
        }
    }
    console.table(cacheItems);
    return cacheItems;
}

// ===================================================
// FUNCIONES UTILITARIAS
// ===================================================

// Formatear precio a moneda argentina
function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(precio);
}

// Mostrar mensaje temporal (toast)
function mostrarToast(mensaje, tipo = 'info') {
    // Eliminar toast existente si hay
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${tipo}`;
    toast.textContent = mensaje;
    
    // Estilos
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = tipo === 'success' ? '#10b981' : tipo === 'error' ? '#ef4444' : '#FF5A00';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '50px';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '1000';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.animation = 'fadeInUp 0.3s ease';
    toast.style.whiteSpace = 'nowrap';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOutDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===================================================
// ANIMACIONES CSS PARA TOAST
// ===================================================

const styleToast = document.createElement('style');
styleToast.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    @keyframes fadeOutDown {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
    }
`;
document.head.appendChild(styleToast);