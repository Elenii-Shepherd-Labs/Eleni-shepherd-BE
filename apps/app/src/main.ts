import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import passport from 'passport';
import session from 'express-session';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get('app.cors.origin') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Configure session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 3600000 },
    }),
  );

  // Initialize Passport with session support
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialization
  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Eleni Shepherd API')
    .setDescription(
      `
# Eleni Shepherd Backend API

AI-powered assistant for people with visual impairments. Speech-to-text, text-to-speech, conversational AI, radio, news, screen reader, and vision object detection.

## Key Features
- **Audio Processing**: Real-time audio transcription with wake-word detection
- **Text-to-Speech**: Convert text to natural speech with multiple voice options
- **Conversational AI**: Multi-turn conversations with context awareness
- **LLM Integration**: Support for OpenAI and Anthropic models
- **Radio Stations**: Live Nigerian radio via Radio Browser API
- **Blog & News**: Recent news, entertainment, sports (GNews / Hacker News)
- **Accessibility**: Screen reader / read-aloud for content
- **Vision**: YOLO object detection; ESP32-CAM image processing
- **Language Tiers**: Free = English only; Subscribed = Hausa, Yoruba, Igbo, Swahili, German, etc.

## Base URL
\`\`\`
http://localhost:3000
\`\`\`

## Authentication
All endpoints except \`/auth/google*\` require authentication via Google OAuth 2.0.
Session cookies are automatically managed after successful Google login.

## Response Format
All API responses follow a standardized format:
\`\`\`json
{
  "success": boolean,
  "message": string,
  "data": any,
  "status": number
}
\`\`\`

## Error Handling
- **400 Bad Request**: Invalid input or missing required parameters
- **401 Unauthorized**: Missing or invalid authentication
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side errors

## Rate Limiting
No rate limiting currently implemented. Contact API team for production considerations.

## WebSocket Support
Conversational AI supports WebSocket connections for real-time messaging (via Gateway).
`,
    )
    .setVersion('1.0.0')
    .setContact(
      'Eleni Shepherd Team',
      'https://github.com/eleni-shepherd',
      'support@eleni-shepherd.com',
    )
    .setLicense(
      'MIT',
      'https://opensource.org/licenses/MIT',
    )
    .addTag('auth', 'User authentication and profile management')
    .addTag('Audio Processing', 'Real-time audio chunk processing with transcription')
    .addTag('Speech-to-Text', 'Audio transcription and voice activity detection')
    .addTag('Text-to-Speech', 'Text to speech synthesis with voice selection')
    .addTag('LLM', 'Large Language Model integration for AI responses')
    .addTag('Conversational AI', 'Multi-turn conversation sessions with context')
    .addTag('Onboarding', 'User onboarding and profile setup')
    .addTag('Radio Stations', 'Live radio stations from Radio Browser API (Nigeria)')
    .addTag('Blog & News', 'Recent news, entertainment, sports, and blog articles')
    .addTag('Accessibility (Screen Reader)', 'Read-aloud TTS for visually impaired users')
    .addTag('Vision (Object Detection)', 'YOLO object detection and ESP32-CAM image processing')
    .addTag('Subscription & Languages', 'Subscription tiers and allowed languages (free: English, subscribed: all)')
    .addCookieAuth('sessionId')
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.example.com', 'Production')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorizationData: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      docExpansion: 'list',
      filter: true,
      presets: [],
    },
  });

  const port = config.get('app.port') || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
}

bootstrap();
