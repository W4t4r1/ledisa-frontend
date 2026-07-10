// app/admin/layout.tsx
import Sidebar from '../components/Sidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar de escritorio y cabecera móvil integrada */}
      <Sidebar />

      {/* ÁREA DE CONTENIDO DINÁMICO */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}