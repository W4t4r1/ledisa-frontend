// app/admin/caja/WorkspaceCaja.tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  abrirCaja,
  guardarMovimientoCajaChica,
  cerrarTurnoCaja,
  obtenerMovimientosDeSesion,
  obtenerVentasDeSesion
} from './actions'
import { CajaSesion, CajaChicaMovimiento } from '../../lib/caja.service'

interface WorkspaceCajaProps {
  sesionActivaInicial: CajaSesion | null
  movimientosIniciales: CajaChicaMovimiento[]
  ventasIniciales: any[]
  historialCierresInicial: CajaSesion[]
}

export default function WorkspaceCaja({
  sesionActivaInicial,
  movimientosIniciales,
  ventasIniciales,
  historialCierresInicial
}: WorkspaceCajaProps) {
  const [tabActiva, setTabActiva] = useState<'turno' | 'historial'>('turno')
  const [isPending, startTransition] = useTransition()

  // --- ESTADOS LOCALES ---
  const [sesionActiva, setSesionActiva] = useState<CajaSesion | null>(sesionActivaInicial)
  const [movimientos, setMovimientos] = useState<CajaChicaMovimiento[]>(movimientosIniciales)
  const [ventas, setVentas] = useState<any[]>(ventasIniciales)
  const [historialCierres, setHistorialCierres] = useState<CajaSesion[]>(historialCierresInicial)

  // Reactividad ante actualizaciones del servidor
  useEffect(() => {
    setSesionActiva(sesionActivaInicial)
    setMovimientos(movimientosIniciales)
    setVentas(ventasIniciales)
    setHistorialCierres(historialCierresInicial)
  }, [sesionActivaInicial, movimientosIniciales, ventasIniciales, historialCierresInicial])

  // --- FORMULARIO APERTURA CON SALDOS INICIALES ---
  const [montoAperturaEfectivo, setMontoAperturaEfectivo] = useState<number>(200)
  const [montoAperturaYape, setMontoAperturaYape] = useState<number>(0)
  const [montoAperturaTarjeta, setMontoAperturaTarjeta] = useState<number>(0)
  const [montoAperturaTransferencia, setMontoAperturaTransferencia] = useState<number>(0)

  // Formulario Movimiento Caja Chica
  const [montoMov, setMontoMov] = useState<number>(0)
  const [tipoMov, setTipoMov] = useState<'INGRESO' | 'EGRESO'>('EGRESO')
  const [motivoMov, setMotivoMov] = useState('')
  const [metodoPagoMov, setMetodoPagoMov] = useState('Efectivo')

  // Formulario Cierre
  const [montoRealContado, setMontoRealContado] = useState<number>(0)
  const [montoRealYape, setMontoRealYape] = useState<number>(0)
  const [montoRealTransferencia, setMontoRealTransferencia] = useState<number>(0)
  const [montoRealTarjeta, setMontoRealTarjeta] = useState<number>(0)
  const [notaCierre, setNotaCierre] = useState('')

  // Auditoría Histórica (Modal)
  const [cierreSeleccionado, setCierreSeleccionado] = useState<CajaSesion | null>(null)
  const [movimientosAuditoria, setMovimientosAuditoria] = useState<CajaChicaMovimiento[] | null>(null)
  const [ventasAuditoria, setVentasAuditoria] = useState<any[] | null>(null)
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false)

  // Modales adicionales: Calculadora y Ticket
  const [mostrarCalculadoraBilletes, setMostrarCalculadoraBilletes] = useState(false)
  const [mostrarTicketModal, setMostrarTicketModal] = useState(false)
  const [ticketData, setTicketData] = useState<CajaSesion | null>(null)

  // Desglose de billetes y monedas para calculadora
  const [desglose, setDesglose] = useState({
    b200: 0, b100: 0, b50: 0, b20: 0, b10: 0,
    m5: 0, m2: 0, m1: 0, m05: 0, m02: 0, m01: 0
  })

  // Calcular total de la calculadora de billetes
  const totalCalculadora = 
    desglose.b200 * 200 + desglose.b100 * 100 + desglose.b50 * 50 + desglose.b20 * 20 + desglose.b10 * 10 +
    desglose.m5 * 5 + desglose.m2 * 2 + desglose.m1 * 1 + desglose.m05 * 0.5 + desglose.m02 * 0.2 + desglose.m01 * 0.1

  const aplicarTotalCalculadora = () => {
    setMontoRealContado(parseFloat(totalCalculadora.toFixed(2)))
    setMostrarCalculadoraBilletes(false)
  }

  // --- CÁLCULOS EN CALIENTE DEL TURNO ACTIVO ---
  const ventasConfirmadas = ventas.filter(v => v.estado === 'PAGADO' || v.estado === 'ENTREGADO')

  let ventasEfectivo = 0
  let ventasYape = 0
  let ventasTarjeta = 0
  let ventasTransferencia = 0

  ventasConfirmadas.forEach(v => {
    const totalVal = Number(v.total)
    const m = (v.metodo_pago || '').toLowerCase()
    
    if (m.includes('efectivo')) {
      ventasEfectivo += totalVal
    } else if (m.includes('yape') || m.includes('plin')) {
      ventasYape += totalVal
    } else if (m.includes('tarjeta') || m.includes('credito') || m.includes('debito')) {
      ventasTarjeta += totalVal
    } else {
      ventasTransferencia += totalVal
    }
  })

  // Movimientos de caja chica consolidados por método de pago
  let egresosEfectivo = 0, ingresosEfectivo = 0
  let egresosYape = 0, ingresosYape = 0
  let egresosTarjeta = 0, ingresosTarjeta = 0
  let egresosTransferencia = 0, ingresosTransferencia = 0
  let egresosCajaChica = 0
  let ingresosCajaChica = 0

  movimientos.forEach(m => {
    const montoVal = Number(m.monto)
    const met = (m.metodo_pago || 'Efectivo').toLowerCase()
    const tipo = m.tipo

    if (tipo === 'EGRESO') {
      egresosCajaChica += montoVal
    } else {
      ingresosCajaChica += montoVal
    }

    if (met.includes('efectivo')) {
      if (tipo === 'EGRESO') egresosEfectivo += montoVal
      else ingresosEfectivo += montoVal
    } else if (met.includes('yape') || met.includes('plin')) {
      if (tipo === 'EGRESO') egresosYape += montoVal
      else ingresosYape += montoVal
    } else if (met.includes('tarjeta') || met.includes('credito') || met.includes('debito')) {
      if (tipo === 'EGRESO') egresosTarjeta += montoVal
      else ingresosTarjeta += montoVal
    } else {
      if (tipo === 'EGRESO') egresosTransferencia += montoVal
      else ingresosTransferencia += montoVal
    }
  })

  // Montos Esperados tomando en cuenta saldos iniciales de Apertura
  const efectivoApertura = Number(sesionActiva?.monto_apertura || 0)
  const yapeApertura = Number(sesionActiva?.monto_apertura_yape || 0)
  const tarjetaApertura = Number(sesionActiva?.monto_apertura_tarjeta || 0)
  const transferenciaApertura = Number(sesionActiva?.monto_apertura_transferencia || 0)

  const efectivoEstimado = efectivoApertura + ventasEfectivo + ingresosEfectivo - egresosEfectivo
  const yapeEstimado = yapeApertura + ventasYape + ingresosYape - egresosYape
  const tarjetaEstimado = tarjetaApertura + ventasTarjeta + ingresosTarjeta - egresosTarjeta
  const transferenciaEstimado = transferenciaApertura + ventasTransferencia + ingresosTransferencia - egresosTransferencia

  // Totales BCP (Cuenta Vinculada: Yape + Tarjeta BCP)
  const totalAperturaBcp = yapeApertura + tarjetaApertura
  const totalVentasBcp = ventasYape + ventasTarjeta
  const totalEstimadoBcp = yapeEstimado + tarjetaEstimado
  const totalRealBcp = montoRealYape + montoRealTarjeta
  const diferenciaBcp = totalRealBcp - totalEstimadoBcp

  // Diferencias individuales
  const diffEfectivo = montoRealContado - efectivoEstimado
  const diffYape = montoRealYape - yapeEstimado
  const diffTarjeta = montoRealTarjeta - tarjetaEstimado
  const diffTransferencia = montoRealTransferencia - transferenciaEstimado
  const descuadreTotal = diffEfectivo + diffYape + diffTarjeta + diffTransferencia

  // Inicializar los inputs de arqueo con los montos calculados por defecto
  useEffect(() => {
    if (sesionActiva) {
      setMontoRealContado(parseFloat(efectivoEstimado.toFixed(2)))
      setMontoRealYape(parseFloat(yapeEstimado.toFixed(2)))
      setMontoRealTransferencia(parseFloat(transferenciaEstimado.toFixed(2)))
      setMontoRealTarjeta(parseFloat(tarjetaEstimado.toFixed(2)))
    }
  }, [sesionActiva, efectivoEstimado, yapeEstimado, transferenciaEstimado, tarjetaEstimado])

  // --- DISPARADORES ---

  // Abrir Turno con Saldos Iniciales
  const handleAbrirCaja = (e: React.FormEvent) => {
    e.preventDefault()
    if (montoAperturaEfectivo < 0 || montoAperturaYape < 0 || montoAperturaTarjeta < 0 || montoAperturaTransferencia < 0) {
      alert('Los montos de apertura no pueden ser negativos.')
      return
    }

    startTransition(async () => {
      try {
        const res = await abrirCaja(
          montoAperturaEfectivo,
          montoAperturaYape,
          montoAperturaTarjeta,
          montoAperturaTransferencia
        )
        setSesionActiva(res)
        alert('🚀 Turno de caja abierto exitosamente con saldos iniciales.')
      } catch (err: any) {
        alert('❌ Error al abrir caja: ' + err.message)
      }
    })
  }

  // Registrar Movimiento Caja Chica
  const handleRegistrarMovimiento = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sesionActiva?.id) return

    if (montoMov <= 0) {
      alert('Ingresa un monto mayor a cero.')
      return
    }

    if (!motivoMov.trim()) {
      alert('Ingresa el motivo del movimiento.')
      return
    }

    startTransition(async () => {
      try {
        const res = await guardarMovimientoCajaChica(
          sesionActiva.id!,
          tipoMov,
          montoMov,
          motivoMov,
          metodoPagoMov
        )
        setMovimientos([...movimientos, res])
        setMontoMov(0)
        setMotivoMov('')
        alert('✅ Movimiento registrado en caja chica.')
      } catch (err: any) {
        alert('❌ Error al registrar movimiento: ' + err.message)
      }
    })
  }

  // Cerrar Caja
  const handleCerrarCaja = () => {
    if (!sesionActiva?.id) return

    const hayDescuadre = diffEfectivo !== 0 || diffYape !== 0 || diffTarjeta !== 0 || diffTransferencia !== 0

    if (hayDescuadre && !notaCierre.trim()) {
      alert('⚠️ Existe un descuadre en la caja. Por favor escribe una Nota del Cierre o Novedades antes de finalizar.')
      return
    }

    const confirmacion = window.confirm(
      `⚠️ ¿Estás seguro de cerrar el turno de caja?\n\n` +
      `[EFECTIVO]\n` +
      `Inicial: S/. ${efectivoApertura.toFixed(2)} | Esperado: S/. ${efectivoEstimado.toFixed(2)} | Real: S/. ${montoRealContado.toFixed(2)} | Dif: S/. ${diffEfectivo.toFixed(2)}\n\n` +
      `[YAPE/PLIN]\n` +
      `Inicial: S/. ${yapeApertura.toFixed(2)} | Esperado: S/. ${yapeEstimado.toFixed(2)} | Real: S/. ${montoRealYape.toFixed(2)} | Dif: S/. ${diffYape.toFixed(2)}\n\n` +
      `[TARJETA BCP / POS]\n` +
      `Inicial: S/. ${tarjetaApertura.toFixed(2)} | Esperado: S/. ${tarjetaEstimado.toFixed(2)} | Real: S/. ${montoRealTarjeta.toFixed(2)} | Dif: S/. ${diffTarjeta.toFixed(2)}\n\n` +
      `[BANCO BCP CONSOLIDADO]\n` +
      `Inicial Total: S/. ${totalAperturaBcp.toFixed(2)} | Esperado BCP: S/. ${totalEstimadoBcp.toFixed(2)} | Real BCP: S/. ${totalRealBcp.toFixed(2)} | Dif BCP: S/. ${diferenciaBcp.toFixed(2)}\n\n` +
      `Esta acción finalizará el turno y guardará el arqueo definitivo.`
    )

    if (!confirmacion) return

    startTransition(async () => {
      try {
        const resCierre = await cerrarTurnoCaja(
          sesionActiva.id!,
          montoRealContado,
          montoRealYape,
          montoRealTransferencia,
          montoRealTarjeta,
          notaCierre
        )
        setTicketData(resCierre)
        setSesionActiva(null)
        setMovimientos([])
        setVentas([])
        setNotaCierre('')
        setMostrarTicketModal(true)
      } catch (err: any) {
        alert('❌ Error al cerrar caja: ' + err.message)
      }
    })
  }

  // Auditar Turno del Historial (Cargar detalles)
  const handleAuditarCierre = (cierre: CajaSesion) => {
    setCierreSeleccionado(cierre)
    setMovimientosAuditoria(null)
    setVentasAuditoria(null)
    setCargandoAuditoria(true)

    startTransition(async () => {
      try {
        const [resMov, resVent] = await Promise.all([
          obtenerMovimientosDeSesion(cierre.id!),
          obtenerVentasDeSesion(cierre.id!)
        ])
        setMovimientosAuditoria(resMov)
        setVentasAuditoria(resVent)
      } catch (err: any) {
        alert('❌ Error al auditar turno: ' + err.message)
      } finally {
        setCargandoAuditoria(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      
      {/* TABS DE NAVEGACIÓN */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTabActiva('turno')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'turno'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          💵 Caja del Turno Actual
        </button>
        <button
          onClick={() => setTabActiva('historial')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'historial'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📄 Historial de Cierres de Caja
        </button>
      </div>

      {/* CONTENIDO DE TABS */}
      <div>

        {/* --- TAB 1: TURNO ACTUAL --- */}
        {tabActiva === 'turno' && (
          <div>
            {!sesionActiva ? (
              
              /* ESTADO: CAJA CERRADA (FORMULARIO APERTURA MULTIMÉTODO) */
              <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center space-y-6 mt-6">
                <div className="flex justify-center items-center gap-3">
                  <span className="text-4xl">💵</span>
                  <span className="text-4xl">📱</span>
                  <span className="text-4xl">💳</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-800">Apertura de Turno de Caja</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    Ingresa los saldos iniciales del día para Efectivo, Yape y Tarjeta BCP (cuentas vinculadas).
                  </p>
                </div>

                <form onSubmit={handleAbrirCaja} className="space-y-4 text-left">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Efectivo Inicial */}
                    <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                      <label className="text-xs font-bold text-emerald-800 block mb-1">
                        💵 Fondo Inicial Efectivo (S/.)*
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        min="0"
                        value={montoAperturaEfectivo}
                        onChange={e => setMontoAperturaEfectivo(parseFloat(e.target.value) || 0)}
                        className="w-full border border-emerald-300 p-2.5 rounded-lg text-gray-900 bg-white font-bold text-lg text-center focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">Dinero en caja chica / sencillo</span>
                    </div>

                    {/* Saldo Inicial Yape */}
                    <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100">
                      <label className="text-xs font-bold text-purple-800 block mb-1">
                        📱 Saldo Inicial Yape (S/.)*
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        min="0"
                        value={montoAperturaYape}
                        onChange={e => setMontoAperturaYape(parseFloat(e.target.value) || 0)}
                        className="w-full border border-purple-300 p-2.5 rounded-lg text-gray-900 bg-white font-bold text-lg text-center focus:outline-none focus:border-purple-600"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">Saldo inicial en App Yape / BCP</span>
                    </div>

                    {/* Saldo Inicial Tarjeta BCP */}
                    <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100">
                      <label className="text-xs font-bold text-amber-800 block mb-1">
                        💳 Saldo Inicial Tarjeta BCP / POS (S/.)*
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        min="0"
                        value={montoAperturaTarjeta}
                        onChange={e => setMontoAperturaTarjeta(parseFloat(e.target.value) || 0)}
                        className="w-full border border-amber-300 p-2.5 rounded-lg text-gray-900 bg-white font-bold text-lg text-center focus:outline-none focus:border-amber-600"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">Vínculo cuenta BCP / POS</span>
                    </div>

                    {/* Saldo Inicial Transferencias */}
                    <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                      <label className="text-xs font-bold text-blue-800 block mb-1">
                        🏦 Saldo Inicial Transferencias (S/.)*
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        min="0"
                        value={montoAperturaTransferencia}
                        onChange={e => setMontoAperturaTransferencia(parseFloat(e.target.value) || 0)}
                        className="w-full border border-blue-300 p-2.5 rounded-lg text-gray-900 bg-white font-bold text-lg text-center focus:outline-none focus:border-blue-600"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">Otras cuentas bancarias</span>
                    </div>
                  </div>

                  <div className="bg-blue-50/80 p-3 rounded-lg border border-blue-200 text-xs text-blue-900 font-semibold flex items-center gap-2">
                    <span>💡</span>
                    <span>
                      <strong>Nota BCP:</strong> Como Yape y la Tarjeta BCP están vinculados a la misma cuenta, la suma inicial de ambos será utilizada para cuadrar el saldo bancario al cierre.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full text-white font-bold py-3.5 px-4 rounded-xl bg-[#04558C] hover:bg-[#033f6b] shadow-md transition-colors text-center cursor-pointer disabled:opacity-50 text-base"
                  >
                    {isPending ? '⏳ Abriendo Turno...' : '🚀 Abrir Turno con Saldos Iniciales'}
                  </button>
                </form>
              </div>

            ) : (

              /* ESTADO: CAJA ABIERTA (DASHBOARD EN VIVO Y MOVIMIENTOS) */
              <div className="space-y-6">
                
                {/* CABECERA DETALLES DE SESIÓN */}
                <div className="bg-white rounded-xl border p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
                  <div>
                    <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                      Turno de Caja Abierto
                    </h3>
                    <p className="text-xs text-gray-400 font-semibold mt-1">
                      Apertura: {new Date(sesionActiva.fecha_apertura!).toLocaleString('es-PE')}
                    </p>
                  </div>
                  
                  {/* Desglose de Fondos de Apertura */}
                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-gray-700 bg-gray-50 p-2.5 rounded-lg border">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Fondo Efectivo</span>
                      <span className="font-bold text-emerald-700">S/. {efectivoApertura.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Inicial Yape</span>
                      <span className="font-bold text-purple-700">S/. {yapeApertura.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Inicial Tarjeta BCP</span>
                      <span className="font-bold text-amber-700">S/. {tarjetaApertura.toFixed(2)}</span>
                    </div>
                    <div className="border-l pl-3">
                      <span className="text-blue-600 block text-[10px] uppercase font-bold">Apertura BCP Total</span>
                      <span className="font-black text-blue-800">S/. {totalAperturaBcp.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* KPIs FINANCIEROS DEL TURNO EN VIVO */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* EFECTIVO ESTIMADO */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-emerald-500 shadow-sm">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Efectivo Estimado</p>
                    <h3 className="text-2xl font-black text-emerald-700">S/. {efectivoEstimado.toFixed(2)}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">
                      Inicial S/. {efectivoApertura.toFixed(2)} + Ventas S/. {ventasEfectivo.toFixed(2)}
                    </p>
                  </div>

                  {/* SALDO YAPE ESTIMADO */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-purple-500 shadow-sm">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Yape / Plin Estimado</p>
                    <h3 className="text-2xl font-black text-purple-700">S/. {yapeEstimado.toFixed(2)}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">
                      Inicial S/. {yapeApertura.toFixed(2)} + Ventas S/. {ventasYape.toFixed(2)}
                    </p>
                  </div>

                  {/* SALDO TARJETA BCP ESTIMADO */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-amber-500 shadow-sm">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Tarjeta BCP / POS Estimada</p>
                    <h3 className="text-2xl font-black text-amber-700">S/. {tarjetaEstimado.toFixed(2)}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">
                      Inicial S/. {tarjetaApertura.toFixed(2)} + Ventas S/. {ventasTarjeta.toFixed(2)}
                    </p>
                  </div>

                  {/* CONSOLIDADO BANCO BCP */}
                  <div className="bg-white p-5 rounded-xl border border-blue-200 border-l-4 border-l-blue-600 bg-blue-50/20 shadow-sm">
                    <p className="text-xs text-blue-800 font-bold uppercase tracking-wider mb-1">Total Cuenta BCP (Vínculo)</p>
                    <h3 className="text-2xl font-black text-blue-900">S/. {totalEstimadoBcp.toFixed(2)}</h3>
                    <p className="text-[10px] text-blue-600 font-semibold mt-1">
                      Yape (S/. {yapeEstimado.toFixed(2)}) + POS BCP (S/. {tarjetaEstimado.toFixed(2)})
                    </p>
                  </div>

                </div>

                {/* DOS COLUMNAS: CAJA CHICA Y CIERRE */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* SECCIÓN CAJA CHICA (2 Columnas) */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Registro de Caja Chica */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
                      <h3 className="text-base font-bold text-gray-800 border-b pb-2">
                        💸 Registrar Ingreso / Egreso Extraordinario
                      </h3>

                      <form onSubmit={handleRegistrarMovimiento} className="grid grid-cols-1 md:grid-cols-5 gap-3 text-gray-900">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Monto (S/.)*</label>
                          <input 
                            type="number" 
                            step="0.01"
                            min="0.01"
                            required
                            placeholder="0.00"
                            value={montoMov || ''}
                            onChange={e => setMontoMov(parseFloat(e.target.value) || 0)}
                            className="border border-gray-300 p-2 rounded-lg text-sm bg-white font-semibold focus:outline-none focus:border-[#04558C]"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Método Pago*</label>
                          <select 
                            value={metodoPagoMov}
                            onChange={e => setMetodoPagoMov(e.target.value)}
                            className="border border-gray-300 p-2 rounded-lg text-sm bg-white font-semibold focus:outline-none"
                          >
                            <option value="Efectivo">💵 Efectivo</option>
                            <option value="Yape">📱 Yape / Plin</option>
                            <option value="Tarjeta BCP">💳 Tarjeta BCP</option>
                            <option value="Transferencia">🏦 Transferencia</option>
                          </select>
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo*</label>
                          <select 
                            value={tipoMov}
                            onChange={e => setTipoMov(e.target.value as any)}
                            className="border border-gray-300 p-2 rounded-lg text-sm bg-white font-semibold focus:outline-none"
                          >
                            <option value="EGRESO">🔴 Egreso (Gasto)</option>
                            <option value="INGRESO">🟢 Ingreso (Aporte)</option>
                          </select>
                        </div>

                        <div className="flex flex-col md:col-span-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1">Motivo / Descripción*</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              required
                              placeholder="Ej: Pago de almuerzo personal, flete..."
                              value={motivoMov}
                              onChange={e => setMotivoMov(e.target.value)}
                              className="flex-1 border border-gray-300 p-2 rounded-lg text-sm bg-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={isPending}
                              className="bg-[#04558C] hover:bg-[#033f6b] text-white px-4 py-2 rounded-lg font-bold transition-colors cursor-pointer disabled:opacity-50 text-xs"
                            >
                              Registrar
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>

                    {/* Bitácora de Movimientos del Turno */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
                      <h3 className="text-base font-bold text-gray-800">
                        📋 Bitácora de Gastos y Aportes del Turno ({movimientos.length})
                      </h3>

                      {movimientos.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm italic">
                          No se han registrado egresos o ingresos de caja chica en este turno.
                        </p>
                      ) : (
                        <div className="overflow-x-auto text-xs">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider font-bold border-b">
                                <th className="p-2">Hora</th>
                                <th className="p-2">Método</th>
                                <th className="p-2">Tipo</th>
                                <th className="p-2 text-right">Monto</th>
                                <th className="p-2 pl-4">Motivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                              {movimientos.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50/50">
                                  <td className="p-2 text-gray-400">
                                    {new Date(m.fecha!).toLocaleTimeString('es-PE', {
                                      hour: '2-digit', minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="p-2 font-semibold text-gray-600">
                                    {m.metodo_pago || 'Efectivo'}
                                  </td>
                                  <td className="p-2">
                                    {m.tipo === 'EGRESO' ? (
                                      <span className="bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200">GASTO</span>
                                    ) : (
                                      <span className="bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded border border-green-200">APORTE</span>
                                    )}
                                  </td>
                                  <td className={`p-2 text-right font-bold ${m.tipo === 'EGRESO' ? 'text-red-600' : 'text-green-600'}`}>
                                    {m.tipo === 'EGRESO' ? '-' : '+'} S/. {Number(m.monto).toFixed(2)}
                                  </td>
                                  <td className="p-2 pl-4 text-gray-800">{m.motivo}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ARQUEO Y CIERRE DE CAJA */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 flex flex-col justify-between shadow-sm">
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-gray-800 border-b pb-2 flex items-center justify-between">
                        <span>🔒 Arqueo por Métodos de Pago</span>
                        <span className="text-xs bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200">Arqueo Requerido</span>
                      </h3>

                      {/* 1. SECCIÓN EFECTIVO */}
                      <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                            💵 Caja Efectivo
                          </h4>
                          <button
                            type="button"
                            onClick={() => setMostrarCalculadoraBilletes(true)}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                          >
                            🧮 Calculadora Billetes
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-semibold pl-1">
                          <span>Apertura: S/. {efectivoApertura.toFixed(2)}</span>
                          <span>Ventas: S/. {ventasEfectivo.toFixed(2)}</span>
                          <span>Aportes: S/. {ingresosEfectivo.toFixed(2)}</span>
                          <span className="text-red-500">Gastos: - S/. {egresosEfectivo.toFixed(2)}</span>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-gray-500">Efectivo Real Contado (S/.)*</label>
                            <span className="text-[10px] font-bold text-emerald-700">Esperado: S/. {efectivoEstimado.toFixed(2)}</span>
                          </div>
                          <input 
                            type="number"
                            step="0.01"
                            required
                            min="0"
                            value={montoRealContado}
                            onChange={e => setMontoRealContado(parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 px-3 py-1.5 rounded-lg text-gray-900 bg-white font-bold text-sm text-center focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] bg-white p-2 rounded-lg border border-emerald-100 font-bold">
                          <span className="text-gray-400">Diferencia Efectivo:</span>
                          <span className={diffEfectivo === 0 ? 'text-green-600' : diffEfectivo < 0 ? 'text-red-600' : 'text-blue-600'}>
                            {diffEfectivo > 0 ? '+' : ''}{diffEfectivo.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* 2. SECCIÓN YAPE / PLIN */}
                      <div className="bg-purple-50/40 p-4 rounded-xl border border-purple-100 space-y-3">
                        <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider flex justify-between items-center">
                          <span>📱 Yape / Plin</span>
                          <span className="font-mono text-purple-700">Esperado: S/. {yapeEstimado.toFixed(2)}</span>
                        </h4>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-semibold pl-1">
                          <span>Inicial: S/. {yapeApertura.toFixed(2)}</span>
                          <span>Ventas: S/. {ventasYape.toFixed(2)}</span>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-500 block mb-1">Monto Real en Yape (S/.)*</label>
                          <input 
                            type="number"
                            step="0.01"
                            required
                            min="0"
                            value={montoRealYape}
                            onChange={e => setMontoRealYape(parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 px-3 py-1.5 rounded-lg text-gray-900 bg-white font-bold text-sm text-center focus:outline-none focus:border-purple-600"
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] bg-white p-2 rounded-lg border border-purple-100 font-bold">
                          <span className="text-gray-400">Diferencia Yape:</span>
                          <span className={diffYape === 0 ? 'text-green-600' : diffYape < 0 ? 'text-red-600' : 'text-blue-600'}>
                            {diffYape > 0 ? '+' : ''}{diffYape.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* 3. SECCIÓN TARJETA BCP / POS */}
                      <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100 space-y-3">
                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex justify-between items-center">
                          <span>💳 Tarjeta BCP / POS</span>
                          <span className="font-mono text-amber-700">Esperado: S/. {tarjetaEstimado.toFixed(2)}</span>
                        </h4>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 font-semibold pl-1">
                          <span>Inicial: S/. {tarjetaApertura.toFixed(2)}</span>
                          <span>Ventas: S/. {ventasTarjeta.toFixed(2)}</span>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-500 block mb-1">Monto Real en POS (S/.)*</label>
                          <input 
                            type="number"
                            step="0.01"
                            required
                            min="0"
                            value={montoRealTarjeta}
                            onChange={e => setMontoRealTarjeta(parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-300 px-3 py-1.5 rounded-lg text-gray-900 bg-white font-bold text-sm text-center focus:outline-none focus:border-amber-600"
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] bg-white p-2 rounded-lg border border-amber-100 font-bold">
                          <span className="text-gray-400">Diferencia Tarjeta:</span>
                          <span className={diffTarjeta === 0 ? 'text-green-600' : diffTarjeta < 0 ? 'text-red-600' : 'text-blue-600'}>
                            {diffTarjeta > 0 ? '+' : ''}{diffTarjeta.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* 4. CONSOLIDADO BCP (YAPE + POS) */}
                      <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 space-y-2">
                        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex justify-between items-center">
                          <span>🏦 Consolidado Cuenta BCP</span>
                          <span className="font-mono text-blue-800">Esperado: S/. {totalEstimadoBcp.toFixed(2)}</span>
                        </h4>
                        <div className="flex justify-between items-center text-xs font-bold text-blue-950 bg-white p-2.5 rounded-lg border border-blue-100">
                          <span>Total Real BCP (Yape + POS):</span>
                          <span>S/. {totalRealBcp.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 px-1">
                          <span>Descuadre Banco BCP:</span>
                          <span className={diferenciaBcp === 0 ? 'text-green-600' : diferenciaBcp < 0 ? 'text-red-600' : 'text-blue-600'}>
                            {diferenciaBcp > 0 ? '+' : ''}{diferenciaBcp.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* SEMÁFORO DE CUADRE GENERAL */}
                      <div className={`p-3 rounded-xl border text-xs font-bold text-center flex items-center justify-center gap-2 ${
                        descuadreTotal === 0 
                          ? 'bg-green-50 border-green-200 text-green-800' 
                          : descuadreTotal < 0 
                          ? 'bg-red-50 border-red-200 text-red-800' 
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        {descuadreTotal === 0 ? (
                          <><span>✅</span> Turno perfectamente cuadrado (S/. 0.00)</>
                        ) : descuadreTotal < 0 ? (
                          <><span>⚠️</span> Faltante Total: S/. {descuadreTotal.toFixed(2)} (Escribe nota)</>
                        ) : (
                          <><span>ℹ️</span> Sobrante Total: +S/. {descuadreTotal.toFixed(2)}</>
                        )}
                      </div>

                      {/* Nota de cierre */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          Nota del Cierre / Novedades {descuadreTotal !== 0 && <span className="text-red-500">* (Requerido por descuadre)</span>}
                        </label>
                        <textarea 
                          rows={2}
                          placeholder="Escribe aquí el motivo si hubo algún descuadre de caja o novedad..."
                          value={notaCierre}
                          onChange={e => setNotaCierre(e.target.value)}
                          className="w-full border p-2 rounded-lg text-gray-900 bg-white text-xs focus:outline-none focus:border-[#04558C]"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCerrarCaja}
                      disabled={isPending}
                      className="w-full text-white font-bold py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors shadow-md text-center cursor-pointer disabled:opacity-50 mt-4 text-sm"
                    >
                      {isPending ? '⏳ Consolidando...' : '🔒 Cerrar Turno y Finalizar Caja'}
                    </button>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: HISTORIAL DE CIERRES --- */}
        {tabActiva === 'historial' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Historial de Arqueos y Cierres de Caja</h3>
            </div>
            
            {historialCierres.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl border-gray-200">
                <p className="text-gray-400 font-medium">No se registran cierres de caja históricos en el sistema.</p>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider font-bold border-b border-gray-200">
                      <th className="p-3 pl-4">Apertura</th>
                      <th className="p-3">Cierre</th>
                      <th className="p-3 text-right">Inicial Efectivo</th>
                      <th className="p-3 text-right">Inicial Yape</th>
                      <th className="p-3 text-right">Inicial Tarjeta</th>
                      <th className="p-3 text-right">Efectivo Real</th>
                      <th className="p-3 text-right">Yape Real</th>
                      <th className="p-3 text-right">Dif. Efectivo</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-gray-700">
                    {historialCierres.map(c => {
                      const diff = Number(c.diferencia || 0)
                      return (
                        <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-3 pl-4 font-semibold text-gray-500">
                            {new Date(c.fecha_apertura!).toLocaleDateString('es-PE', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="p-3 text-gray-500">
                            {c.fecha_cierre ? (
                              new Date(c.fecha_cierre).toLocaleDateString('es-PE', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })
                            ) : (
                              <span className="italic text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-medium">S/. {Number(c.monto_apertura).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-medium text-purple-700">S/. {Number(c.monto_apertura_yape || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-medium text-amber-700">S/. {Number(c.monto_apertura_tarjeta || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-bold text-gray-800">S/. {Number(c.monto_cierre_efectivo_real || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-bold text-purple-800">S/. {Number(c.monto_cierre_yape_real || 0).toFixed(2)}</td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            diff === 0 
                              ? 'text-green-600' 
                              : diff < 0 
                              ? 'text-red-600' 
                              : 'text-blue-600'
                          }`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleAuditarCierre(c)}
                              className="text-[#04558C] hover:text-[#033f6b] font-bold text-[11px] bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              🔎 Auditar Turno
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

      </div>

      {/* --- MODAL CALCULADORA DE BILLETES Y MONEDAS --- */}
      {mostrarCalculadoraBilletes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>🧮</span> Calculadora de Billetes y Monedas
              </h3>
              <button 
                onClick={() => setMostrarCalculadoraBilletes(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              
              {/* Billetes */}
              <div className="space-y-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                <span className="font-bold text-emerald-900 block text-xs uppercase mb-1">💵 Billetes</span>
                
                {[
                  { key: 'b200', val: 200, label: 'S/. 200' },
                  { key: 'b100', val: 100, label: 'S/. 100' },
                  { key: 'b50', val: 50, label: 'S/. 50' },
                  { key: 'b20', val: 20, label: 'S/. 20' },
                  { key: 'b10', val: 10, label: 'S/. 10' },
                ].map(b => (
                  <div key={b.key} className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-gray-700 w-16">{b.label}</span>
                    <input 
                      type="number"
                      min="0"
                      value={desglose[b.key as keyof typeof desglose] || ''}
                      onChange={e => setDesglose({ ...desglose, [b.key]: parseInt(e.target.value) || 0 })}
                      className="w-16 border rounded p-1 text-center font-bold text-gray-800 bg-white"
                    />
                    <span className="font-bold text-emerald-700 w-16 text-right">
                      S/. {(desglose[b.key as keyof typeof desglose] * b.val).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Monedas */}
              <div className="space-y-2 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                <span className="font-bold text-amber-900 block text-xs uppercase mb-1">🪙 Monedas</span>
                
                {[
                  { key: 'm5', val: 5, label: 'S/. 5' },
                  { key: 'm2', val: 2, label: 'S/. 2' },
                  { key: 'm1', val: 1, label: 'S/. 1' },
                  { key: 'm05', val: 0.5, label: 'S/. 0.50' },
                  { key: 'm02', val: 0.2, label: 'S/. 0.20' },
                  { key: 'm01', val: 0.1, label: 'S/. 0.10' },
                ].map(m => (
                  <div key={m.key} className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-gray-700 w-16">{m.label}</span>
                    <input 
                      type="number"
                      min="0"
                      value={desglose[m.key as keyof typeof desglose] || ''}
                      onChange={e => setDesglose({ ...desglose, [m.key]: parseInt(e.target.value) || 0 })}
                      className="w-16 border rounded p-1 text-center font-bold text-gray-800 bg-white"
                    />
                    <span className="font-bold text-amber-700 w-16 text-right">
                      S/. {(desglose[m.key as keyof typeof desglose] * m.val).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

            </div>

            <div className="bg-gray-100 p-3 rounded-xl flex justify-between items-center">
              <span className="font-bold text-gray-600 text-xs">Total Dinero Contado:</span>
              <span className="text-xl font-black text-emerald-700">S/. {totalCalculadora.toFixed(2)}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMostrarCalculadoraBilletes(false)}
                className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={aplicarTotalCalculadora}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Aplicar S/. {totalCalculadora.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL TICKET DE CIERRE E IMPRESIÓN --- */}
      {mostrarTicketModal && ticketData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            {/* Ticket Imprimible */}
            <div id="ticket-cierre-print" className="bg-amber-50/20 p-5 rounded-xl border border-dashed border-gray-300 font-mono text-xs space-y-3">
              <div className="text-center space-y-1 border-b border-dashed pb-3">
                <h2 className="text-base font-black text-gray-900">LEDISA - COMPROBANTE DE CIERRE DE CAJA</h2>
                <p className="text-[10px] text-gray-500">Reporte de Arqueo y Cuadre Financiero</p>
                <p className="text-[10px] text-gray-400">
                  {new Date().toLocaleString('es-PE')}
                </p>
              </div>

              <div className="space-y-1 text-gray-700 text-[11px]">
                <p><strong>Apertura:</strong> {new Date(ticketData.fecha_apertura!).toLocaleString('es-PE')}</p>
                <p><strong>Cierre:</strong> {new Date(ticketData.fecha_cierre!).toLocaleString('es-PE')}</p>
              </div>

              <div className="border-t border-dashed pt-2 space-y-1">
                <p className="font-bold text-gray-800">1. CAJA EFECTIVO</p>
                <div className="flex justify-between pl-2"><span>Inicial:</span><span>S/. {Number(ticketData.monto_apertura).toFixed(2)}</span></div>
                <div className="flex justify-between pl-2"><span>Esperado:</span><span>S/. {Number(ticketData.monto_cierre_efectivo_calculado).toFixed(2)}</span></div>
                <div className="flex justify-between pl-2 font-bold"><span>Real Contado:</span><span>S/. {Number(ticketData.monto_cierre_efectivo_real).toFixed(2)}</span></div>
                <div className="flex justify-between pl-2 font-bold text-gray-600"><span>Diferencia:</span><span>S/. {Number(ticketData.diferencia).toFixed(2)}</span></div>
              </div>

              <div className="border-t border-dashed pt-2 space-y-1">
                <p className="font-bold text-gray-800">2. YAPE / PLIN</p>
                <div className="flex justify-between pl-2"><span>Inicial:</span><span>S/. {Number(ticketData.monto_apertura_yape || 0).toFixed(2)}</span></div>
                <div className="flex justify-between pl-2 font-bold"><span>Real Yape:</span><span>S/. {Number(ticketData.monto_cierre_yape_real || 0).toFixed(2)}</span></div>
                <div className="flex justify-between pl-2 font-bold text-gray-600"><span>Diferencia:</span><span>S/. {Number(ticketData.diferencia_yape || 0).toFixed(2)}</span></div>
              </div>

              <div className="border-t border-dashed pt-2 space-y-1">
                <p className="font-bold text-gray-800">3. TARJETA BCP / POS</p>
                <div className="flex justify-between pl-2"><span>Inicial:</span><span>S/. {Number(ticketData.monto_apertura_tarjeta || 0).toFixed(2)}</span></div>
                <div className="flex justify-between pl-2 font-bold"><span>Real Tarjeta:</span><span>S/. {Number(ticketData.monto_cierre_tarjeta_real || 0).toFixed(2)}</span></div>
                <div className="flex justify-between pl-2 font-bold text-gray-600"><span>Diferencia:</span><span>S/. {Number(ticketData.diferencia_tarjeta || 0).toFixed(2)}</span></div>
              </div>

              {ticketData.nota && (
                <div className="border-t border-dashed pt-2 text-[10px] text-gray-600">
                  <p className="font-bold">Observaciones / Novedades:</p>
                  <p className="italic">"{ticketData.nota}"</p>
                </div>
              )}

              <div className="border-t border-dashed pt-6 text-center text-[10px] text-gray-400 space-y-8">
                <div className="border-t border-gray-400 w-3/4 mx-auto pt-1">
                  Firma de Conformidad Cajero / Admin
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMostrarTicketModal(false)}
                className="flex-1 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Cerrar Ventana
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-[#04558C] hover:bg-[#033f6b] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span> Imprimir Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE AUDITORÍA DETALLADA DEL CIERRE --- */}
      {cierreSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Cabecera modal */}
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span>📊</span> Reporte de Arqueo y Auditoría de Turno
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-1">
                  Apertura: {new Date(cierreSeleccionado.fecha_apertura!).toLocaleString('es-PE')} | 
                  Cierre: {cierreSeleccionado.fecha_cierre ? new Date(cierreSeleccionado.fecha_cierre).toLocaleString('es-PE') : 'Activa'}
                </p>
              </div>
              <button 
                onClick={() => setCierreSeleccionado(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Cuadre general por Métodos de Pago */}
            <div className="space-y-3 mb-6 text-xs">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">
                Resumen de Arqueos y Desbalances del Turno
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-gray-700">
                
                {/* Arqueo Efectivo */}
                <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 space-y-1.5">
                  <span className="font-bold text-emerald-800 block text-[9px] uppercase">💵 Efectivo</span>
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p>Fondo Inicial: S/. {Number(cierreSeleccionado.monto_apertura).toFixed(2)}</p>
                    <p>Esperado: S/. {Number(cierreSeleccionado.monto_cierre_efectivo_calculado || 0).toFixed(2)}</p>
                    <p className="font-bold text-gray-700">Real: S/. {Number(cierreSeleccionado.monto_cierre_efectivo_real || 0).toFixed(2)}</p>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span className="text-gray-400 text-[8px] uppercase">Dif:</span>
                    <span className={Number(cierreSeleccionado.diferencia || 0) === 0 ? 'text-green-600' : Number(cierreSeleccionado.diferencia || 0) < 0 ? 'text-red-600' : 'text-blue-600'}>
                      {Number(cierreSeleccionado.diferencia || 0) > 0 ? '+' : ''}{Number(cierreSeleccionado.diferencia || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Arqueo Yape/Plin */}
                <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 space-y-1.5">
                  <span className="font-bold text-purple-800 block text-[9px] uppercase">📱 Yape / Plin</span>
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p>Inicial: S/. {Number(cierreSeleccionado.monto_apertura_yape || 0).toFixed(2)}</p>
                    <p>Ventas: S/. {Number(cierreSeleccionado.total_ventas_yape || 0).toFixed(2)}</p>
                    <p className="font-bold text-gray-700">Real: S/. {Number(cierreSeleccionado.monto_cierre_yape_real || 0).toFixed(2)}</p>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span className="text-gray-400 text-[8px] uppercase">Dif:</span>
                    <span className={Number(cierreSeleccionado.diferencia_yape || 0) === 0 ? 'text-green-600' : Number(cierreSeleccionado.diferencia_yape || 0) < 0 ? 'text-red-600' : 'text-blue-600'}>
                      {Number(cierreSeleccionado.diferencia_yape || 0) > 0 ? '+' : ''}{Number(cierreSeleccionado.diferencia_yape || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Arqueo Transferencia */}
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 space-y-1.5">
                  <span className="font-bold text-blue-800 block text-[9px] uppercase">🏦 Transferencia</span>
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p>Inicial: S/. {Number(cierreSeleccionado.monto_apertura_transferencia || 0).toFixed(2)}</p>
                    <p>Ventas: S/. {Number(cierreSeleccionado.total_ventas_transferencia || 0).toFixed(2)}</p>
                    <p className="font-bold text-gray-700">Real: S/. {Number(cierreSeleccionado.monto_cierre_transferencia_real || 0).toFixed(2)}</p>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span className="text-gray-400 text-[8px] uppercase">Dif:</span>
                    <span className={Number(cierreSeleccionado.diferencia_transferencia || 0) === 0 ? 'text-green-600' : Number(cierreSeleccionado.diferencia_transferencia || 0) < 0 ? 'text-red-600' : 'text-blue-600'}>
                      {Number(cierreSeleccionado.diferencia_transferencia || 0) > 0 ? '+' : ''}{Number(cierreSeleccionado.diferencia_transferencia || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Arqueo Tarjeta */}
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 space-y-1.5">
                  <span className="font-bold text-amber-800 block text-[9px] uppercase">💳 Tarjetas BCP</span>
                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p>Inicial: S/. {Number(cierreSeleccionado.monto_apertura_tarjeta || 0).toFixed(2)}</p>
                    <p>Ventas: S/. {Number(cierreSeleccionado.total_ventas_tarjeta || 0).toFixed(2)}</p>
                    <p className="font-bold text-gray-700">Real: S/. {Number(cierreSeleccionado.monto_cierre_tarjeta_real || 0).toFixed(2)}</p>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-bold">
                    <span className="text-gray-400 text-[8px] uppercase">Dif:</span>
                    <span className={Number(cierreSeleccionado.diferencia_tarjeta || 0) === 0 ? 'text-green-600' : Number(cierreSeleccionado.diferencia_tarjeta || 0) < 0 ? 'text-red-600' : 'text-blue-600'}>
                      {Number(cierreSeleccionado.diferencia_tarjeta || 0) > 0 ? '+' : ''}{Number(cierreSeleccionado.diferencia_tarjeta || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Dos columnas de listados auditoría */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-80">
              
              {/* Egresos/Ingresos Caja Chica */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 text-xs uppercase border-b pb-2">
                  Caja Chica del Turno ({movimientosAuditoria?.length || 0})
                </h4>
                {cargandoAuditoria ? (
                  <p className="text-gray-400 text-xs italic">Cargando bitácora...</p>
                ) : !movimientosAuditoria || movimientosAuditoria.length === 0 ? (
                  <p className="text-gray-400 text-xs italic">Sin movimientos extraordinarios.</p>
                ) : (
                  <div className="space-y-2 text-[11px] max-h-60 overflow-y-auto">
                    {movimientosAuditoria.map(m => (
                      <div key={m.id} className="p-2 border rounded bg-gray-50 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">{m.motivo}</p>
                          <p className="text-[9px] text-gray-400">
                            {new Date(m.fecha!).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className={`font-bold ${m.tipo === 'EGRESO' ? 'text-red-600' : 'text-green-600'}`}>
                          {m.tipo === 'EGRESO' ? '-' : '+'} S/. {Number(m.monto).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ventas asociadas */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 text-xs uppercase border-b pb-2">
                  Ventas registradas del Turno ({ventasAuditoria?.filter(v => v.estado !== 'COTIZACION' && v.estado !== 'ANULADO').length || 0})
                </h4>
                {cargandoAuditoria ? (
                  <p className="text-gray-400 text-xs italic">Cargando ventas...</p>
                ) : !ventasAuditoria || ventasAuditoria.length === 0 ? (
                  <p className="text-gray-400 text-xs italic">Sin transacciones registradas.</p>
                ) : (
                  <div className="space-y-2 text-[11px] max-h-60 overflow-y-auto">
                    {ventasAuditoria
                      .filter(v => v.estado !== 'COTIZACION' && v.estado !== 'ANULADO')
                      .map(v => (
                        <div key={v.id} className="p-2 border rounded bg-gray-50 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-gray-800">{v.codigo_venta}</p>
                            <p className="text-[9px] text-gray-400">
                              {v.metodo_pago} | {v.clientes?.nombre_razon_social || 'Cliente General'}
                            </p>
                          </div>
                          <span className="font-bold text-[#04558C]">
                            S/. {Number(v.total).toFixed(2)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>

            {/* Observaciones de Cierre */}
            {cierreSeleccionado.nota && (
              <div className="mt-6 pt-4 border-t text-xs text-gray-600 bg-amber-50/50 p-3 rounded-lg border border-amber-200/50">
                <span className="font-bold block text-gray-700 mb-1">Novedades del Cierre:</span>
                <p className="italic">"{cierreSeleccionado.nota}"</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-6 border-t">
              <button
                type="button"
                onClick={() => {
                  setTicketData(cierreSeleccionado)
                  setMostrarTicketModal(true)
                }}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#04558C] rounded-lg font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              >
                <span>🖨️</span> Ver Ticket
              </button>
              <button
                onClick={() => setCierreSeleccionado(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-colors cursor-pointer text-xs"
              >
                Cerrar Auditoría
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
