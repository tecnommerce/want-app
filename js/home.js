// ===================================================
// HOME - Lógica de la página principal
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Home de Want iniciada');
    await cargarNegocios();
    inicializarMenu();
    inicializarBuscador();
});

async function cargarNegocios() {
    const grid = document.getElementById('negocios-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Cargando negocios...</p>
        </div>
    `;

    try {
        const response = await callAPI('getVendedores');
        
        if (response.error || !response.success) {
            throw new Error(response.error || 'Error al cargar negocios');
        }

        const vendedores = response.vendedores || [];
        
        if (vendedores.length === 0) {
            grid.innerHTML = `<div class="sin-negocios"><p>📭 No hay negocios disponibles</p></div>`;
            return;
        }

        renderizarNegocios(vendedores);
        
    } catch (error) {
        console.error('❌ Error:', error);
        grid.innerHTML = `
            <div class="error-mensaje">
                <p>⚠️ Error: ${error.message}</p>
                <button onclick="location.reload()" class="btn btn-outline">Reintentar</button>
            </div>
        `;
    }
}

function renderizarNegocios(vendedores) {
    const grid = document.getElementById('negocios-grid');
    grid.innerHTML = vendedores.map(v => `
        <a href="tienda.html?vendedor=${v.id}" class="negocio-card">
            <div class="negocio-logo">
                ${v.logo_url ? 
                    `<img src="${v.logo_url}" alt="${v.nombre || 'Negocio'}">` : 
                    `<div class="placeholder-logo">${(v.nombre || '?').charAt(0)}</div>`
                }
            </div>
            <div class="negocio-info">
                <h3 class="negocio-nombre">${escapeHTML(v.nombre || 'Sin nombre')}</h3>
                <p class="negocio-direccion">📍 ${escapeHTML(v.direccion || 'Sin dirección')}</p>
                <p class="negocio-horario">🕐 ${escapeHTML(v.horario || 'Sin horario')}</p>
            </div>
        </a>
    `).join('');
    console.log(`✅ Cargados ${vendedores.length} negocios`);
}

// Buscador
function inicializarBuscador() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.negocio-card');
        
        cards.forEach(card => {
            const nombre = card.querySelector('.negocio-nombre')?.textContent.toLowerCase() || '';
            const direccion = card.querySelector('.negocio-direccion')?.textContent.toLowerCase() || '';
            
            if (nombre.includes(termino) || direccion.includes(termino)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// Menú móvil y contacto
function inicializarMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuClose = document.getElementById('menu-close');
    const contactoLink = document.getElementById('contacto-link');
    const contactoLinkMobile = document.getElementById('contacto-link-mobile');
    const contactoSection = document.getElementById('contacto-section');

    function openMenu() {
        if (mobileMenu) mobileMenu.classList.add('active');
        if (menuOverlay) menuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        if (mobileMenu) mobileMenu.classList.remove('active');
        if (menuOverlay) menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

    function mostrarContacto(e) {
        e.preventDefault();
        closeMenu();
        if (contactoSection) {
            contactoSection.style.display = 'block';
            contactoSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    if (contactoLink) contactoLink.addEventListener('click', mostrarContacto);
    if (contactoLinkMobile) contactoLinkMobile.addEventListener('click', mostrarContacto);
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}