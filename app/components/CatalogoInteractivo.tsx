'use client' 

import { useState } from 'react'

export default function CatalogoInteractivo({ inventario }: { inventario: any[] }) {
  // 1. Estados de memoria
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSel, setCategoriaSel] = useState('')
  const [colorSel, setColorSel] = useState('')

  // 2. Extracción de filtros dinámicos (Ignorando nulos y vacíos)
  const categorias = Array.from(new Set(inventario.map(item => item.categoria).filter(Boolean)))
  const colores = Array.from(new Set(inventario.map(item => item.color).filter(c => c && c.trim() !== '')))

  // 3. Motor de filtrado estricto
  const productosFiltrados = inventario.filter(item => {
    const coincideTexto = item.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                          item.id.toLowerCase().includes(busqueda.toLowerCase())
    const coincideCat = categoriaSel === '' || item.categoria === categoriaSel
    const coincideColor = colorSel === '' || item.color === colorSel
    
    return coincideTexto && coincideCat && coincideColor
  })

  const numeroWhatsApp = "51998113276" 

  const generarEnlaceWhatsApp = (item: any) => {
    const colorTexto = item.color ? `\n🎨 Color: ${item.color}` : ''
    const mensaje = `Hola LEDISA, estoy interesado en este producto:\n\n📦 *${item.nombre}*\n🔖 Código: ${item.id}${colorTexto}\n💰 Precio Listado: S/. ${item.precio}\n\n¿Tienen stock disponible para entrega inmediata?`
    
    return `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`
  }

  return (
    <div>
      {/* BARRA DE CONTROLES */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-3">
        <input 
          type="text" 
          placeholder="🔎 Buscar producto, código..." 
          className="border border-gray-300 p-3 rounded-md w-full md:w-1/2 text-black focus:outline-none focus:border-[#04558C]"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        
        <select 
          className="border border-gray-300 p-3 rounded-md w-full md:w-1/4 text-black focus:outline-none"
          value={categoriaSel}
          onChange={(e) => setCategoriaSel(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(cat => (
            <option key={cat as string} value={cat as string}>{cat as string}</option>
          ))}
        </select>

        <select 
          className="border border-gray-300 p-3 rounded-md w-full md:w-1/4 text-black focus:outline-none"
          value={colorSel}
          onChange={(e) => setColorSel(e.target.value)}
        >
          <option value="">Todos los colores</option>
          {colores.map(col => (
            <option key={col as string} value={col as string}>{col as string}</option>
          ))}
        </select>
      </div>

      <p className="text-gray-500 mb-4 text-sm font-semibold">
        Mostrando {productosFiltrados.length} productos
      </p>

{/* GRILLA DE RESULTADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {productosFiltrados.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow flex flex-col">
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
            
            <div className="text-xs text-gray-500 mb-3 flex flex-col gap-1">
              <span>{item.id} | {item.marca}</span>
              {/* Etiqueta condicional de color */}
              {item.color && (
                <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-max border border-gray-200">
                  🎨 {item.color}
                </span>
              )}
            </div>
            
            <div className="flex justify-between items-center border-t pt-3 mt-auto">
              <span className={`text-xs px-2 py-1 rounded font-bold ${item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {item.stock > 0 ? `Stock: ${item.stock}` : 'Agotado'}
              </span>
              <span className="text-lg font-black text-[#04558C]">
                S/. {item.precio}
              </span>
            </div>

          {/* 4. EL CALL TO ACTION */}
            <a 
              href={generarEnlaceWhatsApp(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-center py-2 rounded-md font-bold transition-colors flex items-center justify-center gap-2"
            >
              <span>💬 Cotizar por WhatsApp</span>
            </a>
          </div>
        ))}
      </div>
      
      {/* ESTADO VACÍO */}
      {productosFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 font-bold text-lg">No hay productos que coincidan con tu búsqueda.</p>
        </div>
      )}
    </div>
  )
}