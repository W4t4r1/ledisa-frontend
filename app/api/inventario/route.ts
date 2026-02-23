import { NextResponse } from 'next/server'
import { getInventarioCompleto } from '../../lib/inventario.service'

export async function GET(request: Request) {
  try {
    // 1. SEGURIDAD: Leer la cabecera 'x-api-key' de la petición que llega
    const apiKey = request.headers.get('x-api-key')
    const validKey = process.env.API_SECRET_KEY

    // 2. VALIDACIÓN RUTHLESS: Si no hay llave o no coincide, patada en la puerta. HTTP 401 (No Autorizado)
    if (!apiKey || apiKey !== validKey) {
      return NextResponse.json(
        { success: false, message: "Acceso denegado. Se requiere una API Key válida en los headers." },
        { status: 401 } 
      )
    }

    // 3. EXTRACCIÓN: Solo si pasó la seguridad, vamos a la base de datos
    const inventario = await getInventarioCompleto()

    return NextResponse.json({
      success: true,
      total_productos: inventario.length,
      timestamp: new Date().toISOString(),
      data: inventario
    }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "Error interno del servidor",
      error: error.message
    }, { status: 500 })
  }
}