// ===================================================
// CONFIRMAR PEDIDO POR WHATSAPP (con modal personalizado)
// ===================================================

let pedidoPendienteConfirmar = null;
let botonPendienteConfirmar = null;

async function confirmarPedidoWhatsApp(pedidoId, boton) {
    const pedido = pedidos.find(p => p.id.toString() === pedidoId.toString());
    if (!pedido) return;
    
    pedidoPendienteConfirmar = pedido;
    botonPendienteConfirmar = boton;
    
    const input = document.getElementById('tiempo-entrega-input');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    document.getElementById('modal-tiempo-entrega').classList.add('active');
}

async function enviarConfirmacionWhatsApp() {
    const input = document.getElementById('tiempo-entrega-input');
    const tiempoEntrega = input?.value.trim();
    
    if (!tiempoEntrega) {
        mostrarToast('Ingrese un tiempo estimado de entrega', 'error');
        input?.focus();
        return;
    }
    
    if (!pedidoPendienteConfirmar || !botonPendienteConfirmar) {
        mostrarToast('Error: No hay pedido seleccionado', 'error');
        cerrarModalTiempo();
        return;
    }
    
    const pedido = pedidoPendienteConfirmar;
    const boton = botonPendienteConfirmar;
    
    const originalText = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    const productosTexto = pedido.productos.map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
    const metodoPagoTexto = pedido.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    
    let mensaje = `Hola ${pedido.cliente_nombre}, como estas? Recibimos tu pedido: ${productosTexto}. Ahora lo estamos preparando y te lo enviamos en aproximadamente ${tiempoEntrega}. Numero de orden: #${pedido.id}. Total a pagar: ${formatearPrecio(pedido.total)}.`;
    
    if (metodoPagoTexto === 'transferencia') {
        mensaje += ` Te pasamos nuestro alias y CBU para que nos realices el pago.`;
    } else {
        mensaje += ` Nos indicaste que pagarias con efectivo. Debes pagarle a nuestro delivery cuando te entregue el pedido. Muchas gracias por tu compra. Te avisamos cuando el pedido este en camino.`;
    }
    
    const url = `https://wa.me/${pedido.cliente_telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    try {
        const response = await postAPI('actualizarEstado', { pedidoId: pedido.id, estado: 'en preparacion' });
        if (response && response.success) {
            mostrarToast(`Pedido #${pedido.id} confirmado y actualizado a "En preparación"`, 'success');
            pedido.estado = 'en preparacion';
            actualizarContadoresPedidos();
            calcularMetricas();
            renderizarPedidos();
        }
    } catch (error) {
        console.error('Error al actualizar estado:', error);
    }
    
    cerrarModalTiempo();
    
    setTimeout(() => {
        boton.disabled = false;
        boton.innerHTML = originalText;
    }, 2000);
    
    pedidoPendienteConfirmar = null;
    botonPendienteConfirmar = null;
}

function cerrarModalTiempo() {
    document.getElementById('modal-tiempo-entrega').classList.remove('active');
    const input = document.getElementById('tiempo-entrega-input');
    if (input) input.value = '';
    pedidoPendienteConfirmar = null;
    botonPendienteConfirmar = null;
}