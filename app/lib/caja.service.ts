import { supabase } from './supabase'

export interface CajaSesion {
  id?: string
  empresa_id?: string | null
  fecha_apertura?: string
  fecha_cierre?: string | null
  monto_apertura: number // Fondo inicial en efectivo
  monto_apertura_yape?: number // Saldo inicial Yape
  monto_apertura_tarjeta?: number // Saldo inicial Tarjeta BCP / POS
  monto_apertura_transferencia?: number // Saldo inicial Transferencias
  monto_cierre_efectivo_calculado?: number
  monto_cierre_efectivo_real?: number
  diferencia?: number
  monto_cierre_tarjeta_real?: number
  diferencia_tarjeta?: number
  monto_cierre_transferencia_real?: number
  diferencia_transferencia?: number
  monto_cierre_yape_real?: number
  diferencia_yape?: number
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
 * Normaliza los datos de la sesión extrayendo saldos iniciales digitales incluso si la tabla aún no tiene la columna.
 */
export function normalizarSesionCaja(data: any): CajaSesion {
  if (!data) return data
  let bcpApertura = Number(data.monto_apertura_yape || data.monto_apertura_tarjeta || 0)
  if (bcpApertura === 0 && data.nota) {
    const match = String(data.nota).match(/\[APERTURA_BCP:([\d.]+)\]/)
    if (match && match[1]) {
      bcpApertura = parseFloat(match[1]) || 0
    }
  }
  return {
    ...data,
    monto_apertura_yape: bcpApertura
  }
}

/**
 * Obtiene la sesión de caja abierta actual para la empresa activa (si existe).
 */
export async function getSesionCajaActiva(empresaId?: string): Promise<CajaSesion | null> {
  let query = supabase
    .from('cajas_sesiones')
    .select('*')
    .eq('estado', 'ABIERTA')

  if (empresaId) {
    query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
  }

  const { data, error } = await query
    .order('fecha_apertura', { ascending: false })
    .maybeSingle()

  if (error) {
    throw new Error(`Error al buscar sesión de caja activa: ${error.message}`)
  }

  return data ? normalizarSesionCaja(data) : null
}

/**
 * Registra la apertura de una nueva sesión de caja (turno) con saldos iniciales de Efectivo, Yape y Tarjeta BCP.
 */
export async function abrirSesionCaja(
  montoAperturaEfectivo: number,
  montoAperturaYape: number = 0,
  montoAperturaTarjeta: number = 0,
  montoAperturaTransferencia: number = 0,
  empresaId?: string
): Promise<CajaSesion> {
  const activa = await getSesionCajaActiva(empresaId)
  if (activa) {
    throw new Error('Ya existe una sesión de caja abierta activa. Debes cerrarla primero.')
  }

  const notaTag = montoAperturaYape > 0 ? `[APERTURA_BCP:${montoAperturaYape}]` : null

  const payload: any = {
    monto_apertura: montoAperturaEfectivo,
    monto_apertura_yape: montoAperturaYape,
    monto_apertura_tarjeta: montoAperturaTarjeta,
    monto_apertura_transferencia: montoAperturaTransferencia,
    empresa_id: empresaId || null,
    estado: 'ABIERTA',
    nota: notaTag
  }

  const { data, error } = await supabase
    .from('cajas_sesiones')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // Si las columnas nuevas aún no existen en Supabase, guardar como fallback en nota
    if (error.message.includes('column') || error.message.includes('monto_apertura_yape')) {
      const fallbackPayload = {
        monto_apertura: montoAperturaEfectivo,
        empresa_id: empresaId || null,
        estado: 'ABIERTA',
        nota: notaTag
      }
      const { data: dataFallback, error: errFallback } = await supabase
        .from('cajas_sesiones')
        .insert(fallbackPayload)
        .select()
        .single()

      if (errFallback) {
        throw new Error(`Error al abrir turno de caja: ${errFallback.message}`)
      }
      return normalizarSesionCaja(dataFallback)
    }
    throw new Error(`Error al abrir turno de caja: ${error.message}`)
  }

  return normalizarSesionCaja(data)
}

/**
 * Permite ajustar o actualizar el saldo inicial BCP de un turno activo.
 */
export async function actualizarSaldoInicialBcp(sesionId: string, montoBcp: number): Promise<void> {
  const { data: sesion } = await supabase
    .from('cajas_sesiones')
    .select('nota')
    .eq('id', sesionId)
    .single()

  const notaActual = sesion?.nota || ''
  let nuevaNota = notaActual
  if (nuevaNota.includes('[APERTURA_BCP:')) {
    nuevaNota = nuevaNota.replace(/\[APERTURA_BCP:[\d.]+\]/, `[APERTURA_BCP:${montoBcp}]`)
  } else {
    nuevaNota = `${nuevaNota} [APERTURA_BCP:${montoBcp}]`.trim()
  }

  // Intentar actualizar columna si existe, o en la nota
  const { error } = await supabase
    .from('cajas_sesiones')
    .update({
      monto_apertura_yape: montoBcp,
      nota: nuevaNota
    })
    .eq('id', sesionId)

  if (error && error.message.includes('column')) {
    await supabase
      .from('cajas_sesiones')
      .update({
        nota: nuevaNota
      })
      .eq('id', sesionId)
  }
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
      estado_pago,
      monto_pagado,
      saldo_pendiente,
      fecha,
      clientes (
        nombre_razon_social
      ),
      venta_pagos (
        metodo_pago,
        monto
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
 * Soporta desgloses de pagos mixtos y abonos a crédito cobrados en el turno.
 */
export async function ejecutarCierreCaja(
  sesionId: string,
  montoRealEfectivo: number,
  montoRealYape: number,
  montoRealTransferencia: number,
  montoRealTarjeta: number,
  nota: string
): Promise<CajaSesion> {
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

  // 1. Obtener ventas asociadas al turno
  const { data: ventas, error: errVentas } = await supabase
    .from('ventas')
    .select(`
      id,
      total,
      metodo_pago,
      monto_pagado,
      estado_pago,
      venta_pagos (
        metodo_pago,
        monto
      )
    `)
    .eq('sesion_caja_id', sesionId)
    .in('estado', ['PAGADO', 'ENTREGADO'])

  if (errVentas) {
    throw new Error(`Error al consolidar ventas del turno: ${errVentas.message}`)
  }

  // 2. Obtener abonos recibidos durante este turno (cobranzas de crédito)
  const { data: abonos, error: errAbonos } = await supabase
    .from('venta_abonos')
    .select('monto, metodo_pago')
    .eq('sesion_caja_id', sesionId)

  if (errAbonos && errAbonos.code !== 'PGRST116') {
    console.warn('Nota: No se pudieron cargar abonos (o la tabla aún no existe):', errAbonos?.message)
  }

  // 3. Cargar movimientos de caja chica
  const { data: movimientos, error: errMov } = await supabase
    .from('caja_chica_movimientos')
    .select('tipo, monto, metodo_pago')
    .eq('sesion_id', sesionId)

  if (errMov) {
    throw new Error(`Error al consolidar movimientos de caja chica: ${errMov.message}`)
  }

  let vEfectivo = 0
  let vTarjeta = 0
  let vYape = 0
  let vTransferencia = 0

  const sumarMetodo = (mPago: string, monto: number) => {
    const m = (mPago || '').toLowerCase()
    if (m.includes('efectivo')) vEfectivo += monto
    else if (m.includes('yape') || m.includes('plin')) vYape += monto
    else if (m.includes('tarjeta') || m.includes('credito') || m.includes('debito')) vTarjeta += monto
    else vTransferencia += monto
  }

  // Procesar ventas y sus desgloses
  ventas?.forEach(v => {
    if (v.venta_pagos && v.venta_pagos.length > 0) {
      v.venta_pagos.forEach((vp: any) => {
        sumarMetodo(vp.metodo_pago, Number(vp.monto))
      })
    } else {
      const montoEfectivoVenta = Number(v.monto_pagado) || Number(v.total)
      sumarMetodo(v.metodo_pago || 'Efectivo', montoEfectivoVenta)
    }
  })

  // Procesar abonos de cobranza en la tarde
  abonos?.forEach(a => {
    sumarMetodo(a.metodo_pago || 'Efectivo', Number(a.monto))
  })

  // Procesar movimientos de caja chica
  let egresosCajaChica = 0
  let ingresosCajaChica = 0
  
  let egresosEfectivo = 0, ingresosEfectivo = 0
  let egresosYape = 0, ingresosYape = 0
  let egresosTarjeta = 0, ingresosTarjeta = 0
  let egresosTransferencia = 0, ingresosTransferencia = 0

  movimientos?.forEach(m => {
    const montoVal = Number(m.monto)
    const met = (m.metodo_pago || 'Efectivo').toLowerCase()
    const tipo = m.tipo

    if (tipo === 'EGRESO') egresosCajaChica += montoVal
    else ingresosCajaChica += montoVal

    if (met.includes('efectivo')) {
      if (tipo === 'EGRESO') egresosEfectivo += montoVal
      else ingresosEfectivo += montoVal
    } else if (met.includes('yape') || met.includes('plin')) {
      if (tipo === 'EGRESO') egresosYape += montoVal
      else ingresosYape += montoVal
    } else if (met.includes('tarjeta') || met.includes('credito') || met.includes('debito')) {
      if (tipo === 'EGRESO') egresosTarjeta += montoVal
      else ingresosTarjeta += montoVal
    } else {
      if (tipo === 'EGRESO') egresosTransferencia += montoVal
      else ingresosTransferencia += montoVal
    }
  })

  // Totales esperados considerando saldos de apertura
  const efectivoApertura = Number(sesion.monto_apertura || 0)
  const yapeApertura = Number(sesion.monto_apertura_yape || 0)
  const tarjetaApertura = Number(sesion.monto_apertura_tarjeta || 0)
  const transferenciaApertura = Number(sesion.monto_apertura_transferencia || 0)

  const efectivoEsperado = efectivoApertura + vEfectivo + ingresosEfectivo - egresosEfectivo
  const yapeEsperado = yapeApertura + vYape + ingresosYape - egresosYape
  const transferenciaEsperado = transferenciaApertura + vTransferencia + ingresosTransferencia - egresosTransferencia
  const tarjetaEsperado = tarjetaApertura + vTarjeta + ingresosTarjeta - egresosTarjeta

  const diferencia = montoRealEfectivo - efectivoEsperado
  const diferenciaYape = montoRealYape - yapeEsperado
  const diferenciaTransferencia = montoRealTransferencia - transferenciaEsperado
  const diferenciaTarjeta = montoRealTarjeta - tarjetaEsperado

  const { data: sesionCerrada, error: errCierre } = await supabase
    .from('cajas_sesiones')
    .update({
      fecha_cierre: new Date().toISOString(),
      estado: 'CERRADA',
      monto_cierre_efectivo_calculado: efectivoEsperado,
      monto_cierre_efectivo_real: montoRealEfectivo,
      diferencia: diferencia,
      monto_cierre_yape_real: montoRealYape,
      diferencia_yape: diferenciaYape,
      monto_cierre_transferencia_real: montoRealTransferencia,
      diferencia_transferencia: diferenciaTransferencia,
      monto_cierre_tarjeta_real: montoRealTarjeta,
      diferencia_tarjeta: diferenciaTarjeta,
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
 * Obtiene el historial completo de cajas cerradas por empresa.
 */
export async function getHistorialSesionesCaja(empresaId?: string): Promise<CajaSesion[]> {
  let query = supabase
    .from('cajas_sesiones')
    .select('*')
    .eq('estado', 'CERRADA')

  if (empresaId) {
    query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
  }

  const { data, error } = await query.order('fecha_apertura', { ascending: false })

  if (error) {
    throw new Error(`Error al obtener historial de cajas: ${error.message}`)
  }

  return (data || []).map(normalizarSesionCaja)
}
