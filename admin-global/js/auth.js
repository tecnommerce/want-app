// ===================================================
// ADMIN GLOBAL - Autenticación con Rate Limiting
// ===================================================

const ADMIN_CONFIG = {
    email: 'admin@want.com',
    password_hash: 'be4cd6e887c1c43c02c2e924780ba286dc2a8d6f017d7ceab40ac7f5213c09fb'
};

// Rate limiting: máximo 5 intentos en 15 minutos
const RATE_LIMIT = {
    maxAttempts: 5,
    windowMinutes: 15
};

function getRateLimitKey() {
    // Usar IP + fecha para limitar por día/hora
    // Por ahora usamos localStorage con timestamp
    return 'admin_login_attempts';
}

function getAttempts() {
    const stored = localStorage.getItem(getRateLimitKey());
    if (!stored) return { count: 0, firstAttempt: Date.now() };
    
    try {
        return JSON.parse(stored);
    } catch(e) {
        return { count: 0, firstAttempt: Date.now() };
    }
}

function saveAttempts(attempts) {
    localStorage.setItem(getRateLimitKey(), JSON.stringify(attempts));
}

function isRateLimited() {
    const attempts = getAttempts();
    const windowMs = RATE_LIMIT.windowMinutes * 60 * 1000;
    const timeSinceFirst = Date.now() - attempts.firstAttempt;
    
    // Si pasó la ventana de tiempo, resetear
    if (timeSinceFirst > windowMs) {
        saveAttempts({ count: 0, firstAttempt: Date.now() });
        return false;
    }
    
    // Verificar si excedió el máximo
    return attempts.count >= RATE_LIMIT.maxAttempts;
}

function registerFailedAttempt() {
    const attempts = getAttempts();
    const windowMs = RATE_LIMIT.windowMinutes * 60 * 1000;
    const timeSinceFirst = Date.now() - attempts.firstAttempt;
    
    // Si pasó la ventana, resetear
    if (timeSinceFirst > windowMs) {
        saveAttempts({ count: 1, firstAttempt: Date.now() });
        return;
    }
    
    // Incrementar contador
    saveAttempts({
        count: attempts.count + 1,
        firstAttempt: attempts.firstAttempt
    });
}

function resetAttempts() {
    saveAttempts({ count: 0, firstAttempt: Date.now() });
}

function getRemainingTimeMinutes() {
    const attempts = getAttempts();
    const windowMs = RATE_LIMIT.windowMinutes * 60 * 1000;
    const timeSinceFirst = Date.now() - attempts.firstAttempt;
    const remainingMs = windowMs - timeSinceFirst;
    
    if (remainingMs <= 0) return 0;
    return Math.ceil(remainingMs / 60000);
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkSession() {
    return sessionStorage.getItem('admin_session') === 'true';
}

async function login(email, password) {
    // Verificar rate limiting
    if (isRateLimited()) {
        const remainingMinutes = getRemainingTimeMinutes();
        throw new Error(`Demasiados intentos. Esperá ${remainingMinutes} minutos antes de volver a intentar.`);
    }
    
    const passwordHash = await hashPassword(password);
    
    if (email === ADMIN_CONFIG.email && passwordHash === ADMIN_CONFIG.password_hash) {
        sessionStorage.setItem('admin_session', 'true');
        resetAttempts(); // Resetear intentos en login exitoso
        return true;
    }
    
    // Registrar intento fallido
    registerFailedAttempt();
    const remainingAttempts = RATE_LIMIT.maxAttempts - getAttempts().count;
    throw new Error(`Email o contraseña incorrectos. Te quedan ${remainingAttempts} intentos.`);
}

function logout() {
    sessionStorage.removeItem('admin_session');
    window.location.href = 'login.html';
}

function initPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                btn.querySelector('i').classList.toggle('fa-eye');
                btn.querySelector('i').classList.toggle('fa-eye-slash');
            }
        });
    });
}

function showError(message) {
    // Crear elemento de error si no existe
    let errorDiv = document.getElementById('login-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'login-error';
        errorDiv.style.cssText = `
            background: #fee2e2;
            color: #dc2626;
            padding: 12px;
            border-radius: 12px;
            margin-bottom: 16px;
            font-size: 0.85rem;
            text-align: center;
        `;
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.insertBefore(errorDiv, loginForm.firstChild);
        }
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
        if (errorDiv) errorDiv.style.display = 'none';
    }, 5000);
}

function initLogin() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Limpiar error anterior
            const errorDiv = document.getElementById('login-error');
            if (errorDiv) errorDiv.style.display = 'none';
            
            const email = document.getElementById('admin-email').value.trim();
            const password = document.getElementById('admin-password').value;
            const loginBtn = document.getElementById('login-btn');
            
            // Deshabilitar botón durante la verificación
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Verificando...';
            }
            
            try {
                const success = await login(email, password);
                if (success) {
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                showError(error.message);
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Ingresar';
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggle();
    
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html') || path === '/admin-global/' || path.endsWith('/');
    
    if (isLoginPage) {
        if (checkSession()) {
            window.location.href = 'dashboard.html';
        } else {
            initLogin();
        }
    } else {
        if (!checkSession()) {
            window.location.href = 'login.html';
        }
    }
});