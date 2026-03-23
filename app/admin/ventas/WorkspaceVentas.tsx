// app/admin/ventas/WorkspaceVentas.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import CalculadoraInteractiva from '../calculadora/CalculadoraInteractiva'

export default function WorkspaceVentas({ productos }: { productos: any[] }) {
  // --- ESTADO DEL CONSULTOR IA ---
  const [mensajes, setMensajes] = useState<{role: string, content: string}[]>([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || cargando) return

    const textoUsuario = input
    setInput('')
    setMensajes(prev => [...prev, { role: 'user', content: textoUsuario }])
    setCargando(true)

    try {
      const res = await fetch('/api/inventario/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textoUsuario })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMensajes(prev => [...prev, { role: 'assistant', content: data.respuesta }])
    } catch (error: any) {
      setMensajes(prev => [...prev, { role: 'assistant', content: '❌ Error: ' + error.message }])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-10rem)]">
      
      {/* COLUMNA IZQUIERDA: LA CALCULADORA ESTÁTICA */}
      <div className="w-full xl:w-1/2 overflow-y-auto pr-2 pb-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 shadow-sm">
          <h3 className="font-bold text-[#04558C] text-lg">1. Cálculo Físico</h3>
          <p className="text-xs text-gray-500 mb-4">Determina la cantidad exacta de cajas necesarias.</p>
          <CalculadoraInteractiva productos={productos} />
        </div>
      </div>

      {/* COLUMNA DERECHA: EL CONSULTOR IA */}
      <div className="w-full xl:w-1/2 flex flex-col bg-white rounded-lg shadow-md border border-[#04558C] overflow-hidden">
        <div className="p-3 bg-[#04558C] text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold">2. Consultor Estratégico</h3>
            <p className="text-[10px] text-blue-200 uppercase tracking-widest">Generador de Ventas</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {mensajes.length === 0 && (
            <div className="text-center text-gray-400 mt-10 text-sm">
              <p className="font-bold">IA Lista para operar.</p>
              <p className="mt-2 px-8">Calcula las cajas a la izquierda y luego pídeme aquí que redacte el mensaje de cierre para tu cliente.</p>
            </div>
          )}
          {mensajes.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded p-3 shadow-sm text-sm ${m.role === 'user' ? 'bg-[#04558C] text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          {cargando && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded p-3 text-sm flex gap-2 items-center shadow-sm">
                <span className="font-bold text-gray-400 animate-pulse">Escribiendo...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={enviarMensaje} className="p-3 bg-white border-t border-gray-200 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: Redáctame un mensaje ofreciendo las 13 cajas y el pegamento..."
            className="flex-1 border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#04558C]"
            disabled={cargando}
          />
          <button type="submit" disabled={cargando || !input.trim()} className="bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-2 rounded font-bold text-sm transition-colors disabled:opacity-50">
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}