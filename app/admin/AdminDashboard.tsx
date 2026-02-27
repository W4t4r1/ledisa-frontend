'use client'

import { useState, useTransition } from 'react'
import { eliminarProducto, guardarProducto } from './actions'

export default function AdminDashboard({ inventarioInicial }: { inventarioInicial: any[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [isPending, startTransition] = useTransition()
  
  // Estados para el Modal (Formulario)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [esEdicion, setEsEdicion] = useState(false)
  
  // Estado para guardar temporalmente lo que el usuario escribe
  const [form, setForm] = useState({
    id: '', nombre: '', categoria: 'Porcelanato', marca: '',
    precio: 0, stock: 0, m2_caja: 0, color: '', imagen: ''
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

  const handleAbrirModal = (producto = null) => {
    if (producto) {
      setForm(producto)
      setEsEdicion(true)
    } else {
      setForm({ id: '', nombre: '', categoria: 'Porcelanato', marca: '', precio: 0, stock: 0, m2_caja: 0, color: '', imagen: '' })
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
          className="w-full md:w-1/3 border border-gray-300 p-2 rounded-md focus:outline-none focus:border-[#04558C]"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
              <th className="p-3">ID</th>
              <th className="p-3">Producto</th>
              <th className="p-3 text-right">Precio</th>
              <th className="p-3 text-center">Stock</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {productosFiltrados.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-3 text-sm font-mono text-gray-500">{item.id}</td>
                <td className="p-3 font-medium text-gray-800">
                  {item.nombre}
                  {item.color && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1 rounded">{item.color}</span>}
                </td>
                <td className="p-3 text-right font-bold text-[#04558C]">S/. {item.precio}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${item.stock > 0 ? 'bg-green-100' : 'bg-red-100 text-red-700'}`}>
                    {item.stock}
                  </span>
                </td>
                <td className="p-3 text-center flex justify-center gap-2">
                  <button onClick={() => handleAbrirModal(item)} disabled={isPending} className="text-blue-600 hover:text-blue-800 text-sm font-semibold disabled:opacity-50">Editar</button>
                  <button onClick={() => handleEliminar(item.id, item.nombre)} disabled={isPending} className="text-red-600 hover:text-red-800 text-sm font-semibold disabled:opacity-50">Eliminar</button>
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
            
            <form onSubmit={handleGuardar} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Código ID*</label>
                <input required disabled={esEdicion} type="text" className="w-full border p-2 rounded disabled:bg-gray-100" value={form.id} onChange={e => setForm({...form, id: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Nombre*</label>
                <input required type="text" className="w-full border p-2 rounded" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Categoría</label>
                <input type="text" className="w-full border p-2 rounded" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Marca</label>
                <input type="text" className="w-full border p-2 rounded" value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Precio (S/.)*</label>
                <input required type="number" step="0.1" className="w-full border p-2 rounded" value={form.precio} onChange={e => setForm({...form, precio: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Stock*</label>
                <input required type="number" className="w-full border p-2 rounded" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Color (Opcional)</label>
                <input type="text" className="w-full border p-2 rounded" value={form.color || ''} onChange={e => setForm({...form, color: e.target.value})} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-gray-500">Imagen URL (Opcional)</label>
                <input type="text" className="w-full border p-2 rounded" value={form.imagen || ''} onChange={e => setForm({...form, imagen: e.target.value})} />
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