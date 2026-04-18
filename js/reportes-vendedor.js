// ===================================================
// REPORTES DE VENDEDOR - NUEVA VERSIÓN PROFESIONAL
// ===================================================

let filtroFechaDesde = null;
let filtroFechaHasta = null;

/**
 * Inicializar el sistema de reportes
 */
function inicializarReportes() {
    // Establecer fechas por defecto (últimos 30 días)
    const hoy = new Date();
    const hace30dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const inputDesde = document.getElementById('reporte-fecha-desde');
    const inputHasta = document.getElementById('reporte-fecha-hasta');
    
    if (inputDesde) inputDesde.valueAsDate = hace30dias;
    if (inputHasta) inputHasta.valueAsDate = hoy;
    
    // Event listeners
    const btnFiltrar = document.getElementById('btn-reporte-filtrar');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', generarReporte);
    }
    
    const btnExcel = document.getElementById('btn-descargar-excel');
    if (btnExcel) {
        btnExcel.addEventListener('click', descargarReporteExcel);
    }
    
    // Generar reporte inicial
    generarReporte();
}

/**
 * Generar reporte según fechas seleccionadas
 */
function generarReporte() {
    const inputDesde = document.getElementById('reporte-fecha-desde');
    const inputHasta = document.getElementById('reporte-fecha-hasta');
    
    if (!inputDesde || !inputHasta) return;
    
    filtroFechaDesde = inputDesde.valueAsDate;
    filtroFechaHasta = inputHasta.valueAsDate;
    
    if (!filtroFechaDesde || !filtroFechaHasta) {
        mostrarToast('Selecciona ambas fechas', 'error');
        return;
    }
    
    // Filtrar pedidos por fecha
    const pedidosFiltrados = pedidos.filter(pedido => {
        const fechaPedido = new Date(pedido.fecha);
        return fechaPedido >= filtroFechaDesde && fechaPedido <= filtroFechaHasta;
    });
    
    actualizarReportesNuevo(pedidosFiltrados);
}

/**
 * Actualizar todos los elementos del reporte
 */
function actualizarReportesNuevo(pedidosFiltrados) {
    if (!pedidosFiltrados) pedidosFiltrados = pedidos;
    
    // ESTADÍSTICAS PRINCIPALES
    const stats = calcularEstadisticas(pedidosFiltrados);
    
    // Total ventas
    const totalVentasEl = document.getElementById('reporte-total-ventas');
    if (totalVentasEl) totalVentasEl.textContent = formatearPrecio(stats.totalVentas);
    
    // Total pedidos
    const totalPedidosEl = document.getElementById('reporte-total-pedidos-count');
    if (totalPedidosEl) totalPedidosEl.textContent = `${stats.totalPedidos} pedidos`;
    
    // Entregados
    const entregadosEl = document.getElementById('reporte-pedidos-entregados-count');
    const entregadosPercentEl = document.getElementById('reporte-entregados-percent');
    const entregadosPercent = stats.totalPedidos > 0 ? Math.round((stats.entregados / stats.totalPedidos) * 100) : 0;
    if (entregadosEl) entregadosEl.textContent = stats.entregados;
    if (entregadosPercentEl) entregadosPercentEl.textContent = `${entregadosPercent}%`;
    
    // En progreso (preparando + en camino)
    const progresoEl = document.getElementById('reporte-pedidos-progreso');
    const progresoPercentEl = document.getElementById('reporte-progreso-percent');
    const enProgreso = stats.preparando + stats.enCamino;
    const progresoPercent = stats.totalPedidos > 0 ? Math.round((enProgreso / stats.totalPedidos) * 100) : 0;
    if (progresoEl) progresoEl.textContent = enProgreso;
    if (progresoPercentEl) progresoPercentEl.textContent = `${progresoPercent}%`;
    
    // Ticket promedio
    const ticketPromedioEl = document.getElementById('reporte-ticket-promedio');
    const ticketVariacionEl = document.getElementById('reporte-ticket-variacion');
    const ticketPromedio = stats.totalPedidos > 0 ? stats.totalVentas / stats.totalPedidos : 0;
    if (ticketPromedioEl) ticketPromedioEl.textContent = formatearPrecio(ticketPromedio);
    if (ticketVariacionEl) ticketVariacionEl.textContent = `+${Math.round(ticketPromedio / 100)}%`;
    
    // TOP PRODUCTOS
    actualizarTopProductos(pedidosFiltrados);
    
    // MÉTODOS DE PAGO
    actualizarMetodosPago(pedidosFiltrados);
    
    // ÚLTIMOS PEDIDOS
    actualizarUltimosPedidos(pedidosFiltrados);
}

/**
 * Calcular estadísticas principales
 */
function calcularEstadisticas(pedidosFiltrados) {
    let totalVentas = 0;
    let entregados = 0;
    let preparando = 0;
    let enCamino = 0;
    let cancelados = 0;
    
    pedidosFiltrados.forEach(pedido => {
        const monto = parseFloat(pedido.total) || 0;
        totalVentas += monto;
        
        if (pedido.estado === 'entregado') entregados++;
        else if (pedido.estado === 'preparando' || pedido.estado === 'en preparacion') preparando++;
        else if (pedido.estado === 'en camino') enCamino++;
        else if (pedido.estado === 'cancelado') cancelados++;
    });
    
    return {
        totalVentas,
        totalPedidos: pedidosFiltrados.length,
        entregados,
        preparando,
        enCamino,
        cancelados
    };
}

/**
 * Actualizar tabla de Top 5 productos
 */
function actualizarTopProductos(pedidosFiltrados) {
    const ventasPorProducto = {};
    
    pedidosFiltrados.forEach(pedido => {
        if (pedido.productos && Array.isArray(pedido.productos)) {
            pedido.productos.forEach(prod => {
                const nombre = prod.nombre || 'Sin nombre';
                if (!ventasPorProducto[nombre]) {
                    ventasPorProducto[nombre] = {
                        cantidad: 0,
                        monto: 0,
                        precio: prod.precio || 0
                    };
                }
                ventasPorProducto[nombre].cantidad += prod.cantidad || 1;
                ventasPorProducto[nombre].monto += (prod.precio || 0) * (prod.cantidad || 1);
            });
        }
    });
    
    const topProductos = Object.entries(ventasPorProducto)
        .map(([nombre, data]) => ({ nombre, ...data }))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 5);
    
    const container = document.getElementById('reporte-top-productos');
    if (!container) return;
    
    if (topProductos.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--gray-400);">No hay datos</div>';
        return;
    }
    
    const maxMonto = Math.max(...topProductos.map(p => p.monto));
    
    container.innerHTML = topProductos.map(prod => {
        const porcentaje = (prod.monto / maxMonto) * 100;
        return `
            <div class="reportes-producto-item">
                <div class="reportes-producto-info">
                    <div class="reportes-producto-nombre">${escapeHTML(prod.nombre)}</div>
                    <div class="reportes-producto-cantidad">${prod.cantidad} unidades</div>
                </div>
                <div class="reportes-producto-stats">
                    <div class="reportes-stat-mini">
                        <div class="reportes-stat-mini-label">Venta</div>
                        <div class="reportes-stat-mini-value">${formatearPrecio(prod.monto)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Actualizar gráfico de métodos de pago
 */
function actualizarMetodosPago(pedidosFiltrados) {
    const metodosPago = {
        'efectivo': 0,
        'transferencia': 0
    };
    
    pedidosFiltrados.forEach(pedido => {
        const metodo = (pedido.metodo_pago || 'efectivo').toLowerCase();
        if (metodo in metodosPago) {
            metodosPago[metodo] += parseFloat(pedido.total) || 0;
        } else {
            metodosPago[metodo] = parseFloat(pedido.total) || 0;
        }
    });
    
    const total = Object.values(metodosPago).reduce((a, b) => a + b, 0);
    
    const container = document.getElementById('reporte-metodos-pago');
    if (!container) return;
    
    if (total === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--gray-400);">No hay datos</div>';
        return;
    }
    
    const metodoLabels = {
        'efectivo': '💵 Efectivo',
        'transferencia': '🏦 Transferencia Bancaria',
        'otra': '💳 Otro'
    };
    
    container.innerHTML = Object.entries(metodosPago)
        .filter(([_, monto]) => monto > 0)
        .map(([metodo, monto]) => {
            const porcentaje = (monto / total) * 100;
            return `
                <div class="reportes-metodo-item">
                    <div class="reportes-metodo-nombre">
                        ${metodoLabels[metodo] || metodo}
                    </div>
                    <div class="reportes-metodo-bar">
                        <div class="reportes-metodo-barra">
                            <div class="reportes-metodo-barra-fill" style="width: ${porcentaje}%"></div>
                        </div>
                    </div>
                    <div class="reportes-metodo-valor">${formatearPrecio(monto)}</div>
                </div>
            `;
        }).join('');
}

/**
 * Actualizar tabla de últimos pedidos
 */
function actualizarUltimosPedidos(pedidosFiltrados) {
    const ultimosPedidos = [...pedidosFiltrados]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 10);
    
    const container = document.getElementById('reporte-ultimos-pedidos');
    if (!container) return;
    
    if (ultimosPedidos.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--gray-400);">No hay pedidos en este período</div>';
        return;
    }
    
    const estadoBadge = (estado) => {
        const clases = {
            'preparando': 'preparando',
            'en preparacion': 'en-preparacion',
            'en camino': 'en-camino',
            'entregado': 'entregado',
            'cancelado': 'cancelado'
        };
        return `<span class="reportes-estado ${clases[estado] || estado}">${estado}</span>`;
    };
    
    container.innerHTML = `
        <div class="reportes-pedidos-tabla">
            <table class="reportes-tabla">
                <thead>
                    <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${ultimosPedidos.map(pedido => `
                        <tr>
                            <td class="reportes-id">#${pedido.id || 'N/A'}</td>
                            <td>${escapeHTML(pedido.cliente_nombre || 'S/N')}</td>
                            <td class="reportes-fecha">${formatearFechaPedido(pedido.fecha)}</td>
                            <td class="reportes-monto">${formatearPrecio(pedido.total || 0)}</td>
                            <td>${estadoBadge(pedido.estado || 'desconocido')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Formatear fecha para mostrar en reportes
 */
function formatearFechaPedido(fechaISO) {
    if (!fechaISO) return 'N/A';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
    });
}

/**
 * Descargar reporte en Excel
 */
function descargarReporteExcel() {
    if (!filtroFechaDesde || !filtroFechaHasta) {
        mostrarToast('Selecciona primero un rango de fechas', 'error');
        return;
    }
    
    const pedidosFiltrados = pedidos.filter(pedido => {
        const fechaPedido = new Date(pedido.fecha);
        return fechaPedido >= filtroFechaDesde && fechaPedido <= filtroFechaHasta;
    });
    
    if (pedidosFiltrados.length === 0) {
        mostrarToast('No hay pedidos en este período', 'error');
        return;
    }
    
    // Crear contenido CSV
    const headers = ['ID', 'Cliente', 'Teléfono', 'Dirección', 'Fecha', 'Monto', 'Método Pago', 'Estado', 'Productos'];
    const rows = pedidosFiltrados.map(p => [
        p.id || 'N/A',
        p.cliente_nombre || 'S/N',
        p.cliente_telefono || 'N/A',
        p.direccion || 'N/A',
        formatearFechaPedido(p.fecha),
        formatearMontoParaCSV(p.total || 0),
        p.metodo_pago || 'N/A',
        p.estado || 'N/A',
        extraerProductos(p.productos)
    ]);
    
    // Estadísticas
    const stats = calcularEstadisticas(pedidosFiltrados);
    const resumen = [
        ['RESUMEN DEL PERÍODO'],
        ['Desde:', new Date(filtroFechaDesde).toLocaleDateString('es-AR')],
        ['Hasta:', new Date(filtroFechaHasta).toLocaleDateString('es-AR')],
        [],
        ['Total de Pedidos:', stats.totalPedidos],
        ['Total de Ventas:', formatearMonoParaCSV(stats.totalVentas)],
        ['Entregados:', stats.entregados],
        ['En Preparación:', stats.preparando],
        ['En Camino:', stats.enCamino],
        ['Cancelados:', stats.cancelados]
    ];
    
    // Convertir a CSV
    const csv = [
        ...resumen,
        [],
        headers,
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].map(row => Array.isArray(row) ? row.join(',') : row).join('\n');
    
    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    mostrarToast('Reporte descargado correctamente', 'success');
}

/**
 * Utilidades para CSV
 */
function formatearMontoParaCSV(monto) {
    return `$${Number(monto).toFixed(2)}`;
}

function formatearMonoParaCSV(monto) {
    return formatearMontoParaCSV(monto);
}

function extraerProductos(productos) {
    if (!productos || !Array.isArray(productos)) return '';
    return productos.map(p => `${p.cantidad}x ${p.nombre}`).join('; ');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        inicializarReportes();
    }, 500);
});
