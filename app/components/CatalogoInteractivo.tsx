'use client' // Esta directiva es obligatoria. Le dice a Next.js que esto corre en el navegador.

import { useState } from 'react'

// Definimos qué datos espera recibir este componente
export default function CatalogoInteractivo({ inventario }: { inventario: any[] }) {
  // Estados de React: la memoria a corto plazo de tu interfaz
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSel, setCategoriaSel] = useState('')

  // Extraemos las categorías únicas automáticamente de tu base de datos
  const categorias = Array.from(new Set(inventario.map(item => item.categoria).filter(Boolean)))

  // Lógica de filtrado destructivo (racional y sin piedad con los datos que no coinciden)
  const productosFiltrados = inventario.filter(item => {
    const coincideTexto = item.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                          item.id.toLowerCase().includes(busqueda.toLowerCase())
    const coincideCat = categoriaSel === '' || item.categoria === categoriaSel
    
    return coincideTexto && coincideCat
  })

  return (
    <div>
      {/* 1. BARRA DE CONTROLES (Buscador y Filtros) */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
        <input 
          type="text" 
          placeholder="🔎 Buscar porcelanato, código, marca..." 
          className="border border-gray-300 p-3 rounded-md w-full md:w-2/3 text-black focus:outline-none focus:border-[#04558C]"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        
        <select 
          className="border border-gray-300 p-3 rounded-md w-full md:w-1/3 text-black focus:outline-none"
          value={categoriaSel}
          onChange={(e) => setCategoriaSel(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(cat => (
            <option key={cat as string} value={cat as string}>{cat}</option>
          ))}
        </select>
      </div>

      <p className="text-gray-500 mb-4 text-sm font-semibold">
        Mostrando {productosFiltrados.length} productos
      </p>

      {/* 2. GRILLA DE RESULTADOS (Renderizado dinámico) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {productosFiltrados.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            {item.imagen && item.imagen.split(',')[0] ? (
              <img 
                src={item.imagen.split(',')[0]} 
                alt={item.nombre} 
                className="w-full h-40 object-contain mb-3 rounded"
              />
            ) : (
              <div className="w-full h-40 bg-gray-100 flex items-center justify-center mb-3 rounded">
                <span className="text-gray-400 text-sm">Sin foto</span>
              </div>
            )}
            
            <h2 className="font-bold text-gray-800 leading-tight mb-1">{item.nombre}</h2>
            <p className="text-xs text-gray-500 mb-3">{item.id} | {item.marca}</p>
            
            <div className="flex justify-between items-center border-t pt-3 mt-auto">
              <span className={`text-xs px-2 py-1 rounded font-bold ${item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {item.stock > 0 ? `Stock: ${item.stock}` : 'Agotado'}
              </span>
              <span className="text-lg font-black text-[#04558C]">
                S/. {item.precio}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Estado vacío */}
      {productosFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 font-bold text-lg">No hay cerámicos que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  )
}