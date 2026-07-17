'use server'

import { revalidatePath } from 'next/cache'
import {
  crearProveedor,
  actualizarProveedor,
  buscarProveedorPorDocumento,
  getCompras,
  getDetalleCompra,
  registrarNuevaCompraRPC,
  Proveedor,
  CompraData
} from '../../lib/compras.service'

/**
 * Guarda o edita un proveedor en el directorio.
 */
export async function guardarProveedor(proveedor: Proveedor, esEdicion: boolean) {
  try {
    let result
    if (esEdicion) {
      if (!proveedor.id) throw new Error('ID de proveedor faltante para edición.')
      result = await actualizarProveedor(proveedor.id, proveedor)
    } else {
      result = await crearProveedor(proveedor)
    }

    revalidatePath('/admin/compras')
    return result
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Busca un proveedor por documento en caliente.
 */
export async function buscarProveedor(documento: string) {
  try {
    return await buscarProveedorPorDocumento(documento)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Registra una factura de compra transaccional en base de datos.
 * Revalida la ruta de administración general para refrescar stock físico
 * y el Kardex para mostrar el ingreso respectivo.
 */
export async function crearCompra(compra: CompraData) {
  try {
    const result = await registrarNuevaCompraRPC(compra)
    
    // Forzamos actualizaciones de caché generales
    revalidatePath('/admin')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/kardex')
    revalidatePath('/admin/compras')
    
    return result
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Carga el historial de facturas de compra.
 */
export async function obtenerCompras() {
  try {
    return await getCompras()
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Carga los artículos de una compra en específico.
 */
export async function obtenerDetalleDeCompra(compraId: string) {
  try {
    return await getDetalleCompra(compraId)
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
 * Búsqueda de proveedores por coincidencia de documento o razón social.
 */
export async function buscarProveedores(query: string) {
  try {
    const { buscarProveedoresPorFiltro } = await import('../../lib/compras.service')
    return await buscarProveedoresPorFiltro(query)
  } catch (error: any) {
    throw new Error(error.message)
  }
}
