import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { NotificationLogSchema } from '../notification/entities/notification-log.entity';

export const mikroOrmConfig = (): MikroOrmModuleOptions => ({
  driver: PostgreSqlDriver,
  clientUrl: process.env.DATABASE_URL,
  entities: [NotificationLogSchema],
  migrations: {
    path: './src/migrations',
    glob: '!(*.d).{js,ts}',
  },
  debug: process.env.NODE_ENV === 'development',
});
