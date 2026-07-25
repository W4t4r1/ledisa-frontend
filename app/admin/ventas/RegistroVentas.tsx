import { useState, useTransition, useEffect } from 'react'
import { buscarCliente, guardarCliente, crearNuevaVenta, buscarClientes, buscarDniRucPeru } from './actions'
import { guardarProducto } from '../actions'
import { crearCompra } from '../compras/actions'
import ComprobantePrint from '../../components/ComprobantePrint'
import type { CompraData } from '../../lib/compras.service'

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
  es_combo?: boolean
  producto_componentes?: { componente_id: string; cantidad: number }[]
}

interface CartItem {
  producto: Producto
  cantidad_cajas: number
  piezas_sueltas: number
  precio_unitario: number
  costo_unitario: number
  piezas_por_caja: number // Divisor para calcular precio de piezas sueltas
  subtotal: number
  m2_solicitados: number // M2 solicitados/cobrados
  lote?: string
  tono?: string
  calibre?: string
  es_compra_al_paso?: boolean
  proveedor_nombre?: string
  costo_adquisicion_al_paso?: number
  comprobante_proveedor?: string
  es_producto_eventual?: boolean
}

export default function RegistroVentas({ 
  productos,
  cotizacionCargar,
  setCotizacionCargar
}: { 
  productos: Producto[]
  cotizacionCargar: any
  setCotizacionCargar: (cotizacion: any) => void
}) {
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

  // Modal de Producto Eventual / Fuera de Catálogo
  const [mostrarModalEventual, setMostrarModalEventual] = useState(false)
  const [formEventual, setFormEventual] = useState({
    nombre: '',
    categoria: 'Porcelanato',
    m2_caja: 1.44,
    precio_venta: 0,
    costo_compra: 0,
    proveedor_nombre: '',
    cantidad_cajas: 1,
    piezas_sueltas: 0,
    lote: '',
    tono: '',
    calibre: ''
  })

  // Modal Calculadora Integrada de m² y Materiales Complementarios
  const [mostrarModalCalc, setMostrarModalCalc] = useState(false)
  const [prodCalcId, setProdCalcId] = useState<string>('')
  const [modoCalc, setModoCalc] = useState<'dimensiones' | 'directo'>('dimensiones')
  const [largoM, setLargoM] = useState<number>(4)
  const [anchoM, setAnchoM] = useState<number>(5)
  const [m2DirectoCalc, setM2DirectoCalc] = useState<number>(20)
  const [mermaPct, setMermaPct] = useState<number>(10)
  const [pegamentoSelId, setPegamentoSelId] = useState<string>('')
  const [fraguaSelId, setFraguaSelId] = useState<string>('')
  const [incluirPegamento, setIncluirPegamento] = useState(true)
  const [incluirFragua, setIncluirFragua] = useState(true)

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

  // Estados para búsqueda predictiva de clientes
  const [clientesSugeridos, setClientesSugeridos] = useState<any[]>([])
  const [mostrarSugerenciasCliente, setMostrarSugerenciasCliente] = useState(false)
  const [consultandoSunat, setConsultandoSunat] = useState(false)

  // Estado para comprobante de éxito e impresión
  const [ventaExito, setVentaExito] = useState<any | null>(null)
  
  // Código de cotización cargada en edición
  const [cotizacionOrigenCod, setCotizacionOrigenCod] = useState<string | null>(null)

  // Filtrar productos sugeridos para el carrito
  const productosSugeridos = productos.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) ||
    p.id.toLowerCase().includes(busquedaProd.toLowerCase())
  ).slice(0, 5)

  // Cargar cotización seleccionada en historial
  useEffect(() => {
    if (cotizacionCargar) {
      // 1. Establecer cliente si existe
      if (cotizacionCargar.clientes) {
        setClienteSeleccionado({
          id: cotizacionCargar.cliente_id,
          ...cotizacionCargar.clientes
        })
        setDocumentoBusqueda(cotizacionCargar.clientes.nombre_razon_social)
      } else {
        setClienteSeleccionado(null)
        setDocumentoBusqueda('')
      }
      
      // 2. Poblar carrito
      const itemsCargados: CartItem[] = cotizacionCargar.items.map((item: any) => {
        const prod = productos.find(p => p.id === item.producto_id) || {
          id: item.producto_id,
          nombre: item.inventario?.nombre || 'Producto Desconocido',
          categoria: item.inventario?.categoria || '',
          marca: '',
          precio: item.precio_unitario,
          costo: item.costo_unitario || 0,
          stock: 9999,
          m2_caja: item.inventario?.m2_caja || 0,
          piezas_sueltas: 0
        }
        
        return {
          producto: prod,
          cantidad_cajas: item.cantidad_cajas,
          piezas_sueltas: item.piezas_sueltas,
          precio_unitario: item.precio_unitario,
          costo_unitario: item.costo_unitario,
          piezas_por_caja: item.piezas_por_caja || 6,
          subtotal: item.subtotal,
          m2_solicitados: prod.m2_caja > 0 
            ? parseFloat(((item.cantidad_cajas * prod.m2_caja) + (item.piezas_sueltas * (prod.m2_caja / (item.piezas_por_caja || 6)))).toFixed(2)) 
            : 0,
          lote: item.lote || '',
          tono: item.tono || '',
          calibre: item.calibre || ''
        }
      })
      
      setCarrito(itemsCargados)
      setDescuento(cotizacionCargar.descuento || 0)
      setNota(cotizacionCargar.nota || '')
      setMetodoPago(cotizacionCargar.metodo_pago || 'Efectivo')
      setEstadoVenta('PAGADO') // Se carga por defecto para facturarse
      setCotizacionOrigenCod(cotizacionCargar.codigo_venta || null)
      
      // Limpiar cotización del estado compartido para evitar loops
      setCotizacionCargar(null)
    }
  }, [cotizacionCargar, productos, setCotizacionCargar])

  // Búsqueda de cliente al enviar formulario (Enter)
  const handleBuscarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentoBusqueda.trim()) return

    setCargandoCliente(true)
    setClienteNoEncontrado(false)
    setMostrarSugerenciasCliente(false)
    try {
      const res = await buscarClientes(documentoBusqueda)
      if (res && res.length > 0) {
        // Si hay una coincidencia exacta de documento o solo hay 1 cliente en total, seleccionarlo
        const exactMatch = res.find(c => c.documento.trim() === documentoBusqueda.trim())
        if (exactMatch) {
          setClienteSeleccionado(exactMatch)
          setDocumentoBusqueda(exactMatch.nombre_razon_social)
        } else if (res.length === 1) {
          setClienteSeleccionado(res[0])
          setDocumentoBusqueda(res[0].nombre_razon_social)
        } else {
          setClientesSugeridos(res)
          setMostrarSugerenciasCliente(true)
        }
      } else {
        setClienteSeleccionado(null)
        setClienteNoEncontrado(true)
        setFormCliente(prev => ({ ...prev, documento: /^\d+$/.test(documentoBusqueda) ? documentoBusqueda : '' }))
      }
    } catch (err: any) {
      alert('❌ Error al buscar cliente: ' + err.message)
    } finally {
      setCargandoCliente(false)
    }
  }

  // Búsqueda interactiva conforme escribe
  const handleBuscarClienteText = async (val: string) => {
    setDocumentoBusqueda(val)
    if (val.trim().length >= 3) {
      try {
        const res = await buscarClientes(val)
        setClientesSugeridos(res)
        setMostrarSugerenciasCliente(true)
      } catch (err) {
        // Silencioso
      }
    } else {
      setClientesSugeridos([])
      setMostrarSugerenciasCliente(false)
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

    const esCombo = !!producto.es_combo || (producto.producto_componentes && producto.producto_componentes.length > 0)

    if (esCombo && producto.producto_componentes) {
      for (const c of producto.producto_componentes) {
        const compProd = productos.find(p => p.id === c.componente_id)
        if (!compProd || compProd.stock < c.cantidad) {
          if (!window.confirm(`⚠️ Advertencia: El componente "${compProd?.nombre || c.componente_id}" del combo no tiene stock suficiente (Stock: ${compProd?.stock || 0}, Requerido: ${c.cantidad}). ¿Deseas agregarlo de todos modos?`)) {
            return
          }
        }
      }
    }

    const nuevoItem: CartItem = {
      producto,
      cantidad_cajas: producto.m2_caja > 0 ? 1 : 0,
      piezas_sueltas: producto.m2_caja > 0 ? 0 : 1,
      precio_unitario: producto.precio,
      costo_unitario: producto.costo || 0,
      piezas_por_caja: 6, // Estándar para revestimientos
      m2_solicitados: producto.m2_caja > 0 ? producto.m2_caja : 1,
      subtotal: producto.m2_caja > 0 ? parseFloat((producto.m2_caja * producto.precio).toFixed(2)) : producto.precio
    }

    setCarrito([...carrito, nuevoItem])
    setBusquedaProd('')
    setMostrarSugerenciasProd(false)
  }


  // Agregar Producto Eventual al carrito
  const handleAgregarProductoEventual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEventual.nombre.trim()) {
      alert('Por favor ingresa el nombre o descripción del producto eventual.')
      return
    }
    if (formEventual.precio_venta <= 0) {
      alert('Por favor ingresa un precio de venta mayor a 0.')
      return
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const fechaStr = new Date().toISOString().slice(2,10).replace(/-/g, '')
    const idEventual = `EV-${fechaStr}-${randomSuffix}`

    const productoEventual: Producto = {
      id: idEventual,
      nombre: formEventual.nombre.trim(),
      categoria: formEventual.categoria,
      marca: 'EVENTUAL',
      precio: formEventual.precio_venta,
      costo: formEventual.costo_compra || 0,
      stock: 0,
      m2_caja: formEventual.m2_caja || 0,
      piezas_sueltas: 0
    }

    const m2Req = productoEventual.m2_caja > 0 
      ? parseFloat(((formEventual.cantidad_cajas * productoEventual.m2_caja) + (formEventual.piezas_sueltas * (productoEventual.m2_caja / 6))).toFixed(2))
      : 0

    let sub = 0
    if (productoEventual.m2_caja > 0) {
      sub = parseFloat((m2Req * formEventual.precio_venta).toFixed(2))
    } else {
      sub = parseFloat((formEventual.piezas_sueltas * formEventual.precio_venta).toFixed(2))
    }

    const nuevoItem: CartItem = {
      producto: productoEventual,
      cantidad_cajas: formEventual.cantidad_cajas,
      piezas_sueltas: formEventual.piezas_sueltas,
      precio_unitario: formEventual.precio_venta,
      costo_unitario: formEventual.costo_compra || 0,
      piezas_por_caja: 6,
      subtotal: sub,
      m2_solicitados: m2Req,
      lote: formEventual.lote.trim() || undefined,
      tono: formEventual.tono.trim() || undefined,
      calibre: formEventual.calibre.trim() || undefined,
      es_compra_al_paso: true,
      proveedor_nombre: formEventual.proveedor_nombre.trim() || 'Tienda Externa',
      costo_adquisicion_al_paso: formEventual.costo_compra || 0,
      es_producto_eventual: true
    }

    setCarrito([...carrito, nuevoItem])
    setMostrarModalEventual(false)
    setFormEventual({
      nombre: '', categoria: 'Porcelanato', m2_caja: 1.44, precio_venta: 0, costo_compra: 0,
      proveedor_nombre: '', cantidad_cajas: 1, piezas_sueltas: 0, lote: '', tono: '', calibre: ''
    })
    setBusquedaProd('')
    setMostrarSugerenciasProd(false)
  }

  // Listas de productos complementarios para la calculadora
  const listaPegamentos = productos.filter(p => 
    p.nombre.toLowerCase().includes('pegamento') || 
    p.nombre.toLowerCase().includes('adhesivo') || 
    p.categoria.toLowerCase().includes('pegamento') ||
    p.categoria.toLowerCase().includes('adhesivo')
  )

  const listaFraguas = productos.filter(p => 
    p.nombre.toLowerCase().includes('fragua') || 
    p.categoria.toLowerCase().includes('fragua')
  )

  // Criterios de cálculo dinámico para el modal de calculadora
  const m2BaseCalc = modoCalc === 'dimensiones' ? (largoM * anchoM) : m2DirectoCalc
  const m2TotalesCalc = parseFloat((m2BaseCalc * (1 + mermaPct / 100)).toFixed(2))

  const productoSelCalc = productos.find(p => p.id === prodCalcId) || productos.find(p => p.m2_caja > 0) || productos[0]
  const m2CajaCalc = productoSelCalc?.m2_caja || 1.44
  const pzsPorCajaCalc = 6

  let cajasReqCalc = 0
  let piezasReqCalc = 0
  if (m2CajaCalc > 0) {
    const totalCajasFloat = m2TotalesCalc / m2CajaCalc
    cajasReqCalc = Math.floor(totalCajasFloat)
    const m2Restantes = m2TotalesCalc - (cajasReqCalc * m2CajaCalc)
    if (m2Restantes > 0) {
      const m2PorPieza = m2CajaCalc / pzsPorCajaCalc
      piezasReqCalc = Math.ceil(m2Restantes / m2PorPieza)
      if (piezasReqCalc >= pzsPorCajaCalc) {
        cajasReqCalc += 1
        piezasReqCalc = 0
      }
    }
  }

  const sacosPegamentoReq = Math.ceil(m2TotalesCalc / 4.5) // 1 saco 25kg rinde 4.5 m2
  const kgFraguaReq = Math.ceil(m2TotalesCalc / 4.0) // 1 kg rinde 4.0 m2

  // Inyectar Paquete Completo Calculado al Carrito
  const handleAgregarPaqueteCalculado = () => {
    if (!productoSelCalc) return

    const nuevosItems: CartItem[] = []

    // 1. Cerámico / Porcelanato
    const m2SolicitadosTile = productoSelCalc.m2_caja > 0 
      ? parseFloat(((cajasReqCalc * productoSelCalc.m2_caja) + (piezasReqCalc * (productoSelCalc.m2_caja / pzsPorCajaCalc))).toFixed(2))
      : 0

    let subtotalTile = 0
    if (productoSelCalc.m2_caja > 0) {
      subtotalTile = parseFloat((m2SolicitadosTile * productoSelCalc.precio).toFixed(2))
    } else {
      subtotalTile = parseFloat((piezasReqCalc * productoSelCalc.precio).toFixed(2))
    }

    const existeTile = carrito.find(item => item.producto.id === productoSelCalc.id)
    if (existeTile) {
      actualizarItemCarrito(productoSelCalc.id, 'cantidad_cajas', existeTile.cantidad_cajas + cajasReqCalc)
      actualizarItemCarrito(productoSelCalc.id, 'piezas_sueltas', existeTile.piezas_sueltas + piezasReqCalc)
    } else {
      nuevosItems.push({
        producto: productoSelCalc,
        cantidad_cajas: cajasReqCalc,
        piezas_sueltas: piezasReqCalc,
        precio_unitario: productoSelCalc.precio,
        costo_unitario: productoSelCalc.costo || 0,
        piezas_por_caja: pzsPorCajaCalc,
        subtotal: subtotalTile,
        m2_solicitados: m2SolicitadosTile
      })
    }

    // 2. Pegamento
    const pegamentoTargetId = pegamentoSelId || (listaPegamentos[0]?.id || '')
    if (incluirPegamento && pegamentoTargetId && sacosPegamentoReq > 0) {
      const prodPeg = productos.find(p => p.id === pegamentoTargetId)
      if (prodPeg) {
        const existePeg = carrito.find(item => item.producto.id === prodPeg.id)
        if (existePeg) {
          actualizarItemCarrito(prodPeg.id, 'piezas_sueltas', existePeg.piezas_sueltas + sacosPegamentoReq)
        } else {
          nuevosItems.push({
            producto: prodPeg,
            cantidad_cajas: 0,
            piezas_sueltas: sacosPegamentoReq,
            precio_unitario: prodPeg.precio,
            costo_unitario: prodPeg.costo || 0,
            piezas_por_caja: 1,
            subtotal: parseFloat((sacosPegamentoReq * prodPeg.precio).toFixed(2)),
            m2_solicitados: 0
          })
        }
      }
    }

    // 3. Fragua
    const fraguaTargetId = fraguaSelId || (listaFraguas[0]?.id || '')
    if (incluirFragua && fraguaTargetId && kgFraguaReq > 0) {
      const prodFra = productos.find(p => p.id === fraguaTargetId)
      if (prodFra) {
        const existeFra = carrito.find(item => item.producto.id === prodFra.id)
        if (existeFra) {
          actualizarItemCarrito(prodFra.id, 'piezas_sueltas', existeFra.piezas_sueltas + kgFraguaReq)
        } else {
          nuevosItems.push({
            producto: prodFra,
            cantidad_cajas: 0,
            piezas_sueltas: kgFraguaReq,
            precio_unitario: prodFra.precio,
            costo_unitario: prodFra.costo || 0,
            piezas_por_caja: 1,
            subtotal: parseFloat((kgFraguaReq * prodFra.precio).toFixed(2)),
            m2_solicitados: 0
          })
        }
      }
    }

    if (nuevosItems.length > 0) {
      setCarrito(prev => [...prev, ...nuevosItems])
    }
    setMostrarModalCalc(false)
    alert('✅ Paquete calculado y agregado al carrito exitosamente.')
  }

  // Actualizar cantidad o precio en carrito
  const actualizarItemCarrito = (id: string, campo: keyof CartItem, valor: any) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id !== id) return item

      const temp = { ...item, [campo]: valor }
      
      // Si cambian cajas o piezas manualmente, recalculamos m2_solicitados al valor físico
      if (campo === 'cantidad_cajas' || campo === 'piezas_sueltas' || campo === 'piezas_por_caja') {
        if (temp.producto.m2_caja > 0) {
          temp.m2_solicitados = (temp.cantidad_cajas * temp.producto.m2_caja) + (temp.piezas_sueltas * (temp.producto.m2_caja / (temp.piezas_por_caja || 6)))
          temp.m2_solicitados = parseFloat(temp.m2_solicitados.toFixed(2))
        }
      }

      // Calcular subtotal
      let sub = 0
      if (temp.producto.m2_caja > 0) {
        sub = temp.m2_solicitados * temp.precio_unitario
      } else {
        sub = temp.piezas_sueltas * temp.precio_unitario
      }

      temp.subtotal = parseFloat(sub.toFixed(2))
      return temp
    }))
  }

  // Actualizar cantidades calculadas por m2 solicitado
  const actualizarCantidadesM2 = (id: string, m2Val: number, cajas: number, piezas: number) => {
    setCarrito(carrito.map(item => {
      if (item.producto.id !== id) return item

      const temp = { 
        ...item, 
        cantidad_cajas: cajas, 
        piezas_sueltas: piezas,
        m2_solicitados: m2Val 
      }
      
      let sub = 0
      if (temp.producto.m2_caja > 0) {
        sub = m2Val * temp.precio_unitario
      } else {
        sub = piezas * temp.precio_unitario
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
        if (item.es_compra_al_paso) continue // Omitir bloqueo para compras al paso

        const prod = item.producto
        if (prod.m2_caja > 0) {
          const pzsPorCaja = item.piezas_por_caja || 6
          const totalPiezasDisp = (prod.stock * pzsPorCaja) + (prod.piezas_sueltas || 0)
          const totalPiezasReq = (item.cantidad_cajas * pzsPorCaja) + item.piezas_sueltas

          if (totalPiezasDisp < totalPiezasReq) {
            alert(`⚠️ Stock insuficiente para ${prod.nombre}.\nStock total disponible: ${totalPiezasDisp} pzs (${prod.stock} cjs + ${prod.piezas_sueltas || 0} pzs).\nRequerido: ${totalPiezasReq} pzs (${item.cantidad_cajas} cjs + ${item.piezas_sueltas} pzs).\n💡 Puedes activar la casilla 'Compra al Paso' si lo adquirirás de una tienda externa.`);
            return
          }
        } else {
          // Unidades
          if (prod.stock < item.piezas_sueltas) {
            alert(`⚠️ Stock insuficiente para ${prod.nombre}. Disponible: ${prod.stock} unidades.\n💡 Puedes activar la casilla 'Compra al Paso' si lo adquirirás de una tienda externa.`);
            return
          }
        }
      }
    }

    startTransition(async () => {
      try {
        // 0. Dar de alta automáticamente los productos eventuales en el catálogo de inventario
        const itemsEventuales = carrito.filter(i => i.es_producto_eventual)
        if (itemsEventuales.length > 0) {
          for (const itemEv of itemsEventuales) {
            const resEv = await guardarProducto({
              id: itemEv.producto.id,
              nombre: itemEv.producto.nombre,
              categoria: itemEv.producto.categoria,
              marca: 'EVENTUAL',
              precio: itemEv.precio_unitario,
              costo: itemEv.costo_adquisicion_al_paso || itemEv.costo_unitario,
              stock: 0,
              stock_minimo: 0,
              m2_caja: itemEv.producto.m2_caja,
              piezas_sueltas: 0,
              color: null,
              imagen: null,
              oculto: true
            }, false)
            if (!resEv.success) {
              throw new Error(resEv.error || 'Error al guardar el producto eventual')
            }
          }
        }

        // 1. Procesar Compras al Paso primero (si las hay y no es una simple cotización)
        const itemsAlPaso = carrito.filter(i => i.es_compra_al_paso)
        if (itemsAlPaso.length > 0 && estadoVenta !== 'COTIZACION') {
          const payloadCompra: CompraData = {
            proveedor_id: null,
            numero_factura: itemsAlPaso[0].comprobante_proveedor || `COMPRA-PASO-${Date.now().toString().slice(-6)}`,
            total: itemsAlPaso.reduce((sum, i) => {
              const costo = i.costo_adquisicion_al_paso !== undefined ? i.costo_adquisicion_al_paso : (i.costo_unitario || 0)
              if (i.producto.m2_caja > 0) {
                const totalM2 = (i.cantidad_cajas * i.producto.m2_caja) + (i.piezas_sueltas * (i.producto.m2_caja / (i.piezas_por_caja || 6)))
                return sum + (totalM2 * costo)
              } else {
                return sum + (i.piezas_sueltas * costo)
              }
            }, 0),
            metodo_pago: 'Efectivo',
            nota: `Compra al paso automática vinculada a cliente ${clienteSeleccionado?.nombre_razon_social || 'General'} (Tienda/Prov: ${itemsAlPaso.map(i => i.proveedor_nombre || 'Externa').join(', ')})`,
            items: itemsAlPaso.map(i => ({
              producto_id: i.producto.id,
              cantidad_cajas: i.cantidad_cajas,
              piezas_sueltas: i.piezas_sueltas,
              costo_unitario: i.costo_adquisicion_al_paso !== undefined ? i.costo_adquisicion_al_paso : (i.costo_unitario || 0),
              subtotal: i.producto.m2_caja > 0 
                ? parseFloat((((i.cantidad_cajas * i.producto.m2_caja) + (i.piezas_sueltas * (i.producto.m2_caja / (i.piezas_por_caja || 6)))) * (i.costo_adquisicion_al_paso !== undefined ? i.costo_adquisicion_al_paso : (i.costo_unitario || 0))).toFixed(2))
                : parseFloat((i.piezas_sueltas * (i.costo_adquisicion_al_paso !== undefined ? i.costo_adquisicion_al_paso : (i.costo_unitario || 0))).toFixed(2)),
              lote: i.lote || null,
              tono: i.tono || null,
              calibre: i.calibre || null
            }))
          }

          const resCompra = await crearCompra(payloadCompra)
          if (!resCompra.success) {
            throw new Error(resCompra.error || 'Error al procesar la compra al paso')
          }
        }

        // 2. Procesar la Venta asignando los costos reales de adquisición
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
            costo_unitario: item.es_compra_al_paso ? (item.costo_adquisicion_al_paso !== undefined ? item.costo_adquisicion_al_paso : item.costo_unitario) : item.costo_unitario,
            piezas_por_caja: item.piezas_por_caja,
            subtotal: item.subtotal,
            lote: item.lote || null,
            tono: item.tono || null,
            calibre: item.calibre || null
          }))
        }

        const resVenta = await crearNuevaVenta(payload)
        if (!resVenta.success) {
          throw new Error(resVenta.error || 'Error al procesar la venta')
        }
        const codigoGenerado = resVenta.data!
        
        const payloadExito = {
          codigo_venta: codigoGenerado,
          fecha: new Date().toISOString(),
          metodo_pago: metodoPago,
          subtotal: subtotalVenta,
          descuento: descuento,
          total: totalVenta,
          nota: nota.trim() || undefined,
          estado: estadoVenta,
          clientes: clienteSeleccionado ? {
            tipo_documento: clienteSeleccionado.tipo_documento,
            documento: clienteSeleccionado.documento,
            nombre_razon_social: clienteSeleccionado.nombre_razon_social,
            celular: clienteSeleccionado.celular,
            direccion: clienteSeleccionado.direccion
          } : null,
          items: carrito.map(item => ({
            producto: {
              id: item.producto.id,
              nombre: item.producto.nombre,
              m2_caja: item.producto.m2_caja
            },
            cantidad_cajas: item.cantidad_cajas,
            piezas_sueltas: item.piezas_sueltas,
            precio_unitario: item.precio_unitario,
            piezas_por_caja: item.piezas_por_caja,
            subtotal: item.subtotal
          }))
        }
        setVentaExito(payloadExito)
        
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

          <div className="relative">
            <form onSubmit={handleBuscarCliente} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Buscar por Nombre, DNI o RUC del cliente..."
                value={documentoBusqueda}
                onChange={e => handleBuscarClienteText(e.target.value)}
                onFocus={() => {
                  if (documentoBusqueda.trim().length >= 3) {
                    setMostrarSugerenciasCliente(true)
                  }
                }}
                className="flex-1 border border-gray-300 p-2.5 rounded text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
              />
              <button 
                type="submit" 
                disabled={cargandoCliente}
                className="bg-[#04558C] hover:bg-[#033f6b] text-white px-4 py-2.5 rounded font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cargandoCliente ? '🔍 Buscando...' : 'Buscar'}
              </button>
            </form>

            {/* Listado de sugerencias flotantes de clientes */}
            {mostrarSugerenciasCliente && clientesSugeridos.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-60 overflow-y-auto divide-y text-xs text-gray-900">
                {clientesSugeridos.map(cli => (
                  <button
                    key={cli.id}
                    type="button"
                    onClick={() => {
                      setClienteSeleccionado(cli)
                      setDocumentoBusqueda(cli.nombre_razon_social)
                      setMostrarSugerenciasCliente(false)
                      setClienteNoEncontrado(false)
                    }}
                    className="w-full text-left p-3 hover:bg-blue-50 transition-colors flex justify-between items-center cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-gray-800">{cli.nombre_razon_social}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{cli.tipo_documento}: {cli.documento}</p>
                    </div>
                    <span className="text-gray-400 font-bold text-[10px]">SELECCIONAR ➔</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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

          {/* Buscador de productos rápido y botón Eventual */}
          <div className="flex flex-col sm:flex-row gap-2 mb-6">
            <div className="relative flex-1">
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

              {/* Listado de sugerencias flotantes */}
              {mostrarSugerenciasProd && busquedaProd.trim() !== '' && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto divide-y">
                  {productosSugeridos.length === 0 ? (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-sm text-gray-500 italic">No se encontró "{busquedaProd}" en el catálogo.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFormEventual(prev => ({ ...prev, nombre: busquedaProd }))
                          setMostrarModalEventual(true)
                          setMostrarSugerenciasProd(false)
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        ➕ Crear Producto Eventual / Fuera de Catálogo
                      </button>
                    </div>
                  ) : (
                    productosSugeridos.map(p => {
                      const esCombo = !!p.es_combo || (p.producto_componentes && p.producto_componentes.length > 0)
                      return (
                        <div 
                          key={p.id}
                          onClick={() => agregarAlCarrito(p)}
                          className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-800">{p.nombre}</p>
                              {esCombo && (
                                <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded shadow-xs">
                                  📦 COMBO ({p.producto_componentes?.length || 0} ítems)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 font-mono">Cód: {p.id} | Marca: {p.marca}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#04558C]">S/. {p.precio}</p>
                            <p className="text-[10px] text-gray-400">
                              {esCombo
                                ? `📦 Combo por componentes`
                                : p.m2_caja > 0 
                                  ? `Stock: ${p.stock} cjs / ${p.piezas_sueltas} pzs` 
                                  : `Stock: ${p.stock} und`}
                            </p>
                          </div>
                        </div>
                      )
                    })

                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!prodCalcId && productos.find(p => p.m2_caja > 0)) {
                  setProdCalcId(productos.find(p => p.m2_caja > 0)?.id || '')
                }
                setMostrarModalCalc(true)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
              title="Calcular metros cuadrados, merma y pegamento/fragua"
            >
              <span>🧮</span> Calculadora m²
            </button>

            <button
              type="button"
              onClick={() => {
                setFormEventual(prev => ({ ...prev, nombre: busquedaProd }))
                setMostrarModalEventual(true)
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
              title="Vender un producto fuera de catálogo adquirido por encargo"
            >
              <span>➕</span> Producto Eventual
            </button>
          </div>

          {/* BANNER COTIZACIÓN EN EDICIÓN */}
          {cotizacionOrigenCod && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <span className="text-base">⚡</span>
                <div>
                  <p className="font-bold">Editando Cotización {cotizacionOrigenCod}</p>
                  <p className="text-[11px] text-amber-700 font-normal">
                    Puedes agregar/quitar productos o modificar cantidades. Elige a la derecha si deseas registrar la venta o guardar la cotización.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCotizacionOrigenCod(null)}
                className="text-amber-700 hover:text-amber-900 font-bold underline text-[11px] cursor-pointer"
              >
                Desvincular
              </button>
            </div>
          )}

          {/* Lista del carrito */}
          {carrito.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg border-gray-300">
              <p className="text-gray-400 font-medium">El carrito está vacío. Agrega productos arriba.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden md:grid grid-cols-12 text-xs font-bold text-gray-400 uppercase pb-2 border-b">
                <div className="col-span-4">Producto</div>
                <div className="col-span-4 text-center">Cantidades</div>
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
                      <div className="col-span-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-800 text-sm">{p.nombre}</span>
                            {(p.es_combo || (p.producto_componentes && p.producto_componentes.length > 0)) && (
                              <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded shadow-xs">
                                📦 COMBO
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 font-mono">Cód: {p.id}</span>
                          
                          {/* SECCIÓN DETALLE DE COMPONENTES DEL COMBO */}
                          {(p.es_combo || (p.producto_componentes && p.producto_componentes.length > 0)) && (
                            <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1.5">
                              <span className="font-bold text-indigo-900 block text-[10px] flex items-center gap-1">
                                <span>📦</span> Componentes a Descontar:
                              </span>
                              <div className="space-y-1 text-[10px] text-indigo-900 font-medium">
                                {(p.producto_componentes || []).map((c, idx) => {
                                  const compProd = productos.find(item => item.id === c.componente_id)
                                  const cantTotal = c.cantidad * (item.cantidad_cajas || item.piezas_sueltas || 1)
                                  return (
                                    <div key={idx} className="flex justify-between items-center bg-white/80 px-2 py-1 rounded border border-indigo-100">
                                      <span>🔹 <strong>{cantTotal}x</strong> {compProd?.nombre || c.componente_id}</span>
                                      <span className="text-gray-500 text-[9px] font-mono">
                                        (Stock: {compProd?.stock || 0} unds)
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

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


                          {/* SECCIÓN COMPRA AL PASO */}
                          <div className="mt-3 p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-2">
                            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-800 select-none">
                              <input 
                                type="checkbox"
                                checked={item.es_compra_al_paso || false}
                                onChange={e => {
                                  actualizarItemCarrito(p.id, 'es_compra_al_paso', e.target.checked)
                                  if (e.target.checked && item.costo_adquisicion_al_paso === undefined) {
                                    actualizarItemCarrito(p.id, 'costo_adquisicion_al_paso', item.costo_unitario || 0)
                                  }
                                }}
                                className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500"
                              />
                              <span>🛒 Compra al Paso (Adquisición Externa)</span>
                            </label>

                            {item.es_compra_al_paso && (
                              <div className="space-y-1.5 pt-1.5 border-t border-amber-200/80">
                                <div>
                                  <label className="text-[9px] font-bold text-amber-700 uppercase block">Proveedor / Tienda Externa</label>
                                  <input 
                                    type="text"
                                    placeholder="Ej: Tienda Vecina / Cerámicos X"
                                    value={item.proveedor_nombre || ''}
                                    onChange={e => actualizarItemCarrito(p.id, 'proveedor_nombre', e.target.value)}
                                    className="w-full border border-amber-300 p-1 rounded text-xs text-gray-900 bg-white font-medium focus:outline-none"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <div className="w-1/2">
                                    <label className="text-[9px] font-bold text-amber-700 uppercase block">Costo Compra S/.</label>
                                    <input 
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={item.costo_adquisicion_al_paso !== undefined ? item.costo_adquisicion_al_paso : item.costo_unitario}
                                      onChange={e => actualizarItemCarrito(p.id, 'costo_adquisicion_al_paso', parseFloat(e.target.value) || 0)}
                                      className="w-full border border-amber-300 p-1 rounded text-xs text-gray-900 font-bold bg-white focus:outline-none"
                                    />
                                  </div>
                                  <div className="w-1/2">
                                    <label className="text-[9px] font-bold text-amber-700 uppercase block">Comprobante Nro</label>
                                    <input 
                                      type="text"
                                      placeholder="Ej: F001-1234"
                                      value={item.comprobante_proveedor || ''}
                                      onChange={e => actualizarItemCarrito(p.id, 'comprobante_proveedor', e.target.value)}
                                      className="w-full border border-amber-300 p-1 rounded text-xs text-gray-900 bg-white focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <p className="text-[9px] text-amber-600 font-medium italic">
                                  🔒 Privado: Estos datos NO se imprimirán en el comprobante del cliente.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
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
                                    step="any"
                                    min="0"
                                    placeholder="Ej: 7"
                                    value={item.m2_solicitados !== undefined ? item.m2_solicitados : ''}
                                    onChange={e => {
                                      const m2Val = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                      if (m2Val >= 0) {
                                        const m2Caja = p.m2_caja
                                        const piezasCaja = item.piezas_por_caja || 6
                                        const cajas = Math.floor(m2Val / m2Caja)
                                        const restoM2 = m2Val - (cajas * m2Caja)
                                        const areaPieza = m2Caja / piezasCaja
                                        const piezas = Math.floor(restoM2 / areaPieza)
                                        actualizarCantidadesM2(p.id, m2Val, cajas, piezas)
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
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    required
                    value={formCliente.documento}
                    onChange={e => setFormCliente({ ...formCliente, documento: e.target.value })}
                    className="flex-1 border p-2 rounded text-gray-900 bg-white focus:outline-none focus:border-[#04558C]"
                  />
                  {(formCliente.tipo_documento === 'DNI' || formCliente.tipo_documento === 'RUC') && (
                    <button
                      type="button"
                      onClick={async () => {
                        const doc = formCliente.documento.trim()
                        if (!doc) {
                          alert('Por favor ingresa el número de documento.')
                          return
                        }
                        setConsultandoSunat(true)
                        try {
                          const res = await buscarDniRucPeru(formCliente.tipo_documento as 'DNI' | 'RUC', doc)
                          if (!res.success || !res.data) {
                            alert('❌ Error al consultar documento: ' + (res.error || 'No se encontraron datos.'))
                            return
                          }
                          const data = res.data
                          setFormCliente(prev => ({
                            ...prev,
                            nombre_razon_social: data.nombre_razon_social,
                            direccion: data.direccion || prev.direccion
                          }))
                          alert(`✅ Autocompletado desde la base de datos de ${formCliente.tipo_documento === 'DNI' ? 'RENIEC' : 'SUNAT'}.`)
                        } catch (err: any) {
                          alert('❌ Error al consultar documento: ' + err.message)
                        } finally {
                          setConsultandoSunat(false)
                        }
                      }}
                      disabled={consultandoSunat}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {consultandoSunat ? '⏳ Consultando...' : '🔍 Reniec/Sunat'}
                    </button>
                  )}
                </div>
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

      {/* --- MODAL DE OPERACIÓN EXITOSA CON IMPRESIÓN --- */}
      {ventaExito && (
        <div className="fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto text-3xl">
              {ventaExito.estado === 'COTIZACION' ? '📝' : '✅'}
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                {ventaExito.estado === 'COTIZACION' ? 'Cotización Guardada' : '¡Registro Exitoso!'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                El comprobante se generó bajo el código:
              </p>
              <p className="text-lg font-black font-mono text-[#04558C] mt-1 bg-gray-50 py-2 rounded">
                {ventaExito.codigo_venta}
              </p>
            </div>

            <div className="border border-gray-100 rounded-lg p-4 space-y-2 text-sm text-gray-600 bg-gray-50/50">
              <div className="flex justify-between font-semibold">
                <span>Cliente:</span>
                <span className="text-gray-800">{ventaExito.clientes?.nombre_razon_social || 'Cliente General'}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Importe Total:</span>
                <span className="text-gray-800 font-bold">S/. {ventaExito.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="w-full bg-[#04558C] hover:bg-[#033f6b] text-white py-3 px-4 rounded-xl font-bold transition-colors shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                🖨️ Imprimir / Guardar PDF
              </button>
              <button
                onClick={() => setVentaExito(null)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-bold transition-colors text-sm cursor-pointer"
              >
                ✕ Entendido y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPROBANTE OCULTO PARA IMPRESIÓN */}
      {ventaExito && (
        <div className="hidden print:block">
          <ComprobantePrint venta={ventaExito} />
        </div>
      )}

      {/* --- MODAL CALCULADORA INTEGRADA DE M² Y MATERIALES --- */}
      {mostrarModalCalc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh] text-xs text-gray-900">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#04558C] flex items-center gap-2">
                  <span>🧮</span> Calculadora de m² y Materiales Complementarios
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">Calcula las cajas exactas e inyecta Pegamento y Fragua al carrito en 1 clic.</p>
              </div>
              <button 
                type="button"
                onClick={() => setMostrarModalCalc(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. Seleccionar Cerámico */}
              <div>
                <label className="font-bold text-gray-700 block mb-1">1. Selecciona el Cerámico / Porcelanato</label>
                <select
                  value={prodCalcId}
                  onChange={e => setProdCalcId(e.target.value)}
                  className="w-full border border-gray-300 p-2.5 rounded-lg bg-white font-bold text-gray-900 focus:outline-none focus:border-[#04558C]"
                >
                  {productos.filter(p => p.m2_caja > 0).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.m2_caja} m²/caja) — S/. {p.precio}/m²
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Área y Merma */}
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#04558C]">2. Área del Ambiente y Merma</span>
                  <div className="flex bg-white rounded-lg border p-0.5">
                    <button
                      type="button"
                      onClick={() => setModoCalc('dimensiones')}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${modoCalc === 'dimensiones' ? 'bg-[#04558C] text-white' : 'text-gray-600'}`}
                    >
                      Largo × Ancho
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoCalc('directo')}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${modoCalc === 'directo' ? 'bg-[#04558C] text-white' : 'text-gray-600'}`}
                    >
                      m² Directos
                    </button>
                  </div>
                </div>

                {modoCalc === 'dimensiones' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Largo (metros)</label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={largoM}
                        onChange={e => setLargoM(parseFloat(e.target.value) || 0)}
                        className="w-full border p-2 rounded-lg text-gray-900 bg-white font-semibold text-center"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Ancho (metros)</label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={anchoM}
                        onChange={e => setAnchoM(parseFloat(e.target.value) || 0)}
                        className="w-full border p-2 rounded-lg text-gray-900 bg-white font-semibold text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="font-bold text-gray-600 block mb-1">Superficie Total (m²)</label>
                    <input 
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={m2DirectoCalc}
                      onChange={e => setM2DirectoCalc(parseFloat(e.target.value) || 0)}
                      className="w-full border p-2 rounded-lg text-gray-900 bg-white font-bold text-center text-sm"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-gray-600">Merma de Corte:</label>
                    <select
                      value={mermaPct}
                      onChange={e => setMermaPct(parseInt(e.target.value) || 0)}
                      className="border p-1.5 rounded-lg bg-white font-bold text-gray-900"
                    >
                      <option value={5}>5% (Corte recto)</option>
                      <option value={10}>10% (Estándar recomendado)</option>
                      <option value={15}>15% (Instalación diagonal)</option>
                    </select>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">m² Totales Requeridos</span>
                    <span className="text-base font-black text-[#04558C] font-mono">{m2TotalesCalc} m²</span>
                  </div>
                </div>
              </div>

              {/* Resultado Cerámico */}
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex justify-between items-center">
                <div>
                  <span className="font-bold text-amber-900 block text-xs">Cajas + Piezas Necesarias</span>
                  <span className="text-[11px] text-amber-700 font-medium">Rendimiento: {m2CajaCalc} m²/caja</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-amber-900 font-mono">
                    {cajasReqCalc} cjs {piezasReqCalc > 0 ? `+ ${piezasReqCalc} pzs` : ''}
                  </span>
                </div>
              </div>

              {/* 3. Materiales Complementarios */}
              <div className="space-y-3 pt-2">
                <span className="font-bold text-gray-700 block">3. Materiales Complementarios Recomendados</span>

                {/* Pegamento */}
                <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={incluirPegamento}
                        onChange={e => setIncluirPegamento(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>sacos de Pegamento / Adhesivo (25kg)</span>
                    </label>
                    <span className="font-mono font-bold text-blue-700 text-sm">{sacosPegamentoReq} sacos</span>
                  </div>
                  {incluirPegamento && (
                    <select
                      value={pegamentoSelId || (listaPegamentos[0]?.id || '')}
                      onChange={e => setPegamentoSelId(e.target.value)}
                      className="w-full border p-2 rounded bg-white text-gray-900 font-semibold"
                    >
                      {listaPegamentos.length === 0 ? (
                        <option value="">No hay pegamentos en catálogo (Usar genérico)</option>
                      ) : (
                        listaPegamentos.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} — S/. {p.precio}/saco
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>

                {/* Fragua */}
                <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={incluirFragua}
                        onChange={e => setIncluirFragua(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>kg de Fragua / Junta</span>
                    </label>
                    <span className="font-mono font-bold text-blue-700 text-sm">{kgFraguaReq} kg</span>
                  </div>
                  {incluirFragua && (
                    <select
                      value={fraguaSelId || (listaFraguas[0]?.id || '')}
                      onChange={e => setFraguaSelId(e.target.value)}
                      className="w-full border p-2 rounded bg-white text-gray-900 font-semibold"
                    >
                      {listaFraguas.length === 0 ? (
                        <option value="">No hay fraguas en catálogo (Usar genérico)</option>
                      ) : (
                        listaFraguas.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} — S/. {p.precio}/kg
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>
              </div>

              {/* Botón Inyección al Carrito */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModalCalc(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAgregarPaqueteCalculado}
                  className="px-5 py-2.5 bg-[#04558C] hover:bg-[#033f6b] text-white rounded-lg font-bold shadow-md transition-colors flex items-center gap-2 text-xs cursor-pointer"
                >
                  <span>🛒</span> Agregar Cerámico + Pegamento + Fragua al Carrito
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PRODUCTO EVENTUAL / FUERA DE CATÁLOGO --- */}
      {mostrarModalEventual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2">
                <span>➕</span> Producto Eventual / Fuera de Catálogo
              </h3>
              <button 
                type="button"
                onClick={() => setMostrarModalEventual(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAgregarProductoEventual} className="space-y-4 text-xs text-gray-900">
              <div>
                <label className="font-bold text-gray-600 block mb-1">Nombre / Descripción del Producto*</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Porcelanato Negro Abrillantado 60x60"
                  value={formEventual.nombre}
                  onChange={e => setFormEventual({ ...formEventual, nombre: e.target.value })}
                  className="w-full border p-2.5 rounded-lg text-gray-900 bg-white font-semibold focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Categoría</label>
                  <select 
                    value={formEventual.categoria}
                    onChange={e => setFormEventual({ ...formEventual, categoria: e.target.value })}
                    className="w-full border p-2 rounded-lg bg-white text-gray-900 font-semibold focus:outline-none"
                  >
                    <option value="Porcelanato">Porcelanato</option>
                    <option value="Mayólica">Mayólica</option>
                    <option value="Sanitario">Sanitario</option>
                    <option value="Grifería">Grifería</option>
                    <option value="Decorado">Decorado</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Rendimiento (m²/caja)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 1.44"
                    value={formEventual.m2_caja}
                    onChange={e => setFormEventual({ ...formEventual, m2_caja: parseFloat(e.target.value) || 0 })}
                    className="w-full border p-2 rounded-lg text-gray-900 bg-white focus:outline-none"
                  />
                  <span className="text-[9px] text-gray-400 block mt-0.5">Dejar en 0 si es por unidades</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
                <div>
                  <label className="font-bold text-amber-800 block mb-1">Precio de Venta S/.*</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formEventual.precio_venta || ''}
                    onChange={e => setFormEventual({ ...formEventual, precio_venta: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-amber-300 p-2 rounded-lg text-gray-900 bg-white font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-800 block mb-1">Costo de Compra S/.*</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formEventual.costo_compra || ''}
                    onChange={e => setFormEventual({ ...formEventual, costo_compra: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-amber-300 p-2 rounded-lg text-gray-900 bg-white font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Proveedor / Tienda Externa</label>
                  <input 
                    type="text"
                    placeholder="Ej: Tienda Vecina / Cerámicos X"
                    value={formEventual.proveedor_nombre}
                    onChange={e => setFormEventual({ ...formEventual, proveedor_nombre: e.target.value })}
                    className="w-full border p-2 rounded-lg text-gray-900 bg-white font-medium focus:outline-none"
                  />
                </div>
                <div>
                  {formEventual.m2_caja > 0 ? (
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Cantidad Cajas</label>
                      <input 
                        type="number"
                        min="1"
                        value={formEventual.cantidad_cajas}
                        onChange={e => setFormEventual({ ...formEventual, cantidad_cajas: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full border p-2 rounded-lg text-gray-900 bg-white font-bold focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="font-bold text-gray-600 block mb-1">Cantidad Unidades</label>
                      <input 
                        type="number"
                        min="1"
                        value={formEventual.piezas_sueltas}
                        onChange={e => setFormEventual({ ...formEventual, piezas_sueltas: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full border p-2 rounded-lg text-gray-900 bg-white font-bold focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-gray-500 block mb-0.5">Lote</label>
                  <input 
                    type="text"
                    placeholder="Opcional"
                    value={formEventual.lote}
                    onChange={e => setFormEventual({ ...formEventual, lote: e.target.value })}
                    className="w-full border p-1.5 rounded-lg text-gray-900 bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-0.5">Tono</label>
                  <input 
                    type="text"
                    placeholder="Opcional"
                    value={formEventual.tono}
                    onChange={e => setFormEventual({ ...formEventual, tono: e.target.value })}
                    className="w-full border p-1.5 rounded-lg text-gray-900 bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-500 block mb-0.5">Calibre</label>
                  <input 
                    type="text"
                    placeholder="Opcional"
                    value={formEventual.calibre}
                    onChange={e => setFormEventual({ ...formEventual, calibre: e.target.value })}
                    className="w-full border p-1.5 rounded-lg text-gray-900 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[10px] text-amber-700 italic bg-amber-50 p-2 rounded border border-amber-200">
                🔒 El producto se dará de alta automáticamente en el inventario como oculto y se procesará la compra/venta simultánea. El comprobante impreso para el cliente mostrará exclusivamente los datos de LEDISA.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setMostrarModalEventual(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm transition-colors"
                >
                  🛒 Agregar al Carrito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
