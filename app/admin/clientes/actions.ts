'use server'

import { revalidatePath } from 'next/cache'
import {
  crearCliente,
  actualizarCliente,
  getComprasCliente,
  Cliente
} from '../../lib/clientes.service'
import { getDetalleVenta } from '../../lib/ventas.service'

/**
 * Crea o edita un cliente en el CRM.
 */
export async function guardarClienteCRM(cliente: Cliente, esEdicion: boolean) {
  try {
    let result;
    if (esEdicion) {
      if (!cliente.id) throw new Error('ID de cliente faltante para edición.')
      result = await actualizarCliente(cliente.id, cliente)
    } else {
      result = await crearCliente(cliente)
    }
    
    // Forzamos revalidación de caché en el CRM y en el Workspace de Ventas
    revalidatePath('/admin/clientes')
    revalidatePath('/admin/ventas')
    
    return result
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Obtiene el historial de ventas/cotizaciones de un cliente.
 */
export async function obtenerComprasPorCliente(clienteId: string) {
  try {
    return await getComprasCliente(clienteId)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Obtiene el detalle de productos de una venta en específico.
 */
export async function obtenerDetalleDeCompra(ventaId: string) {
  try {
    return await getDetalleVenta(ventaId)
  } catch (error: any) {
    throw new Error(error.message)
  }
}
