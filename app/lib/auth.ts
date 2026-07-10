// app/lib/auth.ts

/**
 * Genera un hash SHA-256 de forma asíncrona compatible con Edge y Node.js runtimes.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verifica si el valor de la sesión de administración coincide con el hash de la contraseña configurada.
 */
export async function verifySession(cookieValue: string | undefined): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || !cookieValue) return false
  const expectedHash = await hashPassword(adminPassword)
  return cookieValue === expectedHash
}
