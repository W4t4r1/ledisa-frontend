'use server'

import { supabase } from '../lib/supabase'
import { revalidatePath } from 'next/cache'

// ACCIÓN 1: ELIMINAR
export async function eliminarProducto(id: string) {
  const { error } = await supabase.from('inventario').delete().eq('id', id)
  
  if (error) {
    throw new Error(`Error al eliminar en Supabase: ${error.message}`)
  }
  
  // Forzamos a Next.js a limpiar su caché y buscar los datos frescos
  revalidatePath('/admin')
}

// ACCIÓN 2: GUARDAR (Crea si es nuevo, Actualiza si ya existe)
export async function guardarProducto(productoBase: any, esEdicion: boolean, componentesCombo?: { componente_id: string; cantidad: number }[]) {
  try {
    // Autogeneramos nombre si está vacío y completamos la marca como 'OTRO' si no se especifica
    const nombreAutogenerado = (productoBase.nombre || '').trim() || `${productoBase.categoria || 'Producto'} ${productoBase.id}`;
    const marcaAutogenerada = (productoBase.marca || '').trim() || 'OTRO';

    const esCombo = !!productoBase.es_combo

    // Extraer propiedades que no van directo a la tabla inventario si vinieran
    const { componentes, producto_componentes, ...restoProducto } = productoBase

    // Limpiamos los datos antes de inyectarlos
    const producto = {
      ...restoProducto,
      nombre: nombreAutogenerado,
      marca: marcaAutogenerada,
      precio: parseFloat(productoBase.precio),
      costo: parseFloat(productoBase.costo || 0),
      stock: parseInt(productoBase.stock || 0),
      stock_minimo: parseInt(productoBase.stock_minimo || 0),
      m2_caja: parseFloat(productoBase.m2_caja || 0),
      piezas_sueltas: parseInt(productoBase.piezas_sueltas || 0),
      color: productoBase.color?.trim() || null,
      imagen: productoBase.imagen?.trim() || null,
      ubicacion_fisica: productoBase.ubicacion_fisica?.trim() || null,
      oculto: !!productoBase.oculto,
      es_combo: esCombo
    }

    if (esEdicion) {
      const { error } = await supabase.from('inventario').update(producto).eq('id', producto.id)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await supabase.from('inventario').insert(producto)
      if (error) return { success: false, error: error.message }
    }

    // Si es combo, guardamos los componentes en producto_componentes
    if (esCombo) {
      const { guardarComponentesCombo } = await import('../lib/inventario.service')
      await guardarComponentesCombo(producto.id, componentesCombo || [])
    } else {
      // Si no es combo, limpiamos cualquier componente que pudiera haber tenido
      await supabase.from('producto_componentes').delete().eq('combo_id', producto.id)
    }

    try {
      revalidatePath('/admin')
      revalidatePath('/admin/dashboard')
      revalidatePath('/admin/ventas')
    } catch (e) {
      console.warn('Revalidation warning:', e)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al guardar el producto' }
  }
}

// ACCIÓN 2.1: OBTENER COMPONENTES DE UN COMBO
export async function obtenerComponentesProductoAction(comboId: string) {
  try {
    const { getComponentesCombo } = await import('../lib/inventario.service')
    return await getComponentesCombo(comboId)
  } catch (error: any) {
    return []
  }
}


// ACCIÓN 3: CAMBIAR VISIBILIDAD (OCULTAR / MOSTRAR)
export async function toggleVisibilidadProducto(id: string, oculto: boolean) {
  const { error } = await supabase
    .from('inventario')
    .update({ oculto })
    .eq('id', id)

  if (error) {
    throw new Error(`Error al cambiar visibilidad en Supabase: ${error.message}`)
  }

  revalidatePath('/admin')
}

// ACCIÓN 4: EDICIÓN MASIVA DE PRODUCTOS (POR LOTE)
export async function actualizarProductosMasivo(ids: string[], cambios: Record<string, any>) {
  if (!ids || ids.length === 0) {
    throw new Error('Debes seleccionar al menos un producto.')
  }

  const { error } = await supabase
    .from('inventario')
    .update(cambios)
    .in('id', ids)

  if (error) {
    throw new Error(`Error en la edición masiva: ${error.message}`)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/ventas')
}