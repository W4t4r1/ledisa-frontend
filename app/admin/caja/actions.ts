'use server'

import { revalidatePath } from 'next/cache'
import {
  getSesionCajaActiva,
  abrirSesionCaja,
  crearMovimientoCajaChica,
  getMovimientosSesion,
  getVentasSesionCaja,
  ejecutarCierreCaja,
  getHistorialSesionesCaja,
  CajaChicaMovimiento
} from '../../lib/caja.service'

/**
 * Obtiene la sesión de caja activa.
 */
export async function obtenerSesionCajaActiva() {
  try {
    return await getSesionCajaActiva()
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Abre el turno de caja chica con saldos iniciales.
 */
export async function abrirCaja(
  montoAperturaEfectivo: number,
  montoAperturaYape: number = 0,
  montoAperturaTarjeta: number = 0,
  montoAperturaTransferencia: number = 0
) {
  try {
    const res = await abrirSesionCaja(
      montoAperturaEfectivo,
      montoAperturaYape,
      montoAperturaTarjeta,
      montoAperturaTransferencia
    )
    revalidatePath('/admin/caja')
    revalidatePath('/admin/ventas') // Para que los vendedores detecten la caja abierta
    return res
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Registra un movimiento (ingreso/egreso) de dinero.
 */
export async function guardarMovimientoCajaChica(
  sesionId: string,
  tipo: 'INGRESO' | 'EGRESO',
  monto: number,
  motivo: string,
  metodoPago: string
) {
  try {
    const mov: CajaChicaMovimiento = {
      sesion_id: sesionId,
      tipo,
      monto,
      motivo,
      metodo_pago: metodoPago
    }
    const res = await crearMovimientoCajaChica(mov)
    revalidatePath('/admin/caja')
    return res
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Cierra la caja del turno actual y guarda consolidados.
 */
export async function cerrarTurnoCaja(
  sesionId: string,
  montoRealEfectivo: number,
  montoRealYape: number,
  montoRealTransferencia: number,
  montoRealTarjeta: number,
  nota: string
) {
  try {
    const res = await ejecutarCierreCaja(
      sesionId,
      montoRealEfectivo,
      montoRealYape,
      montoRealTransferencia,
      montoRealTarjeta,
      nota
    )
    revalidatePath('/admin/caja')
    revalidatePath('/admin/ventas')
    revalidatePath('/admin/dashboard') // Actualiza indicadores financieros globales
    return res
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Carga la bitácora de cajas cerradas.
 */
export async function obtenerHistorialCajas() {
  try {
    return await getHistorialSesionesCaja()
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Carga movimientos de caja chica de una sesión.
 */
export async function obtenerMovimientosDeSesion(sesionId: string) {
  try {
    return await getMovimientosSesion(sesionId)
  } catch (error: any) {
    throw new Error(error.message)
  }
}

/**
 * Carga ventas registradas durante una sesión.
 */
export async function obtenerVentasDeSesion(sesionId: string) {
  try {
    return await getVentasSesionCaja(sesionId)
  } catch (error: any) {
    throw new Error(error.message)
  }
}
