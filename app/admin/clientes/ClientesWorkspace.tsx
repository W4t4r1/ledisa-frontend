// app/admin/clientes/ClientesWorkspace.tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import { guardarClienteCRM, obtenerComprasPorCliente, obtenerDetalleDeCompra } from './actions'
import { Cliente } from '../../lib/clientes.service'

interface ClientesWorkspaceProps {
  clientesIniciales: Cliente[]
}

export default function ClientesWorkspace({ clientesIniciales }: ClientesWorkspaceProps) {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroDoc, setFiltroDoc] = useState<string>('TODOS')
  const [isPending, startTransition] = useTransition()

  // Sincronizar estado cuando cambian los props del servidor
  useEffect(() => {
    setClientes(clientesIniciales)
  }, [clientesIniciales])

  // Cliente seleccionado para ver detalles/historial
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [comprasCliente, setComprasCliente] = useState<any[]>([])
  const [cargandoCompras, setCargandoCompras] = useState(false)

  // Expandir detalles de una venta en específico
  const [ventaExpandida, setVentaExpandida] = useState<string | null>(null)
  const [detallesVenta, setDetallesVenta] = useState<any[] | null>(null)
  const [cargandoDetalleVenta, setCargandoDetalleVenta] = useState(false)

  // Modales
  const [mostrarModal, setMostrarModal] = useState(false)
  const [esEdicion, setEsEdicion] = useState(false)
  const [form, setForm] = useState<Cliente>({
    tipo_documento: 'DNI',
    documento: '',
    nombre_razon_social: '',
    celular: '',
    direccion: ''
  })

  // Filtrado en frontend
  const clientesFiltrados = clientes.filter(c => {
    const query = busqueda.toLowerCase().trim()
    const matchesQuery = 
      c.nombre_razon_social.toLowerCase().includes(query) ||
      c.documento.includes(query) ||
      (c.celular && c.celular.includes(query))
    
    const matchesDoc = filtroDoc === 'TODOS' || c.tipo_documento === filtroDoc
    
    return matchesQuery && matchesDoc
  })

  // Cargar historial de compras de un cliente
  const cargarHistorial = async (cliente: Cliente) => {
    if (!cliente.id) return
    setClienteSeleccionado(cliente)
    setComprasCliente([])
    setVentaExpandida(null)
    setDetallesVenta(null)
    setCargandoCompras(true)
    
    try {
      const res = await obtenerComprasPorCliente(cliente.id)
      setComprasCliente(res)
    } catch (err: any) {
      alert('❌ Error al cargar historial de compras: ' + err.message)
    } finally {
      setCargandoCompras(false)
    }
  }

  // Cargar artículos de una transacción específica
  const toggleDetalleTransaccion = async (ventaId: string) => {
    if (ventaExpandida === ventaId) {
      setVentaExpandida(null)
      setDetallesVenta(null)
      return
    }

    setVentaExpandida(ventaId)
    setDetallesVenta(null)
    setCargandoDetalleVenta(true)

    try {
      const res = await obtenerDetalleDeCompra(ventaId)
      setDetallesVenta(res)
    } catch (err: any) {
      alert('❌ Error al obtener artículos de la venta: ' + err.message)
    } finally {
      setCargandoDetalleVenta(false)
    }
  }

  // Abrir formulario para agregar/editar
  const handleAbrirModal = (c: Cliente | null = null) => {
    if (c) {
      setForm({
        id: c.id,
        tipo_documento: c.tipo_documento,
        documento: c.documento,
        nombre_razon_social: c.nombre_razon_social,
        celular: c.celular || '',
        direccion: c.direccion || ''
      })
      setEsEdicion(true)
    } else {
      setForm({
        tipo_documento: 'DNI',
        documento: '',
        nombre_razon_social: '',
        celular: '',
        direccion: ''
      })
      setEsEdicion(false)
    }
    setMostrarModal(true)
  }

  // Guardar formulario
  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.documento.trim() || !form.nombre_razon_social.trim()) {
      alert('Por favor complete los campos obligatorios.')
      return
    }

    startTransition(async () => {
      try {
        const guardado = await guardarClienteCRM(form, esEdicion)
        setMostrarModal(false)
        alert(`✅ Cliente ${esEdicion ? 'actualizado' : 'registrado'} exitosamente.`)
        
        // Si el cliente editado era el que estaba seleccionado, refrescamos la ficha
        if (clienteSeleccionado && clienteSeleccionado.id === guardado.id) {
          setClienteSeleccionado(guardado)
        }
      } catch (err: any) {
        alert('❌ Error al guardar cliente: ' + err.message)
      }
    })
  }

  // Cálculos de KPI para el cliente seleccionado
  const ventasConcretadas = comprasCliente.filter(c => c.estado === 'PAGADO' || c.estado === 'ENTREGADO')
  const cotizaciones = comprasCliente.filter(c => c.estado === 'COTIZACION')
  
  const totalInvertido = ventasConcretadas.reduce((sum, c) => sum + Number(c.total), 0)
  const totalCotizado = cotizaciones.reduce((sum, c) => sum + Number(c.total), 0)
  const ticketPromedio = ventasConcretadas.length > 0 ? totalInvertido / ventasConcretadas.length : 0

  return (
    <div className="space-y-6">
      
      {/* CABECERA Y BOTONES DE CONTROL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Directorio CRM de Clientes</h2>
          <p className="text-gray-500 text-sm mt-1">Gestión de datos de contacto y auditoría de consumos de clientes</p>
        </div>
        <button
          onClick={() => handleAbrirModal(null)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer self-start md:self-auto flex items-center gap-2"
        >
          <span>➕</span> Nuevo Cliente
        </button>
      </div>

      {/* FILTROS Y CONTENIDO PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA & CENTRAL: LISTADO DE CLIENTES */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          
          {/* Barra de Filtros */}
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="🔎 Buscar por nombre, RUC o DNI..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="flex-1 border border-gray-300 p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Tipo Doc:</span>
              <select
                value={filtroDoc}
                onChange={e => setFiltroDoc(e.target.value)}
                className="border border-gray-300 p-2.5 rounded-lg bg-white text-gray-900 focus:outline-none"
              >
                <option value="TODOS">Todos</option>
                <option value="DNI">DNI</option>
                <option value="RUC">RUC</option>
                <option value="CE">CE</option>
                <option value="OTROS">Otros</option>
              </select>
            </div>
          </div>

          {/* Directorio de clientes */}
          {clientesFiltrados.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl border-gray-300">
              <p className="text-gray-400 font-medium">No se encontraron clientes con los filtros indicados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="p-3 pl-4">Cliente / Razón Social</th>
                    <th className="p-3">Identificación</th>
                    <th className="p-3">Contacto</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {clientesFiltrados.map((c) => (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${clienteSeleccionado?.id === c.id ? 'bg-blue-50/50 hover:bg-blue-50' : ''}`}
                      onClick={() => cargarHistorial(c)}
                    >
                      <td className="p-3 pl-4 font-semibold text-gray-800">
                        {c.nombre_razon_social}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded mr-2 font-mono">
                          {c.tipo_documento}
                        </span>
                        <span className="text-gray-600 font-mono">{c.documento}</span>
                      </td>
                      <td className="p-3 text-gray-600">
                        <div className="flex flex-col">
                          <span>📞 {c.celular || 'Sin celular'}</span>
                          <span className="text-xs text-gray-400 truncate max-w-[200px]" title={c.direccion || ''}>
                            📍 {c.direccion || 'Sin dirección'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => cargarHistorial(c)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                          >
                            📁 Historial
                          </button>
                          <button
                            onClick={() => handleAbrirModal(c)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                          >
                            ✏️ Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: FICHA CRM & HISTORIAL DE TRANSACCIONES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          
          {/* Cabecera del Panel de Ficha */}
          <div className="p-4 bg-[#04558C] text-white border-b border-[#033f6b] flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">📁 Ficha del Cliente</h3>
              <p className="text-xs text-blue-200">Historial y perfil de compras</p>
            </div>
            {clienteSeleccionado && (
              <span className="text-xs bg-blue-900 border border-blue-700 text-white font-bold px-2 py-1 rounded">
                Seleccionado
              </span>
            )}
          </div>

          {/* Cuerpo del Panel */}
          {!clienteSeleccionado ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <span className="text-4xl block">👤</span>
              <p className="font-semibold text-sm">Selecciona un cliente del directorio para auditar sus consumos, facturas e historial.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              
              {/* FICHA PERFIL */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-2 relative">
                <button
                  onClick={() => handleAbrirModal(clienteSeleccionado)}
                  className="absolute top-2 right-2 text-xs font-bold text-blue-600 hover:underline"
                >
                  Editar Datos
                </button>
                <h4 className="font-bold text-gray-800 text-base">{clienteSeleccionado.nombre_razon_social}</h4>
                <p className="text-xs text-gray-500 font-mono">
                  {clienteSeleccionado.tipo_documento}: {clienteSeleccionado.documento}
                </p>
                {clienteSeleccionado.celular && (
                  <p className="text-xs text-gray-600">📞 <span className="font-semibold">{clienteSeleccionado.celular}</span></p>
                )}
                {clienteSeleccionado.direccion && (
                  <p className="text-xs text-gray-600">📍 <span className="font-medium">{clienteSeleccionado.direccion}</span></p>
                )}
                <p className="text-[10px] text-gray-400 pt-2 border-t mt-2">
                  Registrado: {clienteSeleccionado.created_at ? new Date(clienteSeleccionado.created_at).toLocaleDateString('es-PE') : 'S/D'}
                </p>
              </div>

              {/* CARD DE METRICAS DEL CLIENTE (KPIs) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                  <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Total Compras</span>
                  <p className="text-lg font-black text-[#04558C] mt-0.5">S/. {totalInvertido.toFixed(2)}</p>
                  <span className="text-[9px] text-gray-400 block font-semibold">{ventasConcretadas.length} comprobantes</span>
                </div>
                <div className="bg-green-50/50 p-3 rounded-lg border border-green-100/50">
                  <span className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Ticket Promedio</span>
                  <p className="text-lg font-black text-green-800 mt-0.5 font-mono">S/. {ticketPromedio.toFixed(2)}</p>
                  <span className="text-[9px] text-gray-400 block font-semibold">Consumo por visita</span>
                </div>
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/50 col-span-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Cotizaciones Abiertas</span>
                      <p className="text-base font-black text-amber-800 mt-0.5">{cotizaciones.length} proformas</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-700 bg-white border px-2 py-0.5 rounded">
                      Valor: S/. {totalCotizado.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* HISTORIAL DE OPERACIONES */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-800 text-sm border-b pb-2 flex justify-between items-center">
                  <span>📊 Historial Transaccional</span>
                  <span className="text-xs text-gray-400 font-semibold">{comprasCliente.length} transacciones</span>
                </h4>

                {cargandoCompras ? (
                  <p className="text-center py-6 text-sm text-gray-400 font-medium">⏳ Cargando transacciones...</p>
                ) : comprasCliente.length === 0 ? (
                  <p className="text-center py-6 text-sm text-gray-400 italic">No registra ventas ni cotizaciones en la base de datos.</p>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {comprasCliente.map((compra) => {
                      const esCotiz = compra.estado === 'COTIZACION'
                      const esAnulado = compra.estado === 'ANULADO'
                      
                      return (
                        <div 
                          key={compra.id} 
                          className={`border rounded-lg p-3 transition-colors ${
                            ventaExpandida === compra.id 
                              ? 'border-blue-300 bg-blue-50/10' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div 
                            className="flex justify-between items-center cursor-pointer"
                            onClick={() => toggleDetalleTransaccion(compra.id)}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-sm text-gray-700">{compra.codigo_venta}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                  esCotiz 
                                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                    : esAnulado 
                                      ? 'bg-red-50 text-red-800 border-red-200' 
                                      : 'bg-green-50 text-green-800 border-green-200'
                                }`}>
                                  {compra.estado}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(compra.fecha).toLocaleDateString('es-PE', {
                                  day: '2-digit', month: '2-digit', year: '2-digit',
                                  hour: '2-digit', minute: '2-digit'
                                })} | {compra.metodo_pago}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#04558C]">S/. {Number(compra.total).toFixed(2)}</p>
                              <span className="text-[9px] text-blue-600 hover:underline">
                                {ventaExpandida === compra.id ? 'Ocultar items ▲' : 'Ver items ▼'}
                              </span>
                            </div>
                          </div>

                          {/* SUB-DETALLE DE PRODUCTOS DE LA VENTA (DYNAMIC FETCH) */}
                          {ventaExpandida === compra.id && (
                            <div className="mt-3 pt-3 border-t border-dashed border-gray-200 text-xs">
                              {cargandoDetalleVenta ? (
                                <p className="text-center py-2 text-gray-400 font-medium animate-pulse">Cargando artículos...</p>
                              ) : !detallesVenta || detallesVenta.length === 0 ? (
                                <p className="text-center py-2 text-gray-400 italic">No se pudo cargar el detalle.</p>
                              ) : (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-12 font-bold text-gray-400 uppercase text-[9px] pb-1 border-b">
                                    <div className="col-span-6">Producto</div>
                                    <div className="col-span-3 text-center">Cant.</div>
                                    <div className="col-span-3 text-right">Subtotal</div>
                                  </div>
                                  {detallesVenta.map((det) => {
                                    const prod = det.inventario
                                    const esRecubr = prod?.m2_caja > 0
                                    
                                    return (
                                      <div key={det.id} className="grid grid-cols-12 gap-1 items-center text-gray-700 py-1 border-b border-gray-50">
                                        <div className="col-span-6 flex flex-col truncate">
                                          <span className="font-semibold truncate">{prod?.nombre || 'Producto Eliminado'}</span>
                                          <span className="text-[8px] text-gray-400 font-mono">Cód: {det.producto_id}</span>
                                        </div>
                                        <div className="col-span-3 text-center font-bold">
                                          {esRecubr 
                                            ? `${det.cantidad_cajas} cjs ${det.piezas_sueltas > 0 ? `+${det.piezas_sueltas} pz` : ''}` 
                                            : `${det.piezas_sueltas} und`
                                          }
                                        </div>
                                        <div className="col-span-3 text-right font-semibold">
                                          S/. {Number(det.subtotal).toFixed(2)}
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {compra.nota && (
                                    <div className="bg-gray-50 p-2 rounded border mt-2 text-[10px] text-gray-500">
                                      <span className="font-bold text-gray-600 block mb-0.5">Nota:</span>
                                      {compra.nota}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* --- FORMULARIO MODAL REGISTRAR/EDITAR CLIENTE --- */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">
              {esEdicion ? '✏️ Editar Datos del Cliente' : '➕ Registrar Nuevo Cliente'}
            </h3>
            
            <form onSubmit={handleGuardar} className="space-y-4 text-gray-900">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Tipo de Documento*</label>
                <select
                  value={form.tipo_documento}
                  onChange={e => setForm({ ...form, tipo_documento: e.target.value as any })}
                  className="w-full border p-2.5 rounded-lg bg-white text-gray-900 font-semibold focus:outline-none focus:border-[#04558C]"
                >
                  <option value="DNI">DNI (Persona Natural)</option>
                  <option value="RUC">RUC (Empresa / Jurídico)</option>
                  <option value="CE">CE (Carnet de Extranjería)</option>
                  <option value="OTROS">Otros</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Número de Documento*</label>
                <input
                  type="text"
                  required
                  disabled={esEdicion}
                  value={form.documento}
                  onChange={e => setForm({ ...form, documento: e.target.value })}
                  placeholder="Ej: 45678901 / 20601234567"
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white font-semibold disabled:bg-gray-100 focus:outline-none focus:border-[#04558C]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Nombre Completo o Razón Social*</label>
                <input
                  type="text"
                  required
                  value={form.nombre_razon_social}
                  onChange={e => setForm({ ...form, nombre_razon_social: e.target.value })}
                  placeholder="Ej: Juan Pérez / Inversiones LEDISA S.A.C."
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white font-semibold focus:outline-none focus:border-[#04558C]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Celular / Teléfono (Opcional)</label>
                <input
                  type="text"
                  value={form.celular}
                  onChange={e => setForm({ ...form, celular: e.target.value })}
                  placeholder="Ej: 987654321"
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Dirección (Opcional)</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={e => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Ej: Av. Perú 1234 - San Martín de Porres"
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="px-4 py-2.5 border rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-[#04558C] hover:bg-[#033f6b] text-white rounded-lg font-bold disabled:opacity-50 shadow-sm transition-colors cursor-pointer"
                >
                  {isPending ? '⏳ Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
