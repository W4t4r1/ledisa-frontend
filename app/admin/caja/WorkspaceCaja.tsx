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

  // Formulario Apertura
  const [montoApertura, setMontoApertura] = useState<number>(200)

  // Formulario Movimiento Caja Chica
  const [montoMov, setMontoMov] = useState<number>(0)
  const [tipoMov, setTipoMov] = useState<'INGRESO' | 'EGRESO'>('EGRESO')
  const [motivoMov, setMotivoMov] = useState('')
  const [metodoPagoMov, setMetodoPagoMov] = useState('Efectivo')

  // Formulario Cierre
  const [montoRealContado, setMontoRealContado] = useState<number>(0)
  const [notaCierre, setNotaCierre] = useState('')

  // Auditoría Histórica (Modal)
  const [cierreSeleccionado, setCierreSeleccionado] = useState<CajaSesion | null>(null)
  const [movimientosAuditoria, setMovimientosAuditoria] = useState<CajaChicaMovimiento[] | null>(null)
  const [ventasAuditoria, setVentasAuditoria] = useState<any[] | null>(null)
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false)

  // --- CÁLCULOS EN CALIENTE DEL TURNO ACTIVO ---
  // Ventas consolidadas por método de pago
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

  // Movimientos de caja chica consolidados
  let egresosCajaChica = 0
  let ingresosCajaChica = 0

  movimientos.forEach(m => {
    const montoVal = Number(m.monto)
    if (m.tipo === 'EGRESO') {
      egresosCajaChica += montoVal
    } else {
      ingresosCajaChica += montoVal
    }
  })

  // Efectivo Estimado Esperado
  const efectivoApertura = Number(sesionActiva?.monto_apertura || 0)
  const efectivoEstimado = efectivoApertura + ventasEfectivo + ingresosCajaChica - egresosCajaChica

  // Inicializar el input de arqueo de caja con el monto calculado por defecto
  useEffect(() => {
    if (sesionActiva) {
      setMontoRealContado(parseFloat(efectivoEstimado.toFixed(2)))
    }
  }, [sesionActiva, efectivoEstimado])

  // --- DISPARADORES ---

  // Abrir Turno
  const handleAbrirCaja = (e: React.FormEvent) => {
    e.preventDefault()
    if (montoApertura < 0) {
      alert('El monto de apertura no puede ser negativo.')
      return
    }

    startTransition(async () => {
      try {
        const res = await abrirCaja(montoApertura)
        setSesionActiva(res)
        alert('🚀 Turno de caja abierta exitosamente.')
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

    const confirmacion = window.confirm(
      `⚠️ ¿Estás seguro de cerrar el turno de caja?\n\n` +
      `Efectivo Calculado: S/. ${efectivoEstimado.toFixed(2)}\n` +
      `Efectivo Real Contado: S/. ${montoRealContado.toFixed(2)}\n` +
      `Diferencia (Desbalance): S/. ${(montoRealContado - efectivoEstimado).toFixed(2)}\n\n` +
      `Esta acción finalizará el turno y no se podrá deshacer.`
    )

    if (!confirmacion) return

    startTransition(async () => {
      try {
        await cerrarTurnoCaja(sesionActiva.id!, montoRealContado, notaCierre)
        setSesionActiva(null)
        setMovimientos([])
        setVentas([])
        setNotaCierre('')
        alert('🔒 Caja cerrada y turnada con éxito. Datos guardados en historial.')
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
              
              /* ESTADO: CAJA CERRADA (FORMULARIO APERTURA) */
              <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-gray-200 p-8 text-center space-y-6 mt-6">
                <span className="text-5xl block">💵</span>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Caja Chica Cerrada</h3>
                  <p className="text-gray-400 text-sm mt-1">Ingresa el efectivo inicial para abrir la caja del día.</p>
                </div>

                <form onSubmit={handleAbrirCaja} className="space-y-4">
                  <div className="text-left">
                    <label className="text-xs font-bold text-gray-500 block mb-1">Monto de Apertura en Efectivo (S/.)*</label>
                    <input 
                      type="number" 
                      step="0.1"
                      required
                      min="0"
                      value={montoApertura}
                      onChange={e => setMontoApertura(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 bg-white font-bold text-lg text-center focus:outline-none focus:border-[#04558C]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full text-white font-bold py-3 px-4 rounded-lg bg-[#04558C] hover:bg-[#033f6b] shadow-md transition-colors text-center cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? '⏳ Abriendo...' : '🚀 Abrir Turno de Caja'}
                  </button>
                </form>
              </div>

            ) : (

              /* ESTADO: CAJA ABIERTA (DASHBOARD EN VIVO Y MOVIMIENTOS) */
              <div className="space-y-6">
                
                {/* CABECERA DETALLES DE SESIÓN */}
                <div className="bg-white rounded-xl border p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Turno de Caja Abierto
                    </h3>
                    <p className="text-xs text-gray-400 font-semibold mt-1">
                      Apertura: {new Date(sesionActiva.fecha_apertura!).toLocaleString('es-PE')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-400 block uppercase">Apertura</span>
                    <span className="text-lg font-black text-gray-700">S/. {efectivoApertura.toFixed(2)}</span>
                  </div>
                </div>

                {/* KPIs FINANCIEROS DEL TURNO EN VIVO */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* EFECTIVO ESTIMADO */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-emerald-500">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Efectivo Estimado</p>
                    <h3 className="text-2xl font-black text-emerald-700">S/. {efectivoEstimado.toFixed(2)}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">Apertura + Ventas + Caja Chica</p>
                  </div>

                  {/* VENTAS YAPE/PLIN */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-purple-500">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ventas Yape/Plin</p>
                    <h3 className="text-2xl font-black text-purple-700">S/. {ventasYape.toFixed(2)}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">Cobros electrónicos directos</p>
                  </div>

                  {/* TRANSFERENCIAS BANCARIAS */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-blue-500">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Transferencias</p>
                    <h3 className="text-2xl font-black text-blue-700">S/. {ventasTransferencia.toFixed(2)}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">Cuentas BCP / Interbancarias</p>
                  </div>

                  {/* TARJETAS */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-amber-500">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ventas Tarjeta</p>
                    <h3 className="text-2xl font-black text-gray-800">S/. {ventasTarjeta.toFixed(2)}</h3>
                    <p className="text-[10px] text-gray-400 font-semibold mt-1">Crédito y Débito POS</p>
                  </div>

                </div>

                {/* DOS COLUMNAS: CAJA CHICA Y CIERRE */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* SECCIÓN CAJA CHICA (2 Columnas) */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Registro de Caja Chica */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                      <h3 className="text-base font-bold text-gray-800 border-b pb-2">
                        💸 Registrar Ingreso / Egreso Extraordinario
                      </h3>

                      <form onSubmit={handleRegistrarMovimiento} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-gray-900">
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

                    {/* Historial de Caja Chica del Turno */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
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
                  <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 flex flex-col justify-between">
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-gray-800 border-b pb-2">
                        🔒 Arqueo y Cierre de Caja
                      </h3>

                      {/* Monto apertura */}
                      <div className="flex justify-between text-xs text-gray-500 font-semibold">
                        <span>(+) Fondo Apertura:</span>
                        <span>S/. {efectivoApertura.toFixed(2)}</span>
                      </div>

                      {/* Ventas en efectivo */}
                      <div className="flex justify-between text-xs text-gray-500 font-semibold">
                        <span>(+) Ventas Efectivo:</span>
                        <span>S/. {ventasEfectivo.toFixed(2)}</span>
                      </div>

                      {/* Aportes */}
                      <div className="flex justify-between text-xs text-gray-500 font-semibold">
                        <span>(+) Aportes Caja Chica:</span>
                        <span>S/. {ingresosCajaChica.toFixed(2)}</span>
                      </div>

                      {/* Gastos */}
                      <div className="flex justify-between text-xs text-gray-500 font-semibold">
                        <span>(-) Egresos Caja Chica:</span>
                        <span className="text-red-500">- S/. {egresosCajaChica.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm font-bold text-gray-700 border-t pt-2">
                        <span>Efectivo Esperado:</span>
                        <span>S/. {efectivoEstimado.toFixed(2)}</span>
                      </div>

                      {/* Efectivo Contado */}
                      <div className="pt-2">
                        <label className="text-xs font-bold text-gray-500 block mb-1">Efectivo Físico Contado en Caja (S/.)*</label>
                        <input 
                          type="number"
                          step="0.01"
                          required
                          min="0"
                          value={montoRealContado}
                          onChange={e => setMontoRealContado(parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 p-3 rounded-lg text-gray-900 bg-white font-bold text-lg text-center focus:outline-none focus:border-[#04558C]"
                        />
                      </div>

                      {/* Diferencia */}
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border text-xs">
                        <span className="font-bold text-gray-500">Desbalance / Diferencia:</span>
                        <span className={`font-black text-sm ${
                          montoRealContado - efectivoEstimado === 0 
                            ? 'text-green-600' 
                            : montoRealContado - efectivoEstimado < 0 
                            ? 'text-red-600' 
                            : 'text-blue-600'
                        }`}>
                          {montoRealContado - efectivoEstimado > 0 ? '+' : ''}
                          {parseFloat((montoRealContado - efectivoEstimado).toFixed(2))}
                        </span>
                      </div>

                      {/* Nota de cierre */}
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Nota del Cierre / Novedades</label>
                        <textarea 
                          rows={3}
                          placeholder="Escribe aquí si hubo algún descuadre de caja o novedad..."
                          value={notaCierre}
                          onChange={e => setNotaCierre(e.target.value)}
                          className="w-full border p-2 rounded-lg text-gray-900 bg-white text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCerrarCaja}
                      disabled={isPending}
                      className="w-full text-white font-bold py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 transition-colors shadow-md text-center cursor-pointer disabled:opacity-50 mt-4"
                    >
                      {isPending ? '⏳ Consolidando...' : '🔒 Cerrar Turno y Caja'}
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
            <h3 className="text-xl font-bold text-gray-800">Historial de Arqueos y Cierres de Caja</h3>
            
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
                      <th className="p-3 text-right">Inicial (Fondo)</th>
                      <th className="p-3 text-right">Efectivo Esperado</th>
                      <th className="p-3 text-right">Efectivo Real</th>
                      <th className="p-3 text-right">Diferencia</th>
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
                          <td className="p-3 text-right font-mono font-semibold text-gray-600">S/. {Number(c.monto_cierre_efectivo_calculado || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-bold text-gray-800">S/. {Number(c.monto_cierre_efectivo_real || 0).toFixed(2)}</td>
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

            {/* Cuadre general */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border mb-6 text-xs font-semibold text-gray-600">
              <div className="space-y-1">
                <span className="text-gray-400 block font-bold uppercase text-[9px]">Fondo Inicial</span>
                <span className="text-sm font-black text-gray-800">S/. {Number(cierreSeleccionado.monto_apertura).toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 block font-bold uppercase text-[9px]">Efectivo Esperado</span>
                <span className="text-sm font-black text-gray-800">S/. {Number(cierreSeleccionado.monto_cierre_efectivo_calculado || 0).toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 block font-bold uppercase text-[9px]">Efectivo Contado</span>
                <span className="text-sm font-black text-gray-800">S/. {Number(cierreSeleccionado.monto_cierre_efectivo_real || 0).toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 block font-bold uppercase text-[9px]">Desbalance</span>
                <span className={`text-sm font-black ${
                  Number(cierreSeleccionado.diferencia || 0) === 0 
                    ? 'text-green-600' 
                    : Number(cierreSeleccionado.diferencia || 0) < 0 
                    ? 'text-red-600' 
                    : 'text-blue-600'
                }`}>
                  {Number(cierreSeleccionado.diferencia || 0) > 0 ? '+' : ''}
                  {Number(cierreSeleccionado.diferencia || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Ventas consolidadas por método */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-bold text-[#04558C] text-xs uppercase mb-3 tracking-wider">
                Consolidado de Ventas por Método de Pago
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-gray-700">
                <div className="flex justify-between border-r pr-4">
                  <span>💵 Efectivo:</span>
                  <span className="font-bold text-gray-900 font-mono">S/. {Number(cierreSeleccionado.total_ventas_efectivo || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-r px-2 md:px-4">
                  <span>📱 Yape/Plin:</span>
                  <span className="font-bold text-gray-900 font-mono">S/. {Number(cierreSeleccionado.total_ventas_yape || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-r px-2 md:px-4">
                  <span>🏦 Transf:</span>
                  <span className="font-bold text-gray-900 font-mono">S/. {Number(cierreSeleccionado.total_ventas_transferencia || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span>💳 Tarjetas:</span>
                  <span className="font-bold text-gray-900 font-mono">S/. {Number(cierreSeleccionado.total_ventas_tarjeta || 0).toFixed(2)}</span>
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

            <div className="flex justify-end pt-4 mt-6 border-t">
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
