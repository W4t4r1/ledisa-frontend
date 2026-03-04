// app/admin/dashboard/page.tsx
import { getInventarioCompleto } from '../../lib/inventario.service'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const inventario = await getInventarioCompleto()

  // MATEMÁTICAS DE NEGOCIO (Ejecutadas en el backend)
  const totalProductos = inventario.length
  
  // Capital inmovilizado: ¿Cuánto dinero hay en la tienda?
  const capitalTotal = inventario.reduce((suma, item) => suma + (item.precio * item.stock), 0)
  
  // Alertas de quiebre de stock
  const productosAgotados = inventario.filter(item => item.stock === 0)
  const productosBajoStock = inventario.filter(item => item.stock > 0 && item.stock <= 5)

  // Desglose por categoría
  const categorias = inventario.reduce((acc, item) => {
    const cat = item.categoria || 'Sin Categoría'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Métricas en Tiempo Real</h2>
      
      {/* TARJETAS DE INDICADORES (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Catálogo Activo</p>
          <p className="text-4xl font-black text-gray-800">{totalProductos} <span className="text-base font-normal text-gray-500">ítems</span></p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-green-500">
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Capital Valorizado</p>
          <p className="text-4xl font-black text-gray-800">S/. {capitalTotal.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">Mercadería en stock físico</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-red-500 relative overflow-hidden">
          <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Riesgo de Quiebre</p>
          <p className="text-4xl font-black text-red-600">{productosAgotados.length}</p>
          <p className="text-xs text-red-400 font-semibold mt-1">Productos en stock cero</p>
          {productosAgotados.length > 0 && (
            <div className="absolute top-0 right-0 bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-bl-lg">
              ACCIÓN REQUERIDA
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DE ALERTAS TÁCTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Distribución por Categoría</h3>
          <ul className="space-y-3">
            {Object.entries(categorias).map(([cat, count]) => (
              <li key={cat} className="flex justify-between items-center text-sm">
                <span className="font-semibold text-gray-600">{cat}</span>
                <span className="bg-gray-100 px-2 py-1 rounded text-gray-800 font-mono">{String(count)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200 bg-red-50">
          <h3 className="text-lg font-bold text-red-800 mb-4 border-b border-red-200 pb-2">Atención Inmediata (Bajo Stock)</h3>
          {productosBajoStock.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Todo el inventario tiene niveles saludables.</p>
          ) : (
            <ul className="space-y-2 overflow-y-auto max-h-48">
              {productosBajoStock.map(item => (
                <li key={item.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-red-100 shadow-sm">
                  <span className="font-medium text-gray-800 truncate pr-2">{item.nombre}</span>
                  <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-xs whitespace-nowrap">
                    Quedan: {item.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}