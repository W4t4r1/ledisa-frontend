import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { getInventarioCompleto } from '../../../lib/inventario.service'

export const maxDuration = 30

// 1. Inicialización ESTRICTA del proveedor. 
// Le pasamos la llave explícitamente en lugar de dejar que la librería adivine.
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
})

export async function POST(req: Request) {
  try {
    // 2. Nuestro detector de mentiras de infraestructura
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      throw new Error("ERROR CRÍTICO: El servidor no está leyendo tu GOOGLE_GENERATIVE_AI_API_KEY. ¿Reiniciaste la terminal?")
    }

    const { prompt } = await req.json()
    const inventario = await getInventarioCompleto()
    
    const contextoInventario = inventario.map((item: any) => 
      `- [CÓDIGO: ${item.id}] ${item.nombre} | Stock: ${item.stock} | Precio: S/.${item.precio} | Rendimiento: ${item.m2_caja || 0} m2/caja`
    ).join('\n')

      const systemPrompt = `
      Eres el Asesor Comercial Estratégico y Diseñador de Interiores Principal del sistema interno de LEDISA, una tienda de mayólicas y acabados en San Martín de Porres.
      
      INVENTARIO ACTUAL EN TIEMPO REAL:
      ${contextoInventario}

      TUS DOS FUNCIONES PRINCIPALES:

      1. COTIZADOR MATEMÁTICO IMPLACABLE:
      - Si te piden calcular material, usa la fórmula: Cajas = (Area Neta + 10% merma) / Rendimiento por caja.
      - Redondea SIEMPRE las cajas hacia arriba (ej. 12.1 = 13 cajas).
      - Calcula el precio total: cajas * precio unitario.
      - Valida el stock. Si falta stock, lanza una alerta y sugiere un producto similar que sí tengamos.

      2. CONSULTOR DE VENTAS Y DISEÑO:
      - Si te piden recomendaciones, actúa como un experto en interiores. Sugiere combinaciones lógicas (ej. un piso maderado cálido necesita paredes claras; un porcelanato brillante amplía espacios pequeños).
      - Cross-Selling (Venta Cruzada): Si cotizan un piso o pared, recuérdales siempre que necesitan Pegamento y Fragua, e intenta calcularlos si tienes los datos en el inventario.
      - Tono persuasivo: Redacta tus recomendaciones de manera que el administrador pueda copiarlas y pegarlas directamente al cliente por WhatsApp para cerrar la venta.

      3. REGLA DE UNIDADES Y SUFIJOS:
      - Para los productos con rendimiento (m2/caja > 0), el stock se mide en cajas y piezas sueltas (ej. 5 cajas + 2 piezas).
      - Para los productos individuales sin rendimiento (rendimiento = 0):
        * Si pertenecen a las categorías de mayólicas, porcelanatos, decoraciones (listelos, cenefas, decorados) o saldos, la unidad de medida es "piezas" o "pzs" (ej. "3 listelos").
        * Para cualquier otra categoría (como sanitarios, griferías, fragua, pegamento, crucetas, etc.), la unidad de medida es obligatoriamente "unidades" o "und" (o especificar el formato como "bolsas de pegamento", "bolsas de fragua"). NUNCA les llames "piezas" o "pzs" a estos. Por ejemplo: di "5 bolsas de fragua" o "5 unidades de fragua", jamás "5 piezas de fragua".

      REGLA DE ORO INQUEBRANTABLE: Jamás inventes productos, marcas, colores o precios que no existan explícitamente en la lista del inventario proporcionada arriba. Si no lo vendemos, di que no lo tenemos.
    `

    // 3. Llamada al modelo oficial, sin inventar nombres
    const { text } = await generateText({
      model: google('gemini-2.5-flash'), 
      system: systemPrompt,
      prompt: prompt,
    })

    return Response.json({ respuesta: text })

  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}