import { supabase } from './supabase'

export interface ItemVenta {
  producto_id: string
  cantidad_cajas: number
  piezas_sueltas: number
  precio_unitario: number
  costo_unitario: number
  piezas_por_caja: number
  subtotal: number
  lote?: string | null
  tono?: string | null
  calibre?: string | null
}

export interface PagoDetalle {
  metodo_pago: string
  monto: number
  referencia?: string
}

export interface VentaData {
  cliente_id: string | null
  subtotal: number
  descuento: number
  total: number
  metodo_pago: string
  estado: 'COTIZACION' | 'PAGADO' | 'ENTREGADO' | 'ANULADO'
  nota?: string
  items: ItemVenta[]
  empresa_id?: string | null
  estado_pago?: 'PAGADO' | 'PENDIENTE' | 'PAGADO_PARCIAL'
  pagos?: PagoDetalle[]
}

/**
 * Registra una venta o cotización en el sistema llamando a la función RPC transaccional de PostgreSQL.
 * @returns El código autogenerado de la venta (ej. V-260714-1234)
 */
export async function registrarNuevaVenta(venta: VentaData): Promise<string> {
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_cliente_id: venta.cliente_id,
    p_subtotal: venta.subtotal,
    p_descuento: venta.descuento,
    p_total: venta.total,
    p_metodo_pago: venta.metodo_pago,
    p_estado: venta.estado,
    p_nota: venta.nota || null,
    p_items: venta.items,
    p_empresa_id: venta.empresa_id || null,
    p_estado_pago: venta.estado_pago || 'PAGADO',
    p_pagos: venta.pagos && venta.pagos.length > 0 ? venta.pagos : null
  })

  if (error) {
    throw new Error(`Error en la transacción de venta: ${error.message}`)
  }

  return data as string
}

/**
 * Obtiene el historial de ventas y cotizaciones registradas,
 * opcionalmente filtradas por empresa.
 */
export async function getVentas(empresaId?: string): Promise<any[]> {
  let query = supabase
    .from('ventas')
    .select(`
      *,
      clientes (
        documento,
        nombre_razon_social,
        celular
      ),
      empresas (
        nombre
      ),
      venta_pagos (
        metodo_pago,
        monto,
        referencia
      )
    `)

  if (empresaId) {
    query = query.eq('empresa_id', empresaId)
  }

  const { data, error } = await query.order('fecha', { ascending: false })

  if (error) {
    throw new Error(`Error al cargar historial de ventas: ${error.message}`)
  }

  return data || []
}

/**
 * Obtiene todas las ventas con cuentas pendientes por cobrar (Créditos / Despachos pendientes).
 */
export async function getCuentasPorCobrar(empresaId?: string): Promise<any[]> {
  let query = supabase
    .from('ventas')
    .select(`
      *,
      clientes (
        id,
        documento,
        nombre_razon_social,
        celular,
        direccion
      ),
      empresas (
        nombre
      )
    `)
    .in('estado_pago', ['PENDIENTE', 'PAGADO_PARCIAL'])
    .neq('estado', 'ANULADO')
    .neq('estado_pago', 'ANULADO')
    .order('fecha', { ascending: false })

  if (empresaId) {
    query = query.eq('empresa_id', empresaId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error al cargar cuentas por cobrar: ${error.message}`)
  }

  return data || []
}

/**
 * Registra un abono / pago parcial o total para una venta a crédito.
 */
export async function registrarAbono(
  ventaId: string,
  monto: number,
  metodoPago: string,
  referencia?: string,
  nota?: string
): Promise<number> {
  const { data, error } = await supabase.rpc('registrar_abono_venta', {
    p_venta_id: ventaId,
    p_monto: monto,
    p_metodo_pago: metodoPago,
    p_referencia: referencia || null,
    p_nota: nota || null
  })

  if (error) {
    throw new Error(`Error al registrar el abono: ${error.message}`)
  }

  const nuevoSaldo = Number(data)

  // Si la deuda quedó saldada (saldo <= 0), marcar la venta como CANCELADO / PAGADO
  if (nuevoSaldo <= 0.01) {
    await supabase
      .from('ventas')
      .update({
        estado: 'PAGADO',
        estado_pago: 'PAGADO',
        saldo_pendiente: 0.00
      })
      .eq('id', ventaId)
  }

  return nuevoSaldo
}

/**
 * Obtiene los abonos realizados a una venta específica.
 */
export async function getAbonosVenta(ventaId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('venta_abonos')
    .select('*')
    .eq('venta_id', ventaId)
    .order('fecha', { ascending: false })

  if (error) {
    throw new Error(`Error al obtener abonos de la venta: ${error.message}`)
  }

  return data || []
}

/**
 * Obtiene el detalle específico de productos de una venta o cotización.
 */
export async function getDetalleVenta(ventaId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('ventas_detalle')
    .select(`
      *,
      inventario (
        nombre,
        categoria,
        color,
        m2_caja
      )
    `)
    .eq('venta_id', ventaId)

  if (error) {
    throw new Error(`Error al obtener detalle de la venta: ${error.message}`)
  }

  return data || []
}

/**
 * Obtiene el reporte de movimientos de stock histórico (Kardex).
 */
export async function getKardex(productoId?: string): Promise<any[]> {
  let query = supabase
    .from('kardex')
    .select(`
      *,
      inventario (
        nombre,
        categoria,
        color
      )
    `)

  if (productoId) {
    query = query.eq('producto_id', productoId)
  }

  const { data, error } = await query.order('fecha', { ascending: false })

  if (error) {
    throw new Error(`Error al cargar el Kardex: ${error.message}`)
  }

  return data || []
}

/**
 * Anula una venta registrada en el sistema.
 * Revierte el stock al inventario, registra el movimiento de Kardex (ANULACION_VENTA)
 * y actualiza el estado de la venta a ANULADO.
 * Cuenta con fallback completo en caso de que la función RPC no esté creada en Supabase.
 */
export async function anularVenta(ventaId: string, motivo?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('anular_venta', {
      p_venta_id: ventaId,
      p_motivo: motivo || null
    })

    if (!error) {
      // Asegurar limpieza de saldo pendiente y estado de pago
      try {
        await supabase
          .from('ventas')
          .update({
            estado: 'ANULADO',
            estado_pago: 'ANULADO',
            saldo_pendiente: 0.00
          })
          .eq('id', ventaId)
      } catch (errSync) {
        console.warn('Advertencia al sincronizar estado de pago en anulación:', errSync)
      }
      return Boolean(data)
    }

    console.warn('RPC anular_venta falló o no existe en Supabase, ejecutando anulación vía fallback:', error.message)
  } catch (rpcErr) {
    console.warn('Error al invocar RPC anular_venta, ejecutando fallback:', rpcErr)
  }

  // --- FALLBACK DIRECTO VIA SUPABASE CLIENT ---
  // 1. Obtener la venta
  const { data: venta, error: errVenta } = await supabase
    .from('ventas')
    .select('id, codigo_venta, estado, nota')
    .eq('id', ventaId)
    .single()

  if (errVenta || !venta) {
    throw new Error(`La venta especificada no existe: ${errVenta?.message || ''}`)
  }

  if (venta.estado === 'ANULADO') {
    throw new Error(`La venta ${venta.codigo_venta} ya se encuentra anulada.`)
  }

  // 2. Restituir stock e insertar en Kardex si la venta no era solo cotización
  if (venta.estado === 'PAGADO' || venta.estado === 'ENTREGADO') {
    const { data: items, error: errItems } = await supabase
      .from('ventas_detalle')
      .select('producto_id, cantidad_cajas, piezas_sueltas')
      .eq('venta_id', ventaId)

    if (errItems) {
      throw new Error(`Error al obtener items de la venta: ${errItems.message}`)
    }

    if (items && items.length > 0) {
      for (const item of items) {
        // Verificar si es combo
        const { data: componentes } = await supabase
          .from('producto_componentes')
          .select('componente_id, cantidad')
          .eq('combo_id', item.producto_id)

        if (componentes && componentes.length > 0) {
          // Devolver stock de componentes de combo
          for (const comp of componentes) {
            const { data: compProd } = await supabase
              .from('inventario')
              .select('id, stock, piezas_sueltas, m2_caja')
              .eq('id', comp.componente_id)
              .single()

            if (compProd) {
              const cantReq = (Number(item.cantidad_cajas || 0) + Number(item.piezas_sueltas || 0)) * Number(comp.cantidad)
              if (Number(compProd.m2_caja || 0) > 0) {
                await supabase
                  .from('inventario')
                  .update({ stock: Number(compProd.stock || 0) + cantReq })
                  .eq('id', comp.componente_id)

                await supabase.from('kardex').insert({
                  producto_id: comp.componente_id,
                  tipo: 'ENTRADA',
                  cantidad_cajas: cantReq,
                  piezas_sueltas: 0,
                  motivo: 'ANULACION_VENTA',
                  referencia_id: ventaId
                })
              } else {
                await supabase
                  .from('inventario')
                  .update({ stock: Number(compProd.stock || 0) + cantReq })
                  .eq('id', comp.componente_id)

                await supabase.from('kardex').insert({
                  producto_id: comp.componente_id,
                  tipo: 'ENTRADA',
                  cantidad_cajas: 0,
                  piezas_sueltas: cantReq,
                  motivo: 'ANULACION_VENTA',
                  referencia_id: ventaId
                })
              }
            }
          }
        } else {
          // Producto estándar
          const { data: prod } = await supabase
            .from('inventario')
            .select('id, stock, piezas_sueltas, m2_caja')
            .eq('id', item.producto_id)
            .single()

          if (prod) {
            const m2Caja = Number(prod.m2_caja || 0)
            const pzsPorCaja = 6
            const cjsDevueltas = Number(item.cantidad_cajas || 0)
            const pzsDevueltas = Number(item.piezas_sueltas || 0)

            if (m2Caja > 0) {
              const totalPzs = Number(prod.piezas_sueltas || 0) + pzsDevueltas
              const cjsAdicionales = Math.floor(totalPzs / pzsPorCaja)
              const pzsFinales = totalPzs % pzsPorCaja
              const stockFinal = Number(prod.stock || 0) + cjsDevueltas + cjsAdicionales

              await supabase
                .from('inventario')
                .update({
                  stock: stockFinal,
                  piezas_sueltas: pzsFinales
                })
                .eq('id', item.producto_id)

              await supabase.from('kardex').insert({
                producto_id: item.producto_id,
                tipo: 'ENTRADA',
                cantidad_cajas: cjsDevueltas,
                piezas_sueltas: pzsDevueltas,
                motivo: 'ANULACION_VENTA',
                referencia_id: ventaId
              })
            } else {
              const stockFinal = Number(prod.stock || 0) + pzsDevueltas

              await supabase
                .from('inventario')
                .update({ stock: stockFinal })
                .eq('id', item.producto_id)

              await supabase.from('kardex').insert({
                producto_id: item.producto_id,
                tipo: 'ENTRADA',
                cantidad_cajas: 0,
                piezas_sueltas: pzsDevueltas,
                motivo: 'ANULACION_VENTA',
                referencia_id: ventaId
              })
            }
          }
        }
      }
    }
  }

  // 3. Marcar venta como ANULADO y limpiar deuda
  const notaAnulacion = (venta.nota ? venta.nota + '\n' : '') + `[ANULADO]: ${motivo || 'Anulación de venta'}`

  const { error: errUpdate } = await supabase
    .from('ventas')
    .update({
      estado: 'ANULADO',
      estado_pago: 'ANULADO',
      saldo_pendiente: 0.00,
      nota: notaAnulacion.trim()
    })
    .eq('id', ventaId)

  if (errUpdate) {
    throw new Error(`Error al actualizar estado de la venta: ${errUpdate.message}`)
  }

  return true
}

