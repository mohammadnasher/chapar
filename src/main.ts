import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const config = app.get(ConfigService);

  // Optionally apply pending database migrations on startup. Enable this on a
  // single instance (e.g. the API) to avoid races between replicas.
  if (config.get<boolean>('RUN_MIGRATIONS', false)) {
    const orm = app.get(MikroORM);
    await orm.migrator.up();
    Logger.log('Database migrations applied', 'Bootstrap');
  }

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = config.get<number>('PORT', 3000);

  await app.listen(port);
}

bootstrap();
