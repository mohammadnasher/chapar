import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

/**
 * Public health endpoint used by the Docker HEALTHCHECK and Kubernetes
 * readiness/liveness probes. It is intentionally NOT behind the ApiKeyGuard
 * (which is applied at the NotificationController level), so probes can reach
 * it without credentials.
 */
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
