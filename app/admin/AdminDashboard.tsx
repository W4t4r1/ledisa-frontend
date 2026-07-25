'use client'

import { useState, useTransition } from 'react'
import { eliminarProducto, guardarProducto, toggleVisibilidadProducto, actualizarProductosMasivo, obtenerComponentesProductoAction } from './actions'
import { obtenerSeccionProducto } from '../components/CatalogoInteractivo'

export default function AdminDashboard({ inventarioInicial }: { inventarioInicial: any[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [isPending, startTransition] = useTransition()
  
  // Estados para el Modal (Formulario)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [esEdicion, setEsEdicion] = useState(false)
  
  // Estado para guardar temporalmente lo que el usuario escribe
  const [form, setForm] = useState({
    id: '', nombre: '', categoria: 'Porcelanato', marca: '',
    precio: 0, costo: 0, stock: 0, stock_minimo: 0, m2_caja: 0, piezas_sueltas: 0, color: '', imagen: '',
    ubicacion_fisica: '', oculto: false, es_combo: false
  })

  // Estado para gestión de componentes de combo
  const [componentesCombo, setComponentesCombo] = useState<{ componente_id: string; cantidad: number }[]>([])
  const [selComponenteId, setSelComponenteId] = useState('')
  const [selComponenteCant, setSelComponenteCant] = useState(1)

  // Estado para Edición Masiva (Por Lote)
  const [idsSeleccionados, setIdsSeleccionados] = useState<string[]>([])
  const [mostrarModalMasivo, setMostrarModalMasivo] = useState(false)
  const [formMasivo, setFormMasivo] = useState({
    actCosto: false, costo: 0,
    actUbicacion: false, ubicacion_fisica: '',
    actPrecio: false, precio: 0,
    actStockMinimo: false, stock_minimo: 0,
    actMarca: false, marca: '',
    actVisibilidad: false, oculto: false
  })

  // Función para calcular stock de combo en base a componentes
  const getStockComboDisponibles = (item: any) => {
    const comps = item.producto_componentes || []
    if (item.es_combo || comps.length > 0) {
      if (!comps || comps.length === 0) return 0
      let minCombos = Infinity
      for (const c of comps) {
        const compProd = inventarioInicial.find(p => p.id === c.componente_id)
        const stockComp = compProd ? compProd.stock : 0
        const req = c.cantidad || 1
        const posibles = Math.floor(stockComp / req)
        if (posibles < minCombos) {
          minCombos = posibles
        }
      }
      return minCombos === Infinity ? 0 : minCombos
    }
    return item.stock
  }

  // Filtro rápido en memoria
  const productosFiltrados = inventarioInicial.filter(item => 
    item.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    item.id.toLowerCase().includes(busqueda.toLowerCase())
  )

  const todosSeleccionados = productosFiltrados.length > 0 && productosFiltrados.every(p => idsSeleccionados.includes(p.id))

  const handleToggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      setIdsSeleccionados([])
    } else {
      setIdsSeleccionados(productosFiltrados.map(p => p.id))
    }
  }

  const handleToggleSeleccionarUno = (id: string) => {
    if (idsSeleccionados.includes(id)) {
      setIdsSeleccionados(idsSeleccionados.filter(item => item !== id))
    } else {
      setIdsSeleccionados([...idsSeleccionados, id])
    }
  }

  // Disparadores de acciones
  const handleEliminar = (id: string, nombre: string) => {
    if (window.confirm(`⚠️ ESTO NO SE PUEDE DESHACER.\n¿Eliminar producto: ${nombre}?`)) {
      startTransition(async () => {
        try {
          await eliminarProducto(id)
          alert('✅ Producto eliminado.')
        } catch (error: any) {
          alert('❌ Error: ' + error.message)
        }
      })
    }
  }

  const handleToggleVisibilidad = (id: string, actualOculto: boolean) => {
    startTransition(async () => {
      try {
        await toggleVisibilidadProducto(id, !actualOculto)
      } catch (error: any) {
        alert('❌ Error al cambiar visibilidad: ' + error.message)
      }
    })
  }

  const handleAbrirModal = async (producto: any = null) => {
    if (producto) {
      setForm({
        ...producto,
        oculto: !!producto.oculto,
        es_combo: !!producto.es_combo,
        piezas_sueltas: producto.piezas_sueltas || 0,
        m2_caja: producto.m2_caja || 0,
        costo: producto.costo || 0,
        stock_minimo: producto.stock_minimo || 0,
        ubicacion_fisica: producto.ubicacion_fisica || ''
      })
      setEsEdicion(true)

      if (producto.producto_componentes?.length > 0) {
        setComponentesCombo(producto.producto_componentes.map((c: any) => ({
          componente_id: c.componente_id,
          cantidad: c.cantidad
        })))
      } else if (producto.es_combo) {
        try {
          const comps = await obtenerComponentesProductoAction(producto.id)
          setComponentesCombo(comps.map((c: any) => ({
            componente_id: c.componente_id,
            cantidad: c.cantidad
          })))
        } catch (err) {
          setComponentesCombo([])
        }
      } else {
        setComponentesCombo([])
      }
    } else {
      setForm({ id: '', nombre: '', categoria: 'Porcelanato', marca: '', precio: 0, costo: 0, stock: 0, stock_minimo: 0, m2_caja: 0, piezas_sueltas: 0, color: '', imagen: '', ubicacion_fisica: '', oculto: false, es_combo: false })
      setComponentesCombo([])
      setEsEdicion(false)
    }
    setSelComponenteId('')
    setSelComponenteCant(1)
    setMostrarModal(true)
  }

  const handleAddComboComponente = () => {
    if (!selComponenteId) {
      alert('Selecciona un producto componente.')
      return
    }
    if (selComponenteId === form.id) {
      alert('Un combo no puede ser componente de sí mismo.')
      return
    }
    const existe = componentesCombo.find(c => c.componente_id === selComponenteId)
    if (existe) {
      setComponentesCombo(componentesCombo.map(c => 
        c.componente_id === selComponenteId ? { ...c, cantidad: c.cantidad + selComponenteCant } : c
      ))
    } else {
      setComponentesCombo([...componentesCombo, { componente_id: selComponenteId, cantidad: selComponenteCant }])
    }
    setSelComponenteId('')
    setSelComponenteCant(1)
  }

  const handleRemoveComboComponente = (compId: string) => {
    setComponentesCombo(componentesCombo.filter(c => c.componente_id !== compId))
  }

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.es_combo && componentesCombo.length === 0) {
      alert('⚠️ Para registrar un Producto Combo debes seleccionar al menos 1 producto componente.')
      return
    }

    startTransition(async () => {
      try {
        const resProd = await guardarProducto(form, esEdicion, form.es_combo ? componentesCombo : [])
        if (!resProd.success) {
          throw new Error(resProd.error || 'Error al guardar el producto')
        }
        setMostrarModal(false)
        alert('✅ Producto guardado exitosamente.')
      } catch (error: any) {
        alert('❌ Error al guardar: ' + error.message)
      }
    })
  }

  const handleGuardarMasivo = (e: React.FormEvent) => {
    e.preventDefault()
    if (idsSeleccionados.length === 0) {
      alert('Debes seleccionar al menos un producto.')
      return
    }

    const cambios: Record<string, any> = {}
    if (formMasivo.actCosto) cambios.costo = parseFloat(formMasivo.costo as any) || 0
    if (formMasivo.actUbicacion) cambios.ubicacion_fisica = formMasivo.ubicacion_fisica.trim() || null
    if (formMasivo.actPrecio) cambios.precio = parseFloat(formMasivo.precio as any) || 0
    if (formMasivo.actStockMinimo) cambios.stock_minimo = parseInt(formMasivo.stock_minimo as any) || 0
    if (formMasivo.actMarca) cambios.marca = formMasivo.marca.trim() || 'OTRO'
    if (formMasivo.actVisibilidad) cambios.oculto = formMasivo.oculto

    if (Object.keys(cambios).length === 0) {
      alert('Por favor activa al menos una casilla para modificar los campos deseados.')
      return
    }

    startTransition(async () => {
      try {
        await actualizarProductosMasivo(idsSeleccionados, cambios)
        setMostrarModalMasivo(false)
        setIdsSeleccionados([])
        setFormMasivo({
          actCosto: false, costo: 0,
          actUbicacion: false, ubicacion_fisica: '',
          actPrecio: false, precio: 0,
          actStockMinimo: false, stock_minimo: 0,
          actMarca: false, marca: '',
          actVisibilidad: false, oculto: false
        })
        alert(`✅ Se actualizaron masivamente ${idsSeleccionados.length} productos con éxito.`)
      } catch (err: any) {
        alert('❌ Error en la edición masiva: ' + err.message)
      }
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Gestión de Inventario</h2>
        <button 
          onClick={() => handleAbrirModal()}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-bold transition-colors disabled:opacity-50"
        >
          {isPending ? '⏳ Procesando...' : '+ Nuevo Producto'}
        </button>
      </div>

      <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <input 
          type="text" placeholder="🔎 Buscar por nombre o código..." 
          className="w-full md:w-1/3 border border-gray-300 p-2 rounded-md focus:outline-none focus:border-[#04558C] text-gray-900"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        />

        {/* BARRA FLOTANTE DE EDICIÓN MASIVA */}
        {idsSeleccionados.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 p-2 px-4 rounded-lg flex items-center gap-4 text-xs w-full md:w-auto shadow-sm">
            <span className="font-extrabold text-indigo-900">
              {idsSeleccionados.length} producto{idsSeleccionados.length > 1 ? 's' : ''} seleccionado{idsSeleccionados.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setMostrarModalMasivo(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>✏️</span> Edición Masiva
            </button>
            <button
              onClick={() => setIdsSeleccionados([])}
              className="text-gray-500 hover:text-gray-700 font-bold underline"
            >
              Desmarcar
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
              <th className="p-3 text-center w-10">
                <input 
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={handleToggleSeleccionarTodos}
                  className="w-4 h-4 text-[#04558C] rounded focus:ring-[#04558C] cursor-pointer"
                  title="Seleccionar o deseleccionar todos los visibles"
                />
              </th>
              <th className="p-3">ID</th>
              <th className="p-3">Producto</th>
              <th className="p-3 text-right">Costo</th>
              <th className="p-3 text-right">Precio</th>
              <th className="p-3 text-center">Stock</th>
              <th className="p-3 text-center">Visibilidad</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {productosFiltrados.map((item) => {
              const esComboItem = !!item.es_combo || (item.producto_componentes && item.producto_componentes.length > 0)
              const stockCombo = esComboItem ? getStockComboDisponibles(item) : item.stock

              return (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${idsSeleccionados.includes(item.id) ? 'bg-indigo-50/40' : item.oculto ? 'opacity-60 bg-gray-50/50' : ''}`}>
                  <td className="p-3 text-center">
                    <input 
                      type="checkbox"
                      checked={idsSeleccionados.includes(item.id)}
                      onChange={() => handleToggleSeleccionarUno(item.id)}
                      className="w-4 h-4 text-[#04558C] rounded focus:ring-[#04558C] cursor-pointer"
                    />
                  </td>
                  <td className="p-3 text-sm font-mono text-gray-500">{item.id}</td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">{item.nombre}</span>
                        {esComboItem && (
                          <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded tracking-wide flex items-center gap-1 shadow-xs">
                            📦 COMBO ({item.producto_componentes?.length || 0} ítems)
                          </span>
                        )}
                        {item.oculto && (
                          <span className="text-[10px] bg-gray-400 text-white font-bold px-1.5 py-0.5 rounded tracking-wide">OCULTO</span>
                        )}
                      </div>
                      {item.ubicacion_fisica && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200 w-max mt-1">
                          📍 {item.ubicacion_fisica}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-medium text-gray-500">S/. {item.costo || '0.00'}</td>
                  <td className="p-3 text-right font-bold text-[#04558C]">S/. {item.precio}</td>
                  <td className="p-3 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {esComboItem ? (
                        <>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            stockCombo <= (item.stock_minimo || 0)
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                          }`}>
                            📦 {stockCombo} juegos dispon.
                          </span>
                          <span className="text-[9px] text-gray-500 font-semibold">
                            (Stock dinámico según componentes)
                          </span>
                        </>
                      ) : item.m2_caja > 0 ? (
                        <>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            item.stock <= (item.stock_minimo || 0)
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {item.stock} cjs {item.piezas_sueltas > 0 ? `+ ${item.piezas_sueltas} pzs` : ''}
                          </span>
                          {item.stock <= (item.stock_minimo || 0) && (
                            <span className="text-[9px] text-red-600 font-extrabold uppercase tracking-wide mt-0.5">
                              ⚠️ Stock Mínimo ({item.stock_minimo || 0})
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 font-semibold">
                            ({(item.stock * item.m2_caja).toFixed(2)} m²)
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            item.stock <= (item.stock_minimo || 0)
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {item.stock} {['mayolicas_porcelanatos', 'saldos', 'decoraciones'].includes(obtenerSeccionProducto(item)) ? 'pzs' : 'und'}
                          </span>
                          {item.stock <= (item.stock_minimo || 0) && (
                            <span className="text-[9px] text-red-600 font-extrabold uppercase tracking-wide mt-0.5">
                              ⚠️ Stock Mínimo ({item.stock_minimo || 0})
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => handleToggleVisibilidad(item.id, !!item.oculto)} 
                      disabled={isPending} 
                      className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                      title={item.oculto ? "Mostrar en catálogo" : "Ocultar en catálogo"}
                    >
                      {item.oculto ? (
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleAbrirModal(item)} disabled={isPending} className="text-blue-600 hover:text-blue-800 text-sm font-semibold disabled:opacity-50">Editar</button>
                      <button onClick={() => handleEliminar(item.id, item.nombre)} disabled={isPending} className="text-red-600 hover:text-red-800 text-sm font-semibold disabled:opacity-50">Eliminar</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* --- EL MODAL SUPERPUESTO (Fondo Oscuro) --- */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{esEdicion ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</h3>
            
            <form onSubmit={handleGuardar} className="grid grid-cols-2 gap-4 text-gray-900">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Código ID*</label>
                <input required disabled={esEdicion} type="text" className="w-full border p-2 rounded disabled:bg-gray-100 text-gray-900 bg-white" value={form.id} onChange={e => setForm({...form, id: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Nombre (Opcional - se autogenera si se deja vacío)</label>
                <input type="text" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Categoría*</label>
                <input required type="text" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} />
                
                {/* SUGERENCIAS DE CATEGORÍA */}
                <div className="mt-2 text-xs">
                  <span className="text-gray-400 block mb-1 font-semibold">Sugerencias rápidas:</span>
                  <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto border border-gray-200 p-2 rounded bg-gray-50">
                    {[
                      { g: '💎 Mayólicas', c: ['Piso', 'Pared', 'Porcelanato'] },
                      { g: '🚽 Sanitarios', c: ['1/2 Baño', 'Inodoro', 'Taza', 'Tanque', 'Lavatorio', 'Pedestal', 'Tubo de abasto'] },
                      { g: '✨ Decoraciones', c: ['Listelo', 'Decorado'] },
                      { g: '🚰 Griferías', c: ['Grifería', 'Mezcladora'] },
                      { g: '🛠️ Instalación', c: ['Fragua', 'Varillas', 'Pegamento', 'Crucetas'] },
                      { g: '🏷️ Saldos', c: ['Saldos', 'Piezas Antiguas', 'Cajas Antiguas'] }
                    ].map(grupo => (
                      <div key={grupo.g} className="flex flex-wrap items-center gap-1 border-b border-gray-100 pb-1 last:border-b-0 last:pb-0">
                        <span className="text-[10px] text-gray-500 font-bold mr-1 w-20 shrink-0">{grupo.g}:</span>
                        <div className="flex flex-wrap gap-1">
                          {grupo.c.map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setForm({ ...form, categoria: cat })}
                              className="bg-white border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors text-[10px] font-medium cursor-pointer"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Marca (Opcional - se guarda como OTRO si se deja vacío)</label>
                <input type="text" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.marca || ''} onChange={e => setForm({...form, marca: e.target.value})} />
                
                {/* SUGERENCIAS DE MARCA */}
                <div className="mt-2 text-xs">
                  <span className="text-gray-400 block mb-1 font-semibold">Sugerencias rápidas:</span>
                  <div className="flex flex-wrap gap-1 border border-gray-200 p-2 rounded bg-gray-50">
                    {['Celima', 'Trebol', 'San Lorenzo', 'OTRO'].map(marca => (
                      <button
                        key={marca}
                        type="button"
                        onClick={() => setForm({ ...form, marca: marca })}
                        className="bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors text-[10px] font-medium cursor-pointer"
                      >
                        {marca}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Costo de Adquisición (S/.)*</label>
                <input required type="number" step="0.01" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.costo || 0} onChange={e => setForm({...form, costo: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Precio de Venta (S/.)*</label>
                <input required type="number" step="0.01" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.precio} onChange={e => setForm({...form, precio: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Stock {form.es_combo ? '(Referencial)' : '(Cajas/Unidades)*'}</label>
                <input required={!form.es_combo} type="number" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} />
                <span className="text-[10px] text-gray-400 block mt-1">
                  {form.es_combo
                    ? 'En combos el stock disponible real se calcula dinámicamente según sus componentes'
                    : form.m2_caja > 0 
                      ? `Equivale a ${(form.stock * form.m2_caja).toFixed(2)} m² totales en stock` 
                      : 'Cantidad de piezas o unidades físicas en stock'}
                </span>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Stock Mínimo (Alerta)</label>
                <input required type="number" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.stock_minimo || 0} onChange={e => setForm({...form, stock_minimo: parseInt(e.target.value) || 0})} />
                <span className="text-[10px] text-gray-400 block mt-1">Generará alerta cuando el stock sea menor o igual a este valor</span>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Rendimiento (m² por caja)</label>
                <input type="number" step="0.01" min="0" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.m2_caja || 0} onChange={e => setForm({...form, m2_caja: parseFloat(e.target.value) || 0})} />
                <span className="text-[10px] text-gray-400 block mt-1">Dejar en 0 si es por unidades o piezas (ej. sanitarios, grifería, listelos, fragua)</span>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Piezas Sueltas (Adicionales)</label>
                <input type="number" min="0" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.piezas_sueltas || 0} onChange={e => setForm({...form, piezas_sueltas: parseInt(e.target.value) || 0})} />
                <span className="text-[10px] text-gray-400 block mt-1">Piezas sueltas adicionales fuera de las cajas</span>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Color (Opcional)</label>
                <input type="text" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.color || ''} onChange={e => setForm({...form, color: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">Imagen URL (Opcional)</label>
                <input type="text" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.imagen || ''} onChange={e => setForm({...form, imagen: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500 block mb-1">📍 Ubicación Física Interna</label>
                <select 
                  className="w-full border p-2 rounded text-gray-900 bg-white font-semibold" 
                  value={form.ubicacion_fisica || ''} 
                  onChange={e => setForm({...form, ubicacion_fisica: e.target.value})}
                >
                  <option value="">-- Sin especificar --</option>
                  <option value="Cuarto 1">Cuarto 1</option>
                  <option value="Cuarto 2">Cuarto 2</option>
                  <option value="Almacén Fondo">Almacén Fondo</option>
                  <option value="2do Piso">2do Piso</option>
                  <option value="Exhibición">Exhibición</option>
                </select>
              </div>

              {/* SECCIÓN CONFIGURACIÓN PRODUCTO COMBO */}
              <div className="col-span-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="form-es-combo"
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    checked={form.es_combo || false} 
                    onChange={e => setForm({...form, es_combo: e.target.checked})} 
                  />
                  <label htmlFor="form-es-combo" className="text-sm font-bold text-indigo-900 cursor-pointer select-none flex items-center gap-1.5">
                    <span>📦</span> Es Producto Combo / Kit (Ej: 1/2 Baño, Inodoro Completo)
                  </label>
                </div>
                <p className="text-[11px] text-indigo-700">
                  Al vender este producto, se descontará automáticamente del stock de cada uno de sus componentes individuales.
                </p>

                {form.es_combo && (
                  <div className="space-y-2 pt-2 border-t border-indigo-200">
                    <span className="text-xs font-bold text-indigo-950 block">Seleccionar Componentes que incluye:</span>
                    
                    <div className="flex gap-2">
                      <select 
                        value={selComponenteId} 
                        onChange={e => setSelComponenteId(e.target.value)}
                        className="flex-1 border border-indigo-300 rounded p-1.5 text-xs text-gray-900 bg-white"
                      >
                        <option value="">-- Seleccionar producto componente --</option>
                        {inventarioInicial
                          .filter(p => p.id !== form.id && !p.es_combo)
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} ({p.id}) - Stock: {p.stock} und
                            </option>
                          ))
                        }
                      </select>
                      <input 
                        type="number" 
                        min="1" 
                        value={selComponenteCant} 
                        onChange={e => setSelComponenteCant(parseInt(e.target.value) || 1)}
                        className="w-16 border border-indigo-300 rounded p-1.5 text-xs text-gray-900 text-center bg-white font-bold"
                        placeholder="Cant"
                      />
                      <button
                        type="button"
                        onClick={handleAddComboComponente}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer"
                      >
                        + Agregar
                      </button>
                    </div>

                    {/* Lista de componentes agregados */}
                    {componentesCombo.length > 0 ? (
                      <div className="bg-white rounded border border-indigo-200 divide-y divide-gray-100 overflow-hidden mt-2">
                        {componentesCombo.map((c, idx) => {
                          const prodComp = inventarioInicial.find(p => p.id === c.componente_id)
                          return (
                            <div key={idx} className="flex justify-between items-center p-2 text-xs">
                              <div>
                                <span className="font-bold text-gray-800">{prodComp?.nombre || c.componente_id}</span>
                                <span className="text-gray-500 text-[10px] block">
                                  Código: {c.componente_id} | Stock actual: {prodComp?.stock || 0} und
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-xs">
                                  {c.cantidad} {c.cantidad === 1 ? 'unidad' : 'unidades'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComboComponente(c.componente_id)}
                                  className="text-red-500 hover:text-red-700 font-bold text-sm"
                                  title="Quitar componente"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 font-medium italic bg-amber-50 p-2 rounded border border-amber-200">
                        ⚠️ Por favor agrega al menos 1 producto componente (Ej: Taza, Tanque, Lavatorio, Pedestal).
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="col-span-2 flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="form-oculto"
                  className="w-4 h-4 text-[#04558C] border-gray-300 rounded focus:ring-[#04558C]"
                  checked={form.oculto || false} 
                  onChange={e => setForm({...form, oculto: e.target.checked})} 
                />
                <label htmlFor="form-oculto" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                  Ocultar producto en el catálogo público
                </label>
              </div>

              <div className="col-span-2 flex justify-end gap-2 mt-4 pt-4 border-t">
                <button type="button" onClick={() => setMostrarModal(false)} className="px-4 py-2 border rounded text-gray-600 font-bold hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={isPending} className="px-4 py-2 bg-[#04558C] text-white rounded font-bold hover:bg-[#033f6b] disabled:opacity-50">
                  {isPending ? 'Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDICIÓN MASIVA (POR LOTE) --- */}
      {mostrarModalMasivo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4 text-xs text-gray-900">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                  <span>✏️</span> Edición Masiva de Productos
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Se actualizarán <strong className="text-indigo-700">{idsSeleccionados.length} productos</strong> seleccionados.
                </p>
              </div>
              <button 
                onClick={() => setMostrarModalMasivo(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarMasivo} className="space-y-4">
              <p className="text-gray-500 italic">
                Marca únicamente las casillas de los atributos que deseas actualizar en lote:
              </p>

              {/* 1. Costo */}
              <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formMasivo.actCosto}
                    onChange={e => setFormMasivo({...formMasivo, actCosto: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>Modificar Costo de Adquisición (S/.)</span>
                </label>
                {formMasivo.actCosto && (
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 2.50"
                    value={formMasivo.costo}
                    onChange={e => setFormMasivo({...formMasivo, costo: parseFloat(e.target.value) || 0})}
                    className="w-full border p-2 rounded-lg bg-white font-bold text-gray-900"
                  />
                )}
              </div>

              {/* 2. Ubicación Física */}
              <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formMasivo.actUbicacion}
                    onChange={e => setFormMasivo({...formMasivo, actUbicacion: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>📍 Modificar Ubicación Física Interna</span>
                </label>
                {formMasivo.actUbicacion && (
                  <select 
                    value={formMasivo.ubicacion_fisica}
                    onChange={e => setFormMasivo({...formMasivo, ubicacion_fisica: e.target.value})}
                    className="w-full border p-2 rounded-lg bg-white font-semibold text-gray-900"
                  >
                    <option value="">-- Sin especificar --</option>
                    <option value="Cuarto 1">Cuarto 1</option>
                    <option value="Cuarto 2">Cuarto 2</option>
                    <option value="Almacén Fondo">Almacén Fondo</option>
                    <option value="2do Piso">2do Piso</option>
                    <option value="Exhibición">Exhibición</option>
                  </select>
                )}
              </div>

              {/* 3. Precio de Venta */}
              <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formMasivo.actPrecio}
                    onChange={e => setFormMasivo({...formMasivo, actPrecio: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>Modificar Precio de Venta Público (S/.)</span>
                </label>
                {formMasivo.actPrecio && (
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 35.90"
                    value={formMasivo.precio}
                    onChange={e => setFormMasivo({...formMasivo, precio: parseFloat(e.target.value) || 0})}
                    className="w-full border p-2 rounded-lg bg-white font-bold text-gray-900"
                  />
                )}
              </div>

              {/* 4. Stock Mínimo */}
              <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formMasivo.actStockMinimo}
                    onChange={e => setFormMasivo({...formMasivo, actStockMinimo: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>Modificar Alerta de Stock Mínimo</span>
                </label>
                {formMasivo.actStockMinimo && (
                  <input 
                    type="number"
                    min="0"
                    placeholder="Ej: 10"
                    value={formMasivo.stock_minimo}
                    onChange={e => setFormMasivo({...formMasivo, stock_minimo: parseInt(e.target.value) || 0})}
                    className="w-full border p-2 rounded-lg bg-white font-bold text-gray-900"
                  />
                )}
              </div>

              {/* 5. Marca */}
              <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formMasivo.actMarca}
                    onChange={e => setFormMasivo({...formMasivo, actMarca: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>Modificar Marca</span>
                </label>
                {formMasivo.actMarca && (
                  <input 
                    type="text"
                    placeholder="Ej: Celima, Trebol, San Lorenzo"
                    value={formMasivo.marca}
                    onChange={e => setFormMasivo({...formMasivo, marca: e.target.value})}
                    className="w-full border p-2 rounded-lg bg-white font-bold text-gray-900"
                  />
                )}
              </div>

              {/* 6. Visibilidad */}
              <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={formMasivo.actVisibilidad}
                    onChange={e => setFormMasivo({...formMasivo, actVisibilidad: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>Modificar Visibilidad en Catálogo (Ocultar/Mostrar)</span>
                </label>
                {formMasivo.actVisibilidad && (
                  <select
                    value={formMasivo.oculto ? 'oculto' : 'visible'}
                    onChange={e => setFormMasivo({...formMasivo, oculto: e.target.value === 'oculto'})}
                    className="w-full border p-2 rounded-lg bg-white font-bold text-gray-900"
                  >
                    <option value="visible">👁️ Visible en Catálogo</option>
                    <option value="oculto">🙈 Oculto en Catálogo</option>
                  </select>
                )}
              </div>

              {/* Acciones */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModalMasivo(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? '⏳ Actualizando...' : `💾 Aplicar a los ${idsSeleccionados.length} Productos`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}