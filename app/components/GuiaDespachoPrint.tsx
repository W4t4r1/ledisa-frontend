// app/components/GuiaDespachoPrint.tsx
import React from 'react'

interface GuiaDespachoPrintProps {
  venta: {
    codigo_venta: string
    fecha: string
    metodo_pago: string
    subtotal: number
    descuento: number
    total: number
    nota?: string | null
    estado: string
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

export default function GuiaDespachoPrint({ venta }: GuiaDespachoPrintProps) {
  if (!venta) return null

  const items = venta.items || []

  // Calcular cantidades legibles
  const formatDetalleCantidades = (item: any) => {
    const p = item.producto || item.inventario || item
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
  }

  return (
    <div id="print-area-guia" className="bg-white text-black p-8 font-sans max-w-2xl mx-auto border border-gray-300 shadow-sm print:border-none print:shadow-none text-xs leading-relaxed">
      
      {/* CABECERA DE LA EMPRESA */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#04558C] print:text-black">GRUPO LEDISA S.A.C.</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">ORDEN DE DESPACHO Y GUÍA DE REMISIÓN INTERNA</p>
          <p className="mt-2 text-gray-600 font-medium">Av. Héroes de la Patria 520, San Juan de Lurigancho - Lima</p>
          <p className="text-gray-600">Cel: +51 987 654 321 | Almacén: almacen@ledisa.pe</p>
        </div>
        
        {/* TÍTULO DE LA GUÍA */}
        <div className="border-2 border-black p-4 text-center min-w-56 bg-gray-50 print:bg-white rounded">
          <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">R.U.C. 20601234567</p>
          <h2 className="text-base font-black uppercase tracking-wide my-1">
            GUÍA DE DESPACHO
          </h2>
          <p className="text-sm font-black font-mono text-[#04558C] print:text-black">N° G-{venta.codigo_venta}</p>
        </div>
      </div>

      {/* INFORMACIÓN DEL CLIENTE Y PUNTO DE RETIRO */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-4 rounded mb-6 bg-gray-50/50 print:bg-white">
        <div className="space-y-1">
          <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Cliente / Destinatario:</span> 
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
          <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Venta Referencia:</span> 
            <span className="font-mono font-bold text-gray-800">{venta.codigo_venta}</span>
          </p>
          {venta.clientes?.direccion && (
            <p><span className="font-bold text-gray-500 uppercase text-[9px] block">Punto de Entrega:</span> 
              <span className="font-medium text-gray-700">{venta.clientes.direccion}</span>
            </p>
          )}
        </div>
      </div>

      {/* INSTRUCCIÓN PARA EL ALMACENERO */}
      <div className="bg-amber-50 border border-amber-300 p-2.5 rounded mb-4 text-[10px] text-amber-900 font-medium">
        <span>📍 <strong>Instrucción de Almacén:</strong> Ubique las cajas según el mapa de cuartos y verifique el lote/tono antes de entregar.</span>
      </div>

      {/* TABLA DE PRODUCTOS A PICKING CON UBICACIONES FÍSICAS */}
      <div className="border border-gray-300 rounded overflow-hidden mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-gray-600 font-bold uppercase text-[9px] tracking-wider">
              <th className="p-2.5 pl-4">📍 Ubicación Física</th>
              <th className="p-2.5">Código / Producto</th>
              <th className="p-2.5 font-mono">Metadatos (Lote/Tono)</th>
              <th className="p-2.5 text-center">Cantidades a Entregar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-[11px] text-gray-800">
            {items.map((item: any, idx: number) => {
              const p = item.producto || item.inventario || item
              const ubicacion = p?.ubicacion_fisica || 'Sin Especificar'

              return (
                <tr key={idx} className="hover:bg-gray-50/20">
                  <td className="p-2.5 pl-4">
                    <span className="font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded inline-block text-[11px]">
                      📍 {ubicacion}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className="font-bold block text-gray-900">{p.nombre || item.producto_id}</span>
                    <span className="text-[9px] text-gray-400 font-mono">Cód: {p.id || item.producto_id}</span>
                  </td>
                  <td className="p-2.5 font-mono text-[10px] text-gray-600">
                    {item.lote ? `Lote: ${item.lote} ` : ''}
                    {item.tono ? `Tono: ${item.tono} ` : ''}
                    {item.calibre ? `Cal: ${item.calibre}` : ''}
                    {!item.lote && !item.tono && !item.calibre && '—'}
                  </td>
                  <td className="p-2.5 text-center font-bold text-base text-gray-900">
                    {formatDetalleCantidades(item)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* OBSERVACIONES */}
      {venta.nota && (
        <div className="border border-gray-300 p-3 rounded bg-gray-50 mb-8 text-[10px] text-gray-600 italic">
          <span className="font-bold text-gray-700 block mb-1">Notas de la Orden:</span>
          "{venta.nota}"
        </div>
      )}

      {/* CONFORMIDAD Y FIRMAS DE ENTREGA */}
      <div className="grid grid-cols-2 gap-12 pt-8 border-t-2 border-dashed border-gray-300 mt-12 text-[10px] text-gray-600 text-center">
        <div>
          <div className="border-b border-black mb-2 h-12"></div>
          <p className="font-bold text-gray-800">Despachado por (Almacenero)</p>
          <p className="text-[9px] text-gray-400">Firma y Nombre del Encargado</p>
        </div>
        <div>
          <div className="border-b border-black mb-2 h-12"></div>
          <p className="font-bold text-gray-800">Recibido Conforme (Cliente / Chofer)</p>
          <p className="text-[9px] text-gray-400">DNI / Firma de Conformidad</p>
        </div>
      </div>

    </div>
  )
}
