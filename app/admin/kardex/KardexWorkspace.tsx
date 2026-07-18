// app/admin/kardex/KardexWorkspace.tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import { registrarMovimientoAjuste } from './actions'
import { obtenerSeccionProducto } from '../../components/CatalogoInteractivo'

interface MovimientoKardex {
  id: string
  producto_id: string
  tipo: 'ENTRADA' | 'SALIDA'
  cantidad_cajas: number
  piezas_sueltas: number
  motivo: 'VENTA' | 'COMPRA' | 'AJUSTE' | 'ROTURA' | 'DEVOLUCION' | 'ANULACION_VENTA'
  referencia_id: string | null
  fecha: string
  inventario?: {
    nombre: string
    categoria: string
    color: string | null
  } | null
}

interface Producto {
  id: string
  nombre: string
  categoria: string
  precio: number
  stock: number
  piezas_sueltas: number
  m2_caja: number
  color?: string | null
}

interface KardexWorkspaceProps {
  inventario: Producto[]
  kardexInicial: MovimientoKardex[]
}

export default function KardexWorkspace({ inventario, kardexInicial }: KardexWorkspaceProps) {
  const [kardex, setKardex] = useState<MovimientoKardex[]>(kardexInicial)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS')
  const [filtroMotivo, setFiltroMotivo] = useState<string>('TODOS')
  const [isPending, startTransition] = useTransition()

  // Sincronizar datos con servidor
  useEffect(() => {
    setKardex(kardexInicial)
  }, [kardexInicial])

  // Estados del modal de ajuste manual
  const [mostrarModalAjuste, setMostrarModalAjuste] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  
  const [ajusteTipo, setAjusteTipo] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA')
  const [ajusteMotivo, setAjusteMotivo] = useState<'AJUSTE' | 'ROTURA' | 'COMPRA' | 'DEVOLUCION'>('AJUSTE')
  const [cantCajas, setCantCajas] = useState(0)
  const [cantPiezas, setCantPiezas] = useState(0)
  
  const [ajusteLote, setAjusteLote] = useState('')
  const [ajusteTono, setAjusteTono] = useState('')
  const [ajusteCalibre, setAjusteCalibre] = useState('')

  // Filtro de sugerencias de productos en el modal
  const productosSugeridos = inventario.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.id.toLowerCase().includes(busquedaProducto.toLowerCase())
  ).slice(0, 5)

  // Filtro de la tabla principal de Kardex
  const movimientosFiltrados = kardex.filter(m => {
    const query = busqueda.toLowerCase().trim()
    const matchesProduct = 
      m.producto_id.toLowerCase().includes(query) ||
      (m.inventario?.nombre && m.inventario.nombre.toLowerCase().includes(query))
    
    const matchesTipo = filtroTipo === 'TODOS' || m.tipo === filtroTipo
    const matchesMotivo = filtroMotivo === 'TODOS' || m.motivo === filtroMotivo

    return matchesProduct && matchesTipo && matchesMotivo
  })

  // Helper para determinar el sufijo de las piezas de un producto según las reglas de negocio
  const getUnitLabel = (producto: any) => {
    if (!producto) return 'und'
    const seccion = obtenerSeccionProducto(producto)
    if (['mayolicas_porcelanatos', 'saldos', 'decoraciones'].includes(seccion)) {
      return 'pzs'
    }
    return 'und'
  }

  // Badges estilizados para motivos
  const getBadgeMotivo = (motivo: string) => {
    switch (motivo) {
      case 'VENTA':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-blue-200">🛒 VENTA</span>
      case 'COMPRA':
        return <span className="bg-green-100 text-green-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-green-200">📦 COMPRA</span>
      case 'AJUSTE':
        return <span className="bg-gray-100 text-gray-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-gray-200">🛠️ AJUSTE</span>
      case 'ROTURA':
        return <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-red-200">💔 ROTURA</span>
      case 'DEVOLUCION':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-purple-200">🔄 DEVOLUCIÓN</span>
      case 'ANULACION_VENTA':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-orange-200">❌ ANULACIÓN VTA</span>
      default:
        return <span className="bg-gray-100 text-gray-800 text-[10px] font-extrabold px-2 py-0.5 rounded">{motivo}</span>
    }
  }

  // Guardar Ajuste Manual
  const handleGuardarAjuste = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productoSeleccionado) {
      alert('Por favor selecciona un producto de la lista.')
      return
    }

    if (cantCajas === 0 && cantPiezas === 0) {
      alert('Debes ingresar al menos una unidad/caja para el ajuste.')
      return
    }

    // Validación de stock para salidas
    if (ajusteTipo === 'SALIDA') {
      const stockDisponibleCjs = productoSeleccionado.stock || 0
      const stockDisponiblePzs = productoSeleccionado.piezas_sueltas || 0
      const esRecubrimiento = (productoSeleccionado.m2_caja || 0) > 0

      if (esRecubrimiento) {
        if (cantCajas > stockDisponibleCjs || cantPiezas > stockDisponiblePzs) {
          alert(
            `⚠️ Stock insuficiente para realizar la salida. Disponible: ${stockDisponibleCjs} cjs, ${stockDisponiblePzs} ${getUnitLabel(productoSeleccionado)}. Solicitado: ${cantCajas} cjs, ${cantPiezas} ${getUnitLabel(productoSeleccionado)}.`
          )
          return
        }
      } else {
        if (cantPiezas > stockDisponibleCjs) {
          alert(
            `⚠️ Stock insuficiente para realizar la salida. Disponible: ${stockDisponibleCjs} ${getUnitLabel(productoSeleccionado)}. Solicitado: ${cantPiezas} ${getUnitLabel(productoSeleccionado)}.`
          )
          return
        }
      }
    }

    startTransition(async () => {
      try {
        const payload: any = {
          producto_id: productoSeleccionado.id,
          tipo: ajusteTipo,
          cantidad_cajas: cantCajas,
          piezas_sueltas: cantPiezas,
          motivo: ajusteMotivo,
          lote: (productoSeleccionado.m2_caja || 0) > 0 ? ajusteLote || null : null,
          tono: (productoSeleccionado.m2_caja || 0) > 0 ? ajusteTono || null : null,
          calibre: (productoSeleccionado.m2_caja || 0) > 0 ? ajusteCalibre || null : null
        }

        await registrarMovimientoAjuste(payload)
        
        // Resetear formulario y cerrar modal
        setMostrarModalAjuste(false)
        setProductoSeleccionado(null)
        setBusquedaProducto('')
        setCantCajas(0)
        setCantPiezas(0)
        setAjusteLote('')
        setAjusteTono('')
        setAjusteCalibre('')
        setAjusteTipo('ENTRADA')
        setAjusteMotivo('AJUSTE')
        
        alert('✅ Ajuste de stock registrado y guardado exitosamente.')
      } catch (err: any) {
        alert('❌ Error al registrar el ajuste: ' + err.message)
      }
    })
  }

  return (
    <div className="space-y-6">
      
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Kardex de Inventario</h2>
          <p className="text-gray-500 text-sm mt-1">Auditoría completa de movimientos de stock, ingresos, salidas y mermas</p>
        </div>
        <button
          onClick={() => {
            setProductoSeleccionado(null)
            setBusquedaProducto('')
            setMostrarModalAjuste(true)
          }}
          className="bg-[#04558C] hover:bg-[#033f6b] text-white font-bold px-5 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer self-start md:self-auto flex items-center gap-2"
        >
          <span>📉</span> Registrar Ajuste Manual
        </button>
      </div>

      {/* FILTROS Y TABLA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        
        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Buscador por producto */}
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Buscar Producto</label>
            <input
              type="text"
              placeholder="🔎 Buscar por código o nombre de producto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
            />
          </div>

          {/* Filtro por tipo de movimiento */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Tipo Movimiento</label>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-lg bg-white text-gray-900 focus:outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="ENTRADA">🟢 Entradas (+)</option>
              <option value="SALIDA">🔴 Salidas (-)</option>
            </select>
          </div>

          {/* Filtro por motivo */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Motivo / Operación</label>
            <select
              value={filtroMotivo}
              onChange={e => setFiltroMotivo(e.target.value)}
              className="w-full border border-gray-300 p-2.5 rounded-lg bg-white text-gray-900 focus:outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="VENTA">Venta</option>
              <option value="COMPRA">Compra</option>
              <option value="AJUSTE">Ajuste Manual</option>
              <option value="ROTURA">Rotura / Merma</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="ANULACION_VENTA">Anulación de Venta</option>
            </select>
          </div>

        </div>

        {/* Listado de Movimientos */}
        {movimientosFiltrados.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-xl border-gray-300">
            <p className="text-gray-400 font-medium">No se registraron movimientos en el Kardex bajo estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-3 pl-4">Fecha y Hora</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Producto / Categoría</th>
                  <th className="p-3 text-center">Tipo</th>
                  <th className="p-3 text-center">Cantidad</th>
                  <th className="p-3 text-center">Motivo</th>
                  <th className="p-3 pl-4">Ref. / Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {movimientosFiltrados.map((m) => {
                  const esEntrada = m.tipo === 'ENTRADA'
                  const esRecubr = m.cantidad_cajas > 0 || (m.inventario && (m.inventario.categoria.toLowerCase().includes('cerámic') || m.inventario.categoria.toLowerCase().includes('porcelanato')))
                  
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 pl-4 text-gray-500 font-medium whitespace-nowrap">
                        {new Date(m.fecha).toLocaleString('es-PE', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3 font-mono text-gray-400 text-xs">{m.producto_id}</td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">{m.inventario?.nombre || 'Producto Eliminado'}</span>
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">
                            {m.inventario?.categoria || 'Sin categoría'} {m.inventario?.color ? `| Color: ${m.inventario.color}` : ''}
                          </span>
                          {(m.lote || m.tono || m.calibre) && (
                            <span className="text-[9px] text-[#04558C] font-semibold mt-0.5">
                              {m.lote ? `Lote: ${m.lote} ` : ''}
                              {m.tono ? `Tono: ${m.tono} ` : ''}
                              {m.calibre ? `Calibre: ${m.calibre}` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center font-black text-xs px-2.5 py-1 rounded-full ${
                          esEntrada ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {esEntrada ? '▲ ENTRADA' : '▼ SALIDA'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-gray-800">
                        {m.cantidad_cajas > 0 || m.piezas_sueltas > 0 ? (
                          <div className="flex flex-col items-center">
                            {m.cantidad_cajas > 0 && (
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                {m.cantidad_cajas} cjs
                              </span>
                            )}
                            {m.piezas_sueltas > 0 && (
                              <span className="text-[10px] text-gray-500 mt-0.5">
                                {esEntrada ? '+' : '-'} {m.piezas_sueltas} {getUnitLabel(m.inventario)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">{getBadgeMotivo(m.motivo)}</td>
                      <td className="p-3 pl-4 text-xs font-mono text-gray-400">
                        {m.referencia_id ? (
                          <div className="flex flex-col max-w-[120px] truncate" title={m.referencia_id}>
                            <span className="font-semibold text-gray-500">Transacción:</span>
                            <span className="truncate">{m.referencia_id}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Ajuste Manual</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* --- FORMULARIO MODAL: AJUSTE MANUAL --- */}
      {mostrarModalAjuste && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">
              📐 Registrar Ajuste de Inventario (Kardex)
            </h3>
            
            <form onSubmit={handleGuardarAjuste} className="space-y-4 text-gray-900">
              
              {/* Buscador predictivo de productos */}
              <div className="relative">
                <label className="text-xs font-bold text-gray-500 block mb-1">Seleccionar Producto*</label>
                <input
                  type="text"
                  placeholder="🔎 Escribe el nombre o código del producto..."
                  value={busquedaProducto}
                  onChange={e => {
                    setBusquedaProducto(e.target.value)
                    setMostrarSugerencias(true)
                  }}
                  onFocus={() => setMostrarSugerencias(true)}
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white font-semibold focus:outline-none focus:border-[#04558C]"
                />

                {/* Dropdown de Sugerencias */}
                {mostrarSugerencias && busquedaProducto.trim() !== '' && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto divide-y">
                    {productosSugeridos.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500 italic">No se encontraron productos.</p>
                    ) : (
                      productosSugeridos.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setProductoSeleccionado(p)
                            setBusquedaProducto(p.nombre)
                            setMostrarSugerencias(false)
                          }}
                          className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <p className="font-bold text-gray-800">{p.nombre}</p>
                            <p className="text-gray-400 font-mono">Cód: {p.id} | Cat: {p.categoria}</p>
                          </div>
                          <div className="text-right">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                              Stock: {p.stock} cjs {p.piezas_sueltas > 0 ? `+ ${p.piezas_sueltas} ${getUnitLabel(p)}` : ''}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Mostrar ficha del producto seleccionado */}
              {productoSeleccionado && (
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-xs space-y-1.5">
                  <p className="font-bold text-[#04558C] text-sm">{productoSeleccionado.nombre}</p>
                  <p className="text-gray-600 font-medium">Categoría: <span className="font-bold">{productoSeleccionado.categoria}</span> {productoSeleccionado.color ? `| Color: ${productoSeleccionado.color}` : ''}</p>
                  <div className="flex justify-between items-center bg-white p-2 rounded border border-blue-100 font-semibold mt-1">
                    <span className="text-gray-500">Stock físico actual:</span>
                    <span className="text-gray-800 text-sm font-bold">
                      {productoSeleccionado.stock} cajas + {productoSeleccionado.piezas_sueltas} {getUnitLabel(productoSeleccionado)}
                      {productoSeleccionado.m2_caja > 0 && ` (${(productoSeleccionado.stock * productoSeleccionado.m2_caja).toFixed(2)} m²)`}
                    </span>
                  </div>
                </div>
              )}

              {/* Fila de controles: Tipo y Motivo */}
              <div className="grid grid-cols-2 gap-4">
                
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Tipo de Ajuste*</label>
                  <select
                    value={ajusteTipo}
                    onChange={e => {
                      setAjusteTipo(e.target.value as any)
                      // Resetear motivo a algo adecuado para el tipo
                      if (e.target.value === 'SALIDA') {
                        setAjusteMotivo('ROTURA')
                      } else {
                        setAjusteMotivo('AJUSTE')
                      }
                    }}
                    className="w-full border p-2.5 rounded-lg bg-white font-semibold text-gray-900 focus:outline-none"
                  >
                    <option value="ENTRADA">🟢 Entrada (+)</option>
                    <option value="SALIDA">🔴 Salida (-)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1">Motivo del Ajuste*</label>
                  <select
                    value={ajusteMotivo}
                    onChange={e => setAjusteMotivo(e.target.value as any)}
                    className="w-full border p-2.5 rounded-lg bg-white font-semibold text-gray-900 focus:outline-none"
                  >
                    {ajusteTipo === 'ENTRADA' ? (
                      <>
                        <option value="AJUSTE">Ajuste Manual</option>
                        <option value="DEVOLUCION">Devolución de Cliente</option>
                        <option value="COMPRA">Compra a Proveedor</option>
                      </>
                    ) : (
                      <>
                        <option value="ROTURA">Rotura / Merma</option>
                        <option value="AJUSTE">Ajuste Manual</option>
                        <option value="VENTA">Venta Directa</option>
                      </>
                    )}
                  </select>
                </div>

              </div>

              {/* Cantidades a ajustar */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cantidades a Registrar</p>
                
                {productoSeleccionado && productoSeleccionado.m2_caja > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1">Cajas</label>
                        <input
                          type="number"
                          min="0"
                          value={cantCajas}
                          onChange={e => setCantCajas(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full border p-2 rounded-lg text-gray-900 bg-white font-semibold text-center"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1">Piezas Sueltas ({getUnitLabel(productoSeleccionado)})</label>
                        <input
                          type="number"
                          min="0"
                          value={cantPiezas}
                          onChange={e => setCantPiezas(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full border p-2 rounded-lg text-gray-900 bg-white font-semibold text-center"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 border-t pt-3">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Lote</label>
                        <input
                          type="text"
                          placeholder="Lote"
                          value={ajusteLote || ''}
                          onChange={e => setAjusteLote(e.target.value)}
                          className="w-full border p-1.5 rounded-lg text-gray-900 bg-white font-medium text-center text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Tono</label>
                        <input
                          type="text"
                          placeholder="Tono"
                          value={ajusteTono || ''}
                          onChange={e => setAjusteTono(e.target.value)}
                          className="w-full border p-1.5 rounded-lg text-gray-900 bg-white font-medium text-center text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Calibre</label>
                        <input
                          type="text"
                          placeholder="Calibre"
                          value={ajusteCalibre || ''}
                          onChange={e => setAjusteCalibre(e.target.value)}
                          className="w-full border p-1.5 rounded-lg text-gray-900 bg-white font-medium text-center text-xs"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      Cantidad ({productoSeleccionado ? getUnitLabel(productoSeleccionado) : 'unidades'})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cantPiezas}
                      onChange={e => setCantPiezas(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full border p-2 rounded-lg text-gray-900 bg-white font-semibold text-center md:w-1/2 mx-auto block"
                    />
                  </div>
                )}
              </div>

              {/* Botonera modal */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModalAjuste(false)}
                  className="px-4 py-2.5 border rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !productoSeleccionado}
                  className="px-5 py-2.5 bg-[#04558C] hover:bg-[#033f6b] text-white rounded-lg font-bold disabled:opacity-50 shadow-sm transition-colors cursor-pointer"
                >
                  {isPending ? '⏳ Guardando...' : '💾 Registrar Ajuste'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
