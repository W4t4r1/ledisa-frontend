'use client'

import { useEffect, useState } from 'react'
import { Empresa, getEmpresas, getEmpresaActiva, setEmpresaActivaId } from '../lib/empresas.service'

interface EmpresaSelectorProps {
  onEmpresaChange?: (empresa: Empresa) => void
}

export default function EmpresaSelector({ onEmpresaChange }: EmpresaSelectorProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaActiva, setEmpresaActiva] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEmpresas() {
      try {
        const list = await getEmpresas()
        // Si la tabla aún no tiene datos cargados de Supabase, usaremos los valores por defecto
        const defaultList: Empresa[] = list.length > 0 ? list : [
          { id: '11111111-1111-1111-1111-111111111111', nombre: 'Ledisa (Palao)' },
          { id: '22222222-2222-2222-2222-222222222222', nombre: 'Corporación Oviedo' }
        ]
        setEmpresas(defaultList)
        const activa = getEmpresaActiva(defaultList)
        setEmpresaActiva(activa)
        if (activa && onEmpresaChange) {
          onEmpresaChange(activa)
        }
      } catch (err) {
        console.error('Error al cargar selector de empresas:', err)
      } finally {
        setLoading(false)
      }
    }
    loadEmpresas()
  }, [])

  const handleChange = (id: string) => {
    const selected = empresas.find(e => e.id === id)
    if (selected) {
      setEmpresaActiva(selected)
      setEmpresaActivaId(selected.id)
      if (onEmpresaChange) {
        onEmpresaChange(selected)
      }
      // Emitir evento personalizado para notificar a otras páginas
      window.dispatchEvent(new Event('empresaChanged'))
    }
  }

  if (loading) {
    return <div className="text-xs text-blue-200 animate-pulse px-3 py-1">Cargando empresa...</div>
  }

  return (
    <div className="px-3 py-2 bg-[#033f6b]/60 rounded-lg border border-blue-400/30 flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-blue-200 font-bold flex items-center gap-1">
        <span>🏢 Empresa Activa:</span>
      </label>
      <select
        value={empresaActiva?.id || ''}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full bg-[#04558C] text-white text-xs font-bold py-1.5 px-2 rounded border border-blue-300/40 focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
      >
        {empresas.map((emp) => (
          <option key={emp.id} value={emp.id} className="bg-[#04558C] text-white">
            {emp.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}
