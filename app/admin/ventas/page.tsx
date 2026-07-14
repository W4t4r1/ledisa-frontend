// app/admin/ventas/page.tsx
import { getInventarioCompleto } from '../../lib/inventario.service'
import { getVentas } from '../../lib/ventas.service'
import WorkspaceVentas from './WorkspaceVentas'

export const dynamic = 'force-dynamic'

export default async function VentasPage() {
  const inventario = await getInventarioCompleto()
  const ventas = await getVentas()

  return (
    <div className="space-y-4">
      <div className="border-b pb-2 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Módulo de Ventas y CRM (ERP)</h2>
          <p className="text-gray-500 text-sm mt-1">Cotizaciones, facturación rápida, clientes e histórico</p>
        </div>
      </div>
      
      <WorkspaceVentas inventario={inventario} ventasIniciales={ventas} />
    </div>
  )
}