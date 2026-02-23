import { getInventarioCompleto } from './lib/inventario.service'
import CatalogoInteractivo from './components/CatalogoInteractivo'

export const revalidate = 0 

export default async function Home() {
  let inventario = []
  let errorBD = null

  try {
    // La página llama al servicio directamente. Cero red externa.
    inventario = await getInventarioCompleto()
  } catch (error: any) {
    errorBD = error.message
  }

  if (errorBD) {
    return <div className="p-10 text-red-500 font-bold">Error crítico: {errorBD}</div>
  }

  return (
    <main className="p-6 md:p-10 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#04558C] tracking-tight">
              SISTEMA LEDISA
            </h1>
            <p className="text-gray-500 text-sm mt-1">Catálogo en Tiempo Real</p>
          </div>
        </header>
        
        {/* Inyectamos los datos al componente cliente */}
        <CatalogoInteractivo inventario={inventario} />
      </div>
    </main>
  )
}