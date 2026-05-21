import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const authorizationHeader = req.headers.get('authorization')

  if (authorizationHeader) {
    const basicAuth = authorizationHeader.split(' ')[1]
    if (basicAuth) {
      // Decodificar las credenciales base64
      const [username, password] = atob(basicAuth).split(':')

      // Cargar credenciales esperadas de las variables de entorno
      const expectedUser = process.env.BASIC_AUTH_USER || 'admin'
      const expectedPassword = process.env.BASIC_AUTH_PASSWORD

      // Si no se ha configurado contraseña en Vercel, denegar el acceso por seguridad
      if (
        username === expectedUser &&
        expectedPassword &&
        password === expectedPassword
      ) {
        return NextResponse.next()
      }
    }
  }

  // Si falla o no se provee, retornar 401 pidiendo autenticación
  return new NextResponse('Authentication Required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area", charset="UTF-8"',
    },
  })
}

// Configuración para que el middleware se ejecute en todas las rutas excepto la API, archivos estáticos y favicon
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
