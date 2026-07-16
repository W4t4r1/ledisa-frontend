// app/admin/caja/page.tsx
import { getSesionCajaActiva, getMovimientosSesion, getVentasSesionCaja, getHistorialSesionesCaja } from '../../lib/caja.service'
import WorkspaceCaja from './WorkspaceCaja'

export const dynamic = 'force-dynamic'

export default async function CajaPage() {
  let activa: any = null
  let movimientos: any[] = []
  let ventas: any[] = []
  let historial: any[] = []
  let errorBD = null

  try {
    activa = await getSesionCajaActiva()
    if (activa) {
      // Carga en paralelo si hay una caja abierta
      const [resMovimientos, resVentas] = await Promise.all([
        getMovimientosSesion(activa.id),
        getVentasSesionCaja(activa.id)
      ])
      movimientos = resMovimientos
      ventas = resVentas
    }
    // Carga de cierres históricos
    historial = await getHistorialSesionesCaja()
  } catch (error: any) {
    errorBD = error.message
  }

  if (errorBD) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 font-bold">
        ⚠️ Error al conectar con la base de datos de caja chica y cierres: {errorBD}
      </div>
    )
  }

  return (
    <WorkspaceCaja
      sesionActivaInicial={activa}
      movimientosIniciales={movimientos}
      ventasIniciales={ventas}
      historialCierresInicial={historial}
    />
  )
}
