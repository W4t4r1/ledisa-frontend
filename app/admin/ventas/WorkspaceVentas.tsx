// app/admin/ventas/WorkspaceVentas.tsx
'use client'

import CalculadoraInteractiva from '../calculadora/CalculadoraInteractiva'
import ConsultorChat from '../../components/ConsultorChat'

export default function WorkspaceVentas({ productos }: { productos: any[] }) {
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

      {/* COLUMNA DERECHA: EL CONSULTOR IA REUTILIZABLE */}
      <ConsultorChat
        title="2. Consultor Estratégico"
        subtitle="Generador de Ventas"
        placeholder="Ej: Redáctame un mensaje ofreciendo las 13 cajas y el pegamento..."
        className="w-full xl:w-1/2 flex flex-col bg-white rounded-lg shadow-md border border-[#04558C] overflow-hidden"
        welcomeMessage={
          <>
            <p className="font-bold text-lg text-gray-400">IA Lista para operar.</p>
            <p className="text-sm mt-2 px-8">
              Calcula las cajas a la izquierda y luego pídeme aquí que redacte el mensaje de cierre para tu cliente.
            </p>
          </>
        }
      />
    </div>
  )
}