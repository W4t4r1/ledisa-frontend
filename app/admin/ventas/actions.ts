'use server'

import { revalidatePath } from 'next/cache'
import {
  buscarClientePorDocumento,
  crearCliente,
  Cliente
} from '../../lib/clientes.service'
import {
  registrarNuevaVenta,
  getVentas,
  getDetalleVenta,
  getKardex,
  VentaData
} from '../../lib/ventas.service'

/**
 * Busca un cliente por documento (DNI/RUC) desde componentes cliente.
 */
export async function buscarCliente(documento: string) {
  try {
    return await buscarClientePorDocumento(documento)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Registra un nuevo cliente desde componentes cliente.
 */
export async function guardarCliente(cliente: Cliente) {
  try {
    const result = await crearCliente(cliente)
    revalidatePath('/admin/ventas')
    return result
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Registra una venta completa. Si es exitosa, fuerza la actualización
 * de caché del Dashboard (para recalcular capitales/quiebres de stock),
 * del listado de inventario y de las ventas.
 */
export async function crearNuevaVenta(venta: VentaData) {
  try {
    const codigoVenta = await registrarNuevaVenta(venta)
    try {
      revalidatePath('/admin')
      revalidatePath('/admin/dashboard')
      revalidatePath('/admin/ventas')
    } catch (e) {
      console.warn('Revalidation warning:', e)
    }
    return { success: true, data: codigoVenta }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al procesar la venta' }
  }
}

/**
 * Obtiene el historial de ventas para componentes cliente.
 */
export async function obtenerVentas() {
  try {
    return await getVentas()
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Obtiene el detalle de productos de una venta para componentes cliente.
 */
export async function obtenerDetalle(ventaId: string) {
  try {
    return await getDetalleVenta(ventaId)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Obtiene el reporte de Kardex para componentes cliente.
 */
export async function obtenerKardex(productoId?: string) {
  try {
    return await getKardex(productoId)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Consulta RENIEC/SUNAT en caliente con fallback determinista.
 */
export async function buscarDniRucPeru(tipo: 'DNI' | 'RUC', numero: string) {
  try {
    const { consultarDniRuc } = await import('../../lib/peru-documentos')
    const data = await consultarDniRuc(tipo, numero)
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Búsqueda de clientes por coincidencia de documento o nombre.
 */
export async function buscarClientes(query: string) {
  try {
    const { buscarClientesPorFiltro } = await import('../../lib/clientes.service')
    return await buscarClientesPorFiltro(query)
  } catch (error: any) {
    throw new Error(error.message)
  }
}
