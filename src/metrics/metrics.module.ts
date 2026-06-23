import { Module } from '@nestjs/common';
import { makeCounterProvider, makeHistogramProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Module({
  providers: [
    MetricsService,
    makeCounterProvider({
      name: 'notifications_sent_total',
      help: 'Total number of notifications successfully sent',
      labelNames: ['channel'],
    }),
    makeCounterProvider({
      name: 'notifications_failed_total',
      help: 'Total number of notifications that failed after all retries',
      labelNames: ['channel'],
    }),
    makeHistogramProvider({
      name: 'notification_processing_duration_seconds',
      help: 'Duration of notification processing in seconds',
      labelNames: ['channel'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    }),
    makeGaugeProvider({
      name: 'notification_queue_depth',
      help: 'Current number of jobs waiting in the notification queue',
      labelNames: ['queue'],
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
