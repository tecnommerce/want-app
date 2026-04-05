// ===================================================
// ADMIN - VERSIÓN SIMPLE Y FUNCIONAL
// ===================================================

console.log('🚀 admin.js cargado correctamente');

// Variables globales
let vendedorActual = null;

// ===================================================
// FUNCIONES DE AUTENTICACIÓN
// ===================================================

async function login() {
    console.log('🔐 Función login ejecutada');
    
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    
    console.log('Email ingresado:', email);
    
    if (!email || !password) {
        alert('Completá todos los campos');
        return;
    }
    
    try {
        alert('Validando credenciales...');
        
        const response = await callAPI('loginVendedor', { email, password });
        
        console.log('Respuesta completa:', response);
        alert('Respuesta recibida: ' + JSON.stringify(response));
        
        if (response.success && response.vendedor) {
            vendedorActual = response.vendedor;
            alert(`✅ Bienvenido ${vendedorActual.nombre}`);
            
            // Ocultar login y mostrar panel
            document.getElementById('admin-auth').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'block';
            document.getElementById('header-admin').style.display = 'block';
            document.getElementById('panel-nombre').textContent = vendedorActual.nombre;
            document.getElementById('panel-email').textContent = vendedorActual.email;
        } else {
            alert('❌ Error: ' + (response.error || 'Credenciales incorrectas'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, logoFile) {
    console.log('📝 Registrando vendedor:', { nombre, email });
    
    const response = await postAPI('registrarVendedor', {
        nombre: nombre,
        email: email,
        telefono: telefono,
        direccion: direccion,
        horario: horario,
        password: password,
        logo_url: null
    });
    
    console.log('Respuesta registro:', response);
    return response;
}

// ===================================================
// NAVEGACIÓN ENTRE PANELES
// ===================================================

function mostrarPanelRegistro() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('register-panel').classList.add('active');
}

function mostrarPanelRecuperacion() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('recover-panel').classList.add('active');
}

function mostrarPanelLogin() {
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('login-panel').classList.add('active');
}

// ===================================================
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM cargado, configurando event listeners');
    
    // 1. Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('📝 Login form enviado');
            await login();
        });
        console.log('✅ Login form configurado');
    } else {
        console.error('❌ Login form NO encontrado');
    }
    
    // 2. Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('📝 Register form enviado');
            
            const nombre = document.getElementById('reg-nombre')?.value.trim();
            const email = document.getElementById('reg-email')?.value.trim();
            const telefono = document.getElementById('reg-telefono')?.value.trim();
            const direccion = document.getElementById('reg-direccion')?.value.trim();
            const horario = document.getElementById('reg-horario')?.value.trim();
            const password = document.getElementById('reg-password')?.value;
            const password2 = document.getElementById('reg-password2')?.value;
            
            console.log('Datos:', { nombre, email, telefono, direccion, horario });
            
            if (!nombre || !email || !telefono || !direccion) {
                alert('Completá todos los campos obligatorios');
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
            
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Registrando...';
            
            try {
                const response = await registrarVendedorConLogo(nombre, email, telefono, direccion, horario, password, null);
                console.log('Respuesta:', response);
                
                if (response && response.success) {
                    alert('✅ Registro exitoso. Ahora podés iniciar sesión.');
                    mostrarPanelLogin();
                    registerForm.reset();
                    document.getElementById('login-email').value = email;
                } else {
                    alert('❌ Error: ' + (response?.error || 'Error desconocido'));
                }
            } catch (error) {
                console.error('Error:', error);
                alert('❌ Error: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
        console.log('✅ Register form configurado');
    } else {
        console.error('❌ Register form NO encontrado');
    }
    
    // 3. Botones de navegación
    const btnShowRegister = document.getElementById('btn-show-register');
    if (btnShowRegister) {
        btnShowRegister.onclick = (e) => {
            e.preventDefault();
            mostrarPanelRegistro();
        };
        console.log('✅ Botón Registrarse configurado');
    }
    
    const btnShowRecover = document.getElementById('btn-show-recover');
    if (btnShowRecover) {
        btnShowRecover.onclick = (e) => {
            e.preventDefault();
            mostrarPanelRecuperacion();
        };
        console.log('✅ Botón Recuperar configurado');
    }
    
    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
        backToLogin.onclick = (e) => {
            e.preventDefault();
            mostrarPanelLogin();
        };
    }
    
    const backToLoginRecover = document.getElementById('back-to-login-recover');
    if (backToLoginRecover) {
        backToLoginRecover.onclick = (e) => {
            e.preventDefault();
            mostrarPanelLogin();
        };
    }
    
    // 4. Logo preview
    const regLogo = document.getElementById('reg-logo');
    if (regLogo) {
        regLogo.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const preview = document.getElementById('reg-logo-preview');
                    if (preview) preview.innerHTML = `<img src="${ev.target.result}" style="max-width: 80px; border-radius: 12px;">`;
                };
                reader.readAsDataURL(file);
            }
        };
    }
    
    console.log('✅ Todos los event listeners configurados');
});

// Exponer funciones globalmente
window.login = login;
window.registrarVendedorConLogo = registrarVendedorConLogo;
window.mostrarPanelRegistro = mostrarPanelRegistro;
window.mostrarPanelRecuperacion = mostrarPanelRecuperacion;
window.mostrarPanelLogin = mostrarPanelLogin;