// app/admin/page.tsx
import { getInventarioCompleto } from '../lib/inventario.service'
import AdminDashboard from './AdminDashboard'

// Forzamos a que esta página sea dinámica y no se quede pegada en el caché
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  let inventario = []
  let errorBD = null

  try {
    // Reutilizamos la inteligencia de tu Capa de Servicios
    inventario = await getInventarioCompleto()
  } catch (error: any) {
    errorBD = error.message
  }

  if (errorBD) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-lg shadow-lg border border-red-200">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Fallo Crítico de Conexión</h1>
          <p className="text-gray-700">{errorBD}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-[#04558C] text-white p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black tracking-wider">LEDISA | BACKOFFICE TÁCTICO</h1>
          <span className="bg-red-500 text-xs px-2 py-1 rounded font-bold uppercase tracking-widest">
            Acceso Restringido
          </span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {/* Aquí inyectaremos el componente interactivo (Client Component) */}
        <AdminDashboard inventarioInicial={inventario} />
      </main>
    </div>
  )
}