// app/admin/layout.tsx
import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* SIDEBAR LATERAL (Navegación Táctica) */}
      <aside className="w-64 bg-[#04558C] text-white flex flex-col shadow-xl hidden md:flex">
        <div className="p-6 text-center border-b border-[#033f6b]">
          <h1 className="text-2xl font-black tracking-widest">LEDISA</h1>
          <p className="text-xs text-blue-200 uppercase font-bold mt-1">Centro de Mando</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/admin/dashboard" className="block px-4 py-3 rounded hover:bg-[#033f6b] transition-colors font-semibold">
            📊 Dashboard KPI
          </Link>
          <Link href="/admin" className="block px-4 py-3 rounded hover:bg-[#033f6b] transition-colors font-semibold">
            📦 Gestión de Inventario
          </Link>
          {/* Aquí agregaremos la calculadora y el consultor IA después */}
        </nav>
        
        <Link href="/admin/ventas" className="block px-4 py-3 rounded hover:bg-[#033f6b] transition-colors font-semibold">
            ⚡ Workspace de Ventas
          </Link>

        <div className="p-4 border-t border-[#033f6b]">
          <div className="text-xs text-blue-200 font-mono break-all">
            👤 Admin Activo
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO DINÁMICO */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Navbar superior para móviles (opcional por ahora, lo mantenemos simple) */}
        <header className="md:hidden bg-[#04558C] text-white p-4 shadow-md flex justify-between items-center">
          <h1 className="font-black">LEDISA ADMIN</h1>
          <span className="text-xs bg-red-500 px-2 py-1 rounded font-bold">ZONA RESTRINGIDA</span>
        </header>

        {/* Aquí Next.js inyectará automáticamente el contenido de page.tsx o dashboard/page.tsx */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}