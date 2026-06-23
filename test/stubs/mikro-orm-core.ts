/**
 * CommonJS stub for @mikro-orm/core.
 *
 * The real package is ESM-only (`"type": "module"` and uses `import.meta`),
 * which Jest's CommonJS runtime cannot load. The e2e tests mock the database
 * layer anyway, so we only need the few symbols referenced at module-load time
 * and as DI tokens: EntitySchema (instantiated by the entity definition),
 * EntityManager (used as an injection token) and EntityRepository (type only).
 */
export class EntitySchema {
  constructor(options?: unknown) {
    void options;
  }
}

export class EntityManager {}

export class EntityRepository<T = unknown> {
  // Marker to retain the generic parameter without an unused-type warning.
  declare readonly __entity?: T;
}
