import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { validationSchema } from './config/app.config';
import { HealthController } from './health/health.controller';
import { NotificationModule } from './notification/notification.module';
import { QueueModule } from './queue/queue.module';
import { TemplateModule } from './templates/template.module';
import { MetricsModule } from './metrics/metrics.module';
import { mikroOrmConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
          },
        ],
      }),
    }),
    MikroOrmModule.forRootAsync({
      useFactory: mikroOrmConfig,
    }),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
    QueueModule,
    TemplateModule,
    NotificationModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
