/**
 * Consulta de DNI (RENIEC) o RUC (SUNAT) en Perú.
 * Soporta consulta en vivo usando eldni.com como fuente gratuita para DNI y RUC 10,
 * y api.net.pe para RUC 20 (Empresas), con soporte para pruebas/demos.
 */
export async function consultarDniRuc(tipo: 'DNI' | 'RUC', numero: string) {
  const cleanNum = numero.replace(/\D/g, '')
  if (tipo === 'DNI' && cleanNum.length !== 8) {
    throw new Error('El DNI debe tener exactamente 8 dígitos.')
  }
  if (tipo === 'RUC' && cleanNum.length !== 11) {
    throw new Error('El RUC debe tener exactamente 11 dígitos.')
  }

  // 1. ¿ES UN DOCUMENTO DE PRUEBA / DEMOSTRACIÓN?
  const esDemo = cleanNum === '12345678' || cleanNum === '20123456789' || cleanNum.startsWith('000') || cleanNum.startsWith('999')
  if (esDemo) {
    const hash = Array.from(cleanNum).reduce((acc, char) => acc + Number(char), 0)
    if (tipo === 'DNI') {
      const nombres = ['JUAN CARLOS', 'MARIA HELENA', 'LUIS ALBERTO', 'ANA BEATRIZ', 'JORGE LUIS', 'ROSA MARIA', 'MIGUEL ANGEL', 'CARMEN ROSA', 'JOSE LUIS', 'SILVIA PATRICIA']
      const paternos = ['QUISPE', 'RODRIGUEZ', 'FLORES', 'SANCHEZ', 'GARCIA', 'ROJAS', 'DIAZ', 'TORRES', 'LOPEZ', 'MENDOZA']
      const maternos = ['GONZALES', 'RAMIREZ', 'CHAVEZ', 'HUAMAN', 'VALDIVIA', 'HERRERA', 'PALOMINO', 'BENITES', 'COCA', 'FARFAN']
      return {
        documento: cleanNum,
        nombre_razon_social: `${nombres[hash % nombres.length]} ${paternos[(hash + 3) % paternos.length]} ${maternos[(hash + 7) % maternos.length]}`,
        direccion: `AV. LAS FLORES ${100 + (hash * 5)}, SAN JUAN DE LURIGANCHO, LIMA`
      }
    } else {
      const empresas = ['DISTRIBUIDORA SAN JORGE S.A.C.', 'CONSTRUCTORA INMOBILIARIA ANDINA E.I.R.L.', 'REVESTIMIENTOS Y CERAMICOS LIMA S.A.', 'COMERCIAL PROGRESO DEL SUR S.R.L.']
      return {
        documento: cleanNum,
        nombre_razon_social: empresas[hash % empresas.length],
        direccion: 'AV. JAVIER PRADO ESTE 1024, SAN ISIDRO, LIMA'
      }
    }
  }

  // 2. INTENTAR CONSULTA A ELDNI.COM (DNI Y RUC 10)
  const esRuc10 = tipo === 'RUC' && cleanNum.startsWith('10')
  if (tipo === 'DNI' || esRuc10) {
    try {
      const urlMain = tipo === 'DNI' 
        ? 'https://eldni.com/pe/buscar-datos-por-dni' 
        : 'https://eldni.com/pe/buscar-nombres-por-ruc-10'

      const pageRes = await fetch(urlMain, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      
      if (pageRes.ok) {
        const html = await pageRes.text()
        const tokenMatch = html.match(/name="_token" value="([^"]+)"/)
        
        if (tokenMatch) {
          const token = tokenMatch[1]
          
          // Obtener cookies
          const setCookies = (pageRes.headers as any).getSetCookie 
            ? (pageRes.headers as any).getSetCookie() 
            : (pageRes.headers.get('set-cookie') || '').split(/,\s*/)
          const cookies = setCookies.map((c: string) => c.split(';')[0]).join('; ')

          const bodyParams = new URLSearchParams()
          bodyParams.append('_token', token)
          if (tipo === 'DNI') {
            bodyParams.append('dni', cleanNum)
          } else {
            bodyParams.append('ruc10', cleanNum)
          }

          const postRes = await fetch(urlMain, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': cookies,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Referer': urlMain
            },
            body: bodyParams
          })

          if (postRes.ok) {
            const resultHtml = await postRes.text()
            const match = resultHtml.match(/id="completos"\s+value="([^"]+)"/)
            if (match && match[1] && match[1].trim().length > 0) {
              return {
                documento: cleanNum,
                nombre_razon_social: match[1].trim().toUpperCase(),
                direccion: ''
              }
            }
          }
        }
      }
    } catch (err) {
      // Ignorar e intentar con la API secundaria
    }
  }

  // 3. INTENTAR API SECUNDARIA (API.NET.PE - Útil para RUC 20 de empresas)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    const url = tipo === 'DNI'
      ? `https://api.net.pe/api/v1/dni/${cleanNum}`
      : `https://api.net.pe/api/v1/ruc/${cleanNum}`

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (tipo === 'DNI' && data.nombres) {
        return {
          documento: cleanNum,
          nombre_razon_social: `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.toUpperCase(),
          direccion: data.direccion || ''
        }
      } else if (tipo === 'RUC' && data.razonSocial) {
        return {
          documento: cleanNum,
          nombre_razon_social: data.razonSocial.toUpperCase(),
          direccion: data.direccion || ''
        }
      }
    }
  } catch (e) {
    // Ignorar
  }

  // Si todo falla, arrojar error descriptivo
  throw new Error(`No se pudo encontrar información en RENIEC/SUNAT para el ${tipo} ${cleanNum}. Por favor, ingresa los nombres y dirección manualmente.`)
}
