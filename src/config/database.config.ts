import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { NotificationLogSchema } from '../notification/entities/notification-log.entity';

export const mikroOrmConfig = (): MikroOrmModuleOptions => {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    driver: PostgreSqlDriver,
    clientUrl: process.env.DATABASE_URL,
    entities: [NotificationLogSchema],
    extensions: [Migrator],
    migrations: {
      // Compiled JS at runtime (prod), TypeScript sources in development.
      path: isProd ? './dist/migrations' : './src/migrations',
      glob: '!(*.d).{js,ts}',
      tableName: 'mikro_orm_migrations',
      transactional: true,
    },
    debug: !isProd,
  };
};
