// app/admin/dashboard/DashboardWorkspace.tsx
'use client'

import { useState } from 'react'

interface DashboardWorkspaceProps {
  inventario: any[]
  ventas: any[]
  clientes: any[]
}

export default function DashboardWorkspace({ inventario, ventas, clientes }: DashboardWorkspaceProps) {
  // --- CÁLCULOS TÁCTICOS E INDICADORES (KPIs) ---

  // 1. Inventario
  const totalProductos = inventario.length
  const capitalTotal = inventario.reduce((suma, item) => suma + (item.precio * item.stock), 0)
  const productosAgotados = inventario.filter(item => item.stock === 0)
  const productosBajoStock = inventario.filter(item => item.stock > 0 && item.stock <= 5)

  // Desglose por categoría (cantidad)
  const categoriasCount = inventario.reduce((acc, item) => {
    const cat = item.categoria || 'Sin Categoría'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 2. CRM Clientes
  const totalClientes = clientes.length

  // 3. Ventas y Finanzas
  const ventasConcretadas = ventas.filter(v => v.estado === 'PAGADO' || v.estado === 'ENTREGADO')
  const cotizacionesActivas = ventas.filter(v => v.estado === 'COTIZACION')
  
  const totalIngresos = ventasConcretadas.reduce((sum, v) => sum + Number(v.total), 0)
  const totalCotizado = cotizacionesActivas.reduce((sum, v) => sum + Number(v.total), 0)
  
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

  return (
    <div className="space-y-6">
      
      {/* CABECERA */}
      <div>
        <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Centro de Control General</h2>
        <p className="text-gray-500 text-sm mt-1">Métricas unificadas de ventas, clientes e inventario en tiempo real</p>
      </div>

      {/* FILA 1: KPIs CLAVE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: CAPITAL EN ALMACÉN */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Capital Inmovilizado</p>
              <h3 className="text-2xl font-black text-gray-800">S/. {capitalTotal.toFixed(2)}</h3>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">En {totalProductos} productos de catálogo</p>
            </div>
            <span className="text-2xl bg-blue-50 p-2 rounded-lg">📦</span>
          </div>
        </div>

        {/* KPI: INGRESOS TOTALES */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ingresos por Ventas</p>
              <h3 className="text-2xl font-black text-green-700">S/. {totalIngresos.toFixed(2)}</h3>
              <p className="text-[10px] text-green-600 font-semibold mt-1">En {ventasConcretadas.length} operaciones cerradas</p>
            </div>
            <span className="text-2xl bg-green-50 p-2 rounded-lg">💵</span>
          </div>
        </div>

        {/* KPI: TICKET PROMEDIO */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ticket Promedio</p>
              <h3 className="text-2xl font-black text-purple-700">S/. {ticketPromedio.toFixed(2)}</h3>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">Gasto medio por cliente facturado</p>
            </div>
            <span className="text-2xl bg-purple-50 p-2 rounded-lg">🧾</span>
          </div>
        </div>

        {/* KPI: CLIENTES CRM */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-amber-500 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Cartera de Clientes</p>
              <h3 className="text-2xl font-black text-gray-800">{totalClientes}</h3>
              <p className="text-[10px] text-gray-400 font-semibold mt-1">Registrados en la base de datos CRM</p>
            </div>
            <span className="text-2xl bg-amber-50 p-2 rounded-lg">👥</span>
          </div>
        </div>

      </div>

      {/* FILA 2: GRÁFICOS Y DISTRIBUCIONES (DISEÑO CSS PREMIUM) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PANEL: CONVERSIÓN DE NEGOCIO */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
          <div className="border-b pb-3 flex justify-between items-center">
            <h4 className="font-bold text-gray-800 text-base">Conversión e Interacción Comercial</h4>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Rendimiento</span>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-gray-500">Conversión de Cotización a Compra</span>
              <span className="font-black text-[#04558C]">{conversionPorcentaje.toFixed(1)}%</span>
            </div>

            {/* Barra de progreso de conversión */}
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border">
              <div 
                className="bg-gradient-to-r from-blue-500 to-[#04558C] h-full rounded-full transition-all duration-500" 
                style={{ width: `${conversionPorcentaje}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-center">
                <span className="text-[10px] text-green-700 font-bold uppercase block">Ventas Facturadas</span>
                <span className="text-lg font-black text-green-800">{ventasConcretadas.length}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">S/. {totalIngresos.toFixed(2)}</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-center">
                <span className="text-[10px] text-amber-700 font-bold uppercase block">Proformas / Cotizaciones</span>
                <span className="text-lg font-black text-amber-800">{cotizacionesActivas.length}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">S/. {totalCotizado.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 italic text-center">
              * El índice mide la relación entre los comprobantes concretados frente al total de registros de cotización y ventas.
            </p>
          </div>
        </div>

        {/* PANEL: MÉTODOS DE PAGO */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="border-b pb-3">
            <h4 className="font-bold text-gray-800 text-base">Distribución por Método de Pago</h4>
          </div>

          {metodosOrdenados.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12 italic">No se registran cobros en las ventas.</p>
          ) : (
            <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
              {metodosOrdenados.map(([metodo, monto]) => {
                const pct = totalIngresos > 0 ? (monto / totalIngresos) * 100 : 0
                return (
                  <div key={metodo} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-600">
                      <span>{metodo}</span>
                      <span className="font-mono text-gray-900 font-bold">
                        S/. {monto.toFixed(2)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    {/* Barra de progreso visual */}
                    <div className="w-full bg-gray-50 rounded-full h-2 overflow-hidden border border-gray-100">
                      <div 
                        className="bg-green-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* FILA 3: TABLA DE TRANSACCIONES & ALERTAS DE STOCK */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* TABLA: ÚLTIMAS TRANSACCIONES */}
        <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="border-b pb-3">
            <h4 className="font-bold text-gray-800 text-base">Últimas Transacciones del Sistema</h4>
          </div>

          {transaccionesRecientes.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12 italic">No hay historial de ventas o cotizaciones en el sistema.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider font-bold border-b">
                    <th className="p-2.5">Código</th>
                    <th className="p-2.5">Fecha</th>
                    <th className="p-2.5">Cliente</th>
                    <th className="p-2.5 text-center">Estado</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transaccionesRecientes.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-gray-700">{v.codigo_venta}</td>
                      <td className="p-2.5 text-gray-400">
                        {new Date(v.fecha).toLocaleDateString('es-PE', {
                          day: '2-digit', month: '2-digit', year: '2-digit'
                        })}
                      </td>
                      <td className="p-2.5 font-semibold text-gray-600 truncate max-w-[150px]" title={v.clientes?.nombre_razon_social || 'Cliente Genérico'}>
                        {v.clientes?.nombre_razon_social || 'Cliente Genérico'}
                      </td>
                      <td className="p-2.5 text-center">{getBadgeEstado(v.estado)}</td>
                      <td className="p-2.5 text-right font-bold text-[#04558C]">S/. {Number(v.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ALERTA DE STOCK Y CATEGORÍAS */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
          <div className="border-b pb-3">
            <h4 className="font-bold text-gray-800 text-base">Alertas Críticas de Stock</h4>
          </div>

          {/* Tarjeta rápida de quiebre de stock */}
          <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-red-700 font-bold uppercase tracking-wider block">Quiebre (Stock Cero)</span>
              <span className="text-2xl font-black text-red-600">{productosAgotados.length}</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Productos fuera de servicio</span>
            </div>
            <span className="text-3xl">🚨</span>
          </div>

          {/* Listado bajo stock */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Atención Requerida (Stock &lt;= 5)</span>
            
            {productosBajoStock.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Inventario en niveles estables.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[180px] pr-1">
                {productosBajoStock.slice(0, 10).map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs bg-gray-50 border p-2 rounded-lg hover:border-gray-300 transition-colors">
                    <div className="truncate max-w-[160px]" title={item.nombre}>
                      <p className="font-semibold text-gray-800 truncate">{item.nombre}</p>
                      <p className="text-[9px] text-gray-400 font-mono">Cód: {item.id}</p>
                    </div>
                    <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap">
                      Quedan: {item.stock} cjs
                    </span>
                  </div>
                ))}
                {productosBajoStock.length > 10 && (
                  <p className="text-[10px] text-gray-400 font-semibold text-center italic mt-2">
                    Y {productosBajoStock.length - 10} productos más en alerta...
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
