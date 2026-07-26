# CLAUDE.md

Bu dosya, bu proje üzerinde çalışırken Claude Code'a (ve gelecekte projeye bakan herkese) bağlam sağlar.

## Proje hakkında

Mikroservis mimarisini öğrenmek amacıyla yapılmış, production-grade teknolojilerle kurulu bir örnek e-ticaret MVP'si. Amaç öğrenim; bu yüzden temel akışların (kayıt/login/sipariş/stok/mail) hatasız çalışması, ekstra özellik derinliğinden daha önemli.

## Ayağa kaldırma

```bash
colima start                # Docker daemon (macOS, Docker Desktop yerine)
docker-compose up --build   # standalone binary — bu makinede `docker compose` (plugin) YOK, `docker-compose` kullan
pip3 install httpx && python3 seed.py   # örnek ürünleri MongoDB'ye ekler (stack ayakta olmalı)
```

Uygulama: http://localhost:5173 · RabbitMQ paneli: http://localhost:15672 (`user`/`password`) · auth/order Swagger: `:8001/docs`, `:8003/docs`

`docker-compose.yml`'de tüm altyapı servislerinde (`postgres-*`, `redis`, `mongodb`, `kafka`, `zookeeper`, `rabbitmq`) healthcheck var; uygulama servisleri `depends_on: condition: service_healthy` ile bağımlılıklarının gerçekten hazır olmasını bekliyor. Bu yüzden `docker-compose up` sırasında servislerin health check'i geçmesi biraz zaman alır — bu normal, hata değil.

## Testler

```bash
cd services/auth-service && python3 -m pytest tests/ -v      # 17 test
cd services/order-service && python3 -m pytest tests/ -v     # 9 test
cd services/product-service && npm test                       # 8 test
```

Docker ayakta olmasa da çalışır (mock'lu). `inventory-service`, `notification-service`, `email-worker`, `log-service` için ayrı unit test yok — bu servisler yalnızca gerçek stack üzerinden (event akışını izleyerek) test edilebilir.

## Bilinmesi gereken tuhaflıklar (bug değil)

- **Gateway route'ları "çift segment" gibi görünür**: nginx `location /api/auth/` → `proxy_pass http://auth_service/` prefix'i **siler**, ama `auth-service`'in kendi route'ları `/auth/register` gibi kendi prefix'ini de taşıyor. Sonuç: gerçek istek path'i `/api/auth/auth/register` olur (`frontend/src/lib/api.ts` bunu bilerek böyle çağırıyor). Kafanı karıştırmasın, bug değil, tasarım.
- **nginx upstream IP'yi cache'ler**: Bir servisi tek başına `docker restart` edersen (örn. `docker restart order-service`) container yeni bir IP alır ama `gateway` container'ı bunu yeniden çözmez → 502 verir. Çözüm: `gateway` container'ını da restart et, ya da servisi `docker-compose up -d --build <servis>` ile güncelle (bu genelde gateway'i de otomatik yeniden başlatmaz, gerekirse manuel restart et).

## Mimari: kim kiminle konuşuyor

```
Frontend (Vite/React, :5173)
  → Nginx Gateway (:80) — tek giriş noktası, path-based routing
      → auth-service (FastAPI, PostgreSQL)     — kayıt, login, JWT
      → product-service (Express, MongoDB)     — ürün katalog, Redis cache
      → order-service (FastAPI, PostgreSQL)    — sipariş oluştur/iptal
      → inventory-service (FastAPI, PostgreSQL) — stok (gateway'den GET, Kafka'dan event)
      → log-service (FastAPI)                  — Redis Pub/Sub → SSE → frontend canlı log paneli
```

Servisler birbirini genelde **doğrudan çağırmaz** — event yayınlar, kim dinliyorsa dinler (loose coupling). İki istisna: `order-service` sipariş oluştururken ürün bilgisini almak için `product-service`'e, token doğrulamak için `auth-service`'e senkron HTTP isteği atar (bunlar için gerçek zamanlı cevap gerekiyor).

### Sipariş verildiğinde ne oluyor (uçtan uca akış)

1. Frontend → gateway → `order-service`: `POST /orders/orders/`
2. `order-service`, her `product_id` için `product-service`'e HTTP GET atıp fiyat/isim çeker, siparişi kendi PostgreSQL'ine yazar
3. `order-service`, Kafka'ya **`order.created`** event'i yayınlar (`{order_id, user_id, items, total_price}`)
4. İki servis bu event'i bağımsız olarak dinler:
   - **notification-service** (Go) → RabbitMQ'ya `email_jobs` kuyruğuna bir job ekler → **email-worker** bu job'ı işleyip mock mail "gönderir"
   - **inventory-service** (Python) → kendi PostgreSQL'inde ilgili ürünlerin `reserved` alanını `items`'daki miktar kadar artırır
5. Sipariş iptal edilirse aynı akış tersine işler: `order-service` **`order.cancelled`** event'ini `items` bilgisiyle birlikte yayınlar, `inventory-service` `reserved` alanını geri düşürür
6. Bu adımların her biri Redis Pub/Sub üzerinden `log-service`'e basılır, o da SSE ile frontend'deki canlı log paneline anlık akıtır

### Veritabanı-per-servis

Her servisin kendi DB'si var (`postgres-auth`, `postgres-order`, `postgres-inventory`, `mongodb` product için). Servisler birbirinin DB'sine asla direkt erişmez — ya HTTP ister ya Kafka/RabbitMQ event'i dinler.

## Değişiklik yaparken dikkat

- Bir servisin kodunu değiştirip `docker-compose up -d --build <servis>` yaptığında container yeni IP alır → yukarıdaki nginx cache notuna bak, gerekirse `gateway`'i de restart et.
- `inventory-service`, `notification-service`, `email-worker`'daki Kafka/RabbitMQ consumer'ları arka plan task'ında çalışır; içlerinde hata olursa (retry mekanizması olmayan bir hata) task sessizce ölebilir — loglarda "consumer started" sonrası hiçbir şey yoksa şüphelen.
