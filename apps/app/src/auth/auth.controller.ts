import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Initiate Google OAuth authentication' })
  @ApiResponse({ status: 302, description: 'Redirects to Google login' })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    // Initiates Google OAuth authentication
  }

  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @ApiResponse({ status: 302, description: 'Redirects after successful authentication' })
  @Get('google/callback')
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

  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile' })
  @Get('profile')
  async getProfile(@Req() req: Request) {
    return req.user;
  }

  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  @ApiResponse({ status: 500, description: 'Logout failed' })
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