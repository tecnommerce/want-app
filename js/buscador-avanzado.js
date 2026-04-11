// ===================================================
// BUSCADOR AVANZADO - AUTOCOMPLETADO E HISTORIAL
// ===================================================

const BuscadorAvanzado = {
    // Configuración
    config: {
        maxHistorial: 10,
        debounceDelay: 200,
        minCharsSugerencias: 2
    },
    
    // Estado
    state: {
        historial: [],
        ultimaBusqueda: '',
        sugerenciasAbiertas: false,
        historialAbierto: false
    },
    
    // Elementos DOM
    elements: {
        searchInput: null,
        sugerenciasDropdown: null,
        historialPanel: null
    },
    
    // ===================================================
    // INICIALIZACIÓN
    // ===================================================
    
    init: function() {
        console.log('🔍 Inicializando Buscador Avanzado...');
        
        this.elements.searchInput = document.getElementById('search-input');
        if (!this.elements.searchInput) {
            console.error('❌ No se encontró el input de búsqueda');
            return;
        }
        
        this.cargarHistorial();
        this.crearElementos();
        this.eventos();
        
        console.log('✅ Buscador Avanzado inicializado');
    },
    
    // ===================================================
    // CREAR ELEMENTOS DOM
    // ===================================================
    
    crearElementos: function() {
        // Crear dropdown de sugerencias
        this.elements.sugerenciasDropdown = document.createElement('div');
        this.elements.sugerenciasDropdown.className = 'sugerencias-dropdown';
        this.elements.sugerenciasDropdown.id = 'sugerencias-dropdown';
        this.elements.searchInput.parentNode.appendChild(this.elements.sugerenciasDropdown);
        
        // Crear panel de historial
        this.elements.historialPanel = document.createElement('div');
        this.elements.historialPanel.className = 'historial-panel';
        this.elements.historialPanel.id = 'historial-panel';
        this.elements.searchInput.parentNode.appendChild(this.elements.historialPanel);
    },
    
    // ===================================================
    // HISTORIAL
    // ===================================================
    
    cargarHistorial: function() {
        const historialGuardado = localStorage.getItem('want_busquedas_historial');
        if (historialGuardado) {
            try {
                this.state.historial = JSON.parse(historialGuardado);
                console.log('📜 Historial cargado:', this.state.historial.length);
            } catch(e) {
                console.error('Error cargando historial:', e);
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
        
        // Eliminar si ya existe
        this.state.historial = this.state.historial.filter(h => h !== termino);
        
        // Agregar al principio
        this.state.historial.unshift(termino);
        
        // Limitar cantidad
        if (this.state.historial.length > this.config.maxHistorial) {
            this.state.historial.pop();
        }
        
        this.guardarHistorial();
        this.renderizarHistorial();
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
        this.cerrarHistorial();
    },
    
    renderizarHistorial: function() {
        if (!this.elements.historialPanel) return;
        
        if (this.state.historial.length === 0) {
            this.elements.historialPanel.innerHTML = `
                <div class="historial-vacio">
                    <div style="text-align: center; padding: 30px; color: #999;">
                        <i class="fas fa-history" style="font-size: 1.5rem; margin-bottom: 8px; display: block;"></i>
                        <span style="font-size: 0.8rem;">No hay búsquedas recientes</span>
                    </div>
                </div>
            `;
            return;
        }
        
        this.elements.historialPanel.innerHTML = `
            <div class="historial-header">
                <span><i class="fas fa-history"></i> Búsquedas recientes</span>
                <button class="btn-limpiar-historial" id="btn-limpiar-historial">
                    <i class="fas fa-trash-alt"></i> Limpiar
                </button>
            </div>
            <div class="historial-lista">
                ${this.state.historial.map(termino => `
                    <div class="historial-item" data-termino="${escapeHTML(termino)}">
                        <div class="historial-icono">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="historial-texto">${escapeHTML(termino)}</div>
                        <button class="btn-eliminar-historial" data-termino="${escapeHTML(termino)}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Evento para limpiar historial
        const btnLimpiar = document.getElementById('btn-limpiar-historial');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.limpiarHistorial();
            });
        }
        
        // Eventos para cada item
        document.querySelectorAll('.historial-item').forEach(item => {
            const termino = item.dataset.termino;
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-eliminar-historial')) {
                    this.realizarBusqueda(termino);
                }
            });
        });
        
        document.querySelectorAll('.btn-eliminar-historial').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const termino = btn.dataset.termino;
                this.eliminarDelHistorial(termino);
            });
        });
    },
    
    // ===================================================
    // SUGERENCIAS
    // ===================================================
    
    obtenerSugerencias: async function(termino) {
        if (!termino || termino.length < this.config.minCharsSugerencias) {
            return { negocios: [], productos: [], rubros: [] };
        }
        
        const terminoLower = termino.toLowerCase();
        
        // Buscar en negocios
        const negocios = (todosLosNegocios || []).filter(n => 
            n.nombre?.toLowerCase().includes(terminoLower)
        ).slice(0, 3);
        
        // Buscar en productos (a través de los negocios)
        let productos = [];
        for (const negocio of (todosLosNegocios || [])) {
            if (negocio.productos) {
                const productosEncontrados = negocio.productos.filter(p =>
                    p.nombre?.toLowerCase().includes(terminoLower)
                ).map(p => ({
                    ...p,
                    negocioNombre: negocio.nombre,
                    negocioId: negocio.id
                }));
                productos.push(...productosEncontrados);
            }
        }
        productos = productos.slice(0, 3);
        
        // Buscar en rubros
        const rubros = (window.RUBROS_DISPONIBLES || []).filter(r =>
            r.toLowerCase().includes(terminoLower)
        ).slice(0, 3);
        
        return { negocios, productos, rubros };
    },
    
    renderizarSugerencias: function(sugerencias, termino) {
        if (!this.elements.sugerenciasDropdown) return;
        
        const { negocios, productos, rubros } = sugerencias;
        const tieneResultados = negocios.length > 0 || productos.length > 0 || rubros.length > 0;
        
        if (!tieneResultados) {
            this.elements.sugerenciasDropdown.innerHTML = `
                <div class="sugerencias-vacio">
                    <i class="fas fa-search" style="font-size: 1.2rem; margin-bottom: 8px; display: block;"></i>
                    <span>No hay sugerencias para "${escapeHTML(termino)}"</span>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        // Grupos de sugerencias
        if (negocios.length > 0) {
            html += `
                <div class="sugerencias-grupo">
                    <div class="sugerencias-grupo-titulo">🏪 NEGOCIOS</div>
                    <div class="sugerencias-lista">
                        ${negocios.map(n => `
                            <div class="sugerencia-item" data-tipo="negocio" data-id="${n.id}" data-termino="${escapeHTML(n.nombre)}">
                                <div class="sugerencia-icono">
                                    <i class="fas fa-store"></i>
                                </div>
                                <div class="sugerencia-contenido">
                                    <div class="sugerencia-titulo">${this.resaltarTexto(n.nombre, termino)}</div>
                                    <div class="sugerencia-subtitulo">${escapeHTML(n.rubros?.[0] || 'Negocio')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (productos.length > 0) {
            html += `
                <div class="sugerencias-grupo">
                    <div class="sugerencias-grupo-titulo">📦 PRODUCTOS</div>
                    <div class="sugerencias-lista">
                        ${productos.map(p => `
                            <div class="sugerencia-item" data-tipo="producto" data-negocio-id="${p.negocioId}" data-termino="${escapeHTML(p.nombre)}">
                                <div class="sugerencia-icono">
                                    <i class="fas fa-pizza-slice"></i>
                                </div>
                                <div class="sugerencia-contenido">
                                    <div class="sugerencia-titulo">${this.resaltarTexto(p.nombre, termino)}</div>
                                    <div class="sugerencia-subtitulo">${escapeHTML(p.negocioNombre)} • ${formatearPrecio(p.precio)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (rubros.length > 0) {
            html += `
                <div class="sugerencias-grupo">
                    <div class="sugerencias-grupo-titulo">🏷️ RUBROS</div>
                    <div class="sugerencias-lista">
                        ${rubros.map(r => `
                            <div class="sugerencia-item" data-tipo="rubro" data-termino="${escapeHTML(r)}">
                                <div class="sugerencia-icono">
                                    <i class="fas fa-tag"></i>
                                </div>
                                <div class="sugerencia-contenido">
                                    <div class="sugerencia-titulo">${this.resaltarTexto(r, termino)}</div>
                                    <div class="sugerencia-subtitulo">Rubro</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        this.elements.sugerenciasDropdown.innerHTML = html;
        
        // Eventos para las sugerencias
        document.querySelectorAll('.sugerencia-item').forEach(item => {
            item.addEventListener('click', () => {
                const terminoSugerido = item.dataset.termino;
                const tipo = item.dataset.tipo;
                const id = item.dataset.id;
                const negocioId = item.dataset.negocioId;
                
                if (tipo === 'negocio' && id) {
                    window.location.href = `tienda.html?vendedor=${id}`;
                } else if (tipo === 'producto' && negocioId) {
                    window.location.href = `tienda.html?vendedor=${negocioId}`;
                } else if (terminoSugerido) {
                    this.realizarBusqueda(terminoSugerido);
                }
            });
        });
    },
    
    resaltarTexto: function(texto, busqueda) {
        if (!texto || !busqueda) return escapeHTML(texto);
        
        const regex = new RegExp(`(${busqueda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return escapeHTML(texto).replace(regex, '<span class="sugerencia-resaltado">$1</span>');
    },
    
    // ===================================================
    // BÚSQUEDA
    // ===================================================
    
    realizarBusqueda: function(termino) {
        if (!termino) return;
        
        this.agregarAlHistorial(termino);
        this.cerrarSugerencias();
        this.cerrarHistorial();
        
        if (this.elements.searchInput) {
            this.elements.searchInput.value = termino;
        }
        
        // Disparar búsqueda en home.js
        if (typeof terminoBusquedaActual !== 'undefined') {
            terminoBusquedaActual = termino;
            if (typeof realizarBusqueda === 'function') {
                realizarBusqueda(termino);
            } else if (typeof window.realizarBusqueda === 'function') {
                window.realizarBusqueda(termino);
            }
        }
    },
    
    // ===================================================
    // UI - ABRIR/CERRAR
    // ===================================================
    
    abrirHistorial: function() {
        if (this.state.historialAbierto) return;
        
        this.renderizarHistorial();
        this.elements.historialPanel.classList.add('active');
        this.cerrarSugerencias();
        this.state.historialAbierto = true;
    },
    
    cerrarHistorial: function() {
        this.elements.historialPanel.classList.remove('active');
        this.state.historialAbierto = false;
    },
    
    abrirSugerencias: function() {
        if (this.state.sugerenciasAbiertas) return;
        
        this.elements.sugerenciasDropdown.classList.add('active');
        this.cerrarHistorial();
        this.state.sugerenciasAbiertas = true;
    },
    
    cerrarSugerencias: function() {
        this.elements.sugerenciasDropdown.classList.remove('active');
        this.state.sugerenciasAbiertas = false;
    },
    
    // ===================================================
    // EVENTOS
    // ===================================================
    
    eventos: function() {
        let timeoutId = null;
        
        this.elements.searchInput.addEventListener('input', async (e) => {
            const termino = e.target.value;
            
            if (timeoutId) clearTimeout(timeoutId);
            
            if (termino.length >= this.config.minCharsSugerencias) {
                timeoutId = setTimeout(async () => {
                    this.elements.sugerenciasDropdown.innerHTML = `
                        <div class="sugerencias-loading">
                            <div class="spinner-small"></div>
                            <span>Buscando...</span>
                        </div>
                    `;
                    this.abrirSugerencias();
                    
                    const sugerencias = await this.obtenerSugerencias(termino);
                    this.renderizarSugerencias(sugerencias, termino);
                }, this.config.debounceDelay);
            } else {
                this.cerrarSugerencias();
            }
        });
        
        this.elements.searchInput.addEventListener('focus', () => {
            if (this.state.historial.length > 0) {
                this.abrirHistorial();
            }
        });
        
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const termino = this.elements.searchInput.value.trim();
                if (termino) {
                    this.realizarBusqueda(termino);
                    this.elements.searchInput.blur();
                }
            }
        });
        
        // Cerrar al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!this.elements.searchInput.contains(e.target) &&
                !this.elements.sugerenciasDropdown?.contains(e.target) &&
                !this.elements.historialPanel?.contains(e.target)) {
                this.cerrarSugerencias();
                this.cerrarHistorial();
            }
        });
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        BuscadorAvanzado.init();
    }, 500);
});