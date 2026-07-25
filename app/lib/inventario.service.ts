import { supabase } from './supabase'

export interface ComponenteCombo {
  componente_id: string
  cantidad: number
}

export async function getInventarioCompleto() {
  const { data, error } = await supabase
    .from('inventario')
    .select(`
      *,
      producto_componentes:producto_componentes!combo_id(
        componente_id,
        cantidad
      )
    `)
    .order('nombre', { ascending: true })

  if (error) {
    // Si falla el join (por ejemplo si la migración aún se está corriendo), fallback a select simple
    const { data: fallbackData, error: fallbackErr } = await supabase
      .from('inventario')
      .select('*')
      .order('nombre', { ascending: true })

    if (fallbackErr) {
      throw new Error(`Fallo en Supabase: ${fallbackErr.message}`)
    }
    return fallbackData || []
  }

  return data || []
}

/**
  * Obtiene la lista de componentes de un producto combo por su ID
  */
export async function getComponentesCombo(comboId: string) {
  const { data, error } = await supabase
    .from('producto_componentes')
    .select(`
      id,
      combo_id,
      componente_id,
      cantidad,
      inventario:componente_id (
        id,
        nombre,
        categoria,
        stock,
        costo,
        precio
      )
    `)
    .eq('combo_id', comboId)

  if (error) {
    console.error('Error al cargar componentes del combo:', error)
    return []
  }

  return data || []
}

/**
  * Guarda o actualiza los componentes de un producto combo en producto_componentes
  */
export async function guardarComponentesCombo(comboId: string, componentes: ComponenteCombo[]) {
  // 1. Eliminar componentes existentes del combo
  const { error: errDelete } = await supabase
    .from('producto_componentes')
    .delete()
    .eq('combo_id', comboId)

  if (errDelete) {
    throw new Error(`Error al limpiar componentes anteriores: ${errDelete.message}`)
  }

  // 2. Insertar si hay nuevos componentes
  if (componentes && componentes.length > 0) {
    const filas = componentes.map(c => ({
      combo_id: comboId,
      componente_id: c.componente_id,
      cantidad: Math.max(1, c.cantidad || 1)
    }))

    const { error: errInsert } = await supabase
      .from('producto_componentes')
      .insert(filas)

    if (errInsert) {
      throw new Error(`Error al insertar componentes del combo: ${errInsert.message}`)
    }
  }

  return true
}

export interface AjusteStockData {
  producto_id: string
  tipo: 'ENTRADA' | 'SALIDA'
  cantidad_cajas: number
  piezas_sueltas: number
  motivo: 'VENTA' | 'COMPRA' | 'AJUSTE' | 'ROTURA' | 'DEVOLUCION' | 'ANULACION_VENTA'
  lote?: string
  tono?: string
  calibre?: string
}

/**
 * Registra un ajuste de stock de manera atómica actualizando inventario e insertando en Kardex.
 */
export async function registrarAjusteInventario(ajuste: AjusteStockData): Promise<boolean> {
  // 1. Obtener stock actual
  const { data: producto, error: errFetch } = await supabase
    .from('inventario')
    .select('stock, piezas_sueltas, nombre, m2_caja')
    .eq('id', ajuste.producto_id)
    .single()

  if (errFetch || !producto) {
    throw new Error(`El producto con ID ${ajuste.producto_id} no existe en el inventario.`)
  }

  const esRecubrimiento = (producto.m2_caja || 0) > 0

  // 2. Calcular nuevo stock
  let nuevoStock = producto.stock || 0
  let nuevasPiezas = producto.piezas_sueltas || 0

  if (esRecubrimiento) {
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
  } else {
    // Para productos por unidad (sanitarios, griferías, fragua, etc.),
    // la cantidad de unidades viene en ajuste.piezas_sueltas, y se resta o suma de la columna stock
    if (ajuste.tipo === 'ENTRADA') {
      nuevoStock += ajuste.piezas_sueltas
      nuevasPiezas = 0 // Aseguramos que piezas sueltas quede en 0
    } else {
      // Es SALIDA, validamos que no sea negativo
      if (nuevoStock < ajuste.piezas_sueltas) {
        throw new Error(
          `Stock insuficiente para ${producto.nombre}. Stock actual: ${nuevoStock} unidades. Ajuste requerido: ${ajuste.piezas_sueltas} unidades.`
        )
      }
      nuevoStock -= ajuste.piezas_sueltas
      nuevasPiezas = 0 // Aseguramos que piezas sueltas quede en 0
    }
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
      cantidad_cajas: esRecubrimiento ? ajuste.cantidad_cajas : 0,
      piezas_sueltas: ajuste.piezas_sueltas,
      motivo: ajuste.motivo,
      referencia_id: null,
      lote: ajuste.lote || null,
      tono: ajuste.tono || null,
      calibre: ajuste.calibre || null
    })

  if (errKardex) {
    throw new Error(`Error al insertar movimiento en Kardex: ${errKardex.message}`)
  }

  return true
}