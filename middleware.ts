import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 1. Buscamos la credencial en el navegador del visitante
  const authCookie = request.cookies.get('ledisa_admin_session')
  const adminPassword = process.env.ADMIN_PASSWORD

  // 2. Si la persona intenta entrar a cualquier ruta que empiece con /admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 3. Verificamos si no tiene la cookie o si la contraseña es incorrecta
    if (!authCookie || authCookie.value !== adminPassword) {
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