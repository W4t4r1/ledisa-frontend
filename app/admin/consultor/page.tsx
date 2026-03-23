'use client'

import { useState, useRef, useEffect } from 'react'

export default function ConsultorPage() {
  // Estado 100% controlado por nosotros
  const [mensajes, setMensajes] = useState<{role: string, content: string}[]>([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // Motor de envío nativo (Fetch API)
  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || cargando) return

    const textoUsuario = input
    setInput('') // Limpiamos la caja al instante
    
    // Agregamos la pregunta a la pantalla
    setMensajes(prev => [...prev, { role: 'user', content: textoUsuario }])
    setCargando(true)

    try {
      // Llamada directa a nuestro propio servidor
   const res = await fetch('/api/inventario/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textoUsuario })
      })
      
      const data = await res.json()
      
      if (data.error) throw new Error(data.error)

      // Agregamos la respuesta de la IA a la pantalla
      setMensajes(prev => [...prev, { role: 'assistant', content: data.respuesta }])
    } catch (error: any) {
      setMensajes(prev => [...prev, { role: 'assistant', content: '❌ Error: ' + error.message }])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      
      {/* CABECERA */}
      <div className="p-4 bg-[#04558C] text-white border-b border-[#033f6b] flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black tracking-tight">🧠 Consultor IA (Gemini)</h2>
          <p className="text-xs text-blue-200 mt-1">Conexión Directa al Inventario</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-xs font-bold text-green-400 tracking-wider">ONLINE</span>
        </div>
      </div>

      {/* ÁREA DE MENSAJES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {mensajes.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="font-bold text-lg text-gray-400">Motor Nativo Inicializado.</p>
            <p className="text-sm mt-2">Prueba preguntando: <br/><em>"Un cliente necesita revestir un cuarto de 4x4 metros. Quiere usar el porcelanato Tambopata. Calcúlame exactamente cuántas cajas necesita y cuánto le va a costar."</em></p>
          </div>
        )}
        
        {mensajes.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-4 shadow-sm ${
              m.role === 'user' 
                ? 'bg-[#04558C] text-white rounded-br-none' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
            }`}>
              <span className="font-black text-xs block mb-2 opacity-50 uppercase tracking-wider">
                {m.role === 'user' ? 'Tú' : 'Consultor LEDISA'}
              </span>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
            </div>
          </div>
        ))}
        
        {cargando && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm flex gap-2 items-center shadow-sm rounded-bl-none">
              <span className="font-bold text-[#04558C]">Analizando inventario...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* FORMULARIO BLINDADO */}
      <form onSubmit={enviarMensaje} className="p-4 bg-white border-t border-gray-200 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu consulta de stock o presupuesto..."
          className="flex-1 border border-gray-300 rounded-md p-3 focus:outline-none focus:border-[#04558C]"
          disabled={cargando}
        />
        <button
          type="submit"
          disabled={cargando || !input.trim()}
          className="bg-[#25D366] hover:bg-[#128C7E] text-white px-6 py-3 rounded-md font-bold transition-colors disabled:opacity-50 shadow-sm"
        >
          {cargando ? 'Calculando...' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}