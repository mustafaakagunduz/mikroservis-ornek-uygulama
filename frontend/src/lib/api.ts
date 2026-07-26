import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auth
export const register = (data: { email: string; password: string; full_name: string }) =>
  api.post('/auth/auth/register', data)

export const login = (email: string, password: string) => {
  const form = new FormData()
  form.append('username', email)
  form.append('password', password)
  return api.post('/auth/auth/login', form)
}

// Products
export const getProducts = () => api.get('/products/products/')
export const getProduct = (id: string) => api.get(`/products/products/${id}`)

// Orders
export const createOrder = (items: { product_id: string; quantity: number }[]) =>
  api.post('/orders/orders/', { items })

export const getOrders = () => api.get('/orders/orders/')
export const cancelOrder = (id: string) => api.delete(`/orders/orders/${id}`)

// Inventory
export const getInventory = () => api.get('/inventory/inventory/')
