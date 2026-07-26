"""
Örnek ürünleri product-service'e ekler.
Kullanım: python seed.py
(Stack ayakta olmalı: docker compose up -d)
"""
import httpx

PRODUCTS = [
    {"name": "Laptop Pro 15", "description": "Yüksek performanslı laptop", "price": 45999.99, "stock": 10, "category": "Elektronik"},
    {"name": "Mekanik Klavye", "description": "RGB aydınlatmalı", "price": 1299.00, "stock": 25, "category": "Elektronik"},
    {"name": "Oyuncu Mouse", "description": "16000 DPI hassasiyet", "price": 799.00, "stock": 30, "category": "Elektronik"},
    {"name": "Monitör 27\"", "description": "4K IPS panel, 144Hz", "price": 12499.00, "stock": 8, "category": "Elektronik"},
    {"name": "USB-C Hub", "description": "7-in-1 port genişletici", "price": 449.00, "stock": 50, "category": "Aksesuar"},
    {"name": "Laptop Çantası", "description": "Su geçirmez, 15.6\" uyumlu", "price": 299.00, "stock": 40, "category": "Aksesuar"},
]

def seed():
    base = "http://localhost/api/products/products/"
    with httpx.Client() as client:
        for p in PRODUCTS:
            resp = client.post(base, json=p)
            if resp.status_code == 201:
                print(f"✓ {p['name']} eklendi")
            else:
                print(f"✗ {p['name']} eklenemedi: {resp.text}")

if __name__ == "__main__":
    seed()
