const IMAGE_RULES: { match: RegExp; image: string }[] = [
  { match: /laptop.*(çanta|canta)/i, image: '/products/bag.svg' },
  { match: /laptop/i, image: '/products/laptop.svg' },
  { match: /klavye/i, image: '/products/keyboard.svg' },
  { match: /mouse/i, image: '/products/mouse.svg' },
  { match: /monit(ö|o)r/i, image: '/products/monitor.svg' },
  { match: /hub/i, image: '/products/usb-hub.svg' },
  { match: /çanta|canta/i, image: '/products/bag.svg' },
]

const CATEGORY_FALLBACK: Record<string, string> = {
  Elektronik: '/products/laptop.svg',
  Aksesuar: '/products/usb-hub.svg',
}

export function getProductImage(name: string, category?: string | null): string {
  const rule = IMAGE_RULES.find((r) => r.match.test(name))
  if (rule) return rule.image
  if (category && CATEGORY_FALLBACK[category]) return CATEGORY_FALLBACK[category]
  return '/products/laptop.svg'
}
