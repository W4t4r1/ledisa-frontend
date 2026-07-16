import { supabase } from './supabase'

export interface CajaSesion {
  id?: string
  fecha_apertura?: string
  fecha_cierre?: string | null
  monto_apertura: number
  monto_cierre_efectivo_calculado?: number
  monto_cierre_efectivo_real?: number
  diferencia?: number
  estado: 'ABIERTA' | 'CERRADA'
  total_ventas_efectivo?: number
  total_ventas_tarjeta?: number
  total_ventas_transferencia?: number
  total_ventas_yape?: number
  total_egresos_caja_chica?: number
  total_ingresos_caja_chica?: number
  nota?: string | null
}

export interface CajaChicaMovimiento {
  id?: string
  sesion_id: string
  tipo: 'INGRESO' | 'EGRESO'
  monto: number
  motivo: string
  metodo_pago?: string
  fecha?: string
}

/**
 * Obtiene la sesión de caja abierta actual (si existe).
 */
export async function getSesionCajaActiva(): Promise<CajaSesion | null> {
  const { data, error } = await supabase
    .from('cajas_sesiones')
    .select('*')
    .eq('estado', 'ABIERTA')
    .order('fecha_apertura', { ascending: false })
    .maybeSingle()

  if (error) {
    throw new Error(`Error al buscar sesión de caja activa: ${error.message}`)
  }

  return data
}

/**
 * Registra la apertura de una nueva sesión de caja (turno).
 */
export async function abrirSesionCaja(montoApertura: number): Promise<CajaSesion> {
  // Asegurar que no haya otra caja abierta antes de abrir una nueva
  const activa = await getSesionCajaActiva()
  if (activa) {
    throw new Error('Ya existe una sesión de caja abierta activa. Debes cerrarla primero.')
  }

  const { data, error } = await supabase
    .from('cajas_sesiones')
    .insert({
      monto_apertura: montoApertura,
      estado: 'ABIERTA'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Error al abrir turno de caja: ${error.message}`)
  }

  return data
}

/**
 * Registra un movimiento (Ingreso/Egreso) de Caja Chica.
 */
export async function crearMovimientoCajaChica(movimiento: CajaChicaMovimiento): Promise<CajaChicaMovimiento> {
  const { data, error } = await supabase
    .from('caja_chica_movimientos')
    .insert({
      sesion_id: movimiento.sesion_id,
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      motivo: movimiento.motivo.trim(),
      metodo_pago: movimiento.metodo_pago || 'Efectivo'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Error al registrar movimiento de caja chica: ${error.message}`)
  }

  return data
}

/**
 * Obtiene todos los movimientos de caja chica de una sesión.
 */
export async function getMovimientosSesion(sesionId: string): Promise<CajaChicaMovimiento[]> {
  const { data, error } = await supabase
    .from('caja_chica_movimientos')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('fecha', { ascending: true })

  if (error) {
    throw new Error(`Error al cargar movimientos de caja chica: ${error.message}`)
  }

  return data || []
}

/**
 * Obtiene la lista de ventas realizadas durante una sesión de caja.
 */
export async function getVentasSesionCaja(sesionId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      id,
      codigo_venta,
      total,
      metodo_pago,
      estado,
      fecha,
      clientes (
        nombre_razon_social
      )
    `)
    .eq('sesion_caja_id', sesionId)

  if (error) {
    throw new Error(`Error al obtener ventas del turno: ${error.message}`)
  }

  return data || []
}

/**
 * Realiza el cuadre final de caja (arqueo) y cierra el turno de caja.
 */
export async function ejecutarCierreCaja(
  sesionId: string,
  montoRealEfectivo: number,
  nota: string
): Promise<CajaSesion> {
  // 1. Obtener la sesión activa para validar su estado y saldo inicial
  const { data: sesion, error: errSesion } = await supabase
    .from('cajas_sesiones')
    .select('*')
    .eq('id', sesionId)
    .single()

  if (errSesion || !sesion) {
    throw new Error(`No se encontró la sesión de caja a cerrar.`)
  }

  if (sesion.estado === 'CERRADA') {
    throw new Error('Esta sesión de caja ya se encuentra cerrada.')
  }

  // 2. Cargar todas las ventas confirmadas (PAGADO/ENTREGADO) vinculadas a este turno
  const { data: ventas, error: errVentas } = await supabase
    .from('ventas')
    .select('total, metodo_pago')
    .eq('sesion_caja_id', sesionId)
    .in('estado', ['PAGADO', 'ENTREGADO'])

  if (errVentas) {
    throw new Error(`Error al consolidar ventas del turno: ${errVentas.message}`)
  }

  // 3. Cargar todos los movimientos de caja chica registrados
  const { data: movimientos, error: errMov } = await supabase
    .from('caja_chica_movimientos')
    .select('tipo, monto')
    .eq('sesion_id', sesionId)

  if (errMov) {
    throw new Error(`Error al consolidar movimientos de caja chica: ${errMov.message}`)
  }

  // 4. Calcular consolidados de ventas por método de pago
  let vEfectivo = 0
  let vTarjeta = 0
  let vYape = 0
  let vTransferencia = 0

  ventas?.forEach(v => {
    const totalVal = Number(v.total)
    const m = (v.metodo_pago || '').toLowerCase()
    
    if (m.includes('efectivo')) {
      vEfectivo += totalVal
    } else if (m.includes('yape') || m.includes('plin')) {
      vYape += totalVal
    } else if (m.includes('tarjeta') || m.includes('credito') || m.includes('debito')) {
      vTarjeta += totalVal
    } else {
      // Cualquier otro método se agrupa como transferencia
      vTransferencia += totalVal
    }
  })

  // 5. Calcular consolidados de caja chica
  let egresosCajaChica = 0
  let ingresosCajaChica = 0

  movimientos?.forEach(m => {
    const montoVal = Number(m.monto)
    if (m.tipo === 'EGRESO') {
      egresosCajaChica += montoVal
    } else {
      ingresosCajaChica += montoVal
    }
  })

  // 6. Efectivo Calculado Esperado: Apertura + Ventas Efectivo + Ingresos Caja Chica - Egresos Caja Chica
  const efectivoEsperado = Number(sesion.monto_apertura) + vEfectivo + ingresosCajaChica - egresosCajaChica
  const diferencia = montoRealEfectivo - efectivoEsperado

  // 7. Actualizar la sesión en base de datos
  const { data: sesionCerrada, error: errCierre } = await supabase
    .from('cajas_sesiones')
    .update({
      fecha_cierre: new Date().toISOString(),
      estado: 'CERRADA',
      monto_cierre_efectivo_calculado: efectivoEsperado,
      monto_cierre_efectivo_real: montoRealEfectivo,
      diferencia: diferencia,
      total_ventas_efectivo: vEfectivo,
      total_ventas_tarjeta: vTarjeta,
      total_ventas_yape: vYape,
      total_ventas_transferencia: vTransferencia,
      total_egresos_caja_chica: egresosCajaChica,
      total_ingresos_caja_chica: ingresosCajaChica,
      nota: nota.trim() || null
    })
    .eq('id', sesionId)
    .select()
    .single()

  if (errCierre) {
    throw new Error(`Error al registrar el cierre de caja: ${errCierre.message}`)
  }

  return sesionCerrada
}

/**
 * Obtiene el historial completo de cajas cerradas.
 */
export async function getHistorialSesionesCaja(): Promise<CajaSesion[]> {
  const { data, error } = await supabase
    .from('cajas_sesiones')
    .select('*')
    .eq('estado', 'CERRADA')
    .order('fecha_apertura', { ascending: false })

  if (error) {
    throw new Error(`Error al obtener historial de cajas: ${error.message}`)
  }

  return data || []
}
