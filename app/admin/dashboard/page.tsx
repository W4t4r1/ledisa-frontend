// app/admin/dashboard/page.tsx
import { getInventarioCompleto } from '../../lib/inventario.service'
import { getVentas } from '../../lib/ventas.service'
import { getClientes } from '../../lib/clientes.service'
import DashboardWorkspace from './DashboardWorkspace'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let inventario: any[] = []
  let ventas: any[] = []
  let clientes: any[] = []
  let errorBD = null

  try {
    // Carga paralela ultra rápida en el servidor
    const [resInventario, resVentas, resClientes] = await Promise.all([
      getInventarioCompleto(),
      getVentas(),
      getClientes()
    ])
    
    inventario = resInventario
    ventas = resVentas
    clientes = resClientes
  } catch (error: any) {
    errorBD = error.message
  }

  // Manejo de errores de base de datos
  if (errorBD) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold">
        ⚠️ Error al conectar con la base de datos para cargar métricas del ERP: {errorBD}
      </div>
    )
  }

  return (
    <DashboardWorkspace 
      inventario={inventario}
      ventas={ventas}
      clientes={clientes}
    />
  )
}