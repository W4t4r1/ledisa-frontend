// app/admin/compras/WorkspaceCompras.tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import { guardarProveedor, buscarProveedor, crearCompra, obtenerDetalleDeCompra, buscarProveedores, buscarDniRucPeru } from './actions'
import { Proveedor, CompraData, ItemCompra } from '../../lib/compras.service'
import { obtenerSeccionProducto } from '../../components/CatalogoInteractivo'

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
  color?: string | null
}

interface CartItemCompra {
  producto: Producto
  cantidad_cajas: number
  piezas_sueltas: number
  costo_unitario: number
  piezas_por_caja: number // Divisor estándar para piezas sueltas (por defecto 6)
  subtotal: number
}

interface WorkspaceComprasProps {
  inventario: Producto[]
  proveedoresIniciales: Proveedor[]
  comprasIniciales: any[]
}

export default function WorkspaceCompras({ inventario, proveedoresIniciales, comprasIniciales }: WorkspaceComprasProps) {
  const [tabActiva, setTabActiva] = useState<'registrar' | 'historial' | 'proveedores'>('registrar')
  const [isPending, startTransition] = useTransition()

  // --- 1. CONFIGURACIÓN DEL ESTADO DE PROVEEDORES ---
  const [proveedores, setProveedores] = useState<Proveedor[]>(proveedoresIniciales)
  const [busquedaProv, setBusquedaProv] = useState('')
  
  // Estados para búsqueda predictiva de proveedores
  const [proveedoresSugeridos, setProveedoresSugeridos] = useState<any[]>([])
  const [mostrarSugerenciasProveedor, setMostrarSugerenciasProveedor] = useState(false)
  const [consultandoSunat, setConsultandoSunat] = useState(false)
  
  useEffect(() => {
    setProveedores(proveedoresIniciales)
  }, [proveedoresIniciales])

  // --- 2. CONFIGURACIÓN DEL ESTADO DE COMPRAS ---
  const [compras, setCompras] = useState<any[]>(comprasIniciales)
  const [busquedaComp, setBusquedaComp] = useState('')

  useEffect(() => {
    setCompras(comprasIniciales)
  }, [comprasIniciales])

  // --- 3. REGISTRAR COMPRA (ESTADOS) ---
  const [documentoBusqueda, setDocumentoBusqueda] = useState('')
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null)
  const [proveedorNoEncontrado, setProveedorNoEncontrado] = useState(false)
  const [cargandoProveedor, setCargandoProveedor] = useState(false)

  // Formulario nuevo proveedor
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false)
  const [esEdicionProv, setEsEdicionProv] = useState(false)
  const [formProveedor, setFormProveedor] = useState<Proveedor>({
    tipo_documento: 'RUC',
    documento: '',
    razon_social: '',
    celular: '',
    direccion: ''
  })

  // Carrito de compras
  const [carrito, setCarrito] = useState<CartItemCompra[]>([])
  const [busquedaProd, setBusquedaProd] = useState('')
  const [mostrarSugerenciasProd, setMostrarSugerenciasProd] = useState(false)

  // Cabecera factura de compra
  const [numeroFactura, setNumeroFactura] = useState('')
  const [metodoPago, setMetodoPago] = useState<any>('Transferencia BCP')
  const [nota, setNota] = useState('')

  // Sugerencias de productos para el carrito de compras
  const productosSugeridos = inventario.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) ||
    p.id.toLowerCase().includes(busquedaProd.toLowerCase())
  ).slice(0, 5)

  // --- 4. DETALLES DE COMPRA (MODAL) ---
  const [compraSeleccionada, setCompraSeleccionada] = useState<any | null>(null)
  const [detallesCompra, setDetallesCompra] = useState<any[] | null>(null)
  const [cargandoDetalles, setCargandoDetalles] = useState(false)

  // Helper para determinar el sufijo de las piezas de un producto según las reglas de negocio
  const getUnitLabel = (producto: any) => {
    if (!producto) return 'und'
    const seccion = obtenerSeccionProducto(producto)
    if (['mayolicas_porcelanatos', 'saldos', 'decoraciones'].includes(seccion)) {
      return 'pzs'
    }
    return 'und'
  }

  // Búsqueda de proveedor al enviar formulario (Enter)
  const handleBuscarProveedor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentoBusqueda.trim()) return

    setCargandoProveedor(true)
    setProveedorNoEncontrado(false)
    setMostrarSugerenciasProveedor(false)
    try {
      const res = await buscarProveedores(documentoBusqueda)
      if (res && res.length > 0) {
        const exactMatch = res.find(p => p.documento.trim() === documentoBusqueda.trim())
        if (exactMatch) {
          setProveedorSeleccionado(exactMatch)
          setDocumentoBusqueda(exactMatch.razon_social)
        } else if (res.length === 1) {
          setProveedorSeleccionado(res[0])
          setDocumentoBusqueda(res[0].razon_social)
        } else {
          setProveedoresSugeridos(res)
          setMostrarSugerenciasProveedor(true)
        }
      } else {
        setProveedorSeleccionado(null)
        setProveedorNoEncontrado(true)
        setFormProveedor(prev => ({ 
          ...prev, 
          documento: /^\d+$/.test(documentoBusqueda) ? documentoBusqueda : '', 
          tipo_documento: documentoBusqueda.length === 11 ? 'RUC' : 'DNI',
          razon_social: '',
          celular: '',
          direccion: ''
        }))
      }
    } catch (err: any) {
      alert('❌ Error al buscar proveedor: ' + err.message)
    } finally {
      setCargandoProveedor(false)
    }
  }

  // Búsqueda interactiva conforme escribe
  const handleBuscarProveedorText = async (val: string) => {
    setDocumentoBusqueda(val)
    if (val.trim().length >= 3) {
      try {
        const res = await buscarProveedores(val)
        setProveedoresSugeridos(res)
        setMostrarSugerenciasProveedor(true)
      } catch (err) {
        // Silencioso
      }
    } else {
      setProveedoresSugeridos([])
      setMostrarSugerenciasProveedor(false)
    }
  }

  // Guardar Proveedor (Crear/Editar)
  const handleGuardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formProveedor.documento || !formProveedor.razon_social) {
      alert('Por favor completa los campos obligatorios.')
      return
    }

    startTransition(async () => {
      try {
        const guardado = await guardarProveedor(formProveedor, esEdicionProv)
        
        // Si estábamos en el flujo de registrar compra, lo seleccionamos directamente
        if (tabActiva === 'registrar') {
          setProveedorSeleccionado(guardado)
          setProveedorNoEncontrado(false)
        }
        
        setMostrarModalProveedor(false)
        alert(`✅ Proveedor ${esEdicionProv ? 'actualizado' : 'registrado'} exitosamente.`)
      } catch (err: any) {
        alert('❌ Error al guardar proveedor: ' + err.message)
      }
    })
  }

  // Agregar producto al carrito de compras
  const agregarAlCarrito = (producto: Producto) => {
    const existe = carrito.find(item => item.producto.id === producto.id)
    if (existe) {
      alert('El producto ya está en el listado de compra. Modifica la cantidad directamente.')
      return
    }

    const nuevoItem: CartItemCompra = {
      producto,
      cantidad_cajas: producto.m2_caja > 0 ? 10 : 0, // Por defecto 10 cajas o 10 unidades
      piezas_sueltas: producto.m2_caja > 0 ? 0 : 10,
      costo_unitario: producto.costo || 0,
      piezas_por_caja: 6,
      subtotal: producto.m2_caja > 0 
        ? parseFloat((10 * producto.m2_caja * (producto.costo || 0)).toFixed(2)) 
        : parseFloat((10 * (producto.costo || 0)).toFixed(2))
    }

    setCarrito([...carrito, nuevoItem])
    setBusquedaProd('')
    setMostrarSugerenciasProd(false)
  }

  // Actualizar cantidades o costos en carrito
  const actualizarItemCarrito = (id: string, campo: keyof CartItemCompra, valor: any) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id !== id) return item

      const temp = { ...item, [campo]: valor }
      
      // Calcular subtotal de compra
      let sub = 0
      if (temp.producto.m2_caja > 0) {
        // Para revestimientos: total de m2 (cajas * m2_caja + piezas * (m2_caja / piezas_por_caja)) * costo_unitario (que es por m2)
        const totalM2 = (temp.cantidad_cajas * temp.producto.m2_caja) + (temp.piezas_sueltas * (temp.producto.m2_caja / (temp.piezas_por_caja || 6)))
        sub = totalM2 * temp.costo_unitario
      } else {
        // Unidades sueltas
        sub = temp.piezas_sueltas * temp.costo_unitario
      }

      temp.subtotal = parseFloat(sub.toFixed(2))
      return temp
    }))
  }

  // Actualizar ambas cantidades calculadas por m2
  const actualizarCantidadesM2 = (id: string, cajas: number, piezas: number) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id !== id) return item

      const temp = { ...item, cantidad_cajas: cajas, piezas_sueltas: piezas }
      
      // Calcular subtotal de compra
      let sub = 0
      if (temp.producto.m2_caja > 0) {
        const totalM2 = (cajas * temp.producto.m2_caja) + (piezas * (temp.producto.m2_caja / (temp.piezas_por_caja || 6)))
        sub = totalM2 * temp.costo_unitario
      } else {
        sub = piezas * temp.costo_unitario
      }

      temp.subtotal = parseFloat(sub.toFixed(2))
      return temp
    }))
  }

  const quitarDelCarrito = (id: string) => {
    setCarrito(carrito.filter(item => item.producto.id !== id))
  }

  // Totales
  const totalCompra = parseFloat(carrito.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2))

  // Registrar compra formalmente
  const handleRegistrarCompra = () => {
    if (!proveedorSeleccionado) {
      alert('Por favor selecciona o registra un proveedor.')
      return
    }

    if (!numeroFactura.trim()) {
      alert('Por favor ingresa el número de comprobante/factura del proveedor.')
      return
    }

    if (carrito.length === 0) {
      alert('Agrega al menos un producto a la compra.')
      return
    }

    startTransition(async () => {
      try {
        const payload: CompraData = {
          proveedor_id: proveedorSeleccionado.id || null,
          numero_factura: numeroFactura.trim(),
          total: totalCompra,
          metodo_pago: metodoPago,
          nota: nota.trim() || undefined,
          items: carrito.map(item => ({
            producto_id: item.producto.id,
            cantidad_cajas: item.cantidad_cajas,
            piezas_sueltas: item.piezas_sueltas,
            costo_unitario: item.costo_unitario,
            subtotal: item.subtotal
          }))
        }

        const codigoGenerado = await crearCompra(payload)
        alert(`✅ Compra registrada con éxito. Código de Operación: ${codigoGenerado}\nSe incrementó el stock en almacén y se actualizaron los costos.`)
        
        // Limpiar formulario
        setCarrito([])
        setProveedorSeleccionado(null)
        setDocumentoBusqueda('')
        setNumeroFactura('')
        setNota('')
      } catch (err: any) {
        alert('❌ Error al registrar la compra: ' + err.message)
      }
    })
  }

  // Cargar detalles de una compra del historial
  const handleVerDetallesCompra = (compra: any) => {
    setCompraSeleccionada(compra)
    setDetallesCompra(null)
    setCargandoDetalles(true)

    startTransition(async () => {
      try {
        const res = await obtenerDetalleDeCompra(compra.id)
        setDetallesCompra(res)
      } catch (err: any) {
        alert('❌ Error al cargar detalles de la compra: ' + err.message)
      } finally {
        setCargandoDetalles(false)
      }
    })
  }

  // Filtrado de Proveedores en Directorio
  const proveedoresFiltrados = proveedores.filter(p => {
    const q = busquedaProv.toLowerCase().trim()
    return p.razon_social.toLowerCase().includes(q) || p.documento.includes(q)
  })

  // Filtrado del Historial de Compras
  const comprasFiltradas = compras.filter(c => {
    const q = busquedaComp.toLowerCase().trim()
    return (
      c.codigo_compra.toLowerCase().includes(q) ||
      c.numero_factura.toLowerCase().includes(q) ||
      (c.proveedores?.razon_social && c.proveedores.razon_social.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      
      {/* NAVEGACIÓN DE TABS */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTabActiva('registrar')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'registrar'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📥 Registrar Compra (Factura)
        </button>
        <button
          onClick={() => setTabActiva('historial')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'historial'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📊 Historial de Compras
        </button>
        <button
          onClick={() => setTabActiva('proveedores')}
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            tabActiva === 'proveedores'
              ? 'border-[#04558C] text-[#04558C]'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          🚚 Directorio de Proveedores
        </button>
      </div>

      {/* CONTENIDO DE TABS */}
      <div className="transition-all duration-200">
        
        {/* --- TAB 1: REGISTRAR COMPRA --- */}
        {tabActiva === 'registrar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* SECCIÓN IZQUIERDA: PROVEEDOR Y ARTÍCULOS */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Identificación del Proveedor */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🏢</span> Identificación del Proveedor
                </h3>

                <div className="relative">
                  <form onSubmit={handleBuscarProveedor} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Buscar por Razón Social, DNI o RUC del proveedor..."
                      value={documentoBusqueda}
                      onChange={e => handleBuscarProveedorText(e.target.value)}
                      onFocus={() => {
                        if (documentoBusqueda.trim().length >= 3) {
                          setMostrarSugerenciasProveedor(true)
                        }
                      }}
                      className="flex-1 border border-gray-300 p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
                    />
                    <button 
                      type="submit" 
                      disabled={cargandoProveedor}
                      className="bg-[#04558C] hover:bg-[#033f6b] text-white px-5 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {cargandoProveedor ? '🔍 Buscando...' : 'Buscar'}
                    </button>
                  </form>

                  {/* Listado de sugerencias flotantes de proveedores */}
                  {mostrarSugerenciasProveedor && proveedoresSugeridos.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-60 overflow-y-auto divide-y text-xs text-gray-900">
                      {proveedoresSugeridos.map(prov => (
                        <button
                          key={prov.id}
                          type="button"
                          onClick={() => {
                            setProveedorSeleccionado(prov)
                            setDocumentoBusqueda(prov.razon_social)
                            setMostrarSugerenciasProveedor(false)
                            setProveedorNoEncontrado(false)
                          }}
                          className="w-full text-left p-3 hover:bg-blue-50 transition-colors flex justify-between items-center cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-gray-800">{prov.razon_social}</p>
                            <p className="text-[10px] text-gray-400 font-semibold">{prov.tipo_documento}: {prov.documento}</p>
                          </div>
                          <span className="text-gray-400 font-bold text-[10px]">SELECCIONAR ➔</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Proveedor Seleccionado */}
                {proveedorSeleccionado && (
                  <div className="mt-4 p-3.5 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs text-green-700 font-bold uppercase tracking-wider">Proveedor Seleccionado</p>
                      <p className="text-sm font-bold text-gray-800">{proveedorSeleccionado.razon_social}</p>
                      <p className="text-xs text-gray-500">{proveedorSeleccionado.tipo_documento}: {proveedorSeleccionado.documento} {proveedorSeleccionado.celular ? `| Tel: ${proveedorSeleccionado.celular}` : ''}</p>
                    </div>
                    <button 
                      onClick={() => setProveedorSeleccionado(null)}
                      className="text-red-500 hover:text-red-700 text-xs font-bold hover:underline cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                )}

                {/* Proveedor no encontrado */}
                {proveedorNoEncontrado && (
                  <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs text-amber-700 font-bold">⚠️ EL PROVEEDOR NO EXISTE</p>
                      <p className="text-xs text-gray-500">¿Deseas registrar este documento en la base de datos de proveedores?</p>
                    </div>
                    <button 
                      onClick={() => {
                        setFormProveedor({ ...formProveedor, documento: documentoBusqueda, tipo_documento: documentoBusqueda.length === 11 ? 'RUC' : 'DNI', razon_social: '', celular: '', direccion: '' })
                        setEsEdicionProv(false)
                        setMostrarModalProveedor(true)
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      + Registrar Proveedor
                    </button>
                  </div>
                )}
              </div>

              {/* Listado de Artículos a Comprar */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📦</span> Artículos de la Compra
                </h3>

                {/* Buscador predictivo rápido */}
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
                    className="w-full border border-gray-300 p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
                  />

                  {/* Sugerencias flotantes */}
                  {mostrarSugerenciasProd && busquedaProd.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto divide-y">
                      {productosSugeridos.length === 0 ? (
                        <p className="p-3 text-sm text-gray-500 italic">No se encontraron productos.</p>
                      ) : (
                        productosSugeridos.map(p => (
                          <div 
                            key={p.id}
                            onClick={() => agregarAlCarrito(p)}
                            className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors text-xs"
                          >
                            <div>
                              <p className="font-bold text-gray-800">{p.nombre}</p>
                              <p className="text-gray-400 font-mono">Cód: {p.id} | Marca: {p.marca}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#04558C]">Costo Catálogo: S/. {p.costo || '0.00'}</p>
                              <p className="text-[10px] text-gray-400">
                                Stock: {p.stock} cjs {p.piezas_sueltas > 0 ? `+ ${p.piezas_sueltas} pzs` : ''}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Carrito de Compras */}
                {carrito.length === 0 ? (
                  <div className="text-center py-10 border border-dashed rounded-lg border-gray-300">
                    <p className="text-gray-400 font-medium">El listado está vacío. Busca y agrega productos arriba.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="hidden md:grid grid-cols-12 text-xs font-bold text-gray-400 uppercase pb-2 border-b">
                      <div className="col-span-4">Producto</div>
                      <div className="col-span-4 text-center">Cantidades</div>
                      <div className="col-span-2 text-right">Costo Compra</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                      {carrito.map(item => {
                        const p = item.producto
                        const esRecubrimiento = p.m2_caja > 0

                        return (
                          <div key={p.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-0 py-4 items-center text-xs">
                            
                            {/* Columna Producto */}
                            <div className="col-span-4 flex flex-col">
                              <span className="font-bold text-gray-800 text-sm">{p.nombre}</span>
                              <span className="text-[10px] text-gray-400 font-mono">Cód: {p.id} {p.marca ? `| Marca: ${p.marca}` : ''}</span>
                              {esRecubrimiento && (
                                <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded w-max mt-1">
                                  Rendimiento: {p.m2_caja} m²/caja
                                </span>
                              )}
                            </div>

                            {/* Columna Cantidades */}
                            <div className="col-span-4">
                              <div className="flex flex-col gap-1 items-center">
                                {esRecubrimiento ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      {/* Metro Cuadrado Solicitado */}
                                      <div className="flex flex-col items-center">
                                        <label className="text-[9px] font-bold text-[#04558C] uppercase">M² Req.</label>
                                        <input 
                                          type="number" 
                                          step="0.01"
                                          min="0"
                                          placeholder="Ej: 10"
                                          value={parseFloat(((item.cantidad_cajas * p.m2_caja) + (item.piezas_sueltas * (p.m2_caja / (item.piezas_por_caja || 6)))).toFixed(2)) || ''}
                                          onChange={e => {
                                            const m2Val = parseFloat(e.target.value) || 0
                                            if (m2Val >= 0) {
                                              const m2Caja = p.m2_caja
                                              const piezasCaja = item.piezas_por_caja || 6
                                              const cajas = Math.floor(m2Val / m2Caja)
                                              const restoM2 = m2Val - (cajas * m2Caja)
                                              const areaPieza = m2Caja / piezasCaja
                                              const piezas = Math.floor(restoM2 / areaPieza)
                                              actualizarCantidadesM2(p.id, cajas, piezas)
                                            }
                                          }}
                                          className="border text-center w-16 p-1 rounded text-sm text-gray-900 bg-blue-50 border-blue-200 focus:border-[#04558C] focus:outline-none font-bold"
                                        />
                                      </div>

                                      <span className="text-gray-400 mt-3 text-xs">➔</span>

                                      <div className="flex flex-col items-center">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Cajas</label>
                                        <input 
                                          type="number" 
                                          min="0"
                                          value={item.cantidad_cajas}
                                          onChange={e => actualizarItemCarrito(p.id, 'cantidad_cajas', parseInt(e.target.value) || 0)}
                                          className="border text-center w-12 p-1 rounded text-xs text-gray-900 bg-white"
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
                                          className="border text-center w-12 p-1 rounded text-xs text-gray-900 bg-white"
                                        />
                                      </div>
                                    </div>
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

                            {/* Columna Costo Compra */}
                            <div className="col-span-2 text-right">
                              <div className="flex flex-col md:items-end justify-center">
                                <label className="md:hidden text-[9px] font-bold text-gray-400 uppercase">Costo Unitario</label>
                                <div className="flex items-center gap-1 justify-end">
                                  <span className="text-xs text-gray-500">S/.</span>
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    value={item.costo_unitario}
                                    onChange={e => actualizarItemCarrito(p.id, 'costo_unitario', parseFloat(e.target.value) || 0)}
                                    className="border text-right w-16 p-1 rounded text-sm font-bold text-gray-900 bg-white"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Columna Subtotal & Quitar */}
                            <div className="col-span-2 text-right flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2">
                              <span className="md:hidden text-xs font-bold text-gray-400 uppercase">Subtotal</span>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="font-bold text-sm text-gray-800">S/. {item.subtotal}</span>
                                <button 
                                  onClick={() => quitarDelCarrito(p.id)}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                  title="Quitar de compra"
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

            {/* SECCIÓN DERECHA: DATOS DE CABECERA Y SUBMIT */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">
                    🧾 Detalles del Comprobante
                  </h3>

                  {/* Número de factura */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Nro. de Factura / Boleta Proveedor*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: F001-0001234"
                      value={numeroFactura}
                      onChange={e => setNumeroFactura(e.target.value)}
                      className="w-full border p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C] font-semibold"
                    />
                  </div>

                  {/* Método de pago */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Método de Pago</label>
                    <select 
                      value={metodoPago}
                      onChange={e => setMetodoPago(e.target.value)}
                      className="w-full border p-2.5 rounded-lg bg-white text-gray-900 focus:outline-none font-semibold"
                    >
                      <option value="Transferencia BCP">🏦 Transferencia BCP</option>
                      <option value="Transferencia Interbancaria">🏦 Transf. Interbancaria</option>
                      <option value="Efectivo">💵 Efectivo</option>
                      <option value="Yape/Plin">📱 Yape/Plin</option>
                      <option value="Tarjeta Credito/Debito">💳 Tarjeta Crédito/Débito</option>
                      <option value="Credito">🕒 Crédito Comercial</option>
                      <option value="Sin Especificar">Otros</option>
                    </select>
                  </div>

                  {/* Notas */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1">Notas / Observaciones (Opcional)</label>
                    <textarea 
                      rows={4}
                      placeholder="Ej: Entrega por cargamento de fábrica Celima en San Jerónimo..."
                      value={nota}
                      onChange={e => setNota(e.target.value)}
                      className="w-full border p-2 rounded-lg text-gray-900 bg-white text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {/* Total e Ingreso */}
                <div className="mt-8 pt-4 border-t border-gray-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-gray-800">Total Facturado:</span>
                    <span className="text-3xl font-black text-[#04558C]">
                      S/. {totalCompra.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={handleRegistrarCompra}
                    disabled={isPending}
                    className="w-full text-white font-bold py-3 px-4 rounded-lg bg-[#04558C] hover:bg-[#033f6b] shadow-md transition-colors text-center cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? '⏳ Procesando...' : '📥 Registrar Ingreso de Compra'}
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* --- TAB 2: HISTORIAL DE COMPRAS --- */}
        {tabActiva === 'historial' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            
            {/* Buscador del Historial */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
              <h3 className="text-xl font-bold text-gray-800 self-start md:self-auto">Historial de Facturas de Compras</h3>
              <input 
                type="text" 
                placeholder="🔎 Buscar por código, factura o proveedor..." 
                value={busquedaComp}
                onChange={e => setBusquedaComp(e.target.value)}
                className="w-full md:w-1/3 border border-gray-300 p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
              />
            </div>

            {/* Tabla de compras */}
            {comprasFiltradas.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl border-gray-200">
                <p className="text-gray-400 font-medium">No se registraron facturas de compras en el sistema.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                      <th className="p-3 pl-4">Código Interno</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Factura Nro.</th>
                      <th className="p-3">Proveedor</th>
                      <th className="p-3">Pago</th>
                      <th className="p-3 text-right">Total Invertido</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {comprasFiltradas.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 pl-4 font-mono font-bold text-gray-700">{c.codigo_compra}</td>
                        <td className="p-3 text-gray-500">
                          {new Date(c.fecha).toLocaleDateString('es-PE', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="p-3 font-semibold text-gray-700">{c.numero_factura}</td>
                        <td className="p-3 text-gray-800 font-medium">
                          {c.proveedores ? c.proveedores.razon_social : 'Sin Proveedor'}
                          {c.proveedores && <span className="block text-xs text-gray-400 font-mono">{c.proveedores.documento}</span>}
                        </td>
                        <td className="p-3 text-gray-600 font-medium">{c.metodo_pago}</td>
                        <td className="p-3 text-right font-bold text-[#04558C]">S/. {Number(c.total).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleVerDetallesCompra(c)}
                            className="text-[#04558C] hover:text-[#033f6b] font-bold text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: DIRECTORIO DE PROVEEDORES --- */}
        {tabActiva === 'proveedores' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            
            {/* Buscador y registro */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
              <h3 className="text-xl font-bold text-gray-800 self-start md:self-auto">Directorio de Proveedores</h3>
              <div className="flex gap-2 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="🔎 Buscar RUC, nombre o celular..." 
                  value={busquedaProv}
                  onChange={e => setBusquedaProv(e.target.value)}
                  className="flex-1 md:w-64 border border-gray-300 p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
                />
                <button
                  onClick={() => {
                    setFormProveedor({ tipo_documento: 'RUC', documento: '', razon_social: '', celular: '', direccion: '' })
                    setEsEdicionProv(false)
                    setMostrarModalProveedor(true)
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>➕</span> Proveedor
                </button>
              </div>
            </div>

            {/* Tabla de proveedores */}
            {proveedoresFiltrados.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl border-gray-200">
                <p className="text-gray-400 font-medium">No se registraron proveedores en la base de datos.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                      <th className="p-3 pl-4">Razón Social</th>
                      <th className="p-3">Identificación</th>
                      <th className="p-3">Celular</th>
                      <th className="p-3">Dirección</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {proveedoresFiltrados.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 pl-4 font-bold text-gray-800">{p.razon_social}</td>
                        <td className="p-3">
                          <span className="inline-flex bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded mr-2 font-mono">
                            {p.tipo_documento}
                          </span>
                          <span className="text-gray-600 font-mono">{p.documento}</span>
                        </td>
                        <td className="p-3 text-gray-600 font-medium">{p.celular || 'S/D'}</td>
                        <td className="p-3 text-gray-500 truncate max-w-[200px]" title={p.direccion || ''}>{p.direccion || 'S/D'}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setFormProveedor(p)
                              setEsEdicionProv(true)
                              setMostrarModalProveedor(true)
                            }}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- FORMULARIO MODAL: NUEVO / EDITAR PROVEEDOR --- */}
      {mostrarModalProveedor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">
              {esEdicionProv ? '✏️ Editar Datos de Proveedor' : '➕ Registrar Nuevo Proveedor'}
            </h3>
            
            <form onSubmit={handleGuardarProveedor} className="space-y-4 text-gray-900">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Tipo de Documento*</label>
                <select
                  value={formProveedor.tipo_documento}
                  onChange={e => setFormProveedor({ ...formProveedor, tipo_documento: e.target.value as any })}
                  className="w-full border p-2.5 rounded-lg bg-white text-gray-900 font-semibold focus:outline-none focus:border-[#04558C]"
                >
                  <option value="RUC">RUC (Persona Jurídica)</option>
                  <option value="DNI">DNI (Persona Natural)</option>
                  <option value="CE">CE (Carnet de Extranjería)</option>
                  <option value="OTROS">Otros</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Número de Documento*</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    disabled={esEdicionProv}
                    value={formProveedor.documento}
                    onChange={e => setFormProveedor({ ...formProveedor, documento: e.target.value })}
                    placeholder="Ej: 20601234567"
                    className="flex-1 border border-gray-300 p-2.5 rounded-lg text-gray-900 bg-white font-semibold disabled:bg-gray-100 focus:outline-none focus:border-[#04558C]"
                  />
                  {!esEdicionProv && (formProveedor.tipo_documento === 'DNI' || formProveedor.tipo_documento === 'RUC') && (
                    <button
                      type="button"
                      onClick={async () => {
                        const doc = formProveedor.documento.trim()
                        if (!doc) {
                          alert('Por favor ingresa el número de documento.')
                          return
                        }
                        setConsultandoSunat(true)
                        try {
                          const res = await buscarDniRucPeru(formProveedor.tipo_documento as 'DNI' | 'RUC', doc)
                          if (!res.success || !res.data) {
                            alert('❌ Error al consultar documento: ' + (res.error || 'No se encontraron datos.'))
                            return
                          }
                          const data = res.data
                          setFormProveedor(prev => ({
                            ...prev,
                            razon_social: data.nombre_razon_social,
                            direccion: data.direccion || prev.direccion
                          }))
                          alert(`✅ Autocompletado desde la base de datos de ${formProveedor.tipo_documento === 'DNI' ? 'RENIEC' : 'SUNAT'}.`)
                        } catch (err: any) {
                          alert('❌ Error al consultar documento: ' + err.message)
                        } finally {
                          setConsultandoSunat(false)
                        }
                      }}
                      disabled={consultandoSunat}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {consultandoSunat ? '⏳ Consultando...' : '🔍 Reniec/Sunat'}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Razón Social o Nombre Comercial*</label>
                <input
                  type="text"
                  required
                  value={formProveedor.razon_social}
                  onChange={e => setFormProveedor({ ...formProveedor, razon_social: e.target.value })}
                  placeholder="Ej: Cerámicos San Lorenzo S.A."
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Celular / Teléfono (Opcional)</label>
                <input
                  type="text"
                  value={formProveedor.celular || ''}
                  onChange={e => setFormProveedor({ ...formProveedor, celular: e.target.value })}
                  placeholder="Ej: 987654321"
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Dirección Fiscal / Oficina (Opcional)</label>
                <input
                  type="text"
                  value={formProveedor.direccion || ''}
                  onChange={e => setFormProveedor({ ...formProveedor, direccion: e.target.value })}
                  placeholder="Ej: Av. Industrial 456 - Lima"
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModalProveedor(false)}
                  className="px-4 py-2.5 border rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-[#04558C] hover:bg-[#033f6b] text-white rounded-lg font-bold disabled:opacity-50 shadow-sm transition-colors cursor-pointer"
                >
                  {isPending ? '⏳ Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DETALLES DE COMPRA (MODAL) --- */}
      {compraSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Cabecera */}
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span>📄</span> Detalle de la Compra de Mercadería
                </h3>
                <p className="text-xs font-mono text-gray-500 mt-1">Operación: {compraSeleccionada.codigo_compra}</p>
              </div>
              <button 
                onClick={() => setCompraSeleccionada(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Cabecera de información */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border mb-6 text-sm">
              <div className="space-y-1">
                <p className="text-gray-500 font-medium text-xs">Proveedor:</p>
                <p className="font-bold text-gray-800">
                  {compraSeleccionada.proveedores?.razon_social || 'Proveedor Desconocido'}
                </p>
                {compraSeleccionada.proveedores && (
                  <p className="text-xs text-gray-500 font-mono">Documento: {compraSeleccionada.proveedores.documento}</p>
                )}
              </div>
              <div className="space-y-1 md:text-right">
                <p className="text-gray-500 font-medium text-xs">Factura / Comprobante:</p>
                <p className="font-bold text-gray-800">Nro: {compraSeleccionada.numero_factura}</p>
                <p className="text-xs text-gray-500">Medio Pago: {compraSeleccionada.metodo_pago}</p>
              </div>
            </div>

            {/* Tabla de artículos */}
            <div className="flex-1 overflow-x-auto mb-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 text-xs uppercase font-bold border-b">
                    <th className="p-2 pl-3">Producto</th>
                    <th className="p-2 text-center">Cantidades Compradas</th>
                    <th className="p-2 text-right">Costo Unitario</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-800">
                  {cargandoDetalles ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 font-semibold">
                        ⏳ Cargando artículos de compra...
                      </td>
                    </tr>
                  ) : !detallesCompra || detallesCompra.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                        No se encontraron productos en esta compra.
                      </td>
                    </tr>
                  ) : (
                    detallesCompra.map(item => {
                      const p = item.inventario
                      const esRecubr = p?.m2_caja > 0

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/50">
                          <td className="p-2 pl-3 py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-800">{p?.nombre || 'Producto Eliminado'}</span>
                              <span className="text-[10px] text-gray-400 font-mono">Cód: {item.producto_id} {p?.color ? `| Color: ${p.color}` : ''}</span>
                            </div>
                          </td>
                          <td className="p-2 text-center font-bold">
                            {esRecubr ? (
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                {item.cantidad_cajas} cjs {item.piezas_sueltas > 0 ? `+ ${item.piezas_sueltas} pzs` : ''}
                              </span>
                            ) : (
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                {item.piezas_sueltas} und
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono">S/. {Number(item.costo_unitario).toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-gray-900 font-mono">S/. {Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Notas y Total */}
            <div className="border-t pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-auto">
              <div className="text-xs text-gray-500 max-w-md">
                {compraSeleccionada.nota && (
                  <>
                    <span className="font-bold block text-gray-700 mb-1">Notas internas de compra:</span>
                    <p className="bg-gray-50 p-2.5 rounded-lg border">{compraSeleccionada.nota}</p>
                  </>
                )}
              </div>
              <div className="w-full md:w-64 space-y-1 text-sm border-t md:border-t-0 pt-3 md:pt-0">
                <div className="flex justify-between text-base font-black text-gray-800">
                  <span>Total Inversión:</span>
                  <span className="text-2xl text-[#04558C]">S/. {Number(compraSeleccionada.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
