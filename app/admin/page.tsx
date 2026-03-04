import { getInventarioCompleto } from '../lib/inventario.service'
import AdminDashboard from './AdminDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  let inventario = []
  let errorBD = null

  try {
    inventario = await getInventarioCompleto()
  } catch (error: any) {
    errorBD = error.message
  }

  // Manejo de errores a prueba de balas
  if (errorBD) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold">
        Error al conectar con la base de datos: {errorBD}
      </div>
    )
  }

  // Inyección directa del componente cliente
  return <AdminDashboard inventarioInicial={inventario} />
}