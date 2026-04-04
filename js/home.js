// ===================================================
// HOME - Lógica de la página principal
// ===================================================

let todosLosNegocios = [];
let timeoutBusqueda = null;
let terminoBusquedaActual = '';

// Variables para el carrusel de banners
let banners = [];
let currentIndex = 0;
let autoPlayInterval = null;
const AUTO_PLAY_DELAY = 5000;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Home de Want iniciada');
    await cargarNegocios();
    await cargarBanners();
    inicializarMenu();
    inicializarBuscador();
    inicializarCarruselBotones();
});

// ===================================================
// NEGOCIOS (tu código existente)
// ===================================================

// ... (tus funciones de negocios: cargarNegocios, renderizarNegocios, etc.)

// ===================================================
// BANNERS CARRUSEL
// ===================================================

async function cargarBanners() {
    try {
        const response = await callAPI('getBanners');
        
        if (response.success && response.banners && response.banners.length > 0) {
            banners = response.banners;
            renderizarBanners();
            iniciarCarrusel();
            const bannersSection = document.getElementById('banners-section');
            if (bannersSection) bannersSection.style.display = 'block';
        } else {
            const bannersSection = document.getElementById('banners-section');
            if (bannersSection) bannersSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error al cargar banners:', error);
        const bannersSection = document.getElementById('banners-section');
        if (bannersSection) bannersSection.style.display = 'none';
    }
}

function renderizarBanners() {
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');
    
    if (!track) return;
    
    // Renderizar slides
    track.innerHTML = banners.map((banner, index) => `
        <div class="banner-slide" onclick="window.open('${banner.link || '#'}', '_blank')">
            <img src="${banner.imagen_url}" alt="${escapeHTML(banner.titulo || 'Banner')}" loading="lazy">
            ${banner.titulo ? `<div class="banner-titulo">${escapeHTML(banner.titulo)}</div>` : ''}
        </div>
    `).join('');
    
    // Renderizar dots
    dotsContainer.innerHTML = banners.map((_, index) => `
        <div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>
    `).join('');
    
    // Agregar eventos a los dots
    document.querySelectorAll('.dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-index'));
            irAlSlide(index);
        });
    });
}

function iniciarCarrusel() {
    if (autoPlayInterval) clearInterval(autoPlayInterval);
    
    autoPlayInterval = setInterval(() => {
        siguienteSlide();
    }, AUTO_PLAY_DELAY);
    
    // Pausar autoplay al pasar el mouse
    const carousel = document.querySelector('.banner-carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', () => {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
        });
        carousel.addEventListener('mouseleave', () => {
            autoPlayInterval = setInterval(() => {
                siguienteSlide();
            }, AUTO_PLAY_DELAY);
        });
    }
}

function irAlSlide(index) {
    if (index < 0) index = 0;
    if (index >= banners.length) index = banners.length - 1;
    
    currentIndex = index;
    const track = document.getElementById('carousel-track');
    if (track) {
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }
    
    // Actualizar dots activos
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIndex);
    });
}

function siguienteSlide() {
    if (banners.length === 0) return;
    let newIndex = currentIndex + 1;
    if (newIndex >= banners.length) newIndex = 0;
    irAlSlide(newIndex);
}

function anteriorSlide() {
    if (banners.length === 0) return;
    let newIndex = currentIndex - 1;
    if (newIndex < 0) newIndex = banners.length - 1;
    irAlSlide(newIndex);
}

function inicializarCarruselBotones() {
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    
    if (prevBtn) prevBtn.addEventListener('click', anteriorSlide);
    if (nextBtn) nextBtn.addEventListener('click', siguienteSlide);
}

// ===================================================
// FUNCIONES UTILITARIAS
// ===================================================

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}