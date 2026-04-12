// ===================================================
// ADMIN GLOBAL - Autenticación con Supabase
// ===================================================

const ADMIN_EMAIL = 'admin@want.com';

// Rate limiting: máximo 5 intentos en 15 minutos
const RATE_LIMIT = {
    maxAttempts: 5,
    windowMinutes: 15
};

function getRateLimitKey() {
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
    
    if (timeSinceFirst > windowMs) {
        saveAttempts({ count: 0, firstAttempt: Date.now() });
        return false;
    }
    return attempts.count >= RATE_LIMIT.maxAttempts;
}

function registerFailedAttempt() {
    const attempts = getAttempts();
    const windowMs = RATE_LIMIT.windowMinutes * 60 * 1000;
    const timeSinceFirst = Date.now() - attempts.firstAttempt;
    
    if (timeSinceFirst > windowMs) {
        saveAttempts({ count: 1, firstAttempt: Date.now() });
        return;
    }
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

function checkSession() {
    return sessionStorage.getItem('admin_session') === 'true';
}

async function login(email, password) {
    if (isRateLimited()) {
        const remainingMinutes = getRemainingTimeMinutes();
        throw new Error(`Demasiados intentos. Esperá ${remainingMinutes} minutos.`);
    }
    
    try {
        // Autenticar con Supabase
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        if (data.user && data.user.email === ADMIN_EMAIL) {
            sessionStorage.setItem('admin_session', 'true');
            sessionStorage.setItem('admin_supabase_session', JSON.stringify(data.session));
            resetAttempts();
            return true;
        } else {
            throw new Error('No tienes permisos de administrador');
        }
    } catch (error) {
        registerFailedAttempt();
        const remainingAttempts = RATE_LIMIT.maxAttempts - getAttempts().count;
        throw new Error(`${error.message}. Intentos restantes: ${remainingAttempts}`);
    }
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
    } catch(e) {}
    sessionStorage.removeItem('admin_session');
    sessionStorage.removeItem('admin_supabase_session');
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
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.className = 'error-message';
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.insertBefore(errorDiv, loginForm.firstChild);
        }
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function initLogin() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const errorDiv = document.getElementById('error-message');
            if (errorDiv) errorDiv.style.display = 'none';
            
            const email = document.getElementById('admin-email').value.trim();
            const password = document.getElementById('admin-password').value;
            const loginBtn = document.getElementById('login-btn');
            
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

// Restaurar sesión de Supabase si existe
async function restoreSupabaseSession() {
    const savedSession = sessionStorage.getItem('admin_supabase_session');
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            await supabaseClient.auth.setSession(session);
            console.log('✅ Sesión de Supabase restaurada');
        } catch(e) {
            console.error('Error restaurando sesión:', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initPasswordToggle();
    await restoreSupabaseSession();
    
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