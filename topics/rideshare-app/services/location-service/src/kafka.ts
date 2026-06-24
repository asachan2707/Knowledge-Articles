import { Kafka } from 'kafkajs';

export async function createKafkaProducer() {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const kafka = new Kafka({ clientId: 'location-service', brokers });
  const producer = kafka.producer({ allowAutoTopicCreation: true });
  await producer.connect();
  return producer;
}
