import { supabase } from './supabase'

export interface ItemVenta {
  producto_id: string
  cantidad_cajas: number
  piezas_sueltas: number
  precio_unitario: number
  costo_unitario: number
  piezas_por_caja: number
  subtotal: number
  lote?: string
  tono?: string
  calibre?: string
}

export interface VentaData {
  cliente_id: string | null
  subtotal: number
  descuento: number
  total: number
  metodo_pago: 'Efectivo' | 'Yape/Plin' | 'Transferencia BCP' | 'Transferencia Interbancaria' | 'Tarjeta Credito/Debito' | 'Credito' | 'Sin Especificar'
  estado: 'COTIZACION' | 'PAGADO' | 'ENTREGADO' | 'ANULADO'
  nota?: string
  items: ItemVenta[]
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
    p_items: venta.items // Supabase JS serializa automáticamente el array de objetos a formato JSONB
  })

  if (error) {
    throw new Error(`Error en la transacción de venta: ${error.message}`)
  }

  return data as string
}

/**
 * Obtiene el historial de ventas y cotizaciones registradas,
 * incluyendo los datos de identificación del cliente.
 */
export async function getVentas(): Promise<any[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      clientes (
        documento,
        nombre_razon_social
      )
    `)
    .order('fecha', { ascending: false })

  if (error) {
    throw new Error(`Error al cargar historial de ventas: ${error.message}`)
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
 * Se puede filtrar opcionalmente por un producto específico.
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
