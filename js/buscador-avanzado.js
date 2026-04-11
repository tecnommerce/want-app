// ===================================================
// BUSCADOR AVANZADO - MODO PANTALLA COMPLETA
// ===================================================

const BuscadorAvanzado = {
    // Configuración
    config: {
        maxHistorial: 10,
        debounceDelay: 200,
        minCharsSugerencias: 1
    },
    
    // Estado
    state: {
        historial: [],
        modoBusqueda: false,
        terminoActual: '',
        timeoutId: null
    },
    
    // ===================================================
    // INICIALIZACIÓN
    // ===================================================
    
    init: function() {
        console.log('🔍 Inicializando Buscador Avanzado...');
        
        this.cargarHistorial();
        this.crearEstructuraHTML();
        this.eventos();
        
        console.log('✅ Buscador Avanzado inicializado');
    },
    
    // ===================================================
    // CREAR ESTRUCTURA HTML
    // ===================================================
    
    crearEstructuraHTML: function() {
        // Overlay
        const overlay = document.createElement('div');
        overlay.className = 'search-overlay';
        overlay.id = 'search-overlay';
        document.body.appendChild(overlay);
        
        // Panel fullscreen
        const fullscreen = document.createElement('div');
        fullscreen.className = 'search-fullscreen';
        fullscreen.id = 'search-fullscreen';
        fullscreen.innerHTML = `
            <div class="search-fullscreen-header">
                <button class="btn-back-search" id="btn-back-search">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="search-fullscreen-input-wrapper">
                    <input type="text" class="search-fullscreen-input" id="search-fullscreen-input" placeholder="Buscar negocios, productos..." autocomplete="off">
                    <button class="btn-clear-search" id="btn-clear-search" style="display: none;">
                        <i class="fas fa-times-circle"></i>
                    </button>
                </div>
            </div>
            <div class="search-fullscreen-content" id="search-fullscreen-content">
                <div class="search-loading" style="display: none;">
                    <div class="spinner-small"></div>
                    <span>Buscando...</span>
                </div>
                <div id="search-results-container"></div>
            </div>
        `;
        document.body.appendChild(fullscreen);
        
        this.elements = {
            overlay: document.getElementById('search-overlay'),
            fullscreen: document.getElementById('search-fullscreen'),
            input: document.getElementById('search-fullscreen-input'),
            content: document.getElementById('search-fullscreen-content'),
            loading: document.querySelector('.search-loading'),
            resultsContainer: document.getElementById('search-results-container'),
            btnBack: document.getElementById('btn-back-search'),
            btnClear: document.getElementById('btn-clear-search')
        };
    },
    
    // ===================================================
    // HISTORIAL
    // ===================================================
    
    cargarHistorial: function() {
        const historialGuardado = localStorage.getItem('want_busquedas_historial');
        if (historialGuardado) {
            try {
                this.state.historial = JSON.parse(historialGuardado);
            } catch(e) {
                this.state.historial = [];
            }
        }
    },
    
    guardarHistorial: function() {
        localStorage.setItem('want_busquedas_historial', JSON.stringify(this.state.historial));
    },
    
    agregarAlHistorial: function(termino) {
        if (!termino || termino.trim().length === 0) return;
        termino = termino.trim();
        this.state.historial = this.state.historial.filter(h => h !== termino);
        this.state.historial.unshift(termino);
        if (this.state.historial.length > this.config.maxHistorial) {
            this.state.historial.pop();
        }
        this.guardarHistorial();
    },
    
    eliminarDelHistorial: function(termino) {
        this.state.historial = this.state.historial.filter(h => h !== termino);
        this.guardarHistorial();
        this.renderizarHistorial();
    },
    
    limpiarHistorial: function() {
        this.state.historial = [];
        this.guardarHistorial();
        this.renderizarHistorial();
    },
    
    // ===================================================
    // RENDERIZADO
    // ===================================================
    
    renderizarHistorial: function() {
        if (!this.elements.resultsContainer) return;
        
        if (this.state.historial.length === 0) {
            this.elements.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-history"></i>
                    <p>No hay búsquedas recientes</p>
                </div>
            `;
            return;
        }
        
        this.elements.resultsContainer.innerHTML = `
            <div class="search-section">
                <div class="search-section-title">
                    <i class="fas fa-history"></i>
                    <span>BÚSQUEDAS RECIENTES</span>
                    <button class="btn-limpiar-historial" id="btn-limpiar-historial-full" style="margin-left: auto; background: none; border: none; color: #999; font-size: 0.7rem; cursor: pointer;">
                        <i class="fas fa-trash-alt"></i> Limpiar
                    </button>
                </div>
                <div class="historial-list">
                    ${this.state.historial.map(termino => `
                        <div class="historial-item-full" data-termino="${escapeHTML(termino)}">
                            <div class="icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="text">${escapeHTML(termino)}</div>
                            <button class="delete" data-termino="${escapeHTML(termino)}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Evento limpiar historial
        const btnLimpiar = document.getElementById('btn-limpiar-historial-full');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.limpiarHistorial();
            });
        }
        
        // Eventos items
        document.querySelectorAll('.historial-item-full').forEach(item => {
            const termino = item.dataset.termino;
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.delete')) {
                    this.realizarBusqueda(termino);
                }
            });
        });
        
        document.querySelectorAll('.historial-item-full .delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const termino = btn.dataset.termino;
                this.eliminarDelHistorial(termino);
            });
        });
    },
    
    renderizarSugerencias: function(sugerencias, termino) {
        if (!this.elements.resultsContainer) return;
        
        const { negocios, productos, rubros } = sugerencias;
        
        if (negocios.length === 0 && productos.length === 0 && rubros.length === 0) {
            this.elements.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-search"></i>
                    <p>No encontramos resultados para <strong>"${escapeHTML(termino)}"</strong></p>
                    <p style="font-size: 0.7rem; margin-top: 8px;">Probá con otras palabras</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        if (negocios.length > 0) {
            html += `
                <div class="search-section">
                    <div class="search-section-title">
                        <i class="fas fa-store"></i>
                        <span>NEGOCIOS</span>
                    </div>
                    <div class="sugerencias-list">
                        ${negocios.map(n => `
                            <div class="sugerencia-item-full" data-tipo="negocio" data-id="${n.id}" data-termino="${escapeHTML(n.nombre)}">
                                <div class="icon negocio">
                                    <i class="fas fa-store"></i>
                                </div>
                                <div class="info">
                                    <div class="titulo">${this.resaltarTexto(n.nombre, termino)}</div>
                                    <div class="subtitulo">${escapeHTML(n.rubros?.[0] || 'Negocio')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (productos.length > 0) {
            html += `
                <div class="search-section">
                    <div class="search-section-title">
                        <i class="fas fa-pizza-slice"></i>
                        <span>PRODUCTOS</span>
                    </div>
                    <div class="sugerencias-list">
                        ${productos.map(p => `
                            <div class="sugerencia-item-full" data-tipo="producto" data-negocio-id="${p.negocioId}" data-termino="${escapeHTML(p.nombre)}">
                                <div class="icon producto">
                                    <i class="fas fa-pizza-slice"></i>
                                </div>
                                <div class="info">
                                    <div class="titulo">${this.resaltarTexto(p.nombre, termino)}</div>
                                    <div class="subtitulo">${escapeHTML(p.negocioNombre)} • ${formatearPrecio(p.precio)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (rubros.length > 0) {
            html += `
                <div class="search-section">
                    <div class="search-section-title">
                        <i class="fas fa-tag"></i>
                        <span>RUBROS</span>
                    </div>
                    <div class="sugerencias-list">
                        ${rubros.map(r => `
                            <div class="sugerencia-item-full" data-tipo="rubro" data-termino="${escapeHTML(r)}">
                                <div class="icon rubro">
                                    <i class="fas fa-tag"></i>
                                </div>
                                <div class="info">
                                    <div class="titulo">${this.resaltarTexto(r, termino)}</div>
                                    <div class="subtitulo">Rubro</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        this.elements.resultsContainer.innerHTML = html;
        
        // Eventos sugerencias
        document.querySelectorAll('.sugerencia-item-full').forEach(item => {
            item.addEventListener('click', () => {
                const tipo = item.dataset.tipo;
                const id = item.dataset.id;
                const negocioId = item.dataset.negocioId;
                const termino = item.dataset.termino;
                
                this.cerrarModoBusqueda();
                
                if (tipo === 'negocio' && id) {
                    window.location.href = `tienda.html?vendedor=${id}`;
                } else if (tipo === 'producto' && negocioId) {
                    window.location.href = `tienda.html?vendedor=${negocioId}`;
                } else if (termino) {
                    this.realizarBusqueda(termino);
                }
            });
        });
    },
    
    // ===================================================
    // OBTENER SUGERENCIAS
    // ===================================================
    
    obtenerSugerencias: async function(termino) {
        if (!termino || termino.length < this.config.minCharsSugerencias) {
            return { negocios: [], productos: [], rubros: [] };
        }
        
        const terminoLower = termino.toLowerCase();
        
        const negocios = (window.todosLosNegocios || []).filter(n => 
            n.nombre?.toLowerCase().includes(terminoLower)
        ).slice(0, 4);
        
        let productos = [];
        for (const negocio of (window.todosLosNegocios || [])) {
            if (negocio.productos) {
                const encontrados = negocio.productos.filter(p =>
                    p.nombre?.toLowerCase().includes(terminoLower)
                ).map(p => ({
                    ...p,
                    negocioNombre: negocio.nombre,
                    negocioId: negocio.id
                }));
                productos.push(...encontrados);
            }
        }
        productos = productos.slice(0, 4);
        
        const rubros = (window.RUBROS_DISPONIBLES || []).filter(r =>
            r.toLowerCase().includes(terminoLower)
        ).slice(0, 4);
        
        return { negocios, productos, rubros };
    },
    
    // ===================================================
    // BÚSQUEDA
    // ===================================================
    
    realizarBusqueda: function(termino) {
        if (!termino) return;
        
        this.agregarAlHistorial(termino);
        this.cerrarModoBusqueda();
        
        if (typeof terminoBusquedaActual !== 'undefined') {
            terminoBusquedaActual = termino;
            if (typeof realizarBusqueda === 'function') {
                realizarBusqueda(termino);
            }
        }
        
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = termino;
    },
    
    // ===================================================
    // MODO BÚSQUEDA
    // ===================================================
    
    abrirModoBusqueda: function() {
        if (this.state.modoBusqueda) return;
        
        this.state.modoBusqueda = true;
        document.body.classList.add('search-mode');
        this.elements.overlay.classList.add('active');
        this.elements.fullscreen.classList.add('active');
        
        setTimeout(() => {
            this.elements.input.focus();
        }, 100);
        
        this.renderizarHistorial();
    },
    
    cerrarModoBusqueda: function() {
        if (!this.state.modoBusqueda) return;
        
        this.state.modoBusqueda = false;
        this.state.terminoActual = '';
        document.body.classList.remove('search-mode');
        this.elements.overlay.classList.remove('active');
        this.elements.fullscreen.classList.remove('active');
        this.elements.input.value = '';
        this.elements.btnClear.style.display = 'none';
    },
    
    // ===================================================
    // MANEJAR BÚSQUEDA EN TIEMPO REAL
    // ===================================================
    
    handleInput: async function() {
        const termino = this.elements.input.value;
        this.state.terminoActual = termino;
        
        if (this.state.timeoutId) clearTimeout(this.state.timeoutId);
        
        if (termino.length >= this.config.minCharsSugerencias) {
            this.elements.btnClear.style.display = 'flex';
            this.elements.resultsContainer.innerHTML = `
                <div class="search-loading">
                    <div class="spinner-small"></div>
                    <span>Buscando...</span>
                </div>
            `;
            
            this.state.timeoutId = setTimeout(async () => {
                const sugerencias = await this.obtenerSugerencias(termino);
                this.renderizarSugerencias(sugerencias, termino);
            }, this.config.debounceDelay);
        } else {
            this.elements.btnClear.style.display = 'none';
            this.renderizarHistorial();
        }
    },
    
    limpiarInput: function() {
        this.elements.input.value = '';
        this.state.terminoActual = '';
        this.elements.btnClear.style.display = 'none';
        this.renderizarHistorial();
        this.elements.input.focus();
    },
    
    // ===================================================
    // UTILIDADES
    // ===================================================
    
    resaltarTexto: function(texto, busqueda) {
        if (!texto || !busqueda) return escapeHTML(texto);
        const regex = new RegExp(`(${busqueda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return escapeHTML(texto).replace(regex, '<span class="sugerencia-resaltado">$1</span>');
    },
    
    // ===================================================
    // EVENTOS
    // ===================================================
    
    eventos: function() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('click', () => this.abrirModoBusqueda());
        }
        
        if (this.elements.btnBack) {
            this.elements.btnBack.addEventListener('click', () => this.cerrarModoBusqueda());
        }
        
        if (this.elements.btnClear) {
            this.elements.btnClear.addEventListener('click', () => this.limpiarInput());
        }
        
        if (this.elements.input) {
            this.elements.input.addEventListener('input', () => this.handleInput());
            this.elements.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const termino = this.elements.input.value.trim();
                    if (termino) {
                        this.realizarBusqueda(termino);
                    }
                }
            });
        }
        
        if (this.elements.overlay) {
            this.elements.overlay.addEventListener('click', () => this.cerrarModoBusqueda());
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.modoBusqueda) {
                this.cerrarModoBusqueda();
            }
        });
    }
};

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        BuscadorAvanzado.init();
    }, 500);
});