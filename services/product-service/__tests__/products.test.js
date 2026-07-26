/**
 * Product service unit testleri — Jest + supertest
 *
 * Mongoose ve ioredis tamamen mock'lanır.
 * Gerçek DB veya Redis bağlantısı gerekmez.
 * Testler milisaniyeler içinde çalışır.
 */
const request = require('supertest')

// ── Mock'lar — app.js'i require etmeden önce tanımlanmalı ──────────

// ioredis mock: get, set, setex, del, publish metodları
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  publish: jest.fn().mockResolvedValue(1),
}
jest.mock('ioredis', () => jest.fn(() => mockRedis))

// mongoose mock: connect + Model
const mockProduct = {
  _id: 'mongo-id-123',
  id: 'mongo-id-123',
  name: 'Mekanik Klavye',
  price: 1299,
  stock: 10,
  category: 'Elektronik',
}

const mockProductModel = {
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}

jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(true),
  Schema: jest.fn().mockImplementation(() => ({})),
  model: jest.fn(() => mockProductModel),
}))

// app'i mock'lar tanımlandıktan sonra yükle
const app = require('../app')

// ── Her testten önce mock'ları sıfırla ────────────────────────────
beforeEach(() => {
  jest.clearAllMocks()
  // publish her zaman başarılı olsun
  mockRedis.publish.mockResolvedValue(1)
})

// ─────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('service, dil ve DB bilgisini döndürmeli', async () => {
    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.service).toBe('product')
    expect(res.body.lang).toBe('node.js')
    expect(res.body.db).toBe('mongodb')
  })
})

// ─────────────────────────────────────────────────────────────────
describe('GET /products', () => {
  it('Redis cache hit — MongoDB sorgusu yapılmamalı', async () => {
    const cachedList = [mockProduct]
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedList))

    const res = await request(app).get('/products')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(cachedList)
    // Cache hit'te MongoDB'ye gidilmemeli
    expect(mockProductModel.find).not.toHaveBeenCalled()
  })

  it('Redis cache miss — MongoDB sorgulanmalı ve sonuç cache\'e yazılmalı', async () => {
    mockRedis.get.mockResolvedValue(null) // cache yok
    mockProductModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([mockProduct]),
    })

    const res = await request(app).get('/products')

    expect(res.status).toBe(200)
    expect(mockProductModel.find).toHaveBeenCalledTimes(1)
    // Cache'e yazıldı mı?
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'products:all',
      expect.any(Number),
      expect.any(String)
    )
  })
})

// ─────────────────────────────────────────────────────────────────
describe('GET /products/:id', () => {
  it('var olan ürünü döndürmeli', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockProductModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockProduct),
    })

    const res = await request(app).get('/products/mongo-id-123')

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Mekanik Klavye')
    expect(res.body.price).toBe(1299)
  })

  it('bulunamayan ürün için 404 dönmeli', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockProductModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    })

    const res = await request(app).get('/products/olmayan-id')

    expect(res.status).toBe(404)
    expect(res.body.detail).toBe('Product not found')
  })

  it('cache hit\'te MongoDB sorgusu yapılmamalı', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify(mockProduct))

    const res = await request(app).get('/products/mongo-id-123')

    expect(res.status).toBe(200)
    expect(mockProductModel.findById).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────
describe('POST /products', () => {
  it('yeni ürün oluşturulmalı ve liste cache temizlenmeli', async () => {
    const newProduct = { ...mockProduct, name: 'Yeni Ürün' }
    mockProductModel.create.mockResolvedValue(newProduct)

    const res = await request(app)
      .post('/products')
      .send({ name: 'Yeni Ürün', price: 999, stock: 5 })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Yeni Ürün')
    // Ürün listesi cache'i invalidate edilmeli
    expect(mockRedis.del).toHaveBeenCalledWith('products:all')
  })

  it('mongoose hatası durumunda 400 dönmeli', async () => {
    mockProductModel.create.mockRejectedValue(new Error('validation failed'))

    const res = await request(app)
      .post('/products')
      .send({ price: 999 }) // name eksik

    expect(res.status).toBe(400)
    expect(res.body.detail).toBe('validation failed')
  })
})
