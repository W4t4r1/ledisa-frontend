// app/admin/kardex/page.tsx
import { getKardex } from '../../lib/ventas.service'
import { getInventarioCompleto } from '../../lib/inventario.service'
import KardexWorkspace from './KardexWorkspace'

export const dynamic = 'force-dynamic'

export default async function KardexPage() {
  let kardex: any[] = []
  let inventario: any[] = []
  let errorBD = null

  try {
    kardex = await getKardex()
    inventario = await getInventarioCompleto()
  } catch (error: any) {
    errorBD = error.message
  }

  // Manejo de errores de base de datos
  if (errorBD) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold">
        ⚠️ Error al conectar con la base de datos de inventario/kardex: {errorBD}
      </div>
    )
  }

  return <KardexWorkspace inventario={inventario} kardexInicial={kardex} />
}
