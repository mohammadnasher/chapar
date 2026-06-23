/**
 * CommonJS stub for @mikro-orm/nestjs (also ESM-only).
 *
 * Reproduces the repository-token convention so that `InjectRepository(Entity)`
 * in the service and `getRepositoryToken(Entity)` in the test resolve to the
 * exact same token, allowing the mocked repository to be injected.
 */
import { Inject } from '@nestjs/common';

export function getRepositoryToken(entity: { name: string }): string {
  return `${entity.name}Repository`;
}

export function InjectRepository(entity: { name: string }): ParameterDecorator {
  return Inject(getRepositoryToken(entity));
}
