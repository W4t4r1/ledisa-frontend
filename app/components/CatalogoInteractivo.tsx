'use client' 

import { useState } from 'react'

const SECCIONES = [
  { id: 'mayolicas_porcelanatos', nombre: 'Mayólicas y Porcelanatos', emoji: '💎' },
  { id: 'sanitarios', nombre: 'Sanitarios', emoji: '🚽' },
  { id: 'decoraciones', nombre: 'Decoraciones', emoji: '✨' },
  { id: 'griferias', nombre: 'Griferías', emoji: '🚰' },
  { id: 'instalacion', nombre: 'Instalación', emoji: '🛠️' },
  { id: 'saldos', nombre: 'Saldos y Liquidaciones', emoji: '🏷️' }
]

export function obtenerSeccionProducto(item: any): string {
  const cat = (item.categoria || '').toLowerCase().trim();
  const nom = (item.nombre || '').toLowerCase().trim();

  // 1. Saldos y Liquidaciones (categoría o nombre contenga saldo, pieza/caja antigua, liquidación, oferta)
  if (cat.includes('saldo') || cat.includes('antigu') || cat.includes('liquidac') || cat.includes('oferta') ||
      nom.includes('saldo') || nom.includes('antigu') || nom.includes('liquidac')) {
    return 'saldos';
  }
  
  // 2. Decoraciones (listelos, decorados, cenefas, etc.)
  if (cat.includes('decorac') || cat.includes('listelo') || cat.includes('decorado') || cat.includes('cenefa') || cat.includes('moldura') ||
      nom.includes('listelo') || nom.includes('decorado') || nom.includes('cenefa')) {
    return 'decoraciones';
  }

  // 3. Sanitarios (inodoro, lavatorio, pedestal, tubo de abasto, etc.)
  if (cat.includes('sanitari') || cat.includes('inodoro') || cat.includes('taza') || cat.includes('tanque') || cat.includes('lavatorio') || cat.includes('pedestal') || cat.includes('urinario') || cat.includes('abasto') ||
      nom.includes('inodoro') || nom.includes('lavatorio') || nom.includes('pedestal')) {
    return 'sanitarios';
  }

  // 4. Griferías
  if (cat.includes('grifer') || cat.includes('grifo') || cat.includes('mezcladora') || cat.includes('llave') || cat.includes('ducha') || cat.includes('caño') ||
      nom.includes('grifer') || nom.includes('mezcladora') || nom.includes('llave de agua')) {
    return 'griferias';
  }

  // 5. Instalación (fragua, crucetas, varillas, pegamento, etc.)
  if (cat.includes('instalac') || cat.includes('cruceta') || cat.includes('fragua') || cat.includes('pegamento') || cat.includes('varilla') || cat.includes('nivelador') || cat.includes('aditivo') || cat.includes('zocalo') || cat.includes('zócalo') || cat.includes('perfil') ||
      nom.includes('fragua') || nom.includes('cruceta') || nom.includes('nivelador') || nom.includes('pegamento')) {
    return 'instalacion';
  }

  // 6. Por defecto: Mayólicas y Porcelanatos
  return 'mayolicas_porcelanatos';
}

export default function CatalogoInteractivo({ inventario }: { inventario: any[] }) {
  // 1. Estados de memoria
  const [seccionSel, setSeccionSel] = useState('mayolicas_porcelanatos')
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSel, setCategoriaSel] = useState('')
  const [colorSel, setColorSel] = useState('')

  // Conteo dinámico de productos por sección (solo para productos no ocultos)
  const countPorSeccion = SECCIONES.reduce((acc, sec) => {
    acc[sec.id] = inventario.filter(item => !item.oculto && obtenerSeccionProducto(item) === sec.id).length;
    return acc;
  }, {} as Record<string, number>);

  // 2. Extracción de filtros dinámicos adaptados a la sección activa
  const categorias = Array.from(new Set(
    inventario
      .filter(item => !item.oculto && obtenerSeccionProducto(item) === seccionSel)
      .map(item => item.categoria)
      .filter(Boolean)
  ))
  
  const colores = Array.from(new Set(
    inventario
      .filter(item => !item.oculto && obtenerSeccionProducto(item) === seccionSel)
      .map(item => item.color)
      .filter(c => c && c.trim() !== '')
  ))

  // 3. Motor de filtrado estricto
  let productosFiltrados = inventario.filter(item => {
    const noEstaOculto = !item.oculto
    if (!noEstaOculto) return false;

    const coincideSeccion = obtenerSeccionProducto(item) === seccionSel
    const coincideTexto = item.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
                          item.id.toLowerCase().includes(busqueda.toLowerCase())
    const coincideCat = categoriaSel === '' || item.categoria === categoriaSel
    const coincideColor = colorSel === '' || item.color === colorSel
    
    return coincideSeccion && coincideTexto && coincideCat && coincideColor
  })

  // 4. Algoritmo de Vitrina Comercial
  productosFiltrados.sort((a, b) => {
    // Prioridad 1: Los que tienen imagen van arriba
    const tieneImgA = a.imagen && a.imagen.trim() !== '' ? 1 : 0
    const tieneImgB = b.imagen && b.imagen.trim() !== '' ? 1 : 0
    if (tieneImgB !== tieneImgA) return tieneImgB - tieneImgA

    // Prioridad 2: Productos Ancla (Cerámicos/Porcelanatos) van antes que accesorios
    const esPrincipalA = (a.categoria || '').toLowerCase().match(/cerámic|porcelanato|piso|pared/i) ? 1 : 0
    const esPrincipalB = (b.categoria || '').toLowerCase().match(/cerámic|porcelanato|piso|pared/i) ? 1 : 0
    if (esPrincipalB !== esPrincipalA) return esPrincipalB - esPrincipalA

    return 0 // Mantienen su orden alfabético si empatan
  })

  const numeroWhatsApp = "51998113276" 

  const generarEnlaceWhatsApp = (item: any) => {
    const colorTexto = item.color ? `\n🎨 Color: ${item.color}` : ''
    const mensaje = `Hola LEDISA, estoy interesado en cotizar este producto:\n\n📦 *${item.nombre}*\n🔖 Código: ${item.id}${colorTexto}\n\n¿Me podrían confirmar el precio y si hay disponibilidad para mi obra?`
    
    return `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`
  }

  return (
    <div>
      {/* SECCIONES TABS */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
          {SECCIONES.map((sec) => {
            const activo = seccionSel === sec.id
            const cant = countPorSeccion[sec.id] || 0
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setSeccionSel(sec.id)
                  setCategoriaSel('')
                  setColorSel('')
                }}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activo 
                    ? 'bg-[#04558C] text-white shadow-md transform -translate-y-0.5' 
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>{sec.emoji}</span>
                <span>{sec.nombre}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${activo ? 'bg-[#033f6b] text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {cant}
                </span>
              </button>
            )
          })}
        </div>
      </div>

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
        Mostrando {productosFiltrados.length} productos en esta sección
      </p>

      {/* GRILLA DE RESULTADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {productosFiltrados.map((item) => {
          const marcaFormateada = !item.marca || ['OTRO', 'OTROS', 'GENERICO', 'GENÉRICO'].includes(item.marca.toUpperCase().trim())
            ? 'Genérico'
            : item.marca;

          const seccion = obtenerSeccionProducto(item);

          return (
            <div key={item.id} className="bg-white p-4 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-all duration-200 flex flex-col group hover:-translate-y-1">
              {item.imagen && item.imagen.split(',')[0] ? (
                <img 
                  src={item.imagen.split(',')[0]} 
                  alt={item.nombre} 
                  className="w-full h-40 object-contain mb-3 rounded group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center mb-3 rounded text-gray-400">
                  <span className="text-sm">Sin foto</span>
                </div>
              )}
              
              <div className="flex flex-col gap-1 mb-1">
                {seccion === 'saldos' && (
                  <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border border-amber-200 w-max">
                    🏷️ Saldo / Cajas únicas
                  </span>
                )}
                {seccion === 'decoraciones' && (
                  <span className="inline-block bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border border-indigo-200 w-max">
                    ✨ Decorado
                  </span>
                )}
                <h2 className="font-bold text-gray-800 leading-tight text-base group-hover:text-[#04558C] transition-colors">{item.nombre}</h2>
              </div>
              
              <div className="text-xs text-gray-500 mb-3 flex flex-col gap-1">
                <span>Código: <span className="font-mono">{item.id}</span> | Marca: {marcaFormateada}</span>
                {item.color && (
                  <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-max border border-gray-200 text-[11px]">
                    🎨 {item.color}
                  </span>
                )}
              </div>
              
              {/* ESTADO DE DISPONIBILIDAD */}
              <div className="flex flex-col gap-1.5 border-t pt-3 mt-auto">
                <div className="flex justify-between items-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-black tracking-wide ${(item.m2_caja > 0 ? (item.stock > 0 || item.piezas_sueltas > 0) : item.stock > 0) ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {(item.m2_caja > 0 ? (item.stock > 0 || item.piezas_sueltas > 0) : item.stock > 0) ? '🟢 DISPONIBLE' : '🔴 AGOTADO'}
                  </span>
                  {item.precio > 0 && (
                    <span className="text-sm font-bold text-gray-800">
                      S/. {item.precio} <span className="text-[10px] text-gray-400 font-medium">{item.m2_caja > 0 ? '/ caja' : '/ und'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* CALL TO ACTION */}
              <a 
                href={generarEnlaceWhatsApp(item)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-center py-2.5 rounded-md font-bold transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                <span>💬 Solicitar Cotización</span>
              </a>
            </div>
          )
        })}
      </div>
      
      {/* ESTADO VACÍO */}
      {productosFiltrados.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500 font-bold text-lg">No hay productos en esta sección.</p>
        </div>
      )}
    </div>
  )
}