/**
 * Consulta de DNI (RENIEC) o RUC (SUNAT) en Perú con fallback determinista.
 */
export async function consultarDniRuc(tipo: 'DNI' | 'RUC', numero: string) {
  const cleanNum = numero.replace(/\D/g, '')
  if (tipo === 'DNI' && cleanNum.length !== 8) {
    throw new Error('El DNI debe tener exactamente 8 dígitos.')
  }
  if (tipo === 'RUC' && cleanNum.length !== 11) {
    throw new Error('El RUC debe tener exactamente 11 dígitos.')
  }

  // 1. Intentar consulta a API gratuita y abierta (sin token obligatorio para pruebas rápidas)
  let apiSucceeded = false
  let apiResult: any = null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    // API pública y gratuita disponible para propósitos de prueba
    const url = tipo === 'DNI'
      ? `https://api.net.pe/api/v1/dni/${cleanNum}`
      : `https://api.net.pe/api/v1/ruc/${cleanNum}`

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (tipo === 'DNI' && data.nombres) {
        apiResult = {
          documento: cleanNum,
          nombre_razon_social: `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.toUpperCase(),
          direccion: data.direccion || ''
        }
        apiSucceeded = true
      } else if (tipo === 'RUC' && data.razonSocial) {
        apiResult = {
          documento: cleanNum,
          nombre_razon_social: data.razonSocial.toUpperCase(),
          direccion: data.direccion || ''
        }
        apiSucceeded = true
      }
    }
  } catch (e) {
    // Procede al chequeo
  }

  if (apiSucceeded) {
    return apiResult
  }

  // 2. ¿ES UN DOCUMENTO DE PRUEBA / DEMOSTRACIÓN?
  const esDemo = cleanNum === '12345678' || cleanNum === '20123456789' || cleanNum.startsWith('000') || cleanNum.startsWith('999')
  if (!esDemo) {
    throw new Error('El servicio gubernamental no respondió o requiere un token de pago. Por favor, ingresa el nombre y dirección manualmente.')
  }

  // 3. FALLBACK DETERMINISTA SOLO PARA PRUEBAS (DEMO)
  const hash = Array.from(cleanNum).reduce((acc, char) => acc + Number(char), 0)

  if (tipo === 'DNI') {
    const nombres = ['JUAN CARLOS', 'MARIA HELENA', 'LUIS ALBERTO', 'ANA BEATRIZ', 'JORGE LUIS', 'ROSA MARIA', 'MIGUEL ANGEL', 'CARMEN ROSA', 'JOSE LUIS', 'SILVIA PATRICIA']
    const paternos = ['QUISPE', 'RODRIGUEZ', 'FLORES', 'SANCHEZ', 'GARCIA', 'ROJAS', 'DIAZ', 'TORRES', 'LOPEZ', 'MENDOZA']
    const maternos = ['GONZALES', 'RAMIREZ', 'CHAVEZ', 'HUAMAN', 'VALDIVIA', 'HERRERA', 'PALOMINO', 'BENITES', 'COCA', 'FARFAN']

    const nom = nombres[hash % nombres.length]
    const pat = paternos[(hash + 3) % paternos.length]
    const mat = maternos[(hash + 7) % maternos.length]

    return {
      documento: cleanNum,
      nombre_razon_social: `${nom} ${pat} ${mat}`,
      direccion: `AV. LAS FLORES ${100 + (hash * 5)}, SAN JUAN DE LURIGANCHO, LIMA`
    }
  } else {
    // RUC
    const empresas = [
      'DISTRIBUIDORA SAN JORGE S.A.C.',
      'CONSTRUCTORA INMOBILIARIA ANDINA E.I.R.L.',
      'REVESTIMIENTOS Y CERAMICOS LIMA S.A.',
      'COMERCIAL PROGRESO DEL SUR S.R.L.',
      'INVERSIONES MULTIPLES TRUJILLO S.A.C.',
      'IMPORTADORA DE ACEROS Y MATERIALES SAC',
      'REPRESENTACIONES FERRETERAS EL PACIFICO',
      'GRUPO CONSTRUCTOR DEL CENTRO E.I.R.L.',
      'LOGISTICA Y DISTRIBUCION NORTE SAC',
      'ACABADOS Y DECORACIONES ELEGANCE S.A.C.'
    ]
    const direcciones = [
      'AV. NICOLAS DE PIEROLA 450, PROVINCIA DE LIMA, LIMA',
      'JR. ALFONSO UGARTE 123, TRUJILLO, LA LIBERTAD',
      'AV. LA MARINA 1890, SAN MIGUEL, LIMA',
      'JR. DE LA UNION 890, DISTRITO DE LIMA, LIMA',
      'AV. ARGENTINA 3200, CALLAO',
      'AV. JAVIER PRADO ESTE 1024, SAN ISIDRO, LIMA',
      'JR. ANCASH 345, AREQUIPA, AREQUIPA',
      'AV. LARCO 567, MIRAFLORES, LIMA',
      'AV. DE LA POESIA 160, SAN BORJA, LIMA',
      'AV. CHIMU 820, ZARATE, LIMA'
    ]

    const emp = empresas[hash % empresas.length]
    const dir = direcciones[(hash + 2) % direcciones.length]

    return {
      documento: cleanNum,
      nombre_razon_social: emp,
      direccion: dir
    }
  }
}
