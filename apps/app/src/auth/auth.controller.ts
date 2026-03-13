import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

const ALLOWED_REDIRECT_PREFIXES = [
  'exp://',
  'elenii://',
  'http://localhost',
  'http://127.0.0.1',
  'http://10.',
  'http://192.168.',
];

function isSafeRedirect(url: string | undefined): url is string {
  if (!url) return false;
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => url.startsWith(prefix));
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Initiate Google OAuth authentication',
    description: `
Redirects the user to Google's OAuth 2.0 login page.

Pass the frontend's deep-link redirect URL as the \`state\` query param.
Google is required by the OAuth spec to return it unchanged to the callback,
so this is more reliable than sessions across redirect roundtrips.

**Frontend Implementation**:
\`\`\`javascript
const redirectUrl = AuthSession.makeRedirectUri({ ... });
const authUrl =
  'https://eleni-shepherd-be.onrender.com/auth/google?state=' +
  encodeURIComponent(redirectUrl);

WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
\`\`\`
    `,
  })
  @ApiResponse({ status: 302, description: 'Redirect to Google login page' })
  @Get('google')
  @HttpCode(302)
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Passport intercepts this and redirects to Google.
    // The `state` query param is forwarded automatically when
    // GoogleStrategy is configured with `state: true`.
  }

  @ApiOperation({
    summary: 'Google OAuth callback endpoint',
    description: `
Callback URL for Google OAuth 2.0. This endpoint:
1. Receives the authorization code from Google
2. Validates / creates the user in the database
3. Establishes a session
4. Redirects back to the frontend using the \`state\` param (mobile deep link)
   or \`SUCCESS_REDIRECT_URL\` env var (web / fallback)

For mobile, user data is appended as a \`user\` query param (JSON, URI-encoded).
    `,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with user data appended as query param',
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    console.log('[AuthController] Google OAuth callback received');

    try {
      if (!req.user) {
        console.error('[AuthController] No user data in request after OAuth');
        return res.status(401).json({
          success: false,
          message: 'Authentication failed — no user data',
        });
      }

      const oauthUser = req.user as {
        id: string;
        email: string;
        displayName: string;
        accessToken: string;
      };

      console.log('[AuthController] OAuth user:', oauthUser.email);

      const dbUser = await this.authService.validateUser(
        oauthUser.id,
        oauthUser.email,
        oauthUser.displayName,
      );

      console.log('[AuthController] DB user resolved:', dbUser);

      req.login(dbUser, (err) => {
        if (err) {
          console.error('[AuthController] Session login error:', err);
          return res.status(401).json({
            success: false,
            message: 'Session establishment failed',
          });
        }

        // --- Resolve redirect URL ---
        // Priority: state param (mobile) → env var (web) → hardcoded fallback
        const stateParam = req.query.state as string | undefined;
        const envRedirect = process.env.SUCCESS_REDIRECT_URL;

        const redirectUrl = isSafeRedirect(stateParam)
          ? stateParam
          : envRedirect || 'elenii://Onboarding';

        console.log('[AuthController] Redirect resolution:', {
          stateParam: stateParam ?? 'not set',
          envRedirect: envRedirect ?? 'not set',
          isSafe: isSafeRedirect(stateParam),
          final: redirectUrl,
        });

        // --- Build final URL ---
        // For any mobile deep link (exp:// or elenii://) append user payload
        // so the app can hydrate immediately without an extra /profile round-trip.
        const isMobileDeepLink =
          redirectUrl.startsWith('exp://') ||
          redirectUrl.startsWith('elenii://');

        if (isMobileDeepLink) {
          const userPayload = encodeURIComponent(
            JSON.stringify({
              id: String(dbUser.id),
              email: dbUser.email,
              displayName: dbUser.username,
              subscriptionTier: dbUser.subscriptionTier,
              fullname: dbUser.fullname,
            }),
          );
          const finalUrl = `${redirectUrl}?user=${userPayload}`;
          console.log('[AuthController] Mobile redirect →', finalUrl);
          return res.redirect(finalUrl);
        }

        // Web redirect — session cookie handles auth, no payload needed
        console.log('[AuthController] Web redirect →', redirectUrl);
        return res.redirect(redirectUrl);
      });
    } catch (error) {
      console.error('[AuthController] Unhandled OAuth callback error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication',
      });
    }
  }

  @ApiOperation({ summary: 'Authentication success page' })
  @ApiResponse({ status: 200, description: 'Success message' })
  @Get('success')
  async success(@Req() req: Request) {
    return { message: 'Authentication successful', user: req.user };
  }

  @ApiOperation({ summary: 'Authentication error page' })
  @ApiResponse({ status: 200, description: 'Error message' })
  @Get('error')
  async error() {
    return { message: 'Authentication failed' };
  }

  @ApiCookieAuth('sessionId')
  @ApiOperation({
    summary: 'Get authenticated user profile',
    description: `
Returns the profile of the currently authenticated user.

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('https://eleni-shepherd-be.onrender.com/auth/profile', {
  credentials: 'include',
});
const user = await response.json();
\`\`\`
    `,
  })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @Get('profile')
  async getProfile(@Req() req: Request) {
    console.log('[AuthController] Profile request, user:', req.user);
    if (!req.user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = req.user as any;

    return {
      id: String(user.id || user._id),
      displayName: user.username || user.displayName || '',
      email: user.email,
      googleId: user.googleId,
      subscriptionTier: user.subscriptionTier || 'free',
      fullname: user.fullname || null,
    };
  }

  @ApiCookieAuth('sessionId')
  @ApiOperation({
    summary: 'Logout user',
    description: 'Destroys the current session and logs the user out.',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 500, description: 'Logout failed' })
  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    req.logout((err) => {
      if (err) {
        console.error('[AuthController] Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      console.log('[AuthController] User logged out');
      return res.json({ message: 'Logged out successfully' });
    });
  }
}
