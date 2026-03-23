// app/admin/ventas/page.tsx
import { getInventarioCompleto } from '../../lib/inventario.service'
import WorkspaceVentas from './WorkspaceVentas'

export const dynamic = 'force-dynamic'

export default async function VentasPage() {
  const inventario = await getInventarioCompleto()
  
  // Filtramos solo los productos que sirven para la calculadora
  const recubrimientos = inventario.filter(item => 
    (item.categoria?.toLowerCase().includes('cerámic') || 
     item.categoria?.toLowerCase().includes('porcelanato')) && 
    item.m2_caja > 0
  )

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Centro de Cotización y Cierre</h2>
        <p className="text-gray-500 text-sm mt-1">Calculadora exacta + Consultor Estratégico IA</p>
      </div>
      
      <WorkspaceVentas productos={recubrimientos} />
    </div>
  )
}