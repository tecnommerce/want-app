// ===================================================
// ADMIN GLOBAL - Autenticación
// ===================================================

// Configuración del administrador (por defecto)
// En producción, esto debería estar en Google Sheets con hash
const ADMIN_CONFIG = {
    email: 'admin@want.com',
    password_hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' // "admin" hasheado con SHA-256
};

// Función para hashear contraseñas
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verificar sesión
function checkSession() {
    const session = sessionStorage.getItem('admin_session');
    if (session && session === 'true') {
        return true;
    }
    return false;
}

// Iniciar sesión
async function login(email, password) {
    const passwordHash = await hashPassword(password);
    
    if (email === ADMIN_CONFIG.email && passwordHash === ADMIN_CONFIG.password_hash) {
        sessionStorage.setItem('admin_session', 'true');
        return true;
    }
    return false;
}

// Cerrar sesión
function logout() {
    sessionStorage.removeItem('admin_session');
    window.location.href = 'index.html';
}

// Toggle password visibility
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

// Inicializar login
function initLogin() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value.trim();
            const password = document.getElementById('admin-password').value;
            
            const success = await login(email, password);
            if (success) {
                window.location.href = 'index.html';
            } else {
                alert('Email o contraseña incorrectos');
            }
        });
    }
}

// Verificar sesión al cargar
document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggle();
    
    // Si estamos en login.html
    if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/admin-global/')) {
        if (checkSession()) {
            // Ya hay sesión, redirigir al dashboard
            window.location.href = 'index.html';
        } else {
            initLogin();
        }
    } else {
        // En páginas protegidas
        if (!checkSession()) {
            window.location.href = 'index.html';
        }
    }
});