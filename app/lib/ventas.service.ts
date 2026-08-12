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

  return Number(data)
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
