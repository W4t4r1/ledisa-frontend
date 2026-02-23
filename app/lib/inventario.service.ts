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