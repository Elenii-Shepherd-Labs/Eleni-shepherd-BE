import { Controller, Get, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Initiate Google OAuth authentication',
    description: `
Redirects the user to Google's OAuth 2.0 login page.

**Frontend Implementation**:
\`\`\`javascript
window.location.href = 'http://localhost:3000/auth/google';
\`\`\`

After successful authentication at Google, the user is redirected to the callback endpoint.
    `,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to Google login page',
  })
  @Get('google')
  @HttpCode(302)
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    console.log('[AuthController] Initiating Google OAuth');
    // store desired redirect in session if provided
    const desired = req.query.redirectUrl as string | undefined;
    if (desired) {
      console.log('[AuthController] saving redirectUrl to session:', desired);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req.session as any).redirectUrl = desired;
    }
    // Initiates Google OAuth authentication
  }

  @ApiOperation({
    summary: 'Google OAuth callback endpoint',
    description: `
Callback URL for Google OAuth 2.0. This endpoint:
1. Receives the authorization code from Google
2. Validates/creates the user in the database
3. Establishes a session for the user
4. Returns a JSON payload containing user info and a client redirect URL

**Note**: This is called automatically by Google. Frontend developers do not call this directly; the frontend should read the redirect URL from the response and navigate there.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful, returns user data and redirect URL',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        redirectUrl: { type: 'string', example: '/auth/success' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'google-id-123' },
            email: { type: 'string', example: 'user@example.com' },
            displayName: { type: 'string', example: 'John Doe' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    schema: {
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Authentication failed' },
      },
    },
  })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    console.log('[AuthController] Google OAuth callback received');
    try {
      if (!req.user) {
        console.log('[AuthController] No user data in request');
        return res.status(401).json({
          success: false,
          message: 'Authentication failed - no user data',
        });
      }

      console.log('[AuthController] User data:', req.user);
      const user = req.user;
      const dbUser = await this.authService.validateUser(
        user['id'],
        user['email'],
        user['displayName'],
      );
      console.log('[AuthController] DB User:', dbUser);

      req.login(dbUser, (err) => {
        if (err) {
          console.log('[AuthController] Session login error:', err);
          return res.status(401).json({
            success: false,
            message: 'Session establishment failed',
          });
        }

        // Determine redirect URL
        // Priority: session redirectUrl → env SUCCESS_REDIRECT_URL → default
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionRedirect = (req.session as any)?.redirectUrl as string | undefined;
        const envRedirect = process.env.SUCCESS_REDIRECT_URL;
        const redirectUrl = sessionRedirect || envRedirect || 'elenii://Onboarding';
        
        console.log('[AuthController] Redirect URL resolution:', {
          sessionRedirect: sessionRedirect ? 'set' : 'not set',
          envRedirect: envRedirect ? 'set' : 'not set',
          final: redirectUrl,
          sessionId: req.sessionID,
        });

        // For mobile deep links, append user data as query param
        if (redirectUrl.startsWith('elenii://') || redirectUrl.startsWith('exp://')) {
          const userData = encodeURIComponent(JSON.stringify({
            id: dbUser.googleId,
            email: dbUser.email,
            displayName: dbUser.username,
          }));
          console.log('[AuthController] Appending user data to redirect:', redirectUrl);
          return res.redirect(`${redirectUrl}?user=${userData}`);
        } else {
          // For web, redirect normally (session-based)
          console.log('[AuthController] Web redirect to:', redirectUrl);
          return res.redirect(redirectUrl);
        }
      });
    } catch (error) {
      console.error('[AuthController] OAuth callback error:', error);
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
      });
    }
  }

  @ApiOperation({
    summary: 'Authentication success page',
    description: 'Simple success page shown after successful authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Success message',
    schema: {
      properties: {
        message: { type: 'string', example: 'Authentication successful' },
      },
    },
  })
  @Get('success')
  async success(@Req() req: Request) {
    return { message: 'Authentication successful', user: req.user };
  }

  @ApiOperation({
    summary: 'Authentication error page',
    description: 'Error page shown if authentication fails',
  })
  @ApiResponse({
    status: 200,
    description: 'Error message',
    schema: {
      properties: {
        message: { type: 'string', example: 'Authentication failed' },
      },
    },
  })
  @Get('error')
  async error() {
    return { message: 'Authentication failed' };
  }

  @ApiOperation({
    summary: 'Get authenticated user profile',
    description: `
Returns the profile of the currently authenticated user.
**Authentication**: Required (via session cookie)

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/auth/profile', {
  credentials: 'include', // Important: include session cookie
});
const user = await response.json();
\`\`\`

**Response Data Structure**:
\`\`\`json
{
  "id": "google-id-123",
  "email": "user@example.com",
  "displayName": "John Doe",
  "photos": [
    {
      "value": "https://lh3.googleusercontent.com/..."
    }
  ]
}
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      properties: {
        id: { type: 'string', example: 'google-id-123' },
        email: { type: 'string', example: 'user@example.com' },
        displayName: { type: 'string', example: 'John Doe' },
        photos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', description: 'Profile photo URL' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'User not authenticated. Redirect to /auth/google',
  })
  @Get('profile')
  async getProfile(@Req() req: Request) {
    console.log('[AuthController] Profile request, user:', req.user);
    return req.user;
  }

  @ApiOperation({
    summary: 'Logout user',
    description: `
Destroys the current user session and logs them out.

**Authentication**: Required (via session cookie)

**Frontend Implementation**:
\`\`\`javascript
// Option 1: Simple redirect
window.location.href = 'http://localhost:3000/auth/logout';

// Option 2: Fetch with redirect
const response = await fetch('http://localhost:3000/auth/logout', {
  credentials: 'include',
});
// After logout, redirect to login
window.location.href = '/login';
\`\`\`

**Post-Logout**: User must re-authenticate by visiting /auth/google.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully',
    schema: {
      properties: {
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Logout failed (rare)',
    schema: {
      properties: {
        message: { type: 'string', example: 'Logout failed' },
      },
    },
  })
  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  }
}
