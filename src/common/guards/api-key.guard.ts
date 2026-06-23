import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    // API keys are high-entropy secrets, so a fast SHA-256 hash is sufficient
    // (and, unlike a bcrypt hash, contains no `$` characters that docker-compose
    // would mangle during env_file interpolation).
    const expectedHash = this.config.getOrThrow<string>('API_KEY_HASH');
    const actualHash = createHash('sha256').update(apiKey).digest('hex');

    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const actualBuf = Buffer.from(actualHash, 'hex');

    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(actualBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
