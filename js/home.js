// ===================================================
// HOME - Lógica de la página principal (CON MEJORAS)
// ===================================================

let todosLosNegocios = [];
let timeoutBusqueda = null;
let terminoBusquedaActual = '';

// Variables para el carrusel de banners
let banners = [];
let currentIndex = 0;
let autoPlayInterval = null;
const AUTO_PLAY_DELAY = 5000;

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

function formatearRubros(rubros, isMobile = false) {
    if (!rubros || rubros.length === 0) return '';
    
    // En móvil mostrar máximo 2 rubros, en desktop mostrar 3
    const maxRubros = isMobile ? 2 : 3;
    const rubrosMostrar = rubros.slice(0, maxRubros);
    const resto = rubros.length - maxRubros;
    
    let rubrosHTML = rubrosMostrar.map(r => `<span class="rubro-tag">${escapeHTML(r)}</span>`).join('');
    if (resto > 0) {
        rubrosHTML += `<span class="rubro-tag rubro-mas">+${resto}</span>`;
    }
    return `<div class="rubros-container">${rubrosHTML}</div>`;
}

function getEstadoTexto(estadoAbierto) {
    if (estadoAbierto === true || estadoAbierto === 'true' || estadoAbierto === 1) {
        return '<span class="estado-abierto"><i class="fas fa-check-circle"></i> Atendiendo</span>';
    }
    return '<span class="estado-cerrado"><i class="fas fa-times-circle"></i> Cerrado</span>';
}

function resaltarCoincidencia(texto, busqueda) {
    if (!busqueda || !texto) return escapeHTML(texto);
    
    const textoLower = texto.toLowerCase();
    const busquedaLower = busqueda.toLowerCase();
    const index = textoLower.indexOf(busquedaLower);
    
    if (index === -1) return escapeHTML(texto);
    
    const antes = escapeHTML(texto.substring(0, index));
    const coincidencia = escapeHTML(texto.substring(index, index + busqueda.length));
    const despues = escapeHTML(texto.substring(index + busqueda.length));
    
    return `${antes}<span class="coincidencia">${coincidencia}</span>${despues}`;
}

// ===================================================
// NEGOCIOS
// ===================================================

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

        todosLosNegocios = (response.vendedores || []).filter(v => v.activo === true);
        
        if (todosLosNegocios.length === 0) {
            grid.innerHTML = `<div class="sin-negocios"><i class="fas fa-store-slash"></i><p>📭 No hay negocios disponibles</p></div>`;
            return;
        }

        await cargarProductosParaBusqueda(todosLosNegocios);
        renderizarNegocios(todosLosNegocios);
        
    } catch (error) {
        console.error('❌ Error:', error);
        grid.innerHTML = `
            <div class="error-mensaje">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ef4444; margin-bottom: 15px;"></i>
                <p>⚠️ Error: ${error.message}</p>
                <button onclick="location.reload()" class="btn btn-outline" style="margin-top: 15px;">Reintentar</button>
            </div>
        `;
    }
}

async function cargarProductosParaBusqueda(negocios) {
    try {
        for (let negocio of negocios) {
            const response = await callAPI('getProductos', { vendedorId: negocio.id });
            if (response.success && response.productos) {
                negocio.productos = response.productos;
            } else {
                negocio.productos = [];
            }
        }
        console.log('✅ Productos cargados para búsqueda avanzada');
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

function renderizarNegocios(vendedores) {
    const grid = document.getElementById('negocios-grid');
    if (!grid) return;
    
    if (vendedores.length === 0) {
        grid.innerHTML = `
            <div class="sin-negocios">
                <i class="fas fa-search"></i>
                <p>🔍 No encontramos negocios que coincidan con <strong>"${escapeHTML(terminoBusquedaActual)}"</strong></p>
                <p class="sugerencia">Probá con otras palabras como: pizza, hamburguesa, café, delivery...</p>
                <button onclick="limpiarBusqueda()" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-store"></i> Ver todos los negocios
                </button>
            </div>
        `;
        return;
    }
    
    const isMobile = window.innerWidth <= 768;
    
    grid.innerHTML = vendedores.map(v => {
        const rubros = v.rubros || [];
        const estadoAbierto = v.estado_abierto === true || v.estado_abierto === 'true' || v.estado_abierto === 1;
        
        // Mostrar más rubros en desktop (4), en móvil (3)
        const maxRubros = isMobile ? 3 : 4;
        const rubrosMostrar = rubros.slice(0, maxRubros);
        const resto = rubros.length - maxRubros;
        
        let rubrosHTML = rubrosMostrar.map(r => `<span class="rubro-tag">${escapeHTML(r)}</span>`).join('');
        if (resto > 0) {
            rubrosHTML += `<span class="rubro-tag rubro-mas">+${resto}</span>`;
        }
        
        const nombreResaltado = resaltarCoincidencia(v.nombre || 'Sin nombre', terminoBusquedaActual);
        
        return `
            <a href="tienda.html?vendedor=${v.id}" class="negocio-card">
                <div class="negocio-logo">
                    ${v.logo_url ? 
                        `<img src="${v.logo_url}" alt="${escapeHTML(v.nombre || 'Negocio')}" loading="lazy">` : 
                        `<div class="placeholder-logo">${(v.nombre || '?').charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="negocio-info">
                    <h3 class="negocio-nombre">${nombreResaltado}</h3>
                    <div class="negocio-estado-rubros">
                        <span class="${estadoAbierto ? 'estado-abierto' : 'estado-cerrado'}">
                            <i class="fas ${estadoAbierto ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                            ${estadoAbierto ? 'Atendiendo' : 'Cerrado'}
                        </span>
                        ${rubrosHTML ? `<div class="rubros-container">${rubrosHTML}</div>` : ''}
                    </div>
                    ${v.horario ? `<p class="negocio-horario"><i class="fas fa-clock"></i> ${escapeHTML(v.horario)}</p>` : ''}
                </div>
            </a>
        `;
    }).join('');
    
    if (!window.resizedListener) {
        window.addEventListener('resize', () => {
            if (todosLosNegocios.length > 0) {
                renderizarNegocios(todosLosNegocios);
            }
        });
        window.resizedListener = true;
    }
}

function mostrarSinResultados(termino) {
    const grid = document.getElementById('negocios-grid');
    
    // Buscar sugerencias basadas en palabras clave
    const terminoPalabras = termino.split(' ');
    const sugerencias = todosLosNegocios.filter(negocio => {
        const nombre = negocio.nombre?.toLowerCase() || '';
        return terminoPalabras.some(palabra => 
            nombre.includes(palabra) && palabra.length > 2
        );
    }).slice(0, 3);
    
    grid.innerHTML = `
        <div class="sin-negocios">
            <i class="fas fa-search"></i>
            <p>🔍 No encontramos negocios que coincidan con <strong>"${escapeHTML(termino)}"</strong></p>
            <p class="sugerencia">Probá con otras palabras como: pizza, hamburguesa, café, delivery...</p>
            ${sugerencias.length > 0 ? `
                <div class="sugerencias">
                    <p>💡 Quizás te interese:</p>
                    <div class="sugerencias-lista">
                        ${sugerencias.map(n => `
                            <button onclick="buscarSugerencia('${escapeHTML(n.nombre)}')" class="btn-sugerencia">
                                ${escapeHTML(n.nombre)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <button onclick="limpiarBusqueda()" class="btn btn-primary" style="margin-top: 20px;">
                <i class="fas fa-store"></i> Ver todos los negocios
            </button>
        </div>
    `;
}

function buscarSugerencia(texto) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = texto;
        terminoBusquedaActual = texto.toLowerCase();
        realizarBusqueda(texto.toLowerCase());
    }
}

function limpiarBusqueda() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        terminoBusquedaActual = '';
        renderizarNegocios(todosLosNegocios);
    }
}

function inicializarBuscador() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const termino = e.target.value.toLowerCase().trim();
        terminoBusquedaActual = termino;
        
        if (timeoutBusqueda) clearTimeout(timeoutBusqueda);
        
        timeoutBusqueda = setTimeout(() => {
            realizarBusqueda(termino);
        }, 300);
    });
}

function realizarBusqueda(termino) {
    const grid = document.getElementById('negocios-grid');
    
    if (!termino) {
        renderizarNegocios(todosLosNegocios);
        return;
    }
    
    grid.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Buscando "${escapeHTML(termino)}"...</p>
        </div>
    `;
    
    setTimeout(() => {
        const resultados = todosLosNegocios.filter(negocio => {
            const nombreMatch = negocio.nombre?.toLowerCase().includes(termino) || false;
            const horarioMatch = negocio.horario?.toLowerCase().includes(termino) || false;
            
            // Búsqueda en rubros (todos, no solo primeros)
            const rubrosMatch = (negocio.rubros && negocio.rubros.some(r => 
                r.toLowerCase().includes(termino)
            )) || false;
            
            // Búsqueda en productos
            let productosMatch = false;
            if (negocio.productos && negocio.productos.length > 0) {
                productosMatch = negocio.productos.some(producto => 
                    producto.nombre?.toLowerCase().includes(termino) || 
                    producto.descripcion?.toLowerCase().includes(termino)
                );
            }
            
            return nombreMatch || horarioMatch || rubrosMatch || productosMatch;
        });
        
        console.log(`🔍 Búsqueda "${termino}": ${resultados.length} resultados de ${todosLosNegocios.length}`);
        
        if (resultados.length === 0) {
            mostrarSinResultados(termino);
        } else {
            renderizarNegocios(resultados);
        }
    }, 100);
}

function inicializarMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuClose = document.getElementById('menu-close');

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
}

// ===================================================
// BANNERS CARRUSEL
// ===================================================

async function cargarBanners() {
    try {
        console.log('🔄 Cargando banners...');
        
        if (typeof callAPI === 'undefined') {
            console.error('❌ callAPI no está definida');
            return;
        }
        
        const response = await callAPI('getBanners');
        console.log('📦 Respuesta banners:', response);
        
        if (response && response.success && response.banners && response.banners.length > 0) {
            banners = response.banners;
            console.log('✅ Banners cargados:', banners.length);
            renderizarBanners();
            iniciarCarrusel();
            const bannersSection = document.getElementById('banners-section');
            if (bannersSection) {
                bannersSection.style.display = 'block';
                console.log('✅ Sección de banners visible');
            }
        } else {
            console.log('⚠️ No hay banners para mostrar');
            const bannersSection = document.getElementById('banners-section');
            if (bannersSection) {
                bannersSection.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('❌ Error al cargar banners:', error);
        const bannersSection = document.getElementById('banners-section');
        if (bannersSection) {
            bannersSection.style.display = 'none';
        }
    }
}

function renderizarBanners() {
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');
    
    if (!track) return;
    
    if (banners.length === 0) {
        track.innerHTML = '';
        return;
    }
    
    track.innerHTML = banners.map((banner, index) => `
        <div class="banner-slide" onclick="window.open('${banner.link || '#'}', '_blank')">
            <img src="${banner.imagen_url}" alt="${escapeHTML(banner.titulo || 'Banner')}" loading="lazy">
            ${banner.titulo ? `<div class="banner-titulo">${escapeHTML(banner.titulo)}</div>` : ''}
        </div>
    `).join('');
    
    dotsContainer.innerHTML = banners.map((_, index) => `
        <div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>
    `).join('');
    
    document.querySelectorAll('.dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-index'));
            irAlSlide(index);
        });
    });
}

function iniciarCarrusel() {
    if (autoPlayInterval) clearInterval(autoPlayInterval);
    
    if (banners.length <= 1) return;
    
    autoPlayInterval = setInterval(() => {
        siguienteSlide();
    }, AUTO_PLAY_DELAY);
    
    const carousel = document.querySelector('.banner-carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', () => {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
        });
        carousel.addEventListener('mouseleave', () => {
            if (banners.length > 1) {
                autoPlayInterval = setInterval(() => {
                    siguienteSlide();
                }, AUTO_PLAY_DELAY);
            }
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
// INICIALIZACIÓN
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Home de Want iniciada');
    await cargarNegocios();
    await cargarBanners();
    inicializarMenu();
    inicializarBuscador();
    inicializarCarruselBotones();
});

// Exponer funciones globales
window.buscarSugerencia = buscarSugerencia;
window.limpiarBusqueda = limpiarBusqueda;