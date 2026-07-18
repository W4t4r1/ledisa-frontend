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
export async function guardarProducto(productoBase: any, esEdicion: boolean) {
  // Autogeneramos nombre si está vacío y completamos la marca como 'OTRO' si no se especifica
  const nombreAutogenerado = (productoBase.nombre || '').trim() || `${productoBase.categoria || 'Producto'} ${productoBase.id}`;
  const marcaAutogenerada = (productoBase.marca || '').trim() || 'OTRO';

  // Limpiamos los datos antes de inyectarlos
  const producto = {
    ...productoBase,
    nombre: nombreAutogenerado,
    marca: marcaAutogenerada,
    precio: parseFloat(productoBase.precio),
    costo: parseFloat(productoBase.costo || 0),
    stock: parseInt(productoBase.stock),
    stock_minimo: parseInt(productoBase.stock_minimo || 0),
    m2_caja: parseFloat(productoBase.m2_caja || 0),
    piezas_sueltas: parseInt(productoBase.piezas_sueltas || 0),
    color: productoBase.color?.trim() || null,
    imagen: productoBase.imagen?.trim() || null,
    oculto: !!productoBase.oculto
  }

  if (esEdicion) {
    const { error } = await supabase.from('inventario').update(producto).eq('id', producto.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('inventario').insert(producto)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin')
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