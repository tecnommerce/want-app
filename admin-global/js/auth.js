// ===================================================
// ADMIN GLOBAL - Autenticación simplificada
// ===================================================

const ADMIN_CONFIG = {
    email: 'admin@want.com',
    password_hash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
};

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
    const passwordHash = await hashPassword(password);
    if (email === ADMIN_CONFIG.email && passwordHash === ADMIN_CONFIG.password_hash) {
        sessionStorage.setItem('admin_session', 'true');
        return true;
    }
    return false;
}

function logout() {
    sessionStorage.removeItem('admin_session');
    window.location.href = '/admin-global/';
}

function initLogin() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value.trim();
            const password = document.getElementById('admin-password').value;
            
            console.log('Intentando login...');
            const success = await login(email, password);
            console.log('Login success:', success);
            
            if (success) {
                console.log('Redirigiendo a index.html');
                window.location.href = '/admin-global/index.html';
            } else {
                alert('Email o contraseña incorrectos');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Auth.js cargado');
    const path = window.location.pathname;
    
    if (path === '/admin-global/' || path.endsWith('index.html') || path === '/admin-global') {
        if (checkSession()) {
            console.log('Sesión activa, redirigiendo a dashboard');
            window.location.href = '/admin-global/index.html';
        } else {
            console.log('Mostrando login');
            initLogin();
        }
    } else {
        if (!checkSession()) {
            console.log('No hay sesión, redirigiendo a login');
            window.location.href = '/admin-global/';
        }
    }
});