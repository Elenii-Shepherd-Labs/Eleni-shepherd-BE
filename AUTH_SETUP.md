# Google Authentication Setup Guide

## Overview
This guide explains how to set up and use Google OAuth 2.0 authentication in the Eleni Shepherd backend.

## Prerequisites
- Node.js v14+
- npm or yarn
- MongoDB instance running
- Google OAuth 2.0 credentials (Client ID and Client Secret)

## Installation

### 1. Install Dependencies
The required packages have been installed:
- `passport` - Authentication middleware
- `passport-google-oauth20` - Google OAuth 2.0 strategy
- `express-session` - Session management
- `@nestjs/passport` - NestJS Passport integration

If you need to reinstall, run:
```bash
npm install passport passport-google-oauth20 express-session @types/express-session @nestjs/passport --legacy-peer-deps
```

### 2. Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session Configuration
SESSION_SECRET=your-session-secret-key-here

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/eleni-shepherd

# Application Configuration
NODE_ENV=development
APP_PORT=3000
```

### 3. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials (Web Application type)
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (for development)
   - Your production URL when deploying
6. Copy the Client ID and Client Secret to your `.env` file

## Project Structure

```
apps/app/src/auth/
├── auth.controller.ts      # API endpoints
├── auth.service.ts         # Business logic
├── auth.module.ts          # Auth module configuration
├── google.strategy.ts      # Google OAuth strategy
└── user.schema.ts          # User database schema
```

## API Endpoints

### Authentication Endpoints

#### 1. Initiate Google Login
**Endpoint:** `GET /auth/google`
**Description:** Redirects user to Google login page
**Response:** Redirects to Google OAuth consent screen

#### 2. Google OAuth Callback
**Endpoint:** `GET /auth/google/callback`
**Description:** Handles callback from Google after successful authentication
**Response:** Redirects to home page (`/`) after creating/updating user

#### 3. Get User Profile
**Endpoint:** `GET /auth/profile`
**Description:** Returns authenticated user's profile
**Response:** 
```json
{
  "_id": "user_id",
  "username": "User Name",
  "email": "user@example.com",
  "googleId": "google_id",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### 4. Logout
**Endpoint:** `GET /auth/logout`
**Description:** Logs out the current user
**Response:**
```json
{
  "message": "Logged out successfully"
}
```

## User Schema

```typescript
@Schema()
export class User extends Document {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  googleId: string;
}
```

## Testing with Swagger

The API is fully documented in Swagger. Access it at:
```
http://localhost:3000/api
```

### To test endpoints:

1. **Start the application:**
   ```bash
   npm run start:dev
   ```

2. **Open Swagger UI:**
   Open `http://localhost:3000/api` in your browser

3. **Test Google Login Flow:**
   - Click "Try it out" on the `/auth/google` endpoint
   - This will redirect you to Google's login page
   - After successful login, you'll be redirected back to the callback endpoint
   - User will be stored in MongoDB

4. **Check User Profile:**
   - Once logged in, click "Try it out" on `/auth/profile`
   - Your user profile will be displayed

## Development

### Build
```bash
npm run build
```

### Start Development Server
```bash
npm run start:dev
```

### Run Tests
```bash
npm test
```

## How It Works

1. **User clicks "Login with Google"** → redirected to `/auth/google`
2. **Google Strategy** initiates OAuth 2.0 flow with Google
3. **User authenticates** with Google credentials
4. **Google redirects** to `/auth/google/callback` with authorization code
5. **GoogleStrategy validates** the authorization code and retrieves user profile
6. **AuthService** checks if user exists in MongoDB:
   - If exists: returns existing user
   - If not exists: creates new user with Google profile data
7. **User is logged in** via session and redirected to home page

## Session Management

Sessions are stored in memory by default. For production, consider using:
- `connect-mongo` - MongoDB session store
- `redis-store` - Redis session store

## Security Considerations

- **HTTPS Only**: Use HTTPS in production (set `cookie: { secure: true }`)
- **CSRF Protection**: Consider adding CSRF protection middleware
- **Environment Variables**: Never commit sensitive data to git
- **Validate URLs**: Ensure Google callback URLs match your domain

## Troubleshooting

### Issue: "Cannot find module 'express'"
**Solution:** Run `npm install express --legacy-peer-deps`

### Issue: Google OAuth 3-legged flow not starting
**Solution:** 
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Ensure redirect URI matches exactly in Google Cloud Console

### Issue: User not being created
**Solution:**
- Check MongoDB connection with `MONGODB_URI`
- Verify Mongoose is properly configured
- Check application logs for errors

### Issue: Session not persisting
**Solution:**
- Verify `SESSION_SECRET` is set in `.env`
- Check that cookies are enabled in browser
- Ensure session middleware is initialized before routes

## Next Steps

- Implement refresh token strategy
- Add JWT token generation
- Set up role-based access control (RBAC)
- Add email verification
- Implement two-factor authentication (2FA)

## References

- [Passport.js Documentation](http://www.passportjs.org/)
- [passport-google-oauth20](https://github.com/jaredhanson/passport-google-oauth2)
- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
