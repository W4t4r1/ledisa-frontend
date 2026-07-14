// app/components/Sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const links = [
    { href: '/admin/dashboard', label: '📊 Dashboard KPI' },
    { href: '/admin', label: '📦 Gestión de Inventario' },
    { href: '/admin/calculadora', label: '📐 Calculadora de Obra' },
    { href: '/admin/consultor', label: '🧠 Consultor IA' },
    { href: '/admin/ventas', label: '⚡ Workspace de Ventas' },
    { href: '/admin/clientes', label: '👥 Gestión de Clientes (CRM)' },
    { href: '/admin/kardex', label: '📈 Kardex de Inventario' },
  ]

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  const renderNavLinks = () => (
    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={() => setIsOpen(false)}
          className={`block px-4 py-3 rounded transition-colors font-semibold ${
            isActive(link.href)
              ? 'bg-[#033f6b] text-white shadow-inner border-l-4 border-yellow-400 pl-3'
              : 'text-blue-100 hover:bg-[#033f6b] hover:text-white'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <>
      {/* SIDEBAR LATERAL DESKTOP */}
      <aside className="w-64 bg-[#04558C] text-white flex flex-col shadow-xl hidden md:flex h-full">
        <div className="p-6 text-center border-b border-[#033f6b]">
          <h1 className="text-2xl font-black tracking-widest text-white">LEDISA</h1>
          <p className="text-xs text-blue-200 uppercase font-bold mt-1">Centro de Mando</p>
        </div>

        {renderNavLinks()}

        <div className="p-4 border-t border-[#033f6b]">
          <div className="text-xs text-blue-200 font-mono flex items-center justify-between">
            <span>👤 Admin Activo</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
        </div>
      </aside>

      {/* HEADER SUPERIOR PARA MÓVILES */}
      <header className="md:hidden bg-[#04558C] text-white p-4 shadow-md flex justify-between items-center z-30 w-full">
        <div className="flex items-center gap-3">
          {/* Botón Hamburguesa */}
          <button
            onClick={() => setIsOpen(true)}
            className="p-1 rounded hover:bg-[#033f6b] focus:outline-none transition-colors"
            aria-label="Abrir menú"
          >
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
          <h1 className="font-black text-lg tracking-wider text-white">LEDISA ADMIN</h1>
        </div>
        <span className="text-[10px] bg-red-500 text-white px-2 py-1 rounded font-black tracking-wider uppercase">
          ZONA RESTRINGIDA
        </span>
      </header>

      {/* SIDEBAR MÓVIL (CAJÓN DESLIZABLE) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop oscuro */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity"
            onClick={() => setIsOpen(false)}
          ></div>

          {/* Menú deslizable */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#04558C] text-white shadow-2xl transition-transform duration-300 ease-in-out h-full">
            <div className="p-6 flex justify-between items-center border-b border-[#033f6b]">
              <div>
                <h1 className="text-xl font-black tracking-widest text-white">LEDISA</h1>
                <p className="text-[10px] text-blue-200 uppercase font-bold mt-0.5">Operaciones Móviles</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-[#033f6b] focus:outline-none transition-colors"
                aria-label="Cerrar menú"
              >
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {renderNavLinks()}

            <div className="p-4 border-t border-[#033f6b] mt-auto">
              <div className="text-xs text-blue-200 font-mono flex items-center justify-between">
                <span>👤 Admin Activo</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
