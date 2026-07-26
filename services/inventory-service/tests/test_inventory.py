from models import InventoryItem
from main import apply_order_event


class TestApplyOrderEvent:
    """
    Kafka'dan gelen order.created / order.cancelled event'lerinin stok üzerindeki
    etkisini test eder. Gerçek Kafka'ya ihtiyaç yok — event'i doğrudan bir dict
    olarak apply_order_event'e veriyoruz.
    """

    async def test_order_created_reserves_stock(self, db_session):
        event = {"items": [{"product_id": "p1", "quantity": 3}]}
        await apply_order_event("order.created", event, db_session)

        item = await db_session.get(InventoryItem, "p1")
        assert item.reserved == 3

    async def test_order_created_multiple_items(self, db_session):
        event = {"items": [
            {"product_id": "p1", "quantity": 2},
            {"product_id": "p2", "quantity": 5},
        ]}
        await apply_order_event("order.created", event, db_session)

        assert (await db_session.get(InventoryItem, "p1")).reserved == 2
        assert (await db_session.get(InventoryItem, "p2")).reserved == 5

    async def test_order_created_existing_item_increments(self, db_session):
        await apply_order_event("order.created", {"items": [{"product_id": "p1", "quantity": 2}]}, db_session)
        await apply_order_event("order.created", {"items": [{"product_id": "p1", "quantity": 4}]}, db_session)

        item = await db_session.get(InventoryItem, "p1")
        assert item.reserved == 6

    async def test_order_cancelled_releases_stock(self, db_session):
        await apply_order_event("order.created", {"items": [{"product_id": "p1", "quantity": 5}]}, db_session)
        await apply_order_event("order.cancelled", {"items": [{"product_id": "p1", "quantity": 5}]}, db_session)

        item = await db_session.get(InventoryItem, "p1")
        assert item.reserved == 0

    async def test_order_cancelled_does_not_go_below_zero(self, db_session):
        # Bilinen bug'ın regresyon testi: iptal miktarı rezerveden fazla olsa bile
        # reserved negatife düşmemeli.
        await apply_order_event("order.created", {"items": [{"product_id": "p1", "quantity": 2}]}, db_session)
        await apply_order_event("order.cancelled", {"items": [{"product_id": "p1", "quantity": 10}]}, db_session)

        item = await db_session.get(InventoryItem, "p1")
        assert item.reserved == 0

    async def test_event_without_items_does_nothing(self, db_session):
        await apply_order_event("order.created", {}, db_session)

        rows = (await db_session.execute(InventoryItem.__table__.select())).fetchall()
        assert rows == []


class TestInventoryAPI:
    async def test_get_unknown_product_returns_zero(self, client):
        ac, _ = client
        resp = await ac.get("/inventory/does-not-exist")
        assert resp.status_code == 200
        assert resp.json() == {"product_id": "does-not-exist", "reserved": 0}

    async def test_list_inventory_empty(self, client):
        ac, _ = client
        resp = await ac.get("/inventory/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_inventory_returns_items(self, client):
        ac, TestSession = client
        async with TestSession() as session:
            session.add(InventoryItem(product_id="p1", reserved=7))
            await session.commit()

        resp = await ac.get("/inventory/")
        assert resp.status_code == 200
        assert resp.json() == [{"product_id": "p1", "reserved": 7}]

    async def test_get_existing_product(self, client):
        ac, TestSession = client
        async with TestSession() as session:
            session.add(InventoryItem(product_id="p2", reserved=3))
            await session.commit()

        resp = await ac.get("/inventory/p2")
        assert resp.status_code == 200
        assert resp.json() == {"product_id": "p2", "reserved": 3}
