import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EntityManager } from '@mikro-orm/core';
import {
  NotificationLog,
  NotificationStatus,
} from '../notification/entities/notification-log.entity';
import { ProviderFactory } from '../providers/provider.factory';
import { TemplateService } from '../templates/template.service';
import { MetricsService } from '../metrics/metrics.service';
import { NOTIFICATION_QUEUE, NotificationJobData } from './queue.constants';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly em: EntityManager,
    private readonly providerFactory: ProviderFactory,
    private readonly templateService: TemplateService,
    private readonly metricsService: MetricsService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { logId, channel, recipient, templateId, variables, subject } =
      job.data;

    // Workers run outside the Nest request context, so fork a dedicated
    // EntityManager per job rather than using the (disallowed) global instance.
    const em = this.em.fork();
    const log = await em.findOneOrFail(NotificationLog, { id: logId });
    log.attempts++;

    const timer = this.metricsService.startProcessingTimer(channel);

    try {
      const body = await this.templateService.render(templateId, variables);
      const provider = this.providerFactory.getProvider(channel);

      await provider.send({
        channel,
        recipient,
        subject,
        body,
        metadata: variables,
      });

      log.status = NotificationStatus.SENT;
      this.metricsService.incrementSent(channel);

      this.logger.log(
        `Job ${job.id} dispatched via ${channel} to ${recipient}`,
      );
    } catch (err: any) {
      log.status = NotificationStatus.FAILED;
      log.errorMessage = err?.message ?? String(err);

      this.metricsService.incrementFailed(channel);

      this.logger.error(
        `Job ${job.id} failed (attempt ${log.attempts}): ${err?.message}`,
      );

      throw err; // re-throw so BullMQ handles retry/backoff
    } finally {
      timer();
      await em.flush();
    }
  }
}
