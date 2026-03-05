import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Optional Auth Guard - Allows both authenticated and unauthenticated requests
 *
 * Use Cases:
 * - Onboarding endpoints that should work for new/unauthenticated users
 * - Public API endpoints that optionally use user context
 * - Mobile apps that don't use traditional OAuth flow
 *
 * For Onboarding:
 * - If user is authenticated via Google OAuth: uses req.user
 * - If user is not authenticated: creates a temporary session/user context from request headers
 * - Mobile apps can pass userId or sessionId in headers
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if user is authenticated via session (Google OAuth)
    if (request.isAuthenticated && request.isAuthenticated()) {
      return true;
    }

    // Check for mobile client headers (userId or sessionId)
    const userId = request.headers['x-user-id'] || request.headers['userid'];
    const sessionId =
      request.headers['x-session-id'] || request.headers['sessionid'];
    const mobileClient = request.headers['x-mobile-client'];

    // Allow mobile/unauthenticated requests with proper headers
    if (userId || sessionId || mobileClient === 'true') {
      // Create a minimal user context for unauthenticated requests
      request.user = {
        id: (userId as string) || `temp_${Date.now()}`,
        isTemporary: !userId,
      } as any;
      return true;
    }

    // Reject requests without authentication or mobile headers
    throw new HttpException(
      'Unauthorized - Please provide authentication or mobile client headers',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
