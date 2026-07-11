// app/admin/calculadora/CalculadoraInteractiva.tsx
'use client'

import { useState } from 'react'

export default function CalculadoraInteractiva({ productos }: { productos: any[] }) {
  // Estados de entrada
  const [largo, setLargo] = useState<number>(0)
  const [ancho, setAncho] = useState<number>(0)
  const [merma, setMerma] = useState<number>(10) // 10% estándar de desperdicio por cortes
  const [productoSelId, setProductoSelId] = useState<string>('')

  // Lógica de cálculo puro
  const areaNeta = largo * ancho
  const areaConMerma = areaNeta * (1 + (merma / 100))
  
  const productoSelec = productos.find(p => p.id === productoSelId)
  
  let cajasNecesarias = 0
  let costoTotal = 0

  if (productoSelec && productoSelec.m2_caja > 0) {
    // Math.ceil asegura que siempre se redondee hacia arriba (no puedes vender media caja)
    cajasNecesarias = Math.ceil(areaConMerma / productoSelec.m2_caja)
    costoTotal = cajasNecesarias * productoSelec.precio
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* PANEL DE INGRESO DE DATOS */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-[#04558C] mb-4">Parámetros del Espacio</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Largo (metros)</label>
              <input 
                type="number" step="0.01" min="0"
                className="w-full border p-2 rounded focus:outline-none focus:border-[#04558C] text-gray-900 bg-white"
                value={largo || ''} onChange={(e) => setLargo(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Ancho (metros)</label>
              <input 
                type="number" step="0.01" min="0"
                className="w-full border p-2 rounded focus:outline-none focus:border-[#04558C] text-gray-900 bg-white"
                value={ancho || ''} onChange={(e) => setAncho(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Margen de Merma/Cortes (%)</label>
            <input 
              type="number" min="0" max="30"
              className="w-full border p-2 rounded focus:outline-none focus:border-[#04558C] text-gray-900 bg-white"
              value={merma} onChange={(e) => setMerma(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="pt-4 border-t">
            <label className="block text-xs font-bold text-gray-500 mb-1">Seleccionar Revestimiento</label>
            <select 
              className="w-full border p-2 rounded bg-white text-gray-900 focus:outline-none focus:border-[#04558C]"
              value={productoSelId} onChange={(e) => setProductoSelId(e.target.value)}
            >
              <option value="">-- Elija un modelo --</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (Rendimiento: {p.m2_caja} m²/caja) - S/.{p.precio}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* PANEL DE RESULTADOS Y ESTRATEGIA */}
      <div className="bg-[#04558C] p-6 rounded-lg shadow-md text-white flex flex-col justify-center relative overflow-hidden">
        <h3 className="text-lg font-bold text-blue-200 mb-6 border-b border-blue-700 pb-2">Proyección de Requerimientos</h3>
        
        <div className="space-y-4 relative z-10">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-100">Área Neta:</span>
            <span className="text-xl font-mono">{areaNeta.toFixed(2)} m²</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-100">Área a Cubrir (+ Merma):</span>
            <span className="text-xl font-mono text-yellow-300 font-bold">{areaConMerma.toFixed(2)} m²</span>
          </div>
          
          {productoSelec && (
            <>
              <div className="pt-4 mt-4 border-t border-blue-700 flex justify-between items-center">
                <span className="text-sm font-bold text-white">Cajas a Despachar:</span>
                <span className="text-4xl font-black bg-white text-[#04558C] px-3 py-1 rounded shadow-inner">
                  {cajasNecesarias}
                </span>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-blue-100">Costo Total Revestimiento:</span>
                <span className="text-3xl font-black text-green-400">
                  S/. {costoTotal.toFixed(2)}
                </span>
              </div>

              {/* Validación de inventario físico */}
              {productoSelec.stock < cajasNecesarias && (
                <div className="mt-4 bg-red-500 text-white text-xs font-bold p-2 rounded text-center uppercase tracking-wider">
                  ⚠️ Alerta: Stock Insuficiente (Faltan {cajasNecesarias - productoSelec.stock} cajas / {((cajasNecesarias - productoSelec.stock) * productoSelec.m2_caja).toFixed(2)} m²)
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}