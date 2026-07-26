package main

/*
Notification Service — Go ile yazılmış Kafka consumer + RabbitMQ publisher.

Neden Go?
- Goroutine'ler sayesinde concurrent consumer yazmak çok kolay
- Derlenen dil, düşük bellek kullanımı
- Mikroservis worker'ları için endüstride yaygın tercih

Akış:
  Kafka (order.created / order.cancelled)
    → bu servis consume eder
    → RabbitMQ "email_jobs" kuyruğuna job ekler
    → email-worker (Python) job'ı işler
*/

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	rdb "github.com/redis/go-redis/v9"
	kafka "github.com/segmentio/kafka-go"
)

type OrderEvent struct {
	OrderID    string                   `json:"order_id"`
	UserID     string                   `json:"user_id"`
	Items      []map[string]interface{} `json:"items"`
	TotalPrice float64                  `json:"total_price"`
}

type EmailJob struct {
	Type       string                   `json:"type"`
	UserID     string                   `json:"user_id"`
	OrderID    string                   `json:"order_id"`
	TotalPrice float64                  `json:"total_price,omitempty"`
	Items      []map[string]interface{} `json:"items,omitempty"`
}

type LogEntry struct {
	Service string `json:"service"`
	Level   string `json:"level"`
	Event   string `json:"event"`
	Message string `json:"message"`
	Ts      string `json:"ts"`
}

var redisClient *rdb.Client

func publishLog(level, event, message string) {
	if redisClient == nil {
		return
	}
	entry := LogEntry{
		Service: "notification-service",
		Level:   level,
		Event:   event,
		Message: message,
		Ts:      time.Now().UTC().Format("15:04:05"),
	}
	payload, _ := json.Marshal(entry)
	// fire-and-forget
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		redisClient.Publish(ctx, "logs", payload)
	}()
}

func publishToRabbitMQ(rabbitURL string, job EmailJob) error {
	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		return fmt.Errorf("rabbitmq bağlantı hatası: %w", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	_, err = ch.QueueDeclare("email_jobs", true, false, false, false, nil)
	if err != nil {
		return err
	}

	body, _ := json.Marshal(job)
	return ch.Publish(
		"",
		"email_jobs",
		false, false,
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
		},
	)
}

func newKafkaReader(brokers, topic, groupID string) *kafka.Reader {
	return kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{brokers},
		Topic:       topic,
		GroupID:     groupID,
		MinBytes:    1,
		MaxBytes:    10e6,
		StartOffset: kafka.FirstOffset,
	})
}

func consumeTopic(ctx context.Context, brokers, topic, groupID, rabbitURL string) {
	reader := newKafkaReader(brokers, topic, groupID)
	defer reader.Close()
	log.Printf("[%s] Kafka consumer hazır", topic)

	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("[%s] okuma hatası: %v", topic, err)
			time.Sleep(2 * time.Second)
			continue
		}

		var event OrderEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("[%s] JSON parse hatası: %v", topic, err)
			continue
		}

		shortOrder := event.OrderID
		if len(shortOrder) > 8 {
			shortOrder = shortOrder[:8]
		}

		publishLog("info", "kafka.consumed",
			fmt.Sprintf("Kafka event alındı: '%s' → sipariş #%s", topic, shortOrder))

		var job EmailJob
		switch topic {
		case "order.created":
			job = EmailJob{
				Type:       "order_confirmation",
				UserID:     event.UserID,
				OrderID:    event.OrderID,
				TotalPrice: event.TotalPrice,
				Items:      event.Items,
			}
		case "order.cancelled":
			job = EmailJob{
				Type:    "order_cancellation",
				UserID:  event.UserID,
				OrderID: event.OrderID,
			}
		}

		if err := publishToRabbitMQ(rabbitURL, job); err != nil {
			publishLog("error", "rabbitmq.error", fmt.Sprintf("RabbitMQ publish hatası: %v", err))
		} else {
			publishLog("info", "rabbitmq.published",
				fmt.Sprintf("Email job RabbitMQ kuyruğuna eklendi: %s → sipariş #%s", job.Type, shortOrder))
		}
	}
}

func main() {
	brokers := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	rabbitURL := os.Getenv("RABBITMQ_URL")
	redisURL := os.Getenv("REDIS_URL")

	if brokers == "" || rabbitURL == "" {
		log.Fatal("KAFKA_BOOTSTRAP_SERVERS ve RABBITMQ_URL gerekli")
	}

	if redisURL != "" {
		opt, err := rdb.ParseURL(redisURL)
		if err == nil {
			redisClient = rdb.NewClient(opt)
		}
	}

	ctx := context.Background()

	go consumeTopic(ctx, brokers, "order.created", "notification-go", rabbitURL)
	go consumeTopic(ctx, brokers, "order.cancelled", "notification-go", rabbitURL)

	log.Println("Notification service (Go) çalışıyor...")
	select {}
}
