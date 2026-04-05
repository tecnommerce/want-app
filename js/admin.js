// ===================================================
// ADMIN - VERSIÓN MÍNIMA PARA PRUEBAS
// ===================================================

console.log('🚀 Admin.js mínimo cargado');

// Funciones básicas
async function login() {
    console.log('🔐 Función login ejecutada');
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    
    console.log('Email:', email);
    
    if (!email || !password) {
        alert('Completá todos los campos');
        return;
    }
    
    try {
        const response = await callAPI('loginVendedor', { email, password });
        console.log('Respuesta:', response);
        
        if (response.success) {
            alert('Login exitoso!');
            // Mostrar panel básico
            document.getElementById('admin-auth').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            document.getElementById('header-admin').style.display = 'block';
        } else {
            alert('Error: ' + response.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

async function registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile) {
    console.log('📝 Registrando vendedor:', { nombre, email });
    
    const response = await postAPI('registrarVendedor', {
        nombre, email, telefono, direccion, horario, password, logo_url: null
    });
    
    console.log('Respuesta registro:', response);
    return response;
}

// Función para mostrar panel de registro
function mostrarPanelRegistro() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('register-panel').classList.add('active');
}

function mostrarPanelLogin() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('login-panel').classList.add('active');
}

// Event listeners cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM cargado, configurando event listeners');
    
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await login();
        });
        console.log('✅ Login form configurado');
    }
    
    // Register button
    const btnRegister = document.getElementById('btn-show-register');
    if (btnRegister) {
        btnRegister.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarPanelRegistro();
        });
        console.log('✅ Botón registro configurado');
    }
    
    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Formulario de registro enviado');
            
            const nombre = document.getElementById('reg-nombre')?.value.trim();
            const email = document.getElementById('reg-email')?.value.trim();
            const telefono = document.getElementById('reg-telefono')?.value.trim();
            const direccion = document.getElementById('reg-direccion')?.value.trim();
            const horario = document.getElementById('reg-horario')?.value.trim();
            const password = document.getElementById('reg-password')?.value;
            const password2 = document.getElementById('reg-password2')?.value;
            
            if (!nombre || !email || !telefono || !direccion) {
                alert('Completá todos los campos');
                return;
            }
            
            if (password !== password2) {
                alert('Las contraseñas no coinciden');
                return;
            }
            
            if (password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres');
                return;
            }
            
            const btn = registerForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = 'Registrando...';
            
            try {
                const response = await registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, null);
                
                if (response && response.success) {
                    alert('Registro exitoso. Ahora podés iniciar sesión.');
                    mostrarPanelLogin();
                    registerForm.reset();
                    document.getElementById('login-email').value = email;
                } else {
                    alert('Error: ' + (response?.error || 'Error desconocido'));
                }
            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
        console.log('✅ Register form configurado');
    }
    
    // Back to login buttons
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
        backToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarPanelLogin();
        });
    }
    
    const backToLoginRecover = document.getElementById('back-to-login-recover');
    if (backToLoginRecover) {
        backToLoginRecover.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarPanelLogin();
        });
    }
});

// Exportar funciones globalmente
window.login = login;
window.registrarVendedorConLogo = registrarVendedorConLogo;
window.mostrarPanelRegistro = mostrarPanelRegistro;
window.mostrarPanelLogin = mostrarPanelLogin;