const express = require('express')
const mongoose = require('mongoose')
const Redis = require('ioredis')

const app = express()
app.use(express.json())

// ── Bağlantılar ────────────────────────────────────────────────────
const redis = new Redis(process.env.REDIS_URL)
const CACHE_TTL = 300 // saniye

function publishLog(level, event, message) {
  const payload = JSON.stringify({
    service: 'product-service',
    level,
    event,
    message,
    ts: new Date().toISOString().substring(11, 19),
  })
  // fire-and-forget: hata olursa sessizce geç
  redis.publish('logs', payload).catch(() => {})
}

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('MongoDB bağlandı'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err))

// ── Model ──────────────────────────────────────────────────────────
// MongoDB'de şema esnek — yeni alan eklemek için migration gerekmez
const productSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String },
  price:       { type: Number, required: true },
  stock:       { type: Number, default: 0 },
  category:    { type: String },
}, { timestamps: true })

const Product = mongoose.model('Product', productSchema)

// ── Routes ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'product', lang: 'node.js', db: 'mongodb' }))

app.get('/products', async (req, res) => {
  try {
    const cached = await redis.get('products:all')
    if (cached) {
      publishLog('info', 'products.list', `Ürün listesi Redis cache'den döndü (cache hit)`)
      return res.json(JSON.parse(cached))
    }
    const docs = await Product.find().lean()
    const products = docs.map(p => ({ ...p, id: p._id }))
    await redis.setex('products:all', CACHE_TTL, JSON.stringify(products))
    publishLog('info', 'products.list', `Ürün listesi MongoDB'den çekildi, Redis'e yazıldı (${products.length} ürün)`)
    res.json(products)
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

app.get('/products/:id', async (req, res) => {
  try {
    const cached = await redis.get(`product:${req.params.id}`)
    if (cached) return res.json(JSON.parse(cached))

    const doc = await Product.findById(req.params.id).lean()
    if (!doc) return res.status(404).json({ detail: 'Product not found' })

    const product = { ...doc, id: doc._id }
    await redis.setex(`product:${req.params.id}`, CACHE_TTL, JSON.stringify(product))
    res.json(product)
  } catch (err) {
    res.status(500).json({ detail: err.message })
  }
})

app.post('/products', async (req, res) => {
  try {
    const product = await Product.create(req.body)
    await redis.del('products:all')
    publishLog('success', 'product.created', `Yeni ürün eklendi: "${product.name}" | ${product.price}₺ | Stok: ${product.stock}`)
    res.status(201).json({ id: product._id, name: product.name })
  } catch (err) {
    res.status(400).json({ detail: err.message })
  }
})

// Test ortamında listen çağrılmaz — supertest kendi transport'unu kullanır
if (require.main === module) {
  app.listen(8000, () => console.log('Product service (Node.js + MongoDB) :8000'))
}

module.exports = app
