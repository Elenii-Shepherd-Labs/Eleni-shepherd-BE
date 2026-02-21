import { Controller, Get, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
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
    // Initiates Google OAuth authentication
  }

  @ApiOperation({
    summary: 'Google OAuth callback endpoint',
    description: `
Callback URL for Google OAuth 2.0. This endpoint:
1. Receives the authorization code from Google
2. Validates/creates the user in the database
3. Establishes a session for the user
4. Redirects to home page

**Note**: This is called automatically by Google. Frontend developers do not call this directly.
    `,
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to home page on success or login error page on failure',
  })
  @Get('google/callback')
  @HttpCode(302)
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    // Validate or create user
    const dbUser = await this.authService.validateUser(
      user['id'],
      user['email'],
      user['displayName'],
    );
    // Store user in session or return token
    req.login(dbUser, (err) => {
      if (err) {
        return res.redirect('/login?error=true');
      }
      res.redirect('/');
    });
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