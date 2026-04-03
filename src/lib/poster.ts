import QRCode from 'qrcode'

type PosterInput = {
  sourceCanvas: HTMLCanvasElement
  copyText: string
  editionLabel: string
  qrUrl: string
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })
}

export async function buildPoster(input: PosterInput) {
  const width = 1080
  const height = 1920
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  const sceneSnapshot = input.sourceCanvas.toDataURL('image/jpeg', 0.92)
  const carImage = await loadImage(sceneSnapshot)
  const qrData = await QRCode.toDataURL(input.qrUrl, {
    margin: 1,
    width: 220,
    color: {
      dark: '#DDF1FF',
      light: '#00000000',
    },
  })
  const qrImage = await loadImage(qrData)

  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#07131f')
  gradient.addColorStop(1, '#02060a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.globalAlpha = 0.94
  ctx.drawImage(carImage, 0, 220, width, 920)
  ctx.globalAlpha = 1

  ctx.fillStyle = 'rgba(2, 10, 18, 0.66)'
  ctx.fillRect(68, 1035, width - 136, 520)

  ctx.fillStyle = '#DBEEFF'
  ctx.font = "700 58px 'Manrope', sans-serif"
  const lines = wrapText(ctx, input.copyText, width - 192)
  lines.slice(0, 4).forEach((line, index) => {
    ctx.fillText(line, 96, 1135 + index * 76)
  })

  ctx.fillStyle = '#8FB6D4'
  ctx.font = "500 34px 'Manrope', sans-serif"
  ctx.fillText(`Edition: ${input.editionLabel}`, 96, 1465)

  ctx.fillStyle = '#6FAFE2'
  ctx.font = "700 38px 'Manrope', sans-serif"
  ctx.fillText('SOHU x XIAOMI EV', 86, 1732)

  ctx.fillStyle = '#D3E9FD'
  ctx.font = "500 30px 'Manrope', sans-serif"
  ctx.fillText('扫码即刻解锁你的专属试驾体验', 86, 1790)

  ctx.drawImage(qrImage, width - 300, 1640, 200, 200)

  return canvas.toDataURL('image/png')
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  if (words.length <= 1) {
    return [text]
  }

  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }

  if (line) {
    lines.push(line)
  }

  return lines
}
