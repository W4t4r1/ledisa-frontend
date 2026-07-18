'use client'

import { useState, useTransition } from 'react'
import { obtenerDetalle } from './actions'
import ComprobantePrint from '../../components/ComprobantePrint'

interface Venta {
  id: string
  codigo_venta: string
  cliente_id: string | null
  subtotal: number
  descuento: number
  total: number
  total_costo: number
  metodo_pago: string
  estado: 'COTIZACION' | 'PAGADO' | 'ENTREGADO' | 'ANULADO'
  nota?: string
  fecha: string
  clientes?: {
    documento: string
    nombre_razon_social: string
  } | null
}

export default function HistorialVentas({ 
  ventasIniciales,
  setCotizacionCargar,
  setTabActiva
}: { 
  ventasIniciales: Venta[]
  setCotizacionCargar: (cotizacion: any) => void
  setTabActiva: (tab: 'registrar' | 'historial' | 'calculadora') => void
}) {
  const [isPending, startTransition] = useTransition()
  const [busqueda, setBusqueda] = useState('')
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null)
  const [detalles, setDetalles] = useState<any[] | null>(null)

  // Estado para impresión
  const [ventaImprimir, setVentaImprimir] = useState<any | null>(null)

  // Filtrado en memoria
  const ventasFiltradas = ventasIniciales.filter(v => {
    const term = busqueda.toLowerCase().trim()
    if (!term) return true

    const codigoMatch = v.codigo_venta.toLowerCase().includes(term)
    const clienteNombreMatch = v.clientes?.nombre_razon_social.toLowerCase().includes(term)
    const clienteDocMatch = v.clientes?.documento.toLowerCase().includes(term)
    const metodoMatch = v.metodo_pago?.toLowerCase().includes(term)

    return codigoMatch || clienteNombreMatch || clienteDocMatch || metodoMatch
  })

  // Cargar detalles de una venta específica para impresión y dispararla
  const handleImprimirVenta = async (venta: Venta) => {
    try {
      if (ventaSeleccionada?.id === venta.id && detalles) {
        setVentaImprimir({ ...venta, items: detalles })
        setTimeout(() => {
          window.print()
        }, 150)
        return
      }

      const resDetalles = await obtenerDetalle(venta.id)
      setVentaImprimir({ ...venta, items: resDetalles })
      setTimeout(() => {
        window.print()
      }, 150)
    } catch (err: any) {
      alert('❌ Error al cargar comprobante para impresión: ' + err.message)
    }
  }

  // Cargar detalles de una venta específica
  const handleVerDetalles = (venta: Venta) => {
    setVentaSeleccionada(venta)
    setDetalles(null)
    
    startTransition(async () => {
      try {
        const res = await obtenerDetalle(venta.id)
        setDetalles(res)
      } catch (err: any) {
        alert('❌ Error al cargar detalles: ' + err.message)
      }
    })
  }

  // Helper para pintar badges de estado
  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
        return <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded border border-green-200">🟢 PAGADO</span>
      case 'ENTREGADO':
        return <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded border border-blue-200">🔵 ENTREGADO</span>
      case 'COTIZACION':
        return <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded border border-amber-200">📝 COTIZACIÓN</span>
      case 'ANULADO':
        return <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded border border-red-200">❌ ANULADO</span>
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2.5 py-1 rounded">{estado}</span>
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      
      {/* FILTROS Y CONTROLES */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-800 self-start md:self-auto">Historial de Transacciones</h2>
        <input 
          type="text" 
          placeholder="🔎 Buscar por código, cliente o método..." 
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full md:w-1/3 border border-gray-300 p-2 rounded-md text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
        />
      </div>

      {/* TABLA DE VENTAS */}
      {ventasFiltradas.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-gray-200">
          <p className="text-gray-400 font-medium">No se encontraron registros de ventas o cotizaciones.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="p-3">Código</th>
                <th className="p-3">Fecha / Hora</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Método Pago</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {ventasFiltradas.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-3 font-mono font-bold text-gray-700">{v.codigo_venta}</td>
                  <td className="p-3 text-gray-500">
                    {new Date(v.fecha).toLocaleString('es-PE', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="p-3">
                    {v.clientes ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">{v.clientes.nombre_razon_social}</span>
                        <span className="text-xs text-gray-400">{v.clientes.documento}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Cliente Genérico</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-600 font-medium">{v.metodo_pago}</td>
                  <td className="p-3 text-center">{getBadgeEstado(v.estado)}</td>
                  <td className="p-3 text-right font-bold text-[#04558C]">S/. {v.total.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button 
                        onClick={() => handleVerDetalles(v)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                      >
                        🔎 Detalle
                      </button>
                      <button 
                        onClick={() => handleImprimirVenta(v)}
                        className="text-gray-700 hover:text-gray-900 font-bold text-xs bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                        title="Imprimir comprobante"
                      >
                        🖨️ Imprimir
                      </button>
                      {v.estado === 'COTIZACION' && (
                        <button 
                          onClick={async () => {
                            try {
                              const resDetalles = await obtenerDetalle(v.id)
                              setCotizacionCargar({
                                ...v,
                                items: resDetalles
                              })
                              setTabActiva('registrar')
                            } catch (err: any) {
                              alert('❌ Error al cargar cotización: ' + err.message)
                            }
                          }}
                          className="text-amber-700 hover:text-amber-900 font-bold text-xs bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                          title="Cargar esta cotización para facturarla"
                        >
                          ⚡ Facturar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- DETALLES DE VENTA (MODAL) --- */}
      {ventaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* CABECERA MODAL */}
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span>📄</span> Detalle de la Operación
                </h3>
                <p className="text-xs font-mono text-gray-500 mt-1">ID Transacción: {ventaSeleccionada.codigo_venta}</p>
              </div>
              <button 
                onClick={() => setVentaSeleccionada(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* INFORMACIÓN DE TRANSACCIÓN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border mb-6 text-sm">
              <div className="space-y-1">
                <p className="text-gray-500 font-medium">Cliente:</p>
                <p className="font-bold text-gray-800">
                  {ventaSeleccionada.clientes?.nombre_razon_social || 'Cliente Genérico'}
                </p>
                {ventaSeleccionada.clientes && (
                  <p className="text-xs text-gray-500">Documento: {ventaSeleccionada.clientes.documento}</p>
                )}
              </div>
              <div className="space-y-1 md:text-right">
                <p className="text-gray-500 font-medium">Pago y Registro:</p>
                <p className="font-bold text-gray-800">Medio: {ventaSeleccionada.metodo_pago}</p>
                <div className="mt-1 md:justify-end flex">
                  {getBadgeEstado(ventaSeleccionada.estado)}
                </div>
              </div>
            </div>

            {/* TABLA DE PRODUCTOS */}
            <div className="flex-1 overflow-x-auto mb-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 text-xs uppercase font-bold border-b">
                    <th className="p-2">Producto</th>
                    <th className="p-2 text-center">Cantidades</th>
                    <th className="p-2 text-right">Precio Unit.</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-800">
                  {isPending ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 font-medium">
                        ⏳ Cargando detalles de productos...
                      </td>
                    </tr>
                  ) : detalles === null ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 font-medium">
                        Espere un momento...
                      </td>
                    </tr>
                  ) : (
                    detalles.map(item => {
                      const p = item.inventario
                      const esRecubrimiento = p?.m2_caja > 0

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="p-2 py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-800">{p?.nombre || 'Producto Eliminado'}</span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                Cód: {item.producto_id} {p?.color ? `| Color: ${p.color}` : ''}
                                {item.lote ? ` | Lote: ${item.lote}` : ''}
                                {item.tono ? ` | Tono: ${item.tono}` : ''}
                                {item.calibre ? ` | Calibre: ${item.calibre}` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 text-center font-bold">
                            {esRecubrimiento ? (
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                {item.cantidad_cajas} cjs {item.piezas_sueltas > 0 ? `+ ${item.piezas_sueltas} pzs` : ''}
                              </span>
                            ) : (
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                {item.piezas_sueltas} und
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-medium">S/. {item.precio_unitario.toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-gray-900">S/. {item.subtotal.toFixed(2)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* NOTAS Y TOTALES */}
            <div className="border-t pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-auto">
              <div className="text-xs text-gray-500 max-w-md">
                {ventaSeleccionada.nota && (
                  <>
                    <span className="font-bold block text-gray-700 mb-1">Notas internas:</span>
                    <p className="bg-gray-50 p-2 rounded border">{ventaSeleccionada.nota}</p>
                  </>
                )}
              </div>
              <div className="w-full md:w-64 space-y-1.5 text-sm">
                <div className="flex justify-between font-semibold text-gray-500">
                  <span>Subtotal:</span>
                  <span>S/. {ventaSeleccionada.subtotal.toFixed(2)}</span>
                </div>
                {ventaSeleccionada.descuento > 0 && (
                  <div className="flex justify-between font-semibold text-red-500">
                    <span>Descuento:</span>
                    <span>- S/. {ventaSeleccionada.descuento.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t pt-1.5 text-gray-800">
                  <span>Total Operación:</span>
                  <span className="text-xl text-[#04558C]">S/. {ventaSeleccionada.total.toFixed(2)}</span>
                </div>
                {ventaSeleccionada.estado !== 'COTIZACION' && ventaSeleccionada.estado !== 'ANULADO' && (
                  <div className="border-t border-dashed pt-1.5 mt-1.5 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Costo de Venta:</span>
                      <span>S/. {(ventaSeleccionada.total_costo || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-600">
                      <span>Ganancia Neta:</span>
                      <span>S/. {(ventaSeleccionada.total - (ventaSeleccionada.total_costo || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-6 border-t">
              <button
                onClick={() => handleImprimirVenta(ventaSeleccionada)}
                className="bg-[#04558C] hover:bg-[#033f6b] text-white px-5 py-2.5 rounded-lg font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              >
                🖨️ Imprimir Comprobante
              </button>
              <button
                onClick={() => setVentaSeleccionada(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg font-bold transition-colors cursor-pointer text-xs"
              >
                ✕ Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* COMPROBANTE OCULTO PARA IMPRESIÓN */}
      {ventaImprimir && (
        <div className="hidden print:block">
          <ComprobantePrint venta={ventaImprimir} />
        </div>
      )}

    </div>
  )
}
