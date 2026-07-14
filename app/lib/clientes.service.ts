import { supabase } from './supabase'

export interface Cliente {
  id?: string
  tipo_documento: 'DNI' | 'RUC' | 'CE' | 'OTROS'
  documento: string
  nombre_razon_social: string
  celular?: string
  direccion?: string
  created_at?: string
}

/**
 * Busca un cliente en la base de datos por su número de documento (DNI, RUC, etc.)
 */
export async function buscarClientePorDocumento(documento: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('documento', documento.trim())
    .maybeSingle()

  if (error) {
    throw new Error(`Error al buscar cliente: ${error.message}`)
  }

  return data
}

/**
 * Crea o registra un nuevo cliente en el sistema.
 */
export async function crearCliente(cliente: Cliente): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      tipo_documento: cliente.tipo_documento,
      documento: cliente.documento.trim(),
      nombre_razon_social: cliente.nombre_razon_social.trim(),
      celular: cliente.celular?.trim() || null,
      direccion: cliente.direccion?.trim() || null
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Error al registrar el cliente: ${error.message}`)
  }

  return data
}

/**
 * Obtiene la lista completa de todos los clientes registrados.
 */
export async function getClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre_razon_social', { ascending: true })

  if (error) {
    throw new Error(`Error al listar clientes: ${error.message}`)
  }

  return data || []
}

/**
 * Actualiza la información de un cliente existente.
 */
export async function actualizarCliente(id: string, cliente: Partial<Cliente>): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .update({
      tipo_documento: cliente.tipo_documento,
      documento: cliente.documento?.trim(),
      nombre_razon_social: cliente.nombre_razon_social?.trim(),
      celular: cliente.celular?.trim() || null,
      direccion: cliente.direccion?.trim() || null
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar el cliente: ${error.message}`)
  }

  return data
}

/**
 * Obtiene el historial de compras de un cliente específico.
 */
export async function getComprasCliente(clienteId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(`
      id,
      codigo_venta,
      subtotal,
      descuento,
      total,
      metodo_pago,
      estado,
      fecha,
      nota
    `)
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })

  if (error) {
    throw new Error(`Error al obtener compras del cliente: ${error.message}`)
  }

  return data || []
}
