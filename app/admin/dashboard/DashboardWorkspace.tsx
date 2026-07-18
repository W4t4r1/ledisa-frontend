// app/admin/dashboard/DashboardWorkspace.tsx
'use client'

import { useState } from 'react'

interface DashboardWorkspaceProps {
  inventario: any[]
  ventas: any[]
  clientes: any[]
}

export default function DashboardWorkspace({ inventario, ventas, clientes }: DashboardWorkspaceProps) {
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null)

  // --- CÁLCULOS TÁCTICOS E INDICADORES (KPIs) ---

  // 1. Inventario
  const totalProductos = inventario.length
  const capitalTotal = inventario.reduce((suma, item) => {
    const valorUnitario = item.costo || item.precio || 0
    if (item.m2_caja > 0) {
      const totalM2 = (item.stock * item.m2_caja) + (item.piezas_sueltas * (item.m2_caja / 6))
      return suma + (totalM2 * valorUnitario)
    } else {
      return suma + (item.stock * valorUnitario)
    }
  }, 0)
  const productosAgotados = inventario.filter(item => item.stock === 0)
  const productosBajoStock = inventario.filter(item => item.stock > 0 && item.stock <= (item.stock_minimo !== undefined ? item.stock_minimo : 5))

  // 2. CRM Clientes
  const totalClientes = clientes.length

  // 3. Ventas y Finanzas
  const ventasConcretadas = ventas.filter(v => v.estado === 'PAGADO' || v.estado === 'ENTREGADO')
  const cotizacionesActivas = ventas.filter(v => v.estado === 'COTIZACION')
  
  const totalIngresos = ventasConcretadas.reduce((sum, v) => sum + Number(v.total), 0)
  const totalCotizado = cotizacionesActivas.reduce((sum, v) => sum + Number(v.total), 0)
  
  // Utilidad y Rentabilidad Neta
  const gananciaNeta = ventasConcretadas.reduce((sum, v) => sum + (Number(v.total) - Number(v.total_costo || 0)), 0)
  const rentabilidad = totalIngresos > 0 ? (gananciaNeta / totalIngresos) * 100 : 0
  
  const ticketPromedio = ventasConcretadas.length > 0 ? totalIngresos / ventasConcretadas.length : 0

  // 4. Conversión y Métodos de Pago
  const ventasActivasCount = ventas.filter(v => v.estado !== 'ANULADO').length
  const conversionPorcentaje = ventasActivasCount > 0 
    ? (ventasConcretadas.length / ventasActivasCount) * 100 
    : 0

  // Agrupar ingresos por método de pago
  const ingresosPorMetodo = ventasConcretadas.reduce((acc, v) => {
    const metodo = v.metodo_pago || 'Sin Especificar'
    acc[metodo] = (acc[metodo] || 0) + Number(v.total)
    return acc
  }, {} as Record<string, number>)

  // Ordenar métodos de pago por volumen de ingresos
  const metodosOrdenados = (Object.entries(ingresosPorMetodo) as [string, number][])
    .sort((a, b) => b[1] - a[1])

  // Obtener las 5 transacciones más recientes
  const transaccionesRecientes = ventas.slice(0, 5)

  // 5. TOP CLIENTES (Por facturación total)
  const ventasPorCliente = ventasConcretadas.reduce((acc, v) => {
    const nombre = v.clientes?.nombre_razon_social || 'Cliente General'
    acc[nombre] = (acc[nombre] || 0) + Number(v.total)
    return acc
  }, {} as Record<string, number>)

  const topClientes = (Object.entries(ventasPorCliente) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // 6. EVOLUCIÓN DIARIA (Últimos 15 días)
  const ultimos15Dias = Array.from({ length: 15 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (14 - i))
    return d.toISOString().split('T')[0]
  })

  const ventasPorDia = ventasConcretadas.reduce((acc, v) => {
    const dia = v.fecha.split('T')[0]
    acc[dia] = (acc[dia] || 0) + Number(v.total)
    return acc
  }, {} as Record<string, number>)

  const gananciasPorDia = ventasConcretadas.reduce((acc, v) => {
    const dia = v.fecha.split('T')[0]
    const ganancia = Number(v.total) - Number(v.total_costo || 0)
    acc[dia] = (acc[dia] || 0) + ganancia
    return acc
  }, {} as Record<string, number>)

  const dataDiaria = ultimos15Dias.map(dia => ({
    diaStr: new Date(dia).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
    total: ventasPorDia[dia] || 0,
    ganancia: gananciasPorDia[dia] || 0
  }))

  // Helper para pintar badges de estado
  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
        return <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200">🟢 PAGADO</span>
      case 'ENTREGADO':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">🔵 ENTREGADO</span>
      case 'COTIZACION':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">📝 COTIZACIÓN</span>
      case 'ANULADO':
        return <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200">❌ ANULADO</span>
      default:
        return <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded">{estado}</span>
    }
  }

  // --- CÁLCULO DE GRÁFICOS SVG ---
  // Gráfico de líneas
  const svgWidth = 500
  const svgHeight = 180
  const maxMonto = Math.max(...dataDiaria.map(d => Math.max(d.total, d.ganancia)), 100)
  
  const getPointsCoords = (dataKey: 'total' | 'ganancia') => {
    return dataDiaria.map((d, i) => {
      const x = (i / (dataDiaria.length - 1)) * (svgWidth - 40) + 20
      const y = svgHeight - (d[dataKey] / maxMonto) * (svgHeight - 40) - 20
      return { x, y, data: d }
    })
  }

  const puntosVentas = getPointsCoords('total')
  const puntosGanancias = getPointsCoords('ganancia')

  const generatePathD = (points: { x: number; y: number }[]) => {
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }

  const generateAreaD = (points: { x: number; y: number }[]) => {
    const pathD = generatePathD(points)
    if (points.length === 0) return ''
    return `${pathD} L ${points[points.length - 1].x} ${svgHeight - 20} L ${points[0].x} ${svgHeight - 20} Z`
  }

  const pathVentas = generatePathD(puntosVentas)
  const areaVentas = generateAreaD(puntosVentas)
  
  const pathGanancias = generatePathD(puntosGanancias)
  const areaGanancias = generateAreaD(puntosGanancias)

  // Gráfico Donut (Métodos de pago)
  const donutRadius = 35
  const donutCircumference = 2 * Math.PI * donutRadius
  let cumulativePercent = 0

  return (
    <div className="space-y-6">
      
      {/* CABECERA */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Centro de Control General</h2>
          <p className="text-gray-500 text-sm mt-1">Métricas unificadas de ventas, clientes e inventario en tiempo real</p>
        </div>
        <span className="text-xs bg-[#04558C]/10 text-[#04558C] font-bold px-3 py-1.5 rounded-full border border-[#04558C]/20">
          🔄 Actualizado en Vivo
        </span>
      </div>

      {/* FILA 1: KPIs CLAVE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* KPI: CAPITAL EN ALMACÉN */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Capital Almacén</p>
              <h3 className="text-xl font-black text-gray-800">S/. {capitalTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">En {totalProductos} ítems de catálogo</p>
            </div>
            <span className="text-xl bg-blue-50 p-2.5 rounded-xl">📦</span>
          </div>
        </div>

        {/* KPI: INGRESOS TOTALES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ingresos Facturados</p>
              <h3 className="text-xl font-black text-green-700">S/. {totalIngresos.toFixed(2)}</h3>
              <p className="text-[10px] text-green-600 font-semibold mt-1">En {ventasConcretadas.length} operaciones</p>
            </div>
            <span className="text-xl bg-green-50 p-2.5 rounded-xl">💵</span>
          </div>
        </div>

        {/* KPI: UTILIDAD NETA */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Utilidad Neta</p>
              <h3 className="text-xl font-black text-emerald-700">S/. {gananciaNeta.toFixed(2)}</h3>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">Margen: {rentabilidad.toFixed(1)}%</p>
            </div>
            <span className="text-xl bg-emerald-50 p-2.5 rounded-xl">📈</span>
          </div>
        </div>

        {/* KPI: TICKET PROMEDIO */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ticket Promedio</p>
              <h3 className="text-xl font-black text-purple-700">S/. {ticketPromedio.toFixed(2)}</h3>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">Gasto medio por recibo</p>
            </div>
            <span className="text-xl bg-purple-50 p-2.5 rounded-xl">🧾</span>
          </div>
        </div>

        {/* KPI: CLIENTES CRM */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Clientes Activos</p>
              <h3 className="text-xl font-black text-gray-800">{totalClientes}</h3>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">Registrados en CRM</p>
            </div>
            <span className="text-xl bg-amber-50 p-2.5 rounded-xl">👥</span>
          </div>
        </div>

      </div>

      {/* FILA 2: GRÁFICOS Y ANALÍTICA AVANZADA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO 1: EVOLUCIÓN TEMPORAL (ÁREA INTERACTIVA) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 relative">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Historial de Ventas y Utilidad</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Evolución diaria de los últimos 15 días</p>
            </div>
            <div className="flex gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span> Ventas</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Utilidad</span>
            </div>
          </div>

          {/* Gráfico SVG */}
          <div className="relative">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="ventasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="gananciasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Guías Horizontales */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                const y = svgHeight - 20 - p * (svgHeight - 40)
                return (
                  <line 
                    key={idx} 
                    x1="20" y1={y} x2={svgWidth - 20} y2={y} 
                    stroke="#f3f4f6" strokeWidth="1" strokeDasharray="3" 
                  />
                )
              })}

              {/* Áreas y líneas */}
              {areaVentas && <path d={areaVentas} fill="url(#ventasGrad)" />}
              {areaGanancias && <path d={areaGanancias} fill="url(#gananciasGrad)" />}
              
              {pathVentas && <path d={pathVentas} fill="none" stroke="#3b82f6" strokeWidth="2.5" />}
              {pathGanancias && <path d={pathGanancias} fill="none" stroke="#10b981" strokeWidth="2" />}

              {/* Puntos interactivos invisibles para hover */}
              {puntosVentas.map((p, idx) => (
                <g key={idx}>
                  {/* Punto resaltado */}
                  {hoveredPoint?.idx === idx && (
                    <>
                      <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                      <circle cx={puntosGanancias[idx].x} cy={puntosGanancias[idx].y} r="4" fill="#10b981" stroke="white" strokeWidth="1" />
                      <line x1={p.x} y1="20" x2={p.x} y2={svgHeight - 20} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2" />
                    </>
                  )}
                  {/* Zona de hover sensible */}
                  <rect 
                    x={p.x - 12} y="10" width="24" height={svgHeight - 20} 
                    fill="transparent" 
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint({ idx, ...p.data })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}

              {/* Labels Eje X */}
              {dataDiaria.map((d, i) => {
                if (i % 3 !== 0 && i !== dataDiaria.length - 1) return null
                const x = (i / (dataDiaria.length - 1)) * (svgWidth - 40) + 20
                return (
                  <text 
                    key={i} 
                    x={x} y={svgHeight - 4} 
                    fill="#9ca3af" fontSize="8" fontWeight="bold" textAnchor="middle"
                  >
                    {d.diaStr}
                  </text>
                )
              })}
            </svg>

            {/* Tooltip flotante */}
            {hoveredPoint && (
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-gray-900/95 text-white text-[10px] rounded-lg p-2.5 shadow-xl border border-gray-800 space-y-1 z-20 flex gap-4 backdrop-blur-sm">
                <div>
                  <p className="text-gray-400 font-bold uppercase text-[8px]">{hoveredPoint.diaStr}</p>
                  <p className="font-medium mt-0.5">Ventas: <span className="font-bold text-blue-400">S/. {hoveredPoint.total.toFixed(2)}</span></p>
                  <p className="font-medium">Utilidad: <span className="font-bold text-green-400">S/. {hoveredPoint.ganancia.toFixed(2)}</span></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 2: MÉTODOS DE PAGO (DONUT INTERACTIVO) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="border-b pb-3">
            <h4 className="font-bold text-gray-800 text-sm">Métodos de Pago</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Distribución de cobros por tipo de transacción</p>
          </div>

          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {metodosOrdenados.map(([metodo, monto], idx) => {
                  const percent = totalIngresos > 0 ? (monto / totalIngresos) * 100 : 0
                  if (percent === 0) return null

                  const strokeLength = (percent / 100) * donutCircumference
                  const strokeOffset = donutCircumference - (cumulativePercent / 100) * donutCircumference
                  cumulativePercent += percent

                  // Paleta de colores para cobros
                  const colors = ['#04558C', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280']
                  const color = colors[idx % colors.length]

                  return (
                    <circle
                      key={metodo}
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke={color}
                      strokeWidth="10"
                      strokeDasharray={`${strokeLength} ${donutCircumference - strokeLength}`}
                      strokeDashoffset={strokeOffset}
                      className="transition-all duration-300"
                    />
                  )
                })}
              </svg>
              {/* Centro de la dona */}
              <div className="absolute inset-4 bg-white rounded-full flex flex-col justify-center items-center shadow-inner text-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total</span>
                <span className="text-xs font-black text-gray-800">S/. {totalIngresos.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>

            {/* Leyenda ordenada */}
            <div className="w-full space-y-1.5 text-[10px] max-h-28 overflow-y-auto pr-1">
              {metodosOrdenados.map(([metodo, monto], idx) => {
                const pct = totalIngresos > 0 ? (monto / totalIngresos) * 100 : 0
                const colors = ['#04558C', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280']
                const color = colors[idx % colors.length]

                return (
                  <div key={metodo} className="flex justify-between items-center bg-gray-50/50 p-1.5 rounded border border-gray-100">
                    <span className="flex items-center gap-1.5 font-medium text-gray-600 truncate max-w-[120px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                      {metodo}
                    </span>
                    <span className="font-mono font-bold text-gray-800">
                      S/. {monto.toFixed(0)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>

      {/* FILA 3: TABLA DE TRANSACCIONES & ALERTAS DE STOCK & TOP CLIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TABLA: ÚLTIMAS TRANSACCIONES */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="border-b pb-3">
            <h4 className="font-bold text-gray-800 text-sm">Últimas Transacciones</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Operaciones de venta y cotizaciones recientes</p>
          </div>

          {transaccionesRecientes.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-12 italic">No hay historial de operaciones.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider font-bold border-b text-[9px]">
                    <th className="p-2.5 pl-4">Código</th>
                    <th className="p-2.5">Fecha</th>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5 text-center">Estado</th>
                    <th className="p-2.5 text-right">Total</th>
                    <th className="p-2.5 text-right pr-4">Utilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {transaccionesRecientes.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/40 transition-colors">
                      <td className="p-2.5 pl-4 font-mono font-bold text-gray-800">{v.codigo_venta}</td>
                      <td className="p-2.5 text-gray-400">
                        {new Date(v.fecha).toLocaleDateString('es-PE', {
                          day: '2-digit', month: '2-digit', year: '2-digit'
                        })}
                      </td>
                      <td className="p-2.5 font-semibold text-gray-600 truncate max-w-[120px]" title={v.clientes?.nombre_razon_social || 'Cliente General'}>
                        {v.clientes?.nombre_razon_social || 'Cliente General'}
                      </td>
                      <td className="p-2.5 text-center">{getBadgeEstado(v.estado)}</td>
                      <td className="p-2.5 text-right font-bold text-gray-900">S/. {Number(v.total).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-600 pr-4">
                        {v.estado !== 'COTIZACION' && v.estado !== 'ANULADO' ? (
                          `S/. ${(Number(v.total) - Number(v.total_costo || 0)).toFixed(2)}`
                        ) : (
                          <span className="text-gray-400 font-normal italic">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PANEL: AUDITORÍA DE INVENTARIO Y CRÍTICOS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          
          {/* TAB: TOP CLIENTES FACTURACIÓN */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h4 className="font-bold text-gray-800 text-sm">Top Clientes</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Clientes que más aportan a la facturación</p>
            </div>

            {topClientes.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-4 italic">No se registran ventas facturadas.</p>
            ) : (
              <div className="space-y-3">
                {topClientes.map(([nombre, monto]) => {
                  const pct = totalIngresos > 0 ? (monto / totalIngresos) * 100 : 0
                  return (
                    <div key={nombre} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold text-gray-600">
                        <span className="truncate max-w-[150px]" title={nombre}>{nombre}</span>
                        <span className="font-mono text-gray-900 font-bold">S/. {monto.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* STOCK CRÍTICO */}
          <div className="space-y-4 pt-2">
            <div className="border-b pb-2 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-800 text-sm">Alertas de Stock</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Nivel crítico del almacén de revestimientos</p>
              </div>
              <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-100">
                🚨 {productosAgotados.length} Agotados
              </span>
            </div>

            {productosBajoStock.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Inventario en niveles estables.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[140px] pr-1">
                {productosBajoStock.slice(0, 5).map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs bg-gray-50 border p-2 rounded-xl hover:border-gray-300 transition-all">
                    <div className="truncate max-w-[130px]" title={item.nombre}>
                      <p className="font-semibold text-gray-800 truncate">{item.nombre}</p>
                      <p className="text-[9px] text-gray-400 font-mono">Lote/Cód: {item.id.slice(0, 8)}...</p>
                    </div>
                    <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px] font-mono shrink-0">
                      Quedan: {item.stock} cjs
                    </span>
                  </div>
                ))}
                {productosBajoStock.length > 5 && (
                  <p className="text-[10px] text-gray-400 font-semibold text-center italic mt-2">
                    Y {productosBajoStock.length - 5} productos más en alerta...
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
