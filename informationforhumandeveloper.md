# Bu Projede Kullanılan Mikroservis Patternleri

Bu dosya, projede kullanılan bilinen mikroservis mimarisi patternlerini, "neden var / hangi sorunu çözer" açıklamasıyla ve projeden gerçek örneklerle listeler. Amaç, kod okurken "bu neden böyle yapılmış" sorusuna cevap verebilmek.

---

## 1. API Gateway

**Sorun:** Frontend'in 7 farklı servisin adresini, portunu bilmesi gerekmez; tek bir kapıdan girer.

**Burada:** `gateway/nginx.conf`. Frontend sadece `http://localhost/api/...`'a istek atar, nginx path'e göre doğru servise yönlendirir:

```nginx
location /api/orders/ {
    proxy_pass http://order_service/;
}
```

Frontend arkada kaç servis olduğunu, hangi dilde yazıldığını, hangi portta çalıştığını hiç bilmez.

---

## 2. Database per Service

**Sorun:** Servisler birbirinin veritabanına direkt erişirse, bir servisin şema değişikliği diğerlerini kırar. Bağımlılık gizli ve kontrolsüz büyür.

**Burada:** Her servisin kendi DB'si var — `postgres-auth`, `postgres-order`, `postgres-inventory`, `mongodb` (product). `order-service`, ürün fiyatını görmek için `postgres-order`'a değil, `product-service`'in HTTP API'sine gider (`routers/orders.py:49`):

```python
resp = await client.get(f"{settings.product_service_url}/products/{item.product_id}")
```

---

## 3. Event-Driven Architecture / Publish-Subscribe (Kafka)

**Sorun:** `order-service`, sipariş oluşunca "bildirim gönder" ve "stok rezerve et" işlemlerini kendisi çağırırsa, yeni bir işlem eklemek (örn. "muhasebeye bildir") her seferinde order-service'in kodunu değiştirmeyi gerektirir. Servisler birbirine sıkı bağlanır.

**Burada:** `order-service`, sipariş oluşunca sadece Kafka'ya **`order.created`** event'i yayınlar (`kafka_producer.py`), kimin dinlediğini bilmez/umursamaz:

```python
await producer.send_and_wait("order.created", order_data)
```

İki farklı servis bu event'i **bağımsız** olarak dinler — biri diğerinin varlığından habersiz:
- `notification-service` (Go) → mail job'ı kuyruğa ekler
- `inventory-service` (Python) → stok rezerve eder

Yarın üçüncü bir dinleyici (örn. "analytics-service") eklemek istersen, `order-service`'e hiç dokunmazsın. Bu **loose coupling**'in tam örneği.

---

## 4. Task Queue / Competing Consumers (RabbitMQ)

**Sorun:** Mail gönderme gibi "sonucu hemen önemli olmayan, ama garanti işlenmesi gereken" işler, HTTP isteğini bekletmeden arka planda yapılmalı; birden fazla worker aynı işi iki kez yapmamalı.

**Burada:** `notification-service`, Kafka event'ini yakalayınca RabbitMQ'nun `email_jobs` kuyruğuna bir job basar. `email-worker` bu kuyruktan job'ı çeker, işler, ACK'ler (kuyruktan düşer). Worker sayısını artırırsan (`docker-compose up --scale email-worker=3`), her job sadece **bir** worker tarafından işlenir — bu "competing consumers" patterni. Kafka'daki pub/sub'dan farkı: RabbitMQ'da job bir kez tüketilir, Kafka'da event'i birden fazla bağımsız consumer grubu okuyabilir.

---

## 5. Choreography-based Saga (orkestratörsüz dağıtık işlem)

**Sorun:** Bir "sipariş" işlemi aslında üç ayrı veritabanını ilgilendiriyor (order, inventory, notification). Klasik bir monolitte bunu tek bir DB transaction'ıyla çözersin; mikroserviste böyle bir şey yok — her adım kendi servisinde, kendi DB'sinde commit edilir.

**Burada:** Merkezi bir "saga orchestrator" yok; adımlar event'lerle **koreografik** olarak zincirleniyor:

```
order-service: sipariş kaydet → order.created yayınla
  → inventory-service: event'i dinle → stok rezerve et (kendi DB'sinde commit)
  → notification-service: event'i dinle → mail job'ı kuyruğa ekle
```

İptal durumunda **compensating action** (telafi edici işlem) devreye girer: `order-service`, `order.cancelled` yayınlar, `inventory-service` bunu dinleyip rezervasyonu geri alır (`routers/orders.py:109`, `inventory-service/main.py:52-55`). Not: bu basit haliyle "tam" bir saga değil — order-service kendi iptalini zaten yaptıktan sonra event atıyor, adımlar arası hata/rollback koordinasyonu yok. Gerçek bir saga'da event kaybı veya kısmi hata durumları da yönetilir.

---

## 6. Cache-Aside (Redis)

**Sorun:** Her ürün listesi isteğinde MongoDB'ye gitmek gereksiz yük; ürün verisi sık okunur, az değişir.

**Burada:** `product-service/app.js`. Önce Redis'e bakılır, yoksa (cache miss) MongoDB'den okunup Redis'e TTL'li yazılır:

```js
const cached = await redis.get('products:all')
if (cached) return res.json(JSON.parse(cached))
// ...MongoDB'den çek...
await redis.setex('products:all', CACHE_TTL, JSON.stringify(products))   // TTL: 300s
```

Aynı pattern `auth-service`'te **token cache** için de kullanılıyor (`routers/auth.py:61`) — JWT'yi her seferinde decode etmek yerine Redis'te `token:<jwt>` → `user_id` tutulur, `/verify` önce oraya bakar.

---

## 7. Token-based Authentication + Merkezi Auth Servisi

**Sorun:** Her servis kendi kullanıcı doğrulama mantığını yazarsa (şifre kontrolü, JWT decode) hem kod tekrarı olur hem güvenlik açığı riski artar.

**Burada:** Sadece `auth-service` şifreleri ve JWT secret'ı bilir. Diğer servisler (örn. `order-service`) kullanıcıyı doğrulamak için token'ı kendisi decode etmez, `auth-service`'e senkron bir HTTP isteği atar (`order-service/routers/orders.py:29`):

```python
resp = await client.post(f"{settings.auth_service_url}/auth/verify", params={"token": token})
```

Bu, event-driven olmayan, **senkron servisler-arası çağrı** örneği — bazı işlemler (yetkilendirme gibi) gerçek zamanlı cevap gerektirir, event ile çözülemez.

---

## 8. Log Aggregation (basitleştirilmiş)

**Sorun:** 7 farklı container'ın loglarını `docker logs` ile tek tek okumak, dağıtık bir sistemde neyin ne zaman olduğunu takip etmeyi imkansızlaştırır. Gerçek dünyada bu iş ELK Stack / Loki+Grafana gibi araçlara aittir.

**Burada:** Her servis, önemli bir şey olduğunda Redis'in `logs` pub/sub kanalına küçük bir JSON mesaj basar (`log_publisher.py`, her serviste var). `log-service` bu kanala abone olur, gelen her mesajı **SSE (Server-Sent Events)** ile frontend'e anlık akıtır (`log-service/main.py`). Frontend, sayfayı yenilemeden tüm servislerin olaylarını canlı log panelinde gösterir. Küçük ölçekte gerçek log-aggregation fikrinin minimal hali.

---

## 9. Health Check API

**Sorun:** Bir servisin "container'ı ayakta" olması, "işi yapabilir durumda" olduğu anlamına gelmez (örn. henüz DB'ye bağlanmamış olabilir).

**Burada:** Her servis `/health` endpoint'i sunar. Ayrıca `docker-compose.yml`'deki altyapı servisleri (`postgres-*`, `redis`, `kafka`, `rabbitmq`, `mongodb`) için gerçek `healthcheck` tanımlı, ve uygulama servisleri `depends_on: condition: service_healthy` ile bağımlılıklarının **gerçekten** hazır olmasını bekliyor — sadece container'ın başlamış olmasını değil.

---

## 10. Externalized Configuration

**Sorun:** DB adresi, secret key gibi değerler kod içine gömülürse, ortam değiştikçe (dev/staging/prod) kod değişmek zorunda kalır.

**Burada:** Her servisin bir `config.py` (Python) dosyası var, `pydantic-settings` ile ortam değişkenlerini okuyor; değerler `docker-compose.yml`'de `environment:` altında verilir. Kod hiçbir yerde `localhost:5432` gibi sabit bir adres içermez.

---

## Bu projede bilinçli olarak *olmayan* patternler

Öğrenmeye devam ederken bakılmaya değer, ama bu MVP'de yok. Her biri için: ne olduğu ve **bu projeye nereye, nasıl eklenebileceği**.

### Service Discovery

**Ne:** Servislerin birbirini "sabit adres/port" yerine, çalışma zamanında bir kayıt merkezinden (Consul, Eureka, Kubernetes DNS...) sorup bulmasıdır. Bir servis yeniden başlayıp IP değiştirdiğinde ya da yatayda ölçeklenip 5 kopyaya çıktığında, çağıran taraf bunu otomatik öğrenir.

**Burada nasıl kullanılırdı:** Şu an `kafka`, `redis`, `order-service` gibi isimler Docker Compose'un dahili DNS'iyle çözülüyor — küçük ölçekte bu zaten "basit bir service discovery". Ama tam patternin eksikliğini şurada hissettik: bir servisi tek başına restart edince nginx eski IP'yi cache'liyor, 502 veriyor (`CLAUDE.md`'deki not). Gerçek bir service discovery (ya da en azından nginx'te `resolver` + kısa TTL ayarı) bu sorunu ortadan kaldırırdı. `order-service`'i 3 kopyaya çıkarmak istersen (`docker-compose up --scale order-service=3`) da gateway'in bu 3 instance arasında yük dağıtması için service discovery + load balancing gerekir.

### Circuit Breaker / Retry with Backoff

**Ne:** Bir servise yapılan çağrı sürekli başarısız oluyorsa, her isteği tekrar tekrar deneyip o servisi (ve kendini) daha da zorlamak yerine, bir süre "devreyi kapatıp" direkt hata dönmektir — servisin toparlanması için nefes alanı bırakır. Retry ise geçici hatalarda (network blip gibi) kısa bir bekleme ile tekrar denemektir.

**Burada nasıl kullanılırdı:** `order-service`, sipariş oluştururken `product-service`'e ve `auth-service`'e senkron HTTP isteği atıyor (`routers/orders.py:29,49`). `product-service` o an ayakta değilse veya yavaşsa, şu an `order-service` direkt patlıyor. Buraya `httpx` isteğinin etrafına birkaç kez retry (örn. `tenacity` kütüphanesi ile) ve art arda çok fazla hata olursa devreyi kısa süre kapatan basit bir circuit breaker eklenebilir — gerçek dünyada tam da bu iki senkron çağrı noktası (product-service, auth-service) böyle korunur.

### Saga Orchestrator (orkestrasyon tabanlı saga)

**Ne:** Şu an projede olan "koreografi" (her servis event'i dinleyip kendi işini yapar) yerine, sipariş sürecinin tüm adımlarını (ödeme al → stok ayır → mail gönder → başarısız olursa geri al) tek bir merkezi "orchestrator" servisin yönettiği modeldir. Orchestrator, hangi adımın başarılı/başarısız olduğunu bilir ve gerekirse telafi adımlarını sırayla tetikler.

**Burada nasıl kullanılırdı:** Şu anki akışta `inventory-service`, stok yetersizse sessizce hiçbir şey yapmıyor (stok kontrolü zaten yok) — sipariş her zaman "başarılı" kabul ediliyor. Gerçekçi bir geliştirme fikri: yeni bir `order-orchestrator` servisi eklenip, sipariş adımlarını (ödeme, stok, mail) sırayla çağırıp her birinin sonucunu beklemesi, stok yetersizse siparişi otomatik `cancelled`'a çekip zaten rezerve edilmiş diğer ürünleri geri bırakması. Küçük ölçekte öğrenmek için iyi bir "faz 2" projesi olur.

### API Composition / BFF (Backend for Frontend)

**Ne:** Frontend'in tek bir ekranda birden fazla servisten veri göstermesi gerektiğinde (örn. "sipariş detayı" sayfasında hem sipariş hem ürün hem stok bilgisi), bunu frontend'in kendisinin 3 ayrı istek atıp birleştirmesi yerine, bir "composition/aggregator" katmanının tek bir cevapta toplamasıdır. BFF ise bunun istemci tipine (web/mobil) özel bir versiyonudur.

**Burada nasıl kullanılırdı:** `OrdersPage.tsx` şu an sipariş listesini gösterirken ürün adını/fiyatını `order.items` içine sipariş anında gömülmüş haliyle kullanıyor (iyi bir tasarım kararı, ekstra çağrı gerektirmiyor). Ama "Siparişlerim" sayfasına güncel stok durumunu da eklemek istersen (örn. "bu ürün artık tükendi" uyarısı), frontend hem `order-service`'e hem `inventory-service`'e ayrı ayrı istek atmak zorunda kalır. Bunun yerine gateway seviyesinde ya da yeni bir küçük "order-detail-composer" servisinde bu iki çağrıyı birleştirip frontend'e tek response dönmek, API composition'ın tam örneği olurdu.

### Transactional Outbox

**Ne:** `order-service` gibi bir servis, hem kendi DB'sine yazıp hem Kafka'ya event basıyorsa, bu iki işlem **tek bir transaction değildir**. DB commit başarılı olup uygulama Kafka'ya event basmadan önce çökerse (ya da Kafka o an ulaşılamazsa), sipariş DB'de var ama hiçbir servis bundan haberdar olmaz — stok rezerve edilmez, mail gitmez. Outbox pattern, event'i ayrı bir "gönderilecekler" tablosuna **aynı DB transaction'ı içinde** yazıp, ayrı bir arka plan işleminin bu tabloyu okuyup Kafka'ya güvenli şekilde basmasıdır — böylece "DB'ye yazdım ama event kayboldu" senaryosu imkansız hale gelir.

**Burada nasıl kullanılırdı:** Tam olarak `order-service/routers/orders.py:62-77` — `db.commit()` ile `publish_order_created(...)` iki ayrı adım, aralarında hata payı var. Bunun yerine sipariş kaydıyla aynı transaction'da bir `outbox_events` tablosuna satır eklenip, ayrı bir worker (ya da Kafka Connect Debezium gibi bir CDC aracı) bu tabloyu okuyup Kafka'ya basacak şekilde yeniden tasarlanabilir. Bu, mikroservislerde "dual write problemi" denen çok bilinen bir tuzağın gerçek çözümüdür — projede şu an bu risk (küçük ölçekte, düşük ihtimalle de olsa) var.
