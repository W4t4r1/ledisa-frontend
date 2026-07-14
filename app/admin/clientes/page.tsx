// app/admin/clientes/page.tsx
import { getClientes, Cliente } from '../../lib/clientes.service'
import ClientesWorkspace from './ClientesWorkspace'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  let clientes: Cliente[] = []
  let errorBD = null

  try {
    clientes = await getClientes()
  } catch (error: any) {
    errorBD = error.message
  }

  // Manejo de errores de base de datos
  if (errorBD) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold">
        ⚠️ Error al conectar con la base de datos de clientes: {errorBD}
      </div>
    )
  }

  return <ClientesWorkspace clientesIniciales={clientes} />
}
