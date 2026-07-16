// app/admin/compras/page.tsx
import { getProveedores, getCompras, Proveedor } from '../../lib/compras.service'
import { getInventarioCompleto } from '../../lib/inventario.service'
import WorkspaceCompras from './WorkspaceCompras'

export const dynamic = 'force-dynamic'

export default async function ComprasPage() {
  let proveedores: Proveedor[] = []
  let compras: any[] = []
  let inventario: any[] = []
  let errorBD = null

  try {
    // Carga en paralelo para mejorar el tiempo de respuesta
    const [resProveedores, resCompras, resInventario] = await Promise.all([
      getProveedores(),
      getCompras(),
      getInventarioCompleto()
    ])
    proveedores = resProveedores
    compras = resCompras
    inventario = resInventario
  } catch (error: any) {
    errorBD = error.message
  }

  // Manejo de errores de base de datos
  if (errorBD) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold">
        ⚠️ Error al conectar con la base de datos de compras y proveedores: {errorBD}
      </div>
    )
  }

  return (
    <WorkspaceCompras
      inventario={inventario}
      proveedoresIniciales={proveedores}
      comprasIniciales={compras}
    />
  )
}
