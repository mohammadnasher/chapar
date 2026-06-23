import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const storedHash = this.config.getOrThrow<string>('API_KEY_HASH');
    const isValid = await bcrypt.compare(apiKey, storedHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
