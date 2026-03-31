// ===================================================
// HOME - Lógica de la página principal
// Con filtro de vendedores activos
// ===================================================

let todosLosNegocios = [];
let timeoutBusqueda = null;
let terminoBusquedaActual = '';

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

        // Solo vendedores activos
        todosLosNegocios = (response.vendedores || []).filter(v => v.activo === 'SI');
        
        if (todosLosNegocios.length === 0) {
            grid.innerHTML = `<div class="sin-negocios"><p>📭 No hay negocios disponibles</p></div>`;
            return;
        }

        await cargarProductosParaBusqueda(todosLosNegocios);
        renderizarNegocios(todosLosNegocios);
        
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
                <p>🔍 No encontramos negocios que coincidan con "${escapeHTML(terminoBusquedaActual)}"</p>
                <p class="sugerencia">Probá con otras palabras o mirá todos los negocios</p>
                <button onclick="limpiarBusqueda()" class="btn btn-outline" style="margin-top: 15px;">Ver todos los negocios</button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = vendedores.map(v => {
        const productosPreview = v.productos && v.productos.length > 0 
            ? v.productos.slice(0, 2).map(p => p.nombre).join(', ') 
            : '';
        
        const nombreResaltado = resaltarCoincidencia(v.nombre || 'Sin nombre', terminoBusquedaActual);
        const direccionResaltada = resaltarCoincidencia(v.direccion || 'Sin dirección', terminoBusquedaActual);
        
        return `
            <a href="tienda.html?vendedor=${v.id}" class="negocio-card" data-nombre="${escapeHTML(v.nombre || '').toLowerCase()}" data-direccion="${escapeHTML(v.direccion || '').toLowerCase()}">
                <div class="negocio-logo">
                    ${v.logo_url ? 
                        `<img src="${v.logo_url}" alt="${escapeHTML(v.nombre || 'Negocio')}">` : 
                        `<div class="placeholder-logo">${(v.nombre || '?').charAt(0)}</div>`
                    }
                </div>
                <div class="negocio-info">
                    <h3 class="negocio-nombre">${nombreResaltado}</h3>
                    <p class="negocio-direccion">📍 ${direccionResaltada}</p>
                    <p class="negocio-horario">🕐 ${escapeHTML(v.horario || 'Sin horario')}</p>
                    ${productosPreview ? `<p class="negocio-productos">🍕 ${escapeHTML(productosPreview)}...</p>` : ''}
                </div>
            </a>
        `;
    }).join('');
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
            const direccionMatch = negocio.direccion?.toLowerCase().includes(termino) || false;
            const horarioMatch = negocio.horario?.toLowerCase().includes(termino) || false;
            
            let productosMatch = false;
            if (negocio.productos && negocio.productos.length > 0) {
                productosMatch = negocio.productos.some(producto => 
                    producto.nombre?.toLowerCase().includes(termino) || 
                    producto.descripcion?.toLowerCase().includes(termino)
                );
            }
            
            return nombreMatch || direccionMatch || horarioMatch || productosMatch;
        });
        
        console.log(`🔍 Búsqueda "${termino}": ${resultados.length} resultados de ${todosLosNegocios.length}`);
        
        if (resultados.length === 0) {
            mostrarSinResultados(termino);
        } else {
            renderizarNegocios(resultados);
        }
    }, 100);
}

function mostrarSinResultados(termino) {
    const grid = document.getElementById('negocios-grid');
    
    const sugerencias = todosLosNegocios.filter(negocio => {
        const nombre = negocio.nombre?.toLowerCase() || '';
        const direccion = negocio.direccion?.toLowerCase() || '';
        const terminoPalabras = termino.split(' ');
        return terminoPalabras.some(palabra => 
            nombre.includes(palabra) || direccion.includes(palabra)
        );
    }).slice(0, 3);
    
    grid.innerHTML = `
        <div class="sin-negocios">
            <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 15px;"></i>
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