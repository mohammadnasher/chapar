import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().uri().required(),
  RUN_MIGRATIONS: Joi.boolean().default(false),

  // Redis (BullMQ)
  REDIS_URL: Joi.string().uri().required(),

  // Security
  API_KEY_HASH: Joi.string().required(),

  // Throttler
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // KavehNegar SMS
  KAVEHNEGAR_API_KEY: Joi.string().optional(),

  // SMTP Email
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM: Joi.string().email().optional(),

  // Push: Firebase vs Redis Pub/Sub
  FIREBASE_NOTIFICATION: Joi.boolean().default(false),
  FIREBASE_CREDENTIALS_JSON: Joi.string().when('FIREBASE_NOTIFICATION', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  REDIS_PUBSUB_URL: Joi.string().uri().when('FIREBASE_NOTIFICATION', {
    is: false,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  REDIS_PUBSUB_CHANNEL_PREFIX: Joi.string().default('notifications'),
});
