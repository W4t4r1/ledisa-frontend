'use client'

import { useEffect, useState } from 'react'
import { getCuentasPorCobrar, registrarAbono, getAbonosVenta } from '../../lib/ventas.service'
import { getEmpresas, getEmpresaActiva, Empresa } from '../../lib/empresas.service'

export default function CobranzasPage() {
  const [cuentas, setCuentas] = useState<any[]>([])
  const [empresaActiva, setEmpresaActiva] = useState<Empresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal para abonar
  const [ventaSeleccionada, setVentaSeleccionada] = useState<any | null>(null)
  const [montoAbono, setMontoAbono] = useState<string>('')
  const [metodoPago, setMetodoPago] = useState<string>('Efectivo')
  const [referencia, setReferencia] = useState<string>('')
  const [nota, setNota] = useState<string>('')
  const [procesandoAbono, setProcesandoAbono] = useState(false)

  // Modal para ver historial de abonos
  const [historialAbonos, setHistorialAbonos] = useState<any[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [modalHistorialOpen, setModalHistorialOpen] = useState(false)

  const cargarCuentas = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const empresas = await getEmpresas()
      const activa = getEmpresaActiva(empresas)
      setEmpresaActiva(activa)

      const data = await getCuentasPorCobrar(activa?.id)
      setCuentas(data)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener cuentas por cobrar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCuentas()

    const handleEmpresaChange = () => {
      cargarCuentas()
    }
    window.addEventListener('empresaChanged', handleEmpresaChange)
    return () => window.removeEventListener('empresaChanged', handleEmpresaChange)
  }, [])

  const abrirModalAbono = (venta: any) => {
    setVentaSeleccionada(venta)
    setMontoAbono(String(venta.saldo_pendiente || venta.total))
    setMetodoPago('Efectivo')
    setReferencia('')
    setNota('')
  }

  const handleRegistrarAbono = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ventaSeleccionada) return

    const montoNum = parseFloat(montoAbono)
    if (isNaN(montoNum) || montoNum <= 0) {
      alert('Por favor ingresa un monto válido mayor a S/ 0.')
      return
    }

    if (montoNum > Number(ventaSeleccionada.saldo_pendiente || ventaSeleccionada.total)) {
      alert(`El monto del abono (S/ ${montoNum}) no puede superar el saldo pendiente (S/ ${ventaSeleccionada.saldo_pendiente}).`)
      return
    }

    setProcesandoAbono(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      await registrarAbono(
        ventaSeleccionada.id,
        montoNum,
        metodoPago,
        referencia,
        nota
      )
      setSuccessMsg(`¡Abono registrado con éxito por S/ ${montoNum.toFixed(2)} para ${ventaSeleccionada.codigo_venta}!`)
      setVentaSeleccionada(null)
      await cargarCuentas()
    } catch (err: any) {
      alert(`Error al registrar cobro: ${err.message}`)
    } finally {
      setProcesandoAbono(false)
    }
  }

  const verHistorialAbonos = async (venta: any) => {
    setVentaSeleccionada(venta)
    setModalHistorialOpen(true)
    setCargandoHistorial(true)
    try {
      const data = await getAbonosVenta(venta.id)
      setHistorialAbonos(data)
    } catch (err: any) {
      console.error('Error al obtener abonos:', err)
    } finally {
      setCargandoHistorial(false)
    }
  }

  const cuentasFiltradas = cuentas.filter(c => {
    const term = busqueda.toLowerCase()
    const clienteNombre = c.clientes?.nombre_razon_social || ''
    const clienteDoc = c.clientes?.documento || ''
    const codigoVenta = c.codigo_venta || ''
    return (
      clienteNombre.toLowerCase().includes(term) ||
      clienteDoc.toLowerCase().includes(term) ||
      codigoVenta.toLowerCase().includes(term)
    )
  })

  const totalDeudaAcumulada = cuentasFiltradas.reduce((acc, curr) => acc + Number(curr.saldo_pendiente || 0), 0)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER PAGE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-800">💰 Cuentas por Cobrar (Cobranzas en Ruta)</h1>
            {empresaActiva && (
              <span className="bg-[#04558C] text-white text-xs font-bold px-3 py-1 rounded-full">
                {empresaActiva.nombre}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestión de despachos a crédito y cobranzas a tiendas por la tarde.
          </p>
        </div>

        {/* METRICA DEUDA */}
        <div className="bg-red-50 border border-red-200 px-5 py-3 rounded-lg flex flex-col items-end">
          <span className="text-xs text-red-600 font-bold uppercase tracking-wider">Total Pendiente por Cobrar</span>
          <span className="text-2xl font-black text-red-700">S/ {totalDeudaAcumulada.toFixed(2)}</span>
        </div>
      </div>

      {/* MENSAJES FEEDBACK */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg font-semibold flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {/* BARRA DE BUSQUEDA Y FILTROS */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="🔍 Buscar por cliente, DNI/RUC o # de venta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#04558C]"
          />
        </div>
        <button
          onClick={cargarCuentas}
          className="w-full sm:w-auto px-4 py-2 bg-slate-100 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-200 transition-colors border border-slate-300"
        >
          🔄 Actualizar Lista
        </button>
      </div>

      {/* TABLA DE CUENTAS POR COBRAR */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-semibold animate-pulse">
            Cargando cuentas por cobrar...
          </div>
        ) : cuentasFiltradas.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-lg font-bold">🎉 ¡No hay cuentas pendientes por cobrar!</p>
            <p className="text-sm mt-1">Todas las ventas a crédito están completamente al día.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase">
                <tr>
                  <th className="p-4">Fecha / Venta</th>
                  <th className="p-4">Cliente / Tienda</th>
                  <th className="p-4">Contacto / Dirección</th>
                  <th className="p-4 text-right">Total Venta</th>
                  <th className="p-4 text-right">Cobrado</th>
                  <th className="p-4 text-right">Saldo Pendiente</th>
                  <th className="p-4 text-center">Estado Pago</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cuentasFiltradas.map((c) => {
                  const saldo = Number(c.saldo_pendiente || c.total)
                  const pagado = Number(c.monto_pagado || 0)
                  const total = Number(c.total)

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[#04558C]">{c.codigo_venta}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(c.fecha).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">
                          {c.clientes?.nombre_razon_social || 'Cliente General'}
                        </div>
                        {c.clientes?.documento && (
                          <div className="text-xs text-slate-500 font-mono">
                            Doc: {c.clientes.documento}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-700">{c.clientes?.celular || 'Sin celular'}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {c.clientes?.direccion || 'Sin dirección de despacho'}
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800">
                        S/ {total.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-semibold text-emerald-600">
                        S/ {pagado.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-black text-red-600 text-base">
                        S/ {saldo.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                            c.estado_pago === 'PAGADO_PARCIAL'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-red-100 text-red-800 border border-red-300'
                          }`}
                        >
                          {c.estado_pago === 'PAGADO_PARCIAL' ? 'Pagado Parcial' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-4 text-center space-x-2">
                        <button
                          onClick={() => abrirModalAbono(c)}
                          className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          💵 Cobrar Abono
                        </button>
                        <button
                          onClick={() => verHistorialAbonos(c)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-md hover:bg-slate-200 transition-colors border border-slate-300"
                          title="Ver historial de cobros"
                        >
                          📜 Pagos
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

      {/* MODAL PARA REGISTRAR COBRO / ABONO */}
      {ventaSeleccionada && !modalHistorialOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-800">Registrar Cobro / Abono</h2>
                <p className="text-xs text-slate-500">Venta: {ventaSeleccionada.codigo_venta}</p>
              </div>
              <button
                onClick={() => setVentaSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-800">{ventaSeleccionada.clientes?.nombre_razon_social || 'Cliente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Venta:</span>
                <span className="font-bold text-slate-800">S/ {Number(ventaSeleccionada.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600 font-bold">
                <span>Saldo Pendiente Actual:</span>
                <span>S/ {Number(ventaSeleccionada.saldo_pendiente || ventaSeleccionada.total).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleRegistrarAbono} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Monto a Cobrar (S/) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.10"
                  max={Number(ventaSeleccionada.saldo_pendiente || ventaSeleccionada.total)}
                  required
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  className="w-full text-slate-900 border border-slate-300 rounded-lg p-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Forma de Pago *
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full text-slate-900 border border-slate-300 rounded-lg p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Efectivo">💵 Efectivo (Ingresa a Caja Física)</option>
                  <option value="Yape/Plin">📱 Yape / Plin</option>
                  <option value="Transferencia BCP">🏦 Transferencia BCP</option>
                  <option value="Transferencia Interbancaria">🏦 Transferencia Interbancaria</option>
                  <option value="Tarjeta Credito/Debito">💳 Tarjeta Crédito / Débito</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  N° de Operación / Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Operación # 128492"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="w-full text-slate-900 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nota / Observación (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Cobro realizado en ruta por la tarde..."
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="w-full text-slate-900 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVentaSeleccionada(null)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoAbono}
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50"
                >
                  {procesandoAbono ? 'Guardando...' : 'Confirmar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL ABONOS */}
      {modalHistorialOpen && ventaSeleccionada && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-800">Historial de Abonos</h2>
                <p className="text-xs text-slate-500">Venta: {ventaSeleccionada.codigo_venta}</p>
              </div>
              <button
                onClick={() => {
                  setModalHistorialOpen(false)
                  setVentaSeleccionada(null)
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {cargandoHistorial ? (
              <div className="p-8 text-center text-slate-500 font-semibold animate-pulse">
                Cargando abonos registrados...
              </div>
            ) : historialAbonos.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Aún no se han registrado abonos para esta venta.
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {historialAbonos.map((a) => (
                  <div key={a.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-sm">
                    <div>
                      <div className="font-bold text-emerald-700">S/ {Number(a.monto).toFixed(2)} - {a.metodo_pago}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(a.fecha).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {a.referencia && (
                        <div className="text-xs text-slate-600 font-mono">Ref: {a.referencia}</div>
                      )}
                      {a.nota && <div className="text-xs italic text-slate-500 mt-1">"{a.nota}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 text-right">
              <button
                onClick={() => {
                  setModalHistorialOpen(false)
                  setVentaSeleccionada(null)
                }}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
