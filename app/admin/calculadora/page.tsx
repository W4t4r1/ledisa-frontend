// app/admin/calculadora/page.tsx
import { getInventarioCompleto } from '../../lib/inventario.service'
import CalculadoraInteractiva from './CalculadoraInteractiva'

export const dynamic = 'force-dynamic'

export default async function CalculadoraPage() {
  const inventario = await getInventarioCompleto()
  
  // FILTRO ESTRICTO: Solo cerámicos/porcelanatos que tengan configurado su rendimiento por caja
  const recubrimientos = inventario.filter(item => 
    (item.categoria?.toLowerCase().includes('cerámic') || 
     item.categoria?.toLowerCase().includes('porcelanato')) && 
    item.m2_caja > 0
  )

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Calculadora de Obra</h2>
        <p className="text-gray-500 mt-1">Cotización rápida para cierres por WhatsApp</p>
      </div>
      
      {/* Si el filtro no encuentra nada, exponemos el error de datos inmediatamente */}
      {recubrimientos.length === 0 ? (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded shadow-sm">
          <p className="font-bold text-orange-800">Error de Integridad de Datos</p>
          <p className="text-orange-700 text-sm mt-1">
            No hay productos clasificados como "Cerámico" o "Porcelanato" que tengan un valor mayor a cero en la columna "m2_caja". 
            Actualiza tu inventario primero.
          </p>
        </div>
      ) : (
        <CalculadoraInteractiva productos={recubrimientos} />
      )}
    </div>
  )
}