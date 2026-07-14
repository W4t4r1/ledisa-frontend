import { supabase } from './supabase'

export async function getInventarioCompleto() {
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) {
    throw new Error(`Fallo en Supabase: ${error.message}`)
  }

  return data || []
}

export interface AjusteStockData {
  producto_id: string
  tipo: 'ENTRADA' | 'SALIDA'
  cantidad_cajas: number
  piezas_sueltas: number
  motivo: 'VENTA' | 'COMPRA' | 'AJUSTE' | 'ROTURA' | 'DEVOLUCION' | 'ANULACION_VENTA'
}

/**
 * Registra un ajuste de stock de manera atómica actualizando inventario e insertando en Kardex.
 */
export async function registrarAjusteInventario(ajuste: AjusteStockData): Promise<boolean> {
  // 1. Obtener stock actual
  const { data: producto, error: errFetch } = await supabase
    .from('inventario')
    .select('stock, piezas_sueltas, nombre')
    .eq('id', ajuste.producto_id)
    .single()

  if (errFetch || !producto) {
    throw new Error(`El producto con ID ${ajuste.producto_id} no existe en el inventario.`)
  }

  // 2. Calcular nuevo stock
  let nuevoStock = producto.stock || 0
  let nuevasPiezas = producto.piezas_sueltas || 0

  if (ajuste.tipo === 'ENTRADA') {
    nuevoStock += ajuste.cantidad_cajas
    nuevasPiezas += ajuste.piezas_sueltas
  } else {
    // Es SALIDA, validamos que no sea negativo
    if (nuevoStock < ajuste.cantidad_cajas || nuevasPiezas < ajuste.piezas_sueltas) {
      throw new Error(
        `Stock insuficiente para ${producto.nombre}. Stock actual: ${nuevoStock} cjs, ${nuevasPiezas} pzs. Ajuste requerido: ${ajuste.cantidad_cajas} cjs, ${ajuste.piezas_sueltas} pzs.`
      )
    }
    nuevoStock -= ajuste.cantidad_cajas
    nuevasPiezas -= ajuste.piezas_sueltas
  }

  // 3. Actualizar la tabla de inventario
  const { error: errUpdate } = await supabase
    .from('inventario')
    .update({
      stock: nuevoStock,
      piezas_sueltas: nuevasPiezas
    })
    .eq('id', ajuste.producto_id)

  if (errUpdate) {
    throw new Error(`Error al actualizar el stock del producto: ${errUpdate.message}`)
  }

  // 4. Registrar en la tabla de Kardex
  const { error: errKardex } = await supabase
    .from('kardex')
    .insert({
      producto_id: ajuste.producto_id,
      tipo: ajuste.tipo,
      cantidad_cajas: ajuste.cantidad_cajas,
      piezas_sueltas: ajuste.piezas_sueltas,
      motivo: ajuste.motivo,
      referencia_id: null
    })

  if (errKardex) {
    throw new Error(`Error al insertar movimiento en Kardex: ${errKardex.message}`)
  }

  return true
}