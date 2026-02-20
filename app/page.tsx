import { supabase } from './lib/supabase'
import CatalogoInteractivo from './components/CatalogoInteractivo'

export const revalidate = 0 

export default async function Home() {
  // El servidor hace el trabajo pesado: extraer datos
  const { data: inventario, error } = await supabase
    .from('inventario')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) {
    return <div className="p-10 text-red-500 font-bold">Error crítico de base de datos: {error.message}</div>
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
        
        {/* Le inyectamos los datos al componente cliente */}
        <CatalogoInteractivo inventario={inventario || []} />
        
      </div>
    </main>
  )
}