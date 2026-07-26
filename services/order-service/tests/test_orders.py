"""
Order service integration testleri.

respx: httpx isteklerini intercept eder.
product-service cevaplarını kontrol ederiz, gerçek servis ayakta olmak zorunda değil.
"""
import pytest
import respx
import httpx
from httpx import AsyncClient
from unittest.mock import AsyncMock


FAKE_PRODUCT = {
    "id": "prod-111",
    "name": "Mekanik Klavye",
    "price": 1299.0,
    "stock": 10,
}


class TestCreateOrder:
    @respx.mock
    async def test_create_order_success(self, client: AsyncClient, mocker):
        """
        Sipariş oluşturma akışı:
        1. product-service'ten ürün bilgisi alınır (mock)
        2. DB'ye kaydedilir
        3. Kafka'ya event publish edilir (mock)
        """
        # product-service HTTP çağrısını intercept et
        respx.get("http://product-service:8000/products/prod-111").mock(
            return_value=httpx.Response(200, json=FAKE_PRODUCT)
        )

        resp = await client.post("/orders/", json={
            "items": [{"product_id": "prod-111", "quantity": 2}]
        })

        assert resp.status_code == 201
        body = resp.json()
        assert "order_id" in body
        assert body["total_price"] == pytest.approx(2598.0)
        assert body["status"] == "pending"

    @respx.mock
    async def test_create_order_with_multiple_items(self, client: AsyncClient):
        respx.get("http://product-service:8000/products/prod-111").mock(
            return_value=httpx.Response(200, json=FAKE_PRODUCT)
        )
        respx.get("http://product-service:8000/products/prod-222").mock(
            return_value=httpx.Response(200, json={**FAKE_PRODUCT, "id": "prod-222", "price": 799.0})
        )

        resp = await client.post("/orders/", json={
            "items": [
                {"product_id": "prod-111", "quantity": 1},
                {"product_id": "prod-222", "quantity": 3},
            ]
        })

        assert resp.status_code == 201
        assert resp.json()["total_price"] == pytest.approx(1299.0 + 799.0 * 3)

    @respx.mock
    async def test_create_order_product_not_found_returns_400(self, client: AsyncClient):
        """product-service 404 dönünce sipariş oluşturulmamalı."""
        respx.get("http://product-service:8000/products/prod-999").mock(
            return_value=httpx.Response(404, json={"detail": "Not found"})
        )

        resp = await client.post("/orders/", json={
            "items": [{"product_id": "prod-999", "quantity": 1}]
        })

        assert resp.status_code == 400

    @respx.mock
    async def test_kafka_publish_called_on_order_created(self, client: AsyncClient, mocker):
        """Sipariş oluştuğunda Kafka'ya 'order.created' event'i gönderilmeli."""
        respx.get("http://product-service:8000/products/prod-111").mock(
            return_value=httpx.Response(200, json=FAKE_PRODUCT)
        )
        mock_publish = mocker.patch(
            "routers.orders.publish_order_created", new_callable=AsyncMock
        )

        await client.post("/orders/", json={
            "items": [{"product_id": "prod-111", "quantity": 1}]
        })

        mock_publish.assert_called_once()
        event = mock_publish.call_args[0][0]
        assert event["total_price"] == pytest.approx(1299.0)
        assert "order_id" in event
        assert "items" in event


class TestListOrders:
    @respx.mock
    async def test_list_orders_returns_only_current_users_orders(self, client: AsyncClient):
        """Kullanıcı sadece kendi siparişlerini görmeli."""
        respx.get("http://product-service:8000/products/prod-111").mock(
            return_value=httpx.Response(200, json=FAKE_PRODUCT)
        )
        await client.post("/orders/", json={"items": [{"product_id": "prod-111", "quantity": 1}]})
        await client.post("/orders/", json={"items": [{"product_id": "prod-111", "quantity": 2}]})

        resp = await client.get("/orders/")
        assert resp.status_code == 200
        orders = resp.json()
        assert len(orders) == 2

    async def test_empty_order_list(self, client: AsyncClient):
        resp = await client.get("/orders/")
        assert resp.status_code == 200
        assert resp.json() == []


class TestCancelOrder:
    @respx.mock
    async def _create_order(self, client: AsyncClient) -> str:
        respx.get("http://product-service:8000/products/prod-111").mock(
            return_value=httpx.Response(200, json=FAKE_PRODUCT)
        )
        resp = await client.post("/orders/", json={"items": [{"product_id": "prod-111", "quantity": 1}]})
        return resp.json()["order_id"]

    async def test_cancel_pending_order(self, client: AsyncClient):
        order_id = await self._create_order(client)

        resp = await client.delete(f"/orders/{order_id}")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Order cancelled"

    async def test_cancel_already_cancelled_order_returns_400(self, client: AsyncClient):
        order_id = await self._create_order(client)
        await client.delete(f"/orders/{order_id}")  # ilk iptal

        resp = await client.delete(f"/orders/{order_id}")  # aynı siparişi tekrar iptal
        assert resp.status_code == 400

    async def test_cancel_nonexistent_order_returns_404(self, client: AsyncClient):
        resp = await client.delete("/orders/olmayan-siparis-id")
        assert resp.status_code == 404
