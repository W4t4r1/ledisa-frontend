'use client'

import { useState, useTransition } from 'react'
import { eliminarProducto, guardarProducto, toggleVisibilidadProducto } from './actions'
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
    precio: 0, costo: 0, stock: 0, m2_caja: 0, piezas_sueltas: 0, color: '', imagen: '',
    oculto: false
  })

  // Filtro rápido en memoria
  const productosFiltrados = inventarioInicial.filter(item => 
    item.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    item.id.toLowerCase().includes(busqueda.toLowerCase())
  )

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

  const handleAbrirModal = (producto: any = null) => {
    if (producto) {
      setForm({
        ...producto,
        oculto: !!producto.oculto,
        piezas_sueltas: producto.piezas_sueltas || 0,
        m2_caja: producto.m2_caja || 0,
        costo: producto.costo || 0
      })
      setEsEdicion(true)
    } else {
      setForm({ id: '', nombre: '', categoria: 'Porcelanato', marca: '', precio: 0, costo: 0, stock: 0, m2_caja: 0, piezas_sueltas: 0, color: '', imagen: '', oculto: false })
      setEsEdicion(false)
    }
    setMostrarModal(true)
  }

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await guardarProducto(form, esEdicion)
        setMostrarModal(false)
        alert('✅ Producto guardado exitosamente.')
      } catch (error: any) {
        alert('❌ Error al guardar: ' + error.message)
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

      <div className="mb-4">
        <input 
          type="text" placeholder="🔎 Buscar por nombre o código..." 
          className="w-full md:w-1/3 border border-gray-300 p-2 rounded-md focus:outline-none focus:border-[#04558C] text-gray-900"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
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
            {productosFiltrados.map((item) => (
              <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.oculto ? 'opacity-60 bg-gray-50/50' : ''}`}>
                <td className="p-3 text-sm font-mono text-gray-500">{item.id}</td>
                <td className="p-3 font-medium text-gray-800">
                  <div className="flex items-center gap-2">
                    <span>{item.nombre}</span>
                    {item.oculto && (
                      <span className="text-[10px] bg-gray-400 text-white font-bold px-1.5 py-0.5 rounded tracking-wide">OCULTO</span>
                    )}
                    {item.color && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1 rounded">{item.color}</span>}
                  </div>
                </td>
                <td className="p-3 text-right font-medium text-gray-500">S/. {item.costo || '0.00'}</td>
                <td className="p-3 text-right font-bold text-[#04558C]">S/. {item.precio}</td>
                <td className="p-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    {item.m2_caja > 0 ? (
                      <>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.stock > 0 || item.piezas_sueltas > 0 ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                          {item.stock} cjs {item.piezas_sueltas > 0 ? `+ ${item.piezas_sueltas} pzs` : ''}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold">
                          ({(item.stock * item.m2_caja).toFixed(2)} m²)
                        </span>
                      </>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.stock > 0 ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                        {item.stock} {['mayolicas_porcelanatos', 'saldos', 'decoraciones'].includes(obtenerSeccionProducto(item)) ? 'pzs' : 'und'}
                      </span>
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
            ))}
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
                      { g: '🚽 Sanitarios', c: ['Inodoro', 'Taza', 'Tanque', 'Lavatorio', 'Tubo de abasto'] },
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
                <label className="text-xs font-bold text-gray-500 block mb-1">Stock (Cajas)*</label>
                <input required type="number" className="w-full border p-2 rounded text-gray-900 bg-white" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} />
                <span className="text-[10px] text-gray-400 block mt-1">
                  {form.m2_caja > 0 
                    ? `Equivale a ${(form.stock * form.m2_caja).toFixed(2)} m² totales en stock` 
                    : 'Cantidad de piezas o unidades físicas en stock'}
                </span>
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
    </div>
  )
}