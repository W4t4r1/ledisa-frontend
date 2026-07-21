import { supabase } from './supabase'

export interface Proveedor {
  id?: string
  tipo_documento: 'DNI' | 'RUC' | 'CE' | 'OTROS'
  documento: string
  razon_social: string
  celular?: string
  direccion?: string
  created_at?: string
}

export interface ItemCompra {
  producto_id: string
  cantidad_cajas: number
  piezas_sueltas: number
  costo_unitario: number
  subtotal: number
  lote?: string | null
  tono?: string | null
  calibre?: string | null
}

export interface CompraData {
  proveedor_id: string | null
  numero_factura: string
  total: number
  metodo_pago: 'Efectivo' | 'Yape/Plin' | 'Transferencia BCP' | 'Transferencia Interbancaria' | 'Tarjeta Credito/Debito' | 'Credito' | 'Sin Especificar'
  nota?: string
  items: ItemCompra[]
}

/**
 * Obtiene la lista completa de proveedores ordenados alfabéticamente.
 */
export async function getProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .order('razon_social', { ascending: true })

  if (error) {
    throw new Error(`Error al listar proveedores: ${error.message}`)
  }

  return data || []
}

/**
 * Busca un proveedor por número de documento (DNI, RUC, etc.)
 */
export async function buscarProveedorPorDocumento(documento: string): Promise<Proveedor | null> {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('documento', documento.trim())
    .maybeSingle()

  if (error) {
    throw new Error(`Error al buscar proveedor: ${error.message}`)
  }

  return data
}

/**
 * Busca proveedores por coincidencia de documento o razón social
 */
export async function buscarProveedoresPorFiltro(query: string): Promise<Proveedor[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .or(`documento.ilike.%${q}%,razon_social.ilike.%${q}%`)
    .order('razon_social', { ascending: true })
    .limit(10)

  if (error) {
    throw new Error(`Error al buscar proveedores: ${error.message}`)
  }

  return data || []
}

/**
 * Registra un nuevo proveedor en la base de datos.
 */
export async function crearProveedor(proveedor: Proveedor): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedores')
    .insert({
      tipo_documento: proveedor.tipo_documento,
      documento: proveedor.documento.trim(),
      razon_social: proveedor.razon_social.trim(),
      celular: proveedor.celular?.trim() || null,
      direccion: proveedor.direccion?.trim() || null
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Error al registrar el proveedor: ${error.message}`)
  }

  return data
}

/**
 * Actualiza la información de un proveedor existente.
 */
export async function actualizarProveedor(id: string, proveedor: Partial<Proveedor>): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedores')
    .update({
      tipo_documento: proveedor.tipo_documento,
      documento: proveedor.documento?.trim(),
      razon_social: proveedor.razon_social?.trim(),
      celular: proveedor.celular?.trim() || null,
      direccion: proveedor.direccion?.trim() || null
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar el proveedor: ${error.message}`)
  }

  return data
}

/**
 * Obtiene el historial de facturas de compras registradas.
 */
export async function getCompras(): Promise<any[]> {
  const { data, error } = await supabase
    .from('compras')
    .select(`
      *,
      proveedores (
        documento,
        razon_social
      )
    `)
    .order('fecha', { ascending: false })

  if (error) {
    throw new Error(`Error al cargar historial de compras: ${error.message}`)
  }

  return data || []
}

/**
 * Obtiene el detalle de artículos de una compra en específico.
 */
export async function getDetalleCompra(compraId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('compras_detalle')
    .select(`
      *,
      inventario (
        nombre,
        categoria,
        color,
        m2_caja
      )
    `)
    .eq('compra_id', compraId)

  if (error) {
    throw new Error(`Error al obtener detalle de compra: ${error.message}`)
  }

  return data || []
}

/**
 * Registra una nueva compra de mercadería llamando a la función transaccional RPC de Supabase.
 * @returns El código correlativo de compra (ej: COM-260715-0210)
 */
export async function registrarNuevaCompraRPC(compra: CompraData): Promise<string> {
  const { data, error } = await supabase.rpc('registrar_compra', {
    p_proveedor_id: compra.proveedor_id,
    p_numero_factura: compra.numero_factura.trim(),
    p_total: compra.total,
    p_metodo_pago: compra.metodo_pago,
    p_nota: compra.nota || null,
    p_items: compra.items
  })

  if (error) {
    throw new Error(`Error en la transacción de compra: ${error.message}`)
  }

  return data as string
}
