'use server'

import { revalidatePath } from 'next/cache'
import { getKardex } from '../../lib/ventas.service'
import { registrarAjusteInventario, AjusteStockData } from '../../lib/inventario.service'

/**
 * Obtiene el historial de movimientos de Kardex.
 * Filtra opcionalmente por un ID de producto.
 */
export async function obtenerHistorialKardex(productoId?: string) {
  try {
    return await getKardex(productoId)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Registra un ajuste de stock manual (Entrada/Salida) y revalida las cachés.
 */
export async function registrarMovimientoAjuste(ajuste: AjusteStockData) {
  try {
    const success = await registrarAjusteInventario(ajuste)
    
    // Forzamos a Next.js a actualizar sus cachés de inventario, dashboard y kardex
    revalidatePath('/admin')
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/kardex')
    
    return success
  } catch (error: any) {
    throw new Error(error.message)
  }
}
