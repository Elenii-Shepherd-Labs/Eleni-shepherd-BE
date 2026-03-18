import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  UnauthorizedException,
  BadRequestException,
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
import passport from 'passport';
import { GoogleAuthGuard } from './google-auth.guard';

const ALLOWED_REDIRECT_PREFIXES = [
  'exp://',
  'elenii://',
  'https://',
  'http://localhost',
  'http://127.0.0.1',
  'http://10.',
  'http://192.168.',
];

function isSafeRedirect(url: string | undefined): url is string {
  if (!url) return false;
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function isMobileRedirect(url: string) {
  return url.startsWith('exp://') || url.startsWith('elenii://');
}

function resolveDirectRedirectUrl(stateParam?: string) {
  if (isSafeRedirect(stateParam)) {
    return {
      redirectUrl: stateParam,
      source: 'state-direct',
    } as const;
  }

  return null;
}

function appendQueryParam(url: string, key: string, value: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

function getRequestOrigin(req: Request) {
  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.length > 0
      ? forwardedProto.split(',')[0].trim()
      : req.protocol;

  const forwardedHostHeader = req.headers['x-forwarded-host'];
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : forwardedHostHeader;
  const host =
    typeof forwardedHost === 'string' && forwardedHost.length > 0
      ? forwardedHost.split(',')[0].trim()
      : req.get('host');

  return `${protocol}://${host}`;
}

function buildGoogleCallbackUrl(req: Request) {
  const configuredCallbackUrl = process.env.GOOGLE_CALLBACK_URL?.trim();
  if (configuredCallbackUrl) {
    return configuredCallbackUrl;
  }

  return `${getRequestOrigin(req)}/auth/google/callback`;
}

function toClientFullname(
  fullname?:
    | {
        firstname?: string;
        lastname?: string;
        middlename?: string;
      }
    | null,
) {
  if (!fullname) {
    return null;
  }

  return {
    firstName: fullname.firstname || '',
    lastName: fullname.lastname || '',
    middleName: fullname.middlename || '',
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthGuard: GoogleAuthGuard,
  ) {}

  private toMobileUserPayload(user: any) {
    return {
      id: String(user.id || user._id),
      displayName: user.username || '',
      email: user.email,
      googleId: user.googleId,
      onboardingComplete: Boolean(user.onboardingComplete),
      subscriptionTier: user.subscriptionTier || 'free',
      fullname: toClientFullname(user.fullname),
    };
  }

  private getBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    const altHeader = req.headers['x-mobile-auth'];
    if (typeof altHeader === 'string') {
      return altHeader;
    }

    return null;
  }

  private async resolveRequestUser(req: Request) {
    if (req.user) {
      return req.user as any;
    }

    const mobileToken = this.getBearerToken(req);
    if (!mobileToken) {
      return null;
    }

    return this.authService.findUserByMobileAuthToken(mobileToken);
  }

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
  async googleAuth(@Req() req: Request, @Res() res: Response) {
    const redirectUrl = req.query.state as string | undefined;
    const resolvedRedirect = resolveDirectRedirectUrl(redirectUrl);

    if (!resolvedRedirect) {
      console.error('[AuthController] Missing or unsafe OAuth start redirect', {
        stateParam: redirectUrl ?? 'not set',
      });
      return res.status(400).send('Missing or invalid OAuth redirect state');
    }

    const oauthState = this.authService.createOAuthRedirectState(
      resolvedRedirect.redirectUrl,
    );
    const callbackURL = buildGoogleCallbackUrl(req);

    console.log('[AuthController] OAuth start redirect resolution:', {
      stateParam: redirectUrl,
      oauthState,
      callbackURL,
      finalRedirect: resolvedRedirect.redirectUrl,
    });

    passport.authenticate(
      'google',
      {
        scope: ['email', 'profile'],
        state: oauthState,
        callbackURL,
      } as any,
    )(req, res);
  }

  @ApiOperation({
    summary: 'Google OAuth callback endpoint',
    description: `
Callback URL for Google OAuth 2.0. This endpoint:
1. Receives the authorization code from Google
2. Validates / creates the user in the database
3. Establishes a session
4. Redirects back to the frontend using the validated client-provided
   \`state\` param

For mobile, a short-lived \`exchangeCode\` is appended so the app can
exchange it for a mobile auth token and user payload.
    `,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with mobile auth exchange metadata',
  })
  @ApiResponse({ status: 401, description: 'Authentication failed' })
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
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

        // Redirect target is client-owned. We only honor a safe request-scoped `state`.
        const stateParam = req.query.state as string | undefined;
        const storedRedirectUrl = stateParam
          ? this.authService.consumeOAuthRedirectState(stateParam)
          : null;
        const resolvedRedirect =
          (storedRedirectUrl
            ? {
                redirectUrl: storedRedirectUrl,
                source: 'state-store',
              }
            : null) ?? resolveDirectRedirectUrl(stateParam);

        if (!resolvedRedirect) {
          console.error('[AuthController] Missing or unsafe redirect state', {
            stateParam: stateParam ?? 'not set',
          });
          return res.status(400).send('Missing or invalid OAuth redirect state');
        }

        const { redirectUrl, source } = resolvedRedirect;

        console.log('[AuthController] Redirect resolution:', {
          stateParam: stateParam ?? 'not set',
          isSafe: isSafeRedirect(stateParam),
          source,
          final: redirectUrl,
        });

        // --- Build final URL ---
        // For mobile deep links we append a short-lived exchange code so the
        // app can bootstrap its own durable mobile auth token.
        const isMobileDeepLink = isMobileRedirect(redirectUrl);

        if (isMobileDeepLink) {
          const exchangeCode = this.authService.createMobileExchangeCode(
            String(dbUser.id || dbUser._id),
          );
          const finalUrl = appendQueryParam(
            appendQueryParam(redirectUrl, 'exchangeCode', exchangeCode),
            'authStatus',
            'success',
          );
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

  @ApiOperation({
    summary: 'Exchange mobile auth callback code for a mobile auth token',
  })
  @ApiResponse({ status: 200, description: 'Mobile auth token issued' })
  @ApiResponse({ status: 400, description: 'Exchange code invalid or expired' })
  @Post('mobile/exchange')
  async exchangeMobileAuth(@Body() body: { exchangeCode?: string }) {
    if (!body?.exchangeCode) {
      throw new BadRequestException('exchangeCode is required');
    }

    const user = await this.authService.consumeMobileExchangeCode(
      body.exchangeCode,
    );

    if (!user) {
      throw new BadRequestException('exchangeCode is invalid or expired');
    }

    return {
      success: true,
      message: 'Mobile authentication established',
      data: {
        authToken: this.authService.issueMobileAuthToken(user),
        user: this.toMobileUserPayload(user),
      },
      status: 200,
    };
  }

  @ApiOperation({
    summary: 'Verify a Google ID token for native/mobile sign-in',
  })
  @ApiResponse({ status: 200, description: 'Google ID token verified' })
  @ApiResponse({ status: 400, description: 'idToken missing or invalid' })
  @Post('mobile/google/verify')
  async verifyMobileGoogleToken(@Body() body: { idToken?: string }) {
    if (!body?.idToken) {
      throw new BadRequestException('idToken is required');
    }

    try {
      const user = await this.authService.validateMobileGoogleUser(body.idToken);

      return {
        success: true,
        message: 'Google mobile authentication established',
        data: {
          authToken: this.authService.issueMobileAuthToken(user),
          user: this.toMobileUserPayload(user),
        },
        status: 200,
      };
    } catch (error) {
      throw new BadRequestException('Google ID token is invalid');
    }
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
    const user = await this.resolveRequestUser(req);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return {
      id: String(user.id || user._id),
      displayName: user.username || user.displayName || '',
      email: user.email,
      googleId: user.googleId,
      onboardingComplete: Boolean(user.onboardingComplete),
      subscriptionTier: user.subscriptionTier || 'free',
      fullname: toClientFullname(user.fullname),
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
