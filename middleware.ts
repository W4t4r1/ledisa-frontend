import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './app/lib/auth'

export async function middleware(request: NextRequest) {
  // 1. Buscamos la credencial en el navegador del visitante
  const authCookie = request.cookies.get('ledisa_admin_session')

  // 2. Si la persona intenta entrar a cualquier ruta que empiece con /admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 3. Verificamos la sesión de forma asíncrona y segura
    const isValid = await verifySession(authCookie?.value)
    if (!isValid) {
      // 4. Patada inmediata a la página de login
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Si todo está en orden, lo dejamos pasar
  return NextResponse.next()
}

// Le decimos al Middleware que SOLO vigile la ruta de administración
export const config = {
  matcher: ['/admin/:path*'],
}