import { supabase } from './supabase'

export interface Empresa {
  id: string
  nombre: string
  ruc?: string | null
  direccion?: string | null
  created_at?: string
}

const EMPRESA_STORAGE_KEY = 'ledisa_empresa_activa_id'

/**
 * Obtiene el listado de empresas registradas (Ledisa Palao, Corporación Oviedo).
 */
export async function getEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error al cargar empresas:', error.message)
    return []
  }

  return data || []
}

/**
 * Obtiene la empresa activa almacenada en localStorage, o la primera por defecto.
 */
export function getEmpresaActiva(empresas: Empresa[]): Empresa | null {
  if (!empresas || empresas.length === 0) return null
  if (typeof window === 'undefined') return empresas[0]

  const savedId = localStorage.getItem(EMPRESA_STORAGE_KEY)
  if (savedId) {
    const found = empresas.find(e => e.id === savedId)
    if (found) return found
  }

  return empresas[0]
}

/**
 * Guarda la empresa seleccionada en localStorage.
 */
export function setEmpresaActivaId(empresaId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(EMPRESA_STORAGE_KEY, empresaId)
  }
}
