import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ) {
    const request = context.switchToHttp().getRequest();

    if (err) {
      this.logger.error('Google OAuth guard error', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        oauthError: err?.oauthError?.data || err?.oauthError,
        query: request?.query,
        originalUrl: request?.originalUrl,
      });
      throw err;
    }

    if (!user) {
      this.logger.warn('Google OAuth guard rejected request', {
        info,
        query: request?.query,
        originalUrl: request?.originalUrl,
      });
      throw new UnauthorizedException(info?.message || 'Unauthorized');
    }

    return user;
  }
}
