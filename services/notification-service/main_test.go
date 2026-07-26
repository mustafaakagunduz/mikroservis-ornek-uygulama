package main

import "testing"

// buildEmailJob, Kafka'dan bağımsız saf bir fonksiyon olduğu için testler
// gerçek Kafka/RabbitMQ bağlantısı kurmadan çalışır.

func TestBuildEmailJob_OrderCreated(t *testing.T) {
	event := OrderEvent{
		OrderID:    "order-1",
		UserID:     "user-1",
		TotalPrice: 199.90,
		Items:      []map[string]interface{}{{"product_id": "p1", "quantity": 2}},
	}

	job, ok := buildEmailJob("order.created", event)

	if !ok {
		t.Fatal("beklenen: ok=true, alınan: false")
	}
	if job.Type != "order_confirmation" {
		t.Errorf("beklenen Type=order_confirmation, alınan: %s", job.Type)
	}
	if job.OrderID != "order-1" {
		t.Errorf("beklenen OrderID=order-1, alınan: %s", job.OrderID)
	}
	if job.UserID != "user-1" {
		t.Errorf("beklenen UserID=user-1, alınan: %s", job.UserID)
	}
	if job.TotalPrice != 199.90 {
		t.Errorf("beklenen TotalPrice=199.90, alınan: %v", job.TotalPrice)
	}
	if len(job.Items) != 1 {
		t.Errorf("beklenen 1 item, alınan: %d", len(job.Items))
	}
}

func TestBuildEmailJob_OrderCancelled(t *testing.T) {
	event := OrderEvent{
		OrderID: "order-2",
		UserID:  "user-2",
		Items:   []map[string]interface{}{{"product_id": "p1", "quantity": 5}},
	}

	job, ok := buildEmailJob("order.cancelled", event)

	if !ok {
		t.Fatal("beklenen: ok=true, alınan: false")
	}
	if job.Type != "order_cancellation" {
		t.Errorf("beklenen Type=order_cancellation, alınan: %s", job.Type)
	}
	if job.OrderID != "order-2" {
		t.Errorf("beklenen OrderID=order-2, alınan: %s", job.OrderID)
	}
	// İptal mailinde ürün/tutar bilgisi taşınmamalı — sadece sipariş kimliği yeterli.
	if job.Items != nil {
		t.Errorf("beklenen Items=nil, alınan: %v", job.Items)
	}
	if job.TotalPrice != 0 {
		t.Errorf("beklenen TotalPrice=0, alınan: %v", job.TotalPrice)
	}
}

func TestBuildEmailJob_UnknownTopic(t *testing.T) {
	event := OrderEvent{OrderID: "order-3", UserID: "user-3"}

	job, ok := buildEmailJob("order.shipped", event)

	if ok {
		t.Fatal("beklenen: ok=false (bilinmeyen topic), alınan: true")
	}
	if job.Type != "" || job.OrderID != "" || job.UserID != "" {
		t.Errorf("beklenen: boş EmailJob, alınan: %+v", job)
	}
}
