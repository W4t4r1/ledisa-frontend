// app/admin/ventas/WorkspaceVentas.tsx
'use client'

import { useState } from 'react'
import CalculadoraInteractiva from '../calculadora/CalculadoraInteractiva'
import ConsultorChat from '../../components/ConsultorChat'
import RegistroVentas from './RegistroVentas'
import HistorialVentas from './HistorialVentas'

interface WorkspaceProps {
  inventario: any[]
  ventasIniciales: any[]
}

export default function WorkspaceVentas({ inventario, ventasIniciales }: WorkspaceProps) {
  const [tabActiva, setTabActiva] = useState<'registrar' | 'historial' | 'calculadora'>('registrar')

  // Filtramos los recubrimientos para la calculadora de obra
  const recubrimientos = inventario.filter(item => 
    (item.categoria?.toLowerCase().includes('cerámic') || 
     item.categoria?.toLowerCase().includes('porcelanato')) && 
    item.m2_caja > 0
  )

  return (
    <div className="space-y-6">
      
      {/* TABS DE NAVEGACIÓN INTERNA (ESTILO ERP) */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTabActiva('registrar')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'registrar'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          🛒 Registrar Venta / Cotización
        </button>
        <button
          onClick={() => setTabActiva('historial')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'historial'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📊 Historial de Ventas
        </button>
        <button
          onClick={() => setTabActiva('calculadora')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'calculadora'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📐 Calculadora & Consultor IA
        </button>
      </div>

      {/* CONTENIDO DINÁMICO SEGÚN TAB ACTIVA */}
      <div className="transition-all duration-200">
        
        {tabActiva === 'registrar' && (
          <RegistroVentas productos={inventario} />
        )}

        {tabActiva === 'historial' && (
          <HistorialVentas ventasIniciales={ventasIniciales} />
        )}

        {tabActiva === 'calculadora' && (
          <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-16rem)]">
            
            {/* COLUMNA IZQUIERDA: CALCULADORA DE OBRA */}
            <div className="w-full xl:w-1/2 overflow-y-auto pr-2 pb-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 shadow-sm">
                <h3 className="font-bold text-[#04558C] text-lg">1. Cálculo Físico</h3>
                <p className="text-xs text-gray-500 mb-4">Determina la cantidad exacta de cajas necesarias para la obra.</p>
                <CalculadoraInteractiva productos={recubrimientos} />
              </div>
            </div>

            {/* COLUMNA DERECHA: CONSULTOR IA */}
            <ConsultorChat
              title="2. Consultor Estratégico"
              subtitle="Generador de Ventas"
              placeholder="Ej: Redáctame un mensaje ofreciendo las 13 cajas y el pegamento..."
              className="w-full xl:w-1/2 flex flex-col bg-white rounded-lg shadow-md border border-[#04558C] overflow-hidden"
              welcomeMessage={
                <>
                  <p className="font-bold text-lg text-gray-400">IA Lista para operar.</p>
                  <p className="text-sm mt-2 px-8 text-gray-600">
                    Calcula las cajas a la izquierda y luego pídeme aquí que redacte el mensaje de cierre para tu cliente.
                  </p>
                </>
              }
            />
          </div>
        )}

      </div>
    </div>
  )
}