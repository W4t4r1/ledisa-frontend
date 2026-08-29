// app/components/ComprobantePrint.tsx
import React from 'react'

interface ComprobantePrintProps {
  venta: {
    codigo_venta: string
    fecha: string
    metodo_pago: string
    subtotal: number
    descuento: number
    total: number
    nota?: string | null
    estado: 'PAGADO' | 'ENTREGADO' | 'COTIZACION' | 'ANULADO'
    clientes?: {
      tipo_documento: string
      documento: string
      nombre_razon_social: string
      celular?: string | null
      direccion?: string | null
    } | null
    items?: any[]
  } | null
}

export default function ComprobantePrint({ venta }: ComprobantePrintProps) {
  if (!venta) return null

  const esCotizacion = venta.estado === 'COTIZACION'
  const items = venta.items || []

  // Calcular cantidades legibles
  const formatDetalleCantidades = (item: any) => {
    const p = item.producto || item
    const m2Caja = p.m2_caja || 0
    const cantCajas = Number(item.cantidad_cajas || 0)
    const pzsSueltas = Number(item.piezas_sueltas || 0)

    if (m2Caja > 0) {
      const parts = []
      if (cantCajas > 0) parts.push(`${cantCajas} cjs`)
      if (pzsSueltas > 0) parts.push(`${pzsSueltas} pzs`)
      
      const pzsPorCaja = Number(item.piezas_por_caja || 6)
      const m2Totales = (cantCajas * m2Caja) + (pzsSueltas * (m2Caja / pzsPorCaja))
      
      return `${parts.join(' + ')} (${m2Totales.toFixed(2)} m²)`
    } else {
      return `${pzsSueltas} und`
    }
  };

  return (
    <div id="print-area" className="bg-white text-black p-8 font-sans max-w-2xl mx-auto border border-gray-300 shadow-sm print:border-none print:shadow-none text-xs leading-relaxed">
      
      {/* CABECERA DE LA EMPRESA */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#04558C] print:text-black">GRUPO LEDISA S.A.C.</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Acabados, Mayólicas y Porcelanatos Premium</p>
          <p className="mt-2 text-gray-600 font-medium">Av. Héroes de la Patria 520, San Juan de Lurigancho - Lima</p>
          <p className="text-gray-600">Cel: +51 987 654 321 | Ventas: ventas@ledisa.pe</p>
        </div>
        
        {/* TÍTULO DEL COMPROBANTE */}
        <div className="border-2 border-black p-4 text-center min-w-56 bg-gray-50 print:bg-white rounded">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">R.U.C. 20601234567</p>
          <h2 className="text-base font-black uppercase tracking-wide my-1">
            {esCotizacion ? 'PROFORMA / COTIZACIÓN' : 'NOTA DE VENTA'}
          </h2>
          <p className="text-sm font-black font-mono text-[#04558C] print:text-black">N° {venta.codigo_venta}</p>
          {!esCotizacion && (
            <div className="mt-1.5">
              {(venta.estado === 'PAGADO' || (venta as any).estado_pago === 'PAGADO' || Number((venta as any).saldo_pendiente || 0) <= 0.01) ? (
                <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded tracking-wider">
                  ✓ CANCELADO
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase text-blue-800 bg-blue-50 border border-blue-300 px-2 py-0.5 rounded tracking-wider">
                  DESPACHO A CRÉDITO
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* INFORMACIÓN DEL CLIENTE Y FECHA */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-4 rounded mb-6 bg-gray-50/50 print:bg-white">
        <div className="space-y-1">
          <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Señor(es):</span> 
            <span className="font-bold text-gray-800 text-sm">{venta.clientes?.nombre_razon_social || 'CLIENTE GENERAL'}</span>
          </p>
          <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Documento:</span> 
            <span className="font-medium text-gray-700">{venta.clientes ? `${venta.clientes.tipo_documento}: ${venta.clientes.documento}` : 'S/D'}</span>
          </p>
          {venta.clientes?.celular && (
            <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Celular:</span> 
              <span className="font-medium text-gray-700">{venta.clientes.celular}</span>
            </p>
          )}
        </div>
        
        <div className="space-y-1">
          <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Fecha de Emisión:</span> 
            <span className="font-medium text-gray-700">{new Date(venta.fecha).toLocaleString('es-PE')}</span>
          </p>
          <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Método de Pago:</span> 
            <span className="font-semibold text-gray-700">{venta.metodo_pago}</span>
          </p>
          {venta.clientes?.direccion && (
            <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Dirección:</span> 
              <span className="font-medium text-gray-700">{venta.clientes.direccion}</span>
            </p>
          )}
        </div>
      </div>

      {/* TABLA DE PRODUCTOS */}
      <div className="border border-gray-300 rounded overflow-hidden mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-gray-600 font-bold uppercase text-[9px] tracking-wider">
              <th className="p-2.5 pl-4">Código / Producto</th>
              <th className="p-2.5 text-center">Cantidades</th>
              <th className="p-2.5 text-right">Precio Unit. (m²/und)</th>
              <th className="p-2.5 text-right pr-4">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-[11px] text-gray-800">
            {items.map((item: any, idx: number) => {
              const p = item.producto || item
              return (
                <tr key={idx} className="hover:bg-gray-50/20">
                  <td className="p-2.5 pl-4">
                    <span className="font-bold block">{p.nombre}</span>
                    <span className="text-[9px] text-gray-400 font-mono">Cód: {p.id || p.producto_id}</span>
                  </td>
                  <td className="p-2.5 text-center font-semibold text-gray-700">
                    {formatDetalleCantidades(item)}
                  </td>
                  <td className="p-2.5 text-right font-mono">
                    S/. {Number(item.precio_unitario || p.precio).toFixed(2)}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-gray-900 pr-4">
                    S/. {Number(item.subtotal).toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* RESUMEN DE TOTALES */}
      <div className="flex justify-end mb-6">
        <div className="w-64 border border-gray-300 rounded p-4 space-y-2 bg-gray-50/50 print:bg-white text-xs">
          <div className="flex justify-between text-gray-500 font-medium">
            <span>Subtotal:</span>
            <span className="font-mono">S/. {Number(venta.subtotal).toFixed(2)}</span>
          </div>
          {Number(venta.descuento) > 0 && (
            <div className="flex justify-between text-red-500 font-semibold">
              <span>Descuento:</span>
              <span className="font-mono">- S/. {Number(venta.descuento).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 font-black text-sm text-[#04558C] print:text-black">
            <span>Total a Pagar:</span>
            <span className="font-mono text-base">S/. {Number(venta.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* NOTAS Y OBSERVACIONES */}
      {venta.nota && (
        <div className="border border-gray-300 p-3 rounded bg-amber-50/20 mb-6 text-[10px] text-gray-600 italic">
          <span className="font-bold text-gray-700 block mb-1">Notas del vendedor:</span>
          "{venta.nota}"
        </div>
      )}

      {/* PIE DE PÁGINA COMERCIAL */}
      <div className="text-[9px] text-gray-400 font-semibold text-center border-t pt-4 space-y-1">
        {esCotizacion ? (
          <>
            <p>Esta proforma es un presupuesto de obra referencial y tiene una vigencia máxima de 7 días calendario.</p>
            <p>Los precios pueden variar de acuerdo a disponibilidad de fábrica y lotes de producción.</p>
          </>
        ) : (
          <>
            <p>Revise el material y su tonalidad (lote) antes de firmar la conformidad y proceder con la instalación.</p>
            <p>No se aceptan devoluciones de cajas abiertas ni saldos sueltos de obra.</p>
            <p>¡Gracias por confiar en GRUPO LEDISA!</p>
          </>
        )}
      </div>

    </div>
  )
}
