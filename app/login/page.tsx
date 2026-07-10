import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { hashPassword } from '../lib/auth'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {

// Esta función se ejecuta estrictamente en el backend (Server Action)
  async function procesarLogin(formData: FormData) {
    'use server'
    const passwordIngresado = formData.get('password') as string
    const passwordReal = process.env.ADMIN_PASSWORD

    if (passwordIngresado === passwordReal) {
      // CORRECCIÓN CRÍTICA: Esperamos la promesa de las cookies (Next.js 15+)
      const cookieStore = await cookies()
      const hashedPassword = await hashPassword(passwordReal)
      
      cookieStore.set('ledisa_admin_session', hashedPassword, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 día
        path: '/',
      })
      redirect('/admin') // Lo dejamos pasar al panel
    } else {
      redirect('/login?error=1') // Lo regresamos con un error
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#04558C]">LEDISA ADMIN</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresa la contraseña de operaciones</p>
        </div>

        {searchParams.error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-bold text-center">
            ⚠️ Contraseña incorrecta
          </div>
        )}

        {/* El formulario ejecuta la acción segura del servidor */}
        <form action={procesarLogin} className="flex flex-col gap-4">
          <div>
            <input
              type="password"
              name="password"
              placeholder="Contraseña"
              required
              className="w-full border border-gray-300 p-3 rounded-md focus:outline-none focus:border-[#04558C] text-gray-900"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-[#04558C] hover:bg-[#033f6b] text-white font-bold py-3 rounded-md transition-colors"
          >
            Acceder al Sistema
          </button>
        </form>
      </div>
    </div>
  )
}