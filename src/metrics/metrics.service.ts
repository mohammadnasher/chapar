import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('notifications_sent_total')
    private readonly sentCounter: Counter<string>,

    @InjectMetric('notifications_failed_total')
    private readonly failedCounter: Counter<string>,

    @InjectMetric('notification_processing_duration_seconds')
    private readonly processingHistogram: Histogram<string>,

    @InjectMetric('notification_queue_depth')
    private readonly queueDepthGauge: Gauge<string>,
  ) {}

  incrementSent(channel: string): void {
    this.sentCounter.inc({ channel });
  }

  incrementFailed(channel: string): void {
    this.failedCounter.inc({ channel });
  }

  startProcessingTimer(channel: string): () => void {
    return this.processingHistogram.startTimer({ channel });
  }

  setQueueDepth(queue: string, depth: number): void {
    this.queueDepthGauge.set({ queue }, depth);
  }
}
