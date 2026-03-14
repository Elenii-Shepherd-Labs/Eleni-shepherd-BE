import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { isValidObjectId } from 'mongoose';
import { verifyMobileAuthToken } from '../../auth/mobile-auth.util';

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

    const authorizationHeader = request.headers.authorization;
    if (
      typeof authorizationHeader === 'string' &&
      authorizationHeader.startsWith('Bearer ')
    ) {
      const token = authorizationHeader.slice('Bearer '.length);
      const payload = verifyMobileAuthToken(token);
      if (payload?.sub && isValidObjectId(payload.sub)) {
        request.user = {
          id: payload.sub,
          isTemporary: false,
          authType: 'mobile-token',
        } as any;
        return true;
      }
    }

    // Check for mobile client headers (userId or sessionId)
    const userId = request.headers['x-user-id'] || request.headers['userid'];
    const sessionId =
      request.headers['x-session-id'] || request.headers['sessionid'];
    const mobileClient = request.headers['x-mobile-client'] || request.headers['x-client-type'] === 'mobile';

    // Allow mobile/unauthenticated requests with a valid backend user id
    if (typeof userId === 'string' && isValidObjectId(userId)) {
      request.user = {
        id: userId,
        isTemporary: false,
      } as any;
      return true;
    }

    // Allow the request through for mobile/session-based clients, but do not
    // synthesize a fake user id. Controllers can decide whether user context
    // is optional or required for the specific endpoint.
    if (sessionId || mobileClient) {
      return true;
    }

    // Reject requests without authentication or mobile headers
    throw new HttpException(
      'Unauthorized - Please provide authentication or mobile client headers',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
