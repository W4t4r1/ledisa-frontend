'use client'

import { useState, useTransition } from 'react'
import { buscarCliente, guardarCliente, crearNuevaVenta } from './actions'

interface Producto {
  id: string
  nombre: string
  categoria: string
  marca: string
  precio: number
  costo: number
  stock: number
  m2_caja: number
  piezas_sueltas: number
  color?: string
}

interface CartItem {
  producto: Producto
  cantidad_cajas: number
  piezas_sueltas: number
  precio_unitario: number
  costo_unitario: number
  piezas_por_caja: number // Divisor para calcular precio de piezas sueltas
  subtotal: number
}

export default function RegistroVentas({ productos }: { productos: Producto[] }) {
  const [isPending, startTransition] = useTransition()
  
  // Estado de Clientes
  const [documentoBusqueda, setDocumentoBusqueda] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [clienteNoEncontrado, setClienteNoEncontrado] = useState(false)
  const [cargandoCliente, setCargandoCliente] = useState(false)
  
  // Modal nuevo cliente
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false)
  const [formCliente, setFormCliente] = useState({
    tipo_documento: 'DNI' as 'DNI' | 'RUC' | 'CE' | 'OTROS',
    documento: '',
    nombre_razon_social: '',
    celular: '',
    direccion: ''
  })

  // Carrito de ventas
  const [carrito, setCarrito] = useState<CartItem[]>([])
  
  // Búsqueda de productos en el buscador del carrito
  const [busquedaProd, setBusquedaProd] = useState('')
  const [mostrarSugerenciasProd, setMostrarSugerenciasProd] = useState(false)

  // Metadatos de venta
  const [metodoPago, setMetodoPago] = useState<any>('Efectivo')
  const [estadoVenta, setEstadoVenta] = useState<any>('PAGADO')
  const [descuento, setDescuento] = useState(0)
  const [nota, setNota] = useState('')

  // Filtrar productos sugeridos para el carrito
  const productosSugeridos = productos.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) ||
    p.id.toLowerCase().includes(busquedaProd.toLowerCase())
  ).slice(0, 5)

  // Búsqueda de cliente
  const handleBuscarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentoBusqueda.trim()) return

    setCargandoCliente(true)
    setClienteNoEncontrado(false)
    try {
      const res = await buscarCliente(documentoBusqueda)
      if (res) {
        setClienteSeleccionado(res)
      } else {
        setClienteSeleccionado(null)
        setClienteNoEncontrado(true)
        setFormCliente(prev => ({ ...prev, documento: documentoBusqueda }))
      }
    } catch (err: any) {
      alert('❌ Error al buscar cliente: ' + err.message)
    } finally {
      setCargandoCliente(false)
    }
  }

  // Registrar cliente nuevo
  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCliente.documento || !formCliente.nombre_razon_social) {
      alert('Por favor completa los campos obligatorios.')
      return
    }

    startTransition(async () => {
      try {
        const clienteCreado = await guardarCliente(formCliente)
        setClienteSeleccionado(clienteCreado)
        setMostrarModalCliente(false)
        setClienteNoEncontrado(false)
        alert('✅ Cliente registrado exitosamente.')
      } catch (err: any) {
        alert('❌ Error al registrar cliente: ' + err.message)
      }
    })
  }

  // Agregar al carrito
  const agregarAlCarrito = (producto: Producto) => {
    const existe = carrito.find(item => item.producto.id === producto.id)
    if (existe) {
      alert('El producto ya está en el carrito. Modifica su cantidad directamente.')
      return
    }

    const nuevoItem: CartItem = {
      producto,
      cantidad_cajas: producto.m2_caja > 0 ? 1 : 0,
      piezas_sueltas: producto.m2_caja > 0 ? 0 : 1,
      precio_unitario: producto.precio,
      costo_unitario: producto.costo || 0,
      piezas_por_caja: 6, // Estándar para revestimientos
      subtotal: producto.m2_caja > 0 ? parseFloat((producto.m2_caja * producto.precio).toFixed(2)) : producto.precio
    }

    setCarrito([...carrito, nuevoItem])
    setBusquedaProd('')
    setMostrarSugerenciasProd(false)
  }

  // Actualizar cantidad o precio en carrito
  const actualizarItemCarrito = (id: string, campo: keyof CartItem, valor: any) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id !== id) return item

      const temp = { ...item, [campo]: valor }
      
      // Calcular subtotal
      let sub = 0
      if (temp.producto.m2_caja > 0) {
        // Para revestimientos: total de m2 (cajas * m2_caja + piezas * (m2_caja / piezas_por_caja)) * precio_unitario (que es por m2)
        const totalM2 = (temp.cantidad_cajas * temp.producto.m2_caja) + (temp.piezas_sueltas * (temp.producto.m2_caja / (temp.piezas_por_caja || 6)))
        sub = totalM2 * temp.precio_unitario
      } else {
        // Para sanitarios / griferías / etc: stock_directo (usamos piezas_sueltas como cantidad de unidades)
        sub = temp.piezas_sueltas * temp.precio_unitario
      }

      temp.subtotal = parseFloat(sub.toFixed(2))
      return temp
    }))
  }

  const quitarDelCarrito = (id: string) => {
    setCarrito(carrito.filter(item => item.producto.id !== id))
  }

  // Cálculos totales
  const subtotalVenta = parseFloat(carrito.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))
  const totalVenta = parseFloat(Math.max(0, subtotalVenta - descuento).toFixed(2))

  // Enviar venta a base de datos
  const handleGuardarVenta = () => {
    if (carrito.length === 0) {
      alert('Agrega al menos un producto al carrito.')
      return
    }

    // Validar stock si la venta descuenta mercadería
    if (estadoVenta !== 'COTIZACION') {
      for (const item of carrito) {
        const prod = item.producto
        if (prod.m2_caja > 0) {
          if (prod.stock < item.cantidad_cajas || prod.piezas_sueltas < item.piezas_sueltas) {
            alert(`⚠️ Stock insuficiente para ${prod.nombre}. Disponible: ${prod.stock} cjs, ${prod.piezas_sueltas} pzs.`);
            return
          }
        } else {
          // Unidades
          if (prod.stock < item.piezas_sueltas) {
            alert(`⚠️ Stock insuficiente para ${prod.nombre}. Disponible: ${prod.stock} unidades.`);
            return
          }
        }
      }
    }

    startTransition(async () => {
      try {
        const payload = {
          cliente_id: clienteSeleccionado ? clienteSeleccionado.id : null,
          subtotal: subtotalVenta,
          descuento: descuento,
          total: totalVenta,
          metodo_pago: metodoPago,
          estado: estadoVenta,
          nota: nota.trim() || undefined,
          items: carrito.map(item => ({
            producto_id: item.producto.id,
            cantidad_cajas: item.cantidad_cajas,
            piezas_sueltas: item.piezas_sueltas,
            precio_unitario: item.precio_unitario,
            costo_unitario: item.costo_unitario,
            piezas_por_caja: item.piezas_por_caja,
            subtotal: item.subtotal
          }))
        }

        const codigoGenerado = await crearNuevaVenta(payload)
        alert(`✅ Venta guardada con éxito. Código de Operación: ${codigoGenerado}`)
        
        // Resetear formulario
        setCarrito([])
        setClienteSeleccionado(null)
        setDocumentoBusqueda('')
        setDescuento(0)
        setNota('')
      } catch (err: any) {
        alert('❌ Error al procesar la venta: ' + err.message)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* SECCIÓN IZQUIERDA: CLIENTE Y CARRITO */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* PANEL CRM: CLIENTE */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>👤</span> Identificación del Cliente
          </h3>

          <form onSubmit={handleBuscarCliente} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Buscar DNI o RUC del cliente..."
              value={documentoBusqueda}
              onChange={e => setDocumentoBusqueda(e.target.value)}
              className="flex-1 border border-gray-300 p-2.5 rounded text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
            />
            <button 
              type="submit" 
              disabled={cargandoCliente}
              className="bg-[#04558C] hover:bg-[#033f6b] text-white px-4 py-2.5 rounded font-bold transition-colors disabled:opacity-50"
            >
              {cargandoCliente ? '🔍 Buscando...' : 'Buscar'}
            </button>
          </form>

          {/* Estado de cliente encontrado */}
          {clienteSeleccionado && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded flex justify-between items-center">
              <div>
                <p className="text-xs text-green-700 font-bold uppercase tracking-wider">Cliente Seleccionado</p>
                <p className="text-sm font-bold text-gray-800">{clienteSeleccionado.nombre_razon_social}</p>
                <p className="text-xs text-gray-500">{clienteSeleccionado.tipo_documento}: {clienteSeleccionado.documento}</p>
              </div>
              <button 
                onClick={() => setClienteSeleccionado(null)}
                className="text-red-500 hover:text-red-700 text-xs font-bold"
              >
                Quitar
              </button>
            </div>
          )}

          {/* Cliente no encontrado */}
          {clienteNoEncontrado && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded flex justify-between items-center">
              <div>
                <p className="text-xs text-amber-700 font-bold">⚠️ EL CLIENTE NO EXISTE</p>
                <p className="text-xs text-gray-500">¿Deseas registrar este documento en la base de datos?</p>
              </div>
              <button 
                onClick={() => {
                  setFormCliente({ ...formCliente, documento: documentoBusqueda })
                  setMostrarModalCliente(true)
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
              >
                + Registrar Cliente
              </button>
            </div>
          )}
        </div>

        {/* PANEL DE PRODUCTOS / CARRITO */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📦</span> Carrito de Compra
          </h3>

          {/* Buscador de productos rápido */}
          <div className="relative mb-6">
            <input 
              type="text"
              placeholder="🔍 Escribe el nombre o código de producto para agregar..."
              value={busquedaProd}
              onChange={e => {
                setBusquedaProd(e.target.value)
                setMostrarSugerenciasProd(true)
              }}
              onFocus={() => setMostrarSugerenciasProd(true)}
              className="w-full border border-gray-300 p-2.5 rounded text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
            />

            {/* Listado de sugerencias flotantes */}
            {mostrarSugerenciasProd && busquedaProd.trim() !== '' && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto divide-y">
                {productosSugeridos.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500 italic">No se encontraron productos.</p>
                ) : (
                  productosSugeridos.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => agregarAlCarrito(p)}
                      className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-gray-800">{p.nombre}</p>
                        <p className="text-xs text-gray-500 font-mono">Cód: {p.id} | Marca: {p.marca}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#04558C]">S/. {p.precio}</p>
                        <p className="text-[10px] text-gray-400">
                          {p.m2_caja > 0 
                            ? `Stock: ${p.stock} cjs / ${p.piezas_sueltas} pzs` 
                            : `Stock: ${p.stock} und`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Lista del carrito */}
          {carrito.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg border-gray-300">
              <p className="text-gray-400 font-medium">El carrito está vacío. Agrega productos arriba.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden md:grid grid-cols-12 text-xs font-bold text-gray-400 uppercase pb-2 border-b">
                <div className="col-span-5">Producto</div>
                <div className="col-span-3 text-center">Cantidades</div>
                <div className="col-span-2 text-right">Precio Unit.</div>
                <div className="col-span-2 text-right">Subtotal</div>
              </div>
              
              <div className="divide-y divide-gray-100">
                {carrito.map(item => {
                  const p = item.producto
                  const esRecubrimiento = p.m2_caja > 0

                  return (
                    <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-0 py-4 items-center">
                      
                      {/* Columna Producto */}
                      <div className="col-span-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm">{p.nombre}</span>
                          <span className="text-xs text-gray-400 font-mono">Cód: {p.id}</span>
                          
                          {/* Costo de Adquisición */}
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                            <span className="font-semibold text-gray-400 uppercase text-[9px]">Costo: S/.</span>
                            <input 
                              type="number"
                              step="0.01"
                              value={item.costo_unitario}
                              onChange={e => actualizarItemCarrito(p.id, 'costo_unitario', parseFloat(e.target.value) || 0)}
                              className="border text-center w-16 p-0.5 rounded text-[11px] text-gray-700 bg-white"
                            />
                          </div>

                          {esRecubrimiento && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded w-max mt-1.5">
                              Rendimiento: {p.m2_caja} m²/caja
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Columna Cantidades */}
                      <div className="col-span-3">
                        <div className="flex flex-col gap-1 items-center">
                          {esRecubrimiento ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <div className="flex flex-col items-center">
                                  <label className="text-[9px] font-bold text-gray-400 uppercase">Cajas</label>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={item.cantidad_cajas}
                                    onChange={e => actualizarItemCarrito(p.id, 'cantidad_cajas', parseInt(e.target.value) || 0)}
                                    className="border text-center w-14 p-1 rounded text-sm text-gray-900 bg-white"
                                  />
                                </div>
                                <span className="text-gray-400 mt-3">+</span>
                                <div className="flex flex-col items-center">
                                  <label className="text-[9px] font-bold text-gray-400 uppercase">Pzs</label>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={item.piezas_sueltas}
                                    onChange={e => actualizarItemCarrito(p.id, 'piezas_sueltas', parseInt(e.target.value) || 0)}
                                    className="border text-center w-14 p-1 rounded text-sm text-gray-900 bg-white"
                                  />
                                </div>
                              </div>
                              {/* Divisor de piezas por caja */}
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[9px] text-gray-400 font-semibold">Pzs por caja:</span>
                                <input 
                                  type="number" 
                                  min="1"
                                  value={item.piezas_por_caja}
                                  onChange={e => actualizarItemCarrito(p.id, 'piezas_por_caja', parseInt(e.target.value) || 1)}
                                  className="border text-center w-9 p-0.5 rounded text-[10px] text-gray-700 bg-white"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Cantidad</label>
                              <input 
                                type="number" 
                                min="1"
                                value={item.piezas_sueltas}
                                onChange={e => actualizarItemCarrito(p.id, 'piezas_sueltas', parseInt(e.target.value) || 0)}
                                className="border text-center w-16 p-1 rounded text-sm text-gray-900 bg-white"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Columna Precio */}
                      <div className="col-span-2 text-right">
                        <div className="flex flex-col md:items-end justify-center">
                          <label className="md:hidden text-[9px] font-bold text-gray-400 uppercase">Precio</label>
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-xs text-gray-500">S/.</span>
                            <input 
                              type="number" 
                              step="0.01"
                              value={item.precio_unitario}
                              onChange={e => actualizarItemCarrito(p.id, 'precio_unitario', parseFloat(e.target.value) || 0)}
                              className="border text-right w-16 p-1 rounded text-sm font-bold text-gray-900 bg-white"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Columna Subtotal & Quitar */}
                      <div className="col-span-2 text-right flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2">
                        <span className="md:hidden text-xs font-bold text-gray-400 uppercase">Subtotal</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-800">S/. {item.subtotal}</span>
                          <button 
                            onClick={() => quitarDelCarrito(p.id)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                            title="Quitar producto"
                          >
                            ❌
                          </button>
                        </div>
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DERECHA: RESUMEN DE PAGO */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-between h-full">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">
              🧾 Resumen y Operación
            </h3>

            <div className="space-y-4">
              
              {/* Método de pago */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Método de Pago</label>
                <select 
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value)}
                  className="w-full border p-2.5 rounded bg-white text-gray-900 focus:outline-none"
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Yape/Plin">📱 Yape/Plin</option>
                  <option value="Transferencia BCP">🏦 Transferencia BCP</option>
                  <option value="Transferencia Interbancaria">🏦 Transf. Interbancaria</option>
                  <option value="Tarjeta Credito/Debito">💳 Tarjeta Crédito/Débito</option>
                  <option value="Credito">🕒 Crédito Comercial</option>
                  <option value="Sin Especificar">Otros</option>
                </select>
              </div>

              {/* Estado de la venta */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Tipo de Registro (Estado)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEstadoVenta('PAGADO')}
                    className={`p-2 rounded text-xs font-bold border transition-colors ${estadoVenta === 'PAGADO' ? 'bg-green-600 border-green-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    🔴 COMPRA (Descuenta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEstadoVenta('COTIZACION')}
                    className={`p-2 rounded text-xs font-bold border transition-colors ${estadoVenta === 'COTIZACION' ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    📝 COTIZACIÓN (No desc.)
                  </button>
                </div>
              </div>

              {/* Descuento */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Descuento Especial (S/.)</label>
                <input 
                  type="number" 
                  min="0"
                  step="0.1"
                  value={descuento}
                  onChange={e => setDescuento(parseFloat(e.target.value) || 0)}
                  className="w-full border p-2 rounded text-gray-900 bg-white"
                />
              </div>

              {/* Nota de la Venta */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Notas / Observaciones (Opcional)</label>
                <textarea 
                  rows={3}
                  placeholder="Ej: Entrega a obra el viernes por la tarde..."
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  className="w-full border p-2 rounded text-gray-900 bg-white text-sm focus:outline-none"
                />
              </div>

            </div>
          </div>

          {/* Totales y acción */}
          <div className="mt-8 pt-4 border-t border-gray-100 space-y-4">
            <div className="flex justify-between items-center text-sm font-semibold text-gray-500">
              <span>Subtotal:</span>
              <span>S/. {subtotalVenta.toFixed(2)}</span>
            </div>
            
            {descuento > 0 && (
              <div className="flex justify-between items-center text-sm font-semibold text-red-500">
                <span>Descuento:</span>
                <span>- S/. {descuento.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-base font-bold text-gray-800">Total a Pagar:</span>
              <span className="text-3xl font-black text-[#04558C]">
                S/. {totalVenta.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleGuardarVenta}
              disabled={isPending}
              className={`w-full text-white font-bold py-3 px-4 rounded shadow-md transition-colors text-center cursor-pointer ${
                estadoVenta === 'COTIZACION' 
                  ? 'bg-amber-500 hover:bg-amber-600' 
                  : 'bg-green-600 hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {isPending ? '⏳ Procesando...' : estadoVenta === 'COTIZACION' ? '💾 Guardar Cotización' : '🛒 Registrar Venta'}
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL PARA REGISTRAR NUEVO CLIENTE --- */}
      {mostrarModalCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">➕ Registrar Nuevo Cliente</h3>
            
            <form onSubmit={handleCrearCliente} className="space-y-4 text-gray-900">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Tipo de Documento*</label>
                <select 
                  value={formCliente.tipo_documento}
                  onChange={e => setFormCliente({ ...formCliente, tipo_documento: e.target.value as any })}
                  className="w-full border p-2 rounded bg-white text-gray-900"
                >
                  <option value="DNI">DNI (Persona Física)</option>
                  <option value="RUC">RUC (Empresa / Jurídico)</option>
                  <option value="CE">CE (Carnet de Extranjería)</option>
                  <option value="OTROS">Otros</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Número de Documento*</label>
                <input 
                  type="text" 
                  required
                  value={formCliente.documento}
                  onChange={e => setFormCliente({ ...formCliente, documento: e.target.value })}
                  className="w-full border p-2 rounded text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Nombre Completo o Razón Social*</label>
                <input 
                  type="text" 
                  required
                  value={formCliente.nombre_razon_social}
                  onChange={e => setFormCliente({ ...formCliente, nombre_razon_social: e.target.value })}
                  className="w-full border p-2 rounded text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Celular / Teléfono (Opcional)</label>
                <input 
                  type="text" 
                  value={formCliente.celular}
                  onChange={e => setFormCliente({ ...formCliente, celular: e.target.value })}
                  className="w-full border p-2 rounded text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Dirección (Opcional)</label>
                <input 
                  type="text" 
                  value={formCliente.direccion}
                  onChange={e => setFormCliente({ ...formCliente, direccion: e.target.value })}
                  className="w-full border p-2 rounded text-gray-900 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setMostrarModalCliente(false)}
                  className="px-4 py-2 border rounded text-gray-600 font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="px-4 py-2 bg-[#04558C] text-white rounded font-bold hover:bg-[#033f6b] disabled:opacity-50"
                >
                  💾 Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
