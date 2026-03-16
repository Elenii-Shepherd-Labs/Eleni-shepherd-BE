import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import passport from 'passport';
import session from 'express-session';
import Redis from 'ioredis';
import { RedisSessionStore } from './auth/redis-session.store';

const createSessionStore = async (config: ConfigService) => {
  const environment = config.get<string>('app.environment') || 'development';
  const isProduction = environment === 'production';
  const sessionTtlSeconds =
    config.get<number>('session.ttlSeconds') || 3600;
  const sessionPrefix =
    config.get<string>('session.redisPrefix') || 'sess:';
  const sessionRedisConnectTimeoutMs =
    config.get<number>('session.redisConnectTimeoutMs') || 1500;
  const allowMemoryFallback =
    config.get<boolean>('session.allowMemoryFallback') ?? !isProduction;

  const redis = new Redis({
    host: config.get<string>('redis.host') || '127.0.0.1',
    port: config.get<number>('redis.port') || 6379,
    password: config.get<string>('redis.password') || undefined,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: sessionRedisConnectTimeoutMs,
  });

  redis.on('error', (error) => {
    console.warn(
      `[Main] Redis session store connection warning: ${error.message}`,
    );
  });

  try {
    await redis.connect();
    await redis.ping();
    console.log(
      `[Main] Redis session store connected at ${config.get<string>('redis.host') || '127.0.0.1'}:${config.get<number>('redis.port') || 6379}`,
    );

    return {
      store: new RedisSessionStore(redis, {
        prefix: sessionPrefix,
        defaultTtlSeconds: sessionTtlSeconds,
      }),
      redisClient: redis,
      usesRedis: true,
    };
  } catch (error) {
    redis.disconnect();

    if (!allowMemoryFallback || isProduction) {
      throw error;
    }

    console.warn(
      '[Main] Redis unavailable, falling back to in-memory sessions for local development.',
      error,
    );

    return {
      store: undefined,
      redisClient: null,
      usesRedis: false,
    };
  }
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const { store, redisClient, usesRedis } = await createSessionStore(config);
  const sessionMaxAgeMs =
    config.get<number>('session.maxAgeMs') ||
    (config.get<number>('session.ttlSeconds') || 3600) * 1000;

  // Enhanced CORS configuration for mobile and web clients
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:19000', // Expo dev client
        'http://localhost:19001',
        /^http:\/\/192\.168\.\d+\.\d+:\d+/, // Local network IP (any port)
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+/, // Android emulator/10.x.x.x IPs
        'https://eleni-shepherd-be.onrender.com', // Render deployment
        'capacitor://',
        'ionic://',
      ];

      if (
        !origin ||
        allowedOrigins.some((allowed) => {
          if (allowed instanceof RegExp) return allowed.test(origin);
          return origin === allowed;
        })
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-ID',
      'x-session-id',
    ],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const environment = config.get<string>('app.environment') || 'development';
  const isProduction = environment === 'production';
  console.log(
    `[Main] Environment: NODE_ENV=${environment}, isProduction=${isProduction}, sessionStore=${usesRedis ? 'redis' : 'memory'}`,
  );
  console.log(
    `[Main] OAuth config: GOOGLE_CALLBACK_URL=${process.env.GOOGLE_CALLBACK_URL || 'not set'}, redirectSource=client-state`,
  );
  app.enableShutdownHooks();

  app.use(
    session({
      name: 'sessionId',
      ...(store ? { store } : {}),
      secret: config.get<string>('session.secret') || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: sessionMaxAgeMs,
        // Remove domain restriction to allow cookies on the exact domain
        // domain: isProduction ? '.onrender.com' : undefined,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

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
`,
    )
    .setVersion('1.0.0')
    // .setContact(
    //   'Eleni Shepherd Team',
    //   'https://github.com/eleni-shepherd',
    //   'support@eleni-shepherd.com',
    // )
    // .setLicense(
    //   'MIT',
    //   'https://opensource.org/licenses/MIT',
    // )
    .addTag('auth', 'User authentication and profile management')
    .addTag(
      'Audio Processing',
      'Real-time audio chunk processing with transcription',
    )
    .addTag(
      'Speech-to-Text',
      'Audio transcription and voice activity detection',
    )
    .addTag('Text-to-Speech', 'Text to speech synthesis with voice selection')
    .addTag('LLM', 'Large Language Model integration for AI responses')
    .addTag(
      'Conversational AI',
      'Multi-turn conversation sessions with context',
    )
    .addTag('Onboarding', 'User onboarding and profile setup')
    .addTag(
      'Radio Stations',
      'Live radio stations from Radio Browser API (Nigeria)',
    )
    .addTag(
      'Blog & News',
      'Recent news, entertainment, sports, and blog articles',
    )
    .addTag(
      'Accessibility (Screen Reader)',
      'Read-aloud TTS for visually impaired users',
    )
    .addTag(
      'Vision (Object Detection)',
      'YOLO object detection and ESP32-CAM image processing',
    )
    .addTag(
      'Subscription & Languages',
      'Subscription tiers and allowed languages (free: English, subscribed: all)',
    )
    .addTag(
      'Telehealth',
      'Health Assistant: daily reminders (medications/appointments), AI symptom checker, and medical document OCR analysis',
    )
    .addCookieAuth('sessionId')
    .addServer('http://localhost:3000', 'Local Development')
    // .addServer('https://api.example.com', 'Production')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Mount Swagger UI at /api with minimal options to avoid swagger-ui incompatibilities
  SwaggerModule.setup('/api', app, document, {
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      docExpansion: 'list',
      filter: true,
    },
  });

  const port = config.get('app.port') || 3000;
  // Explicitly bind to 0.0.0.0 so emulators and devices can reach the server
  await app.listen(port, '0.0.0.0');
  if (usesRedis && redisClient) {
    app.getHttpServer().on('close', () => redisClient.disconnect());
  }
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${await app.getUrl()}`);
}

bootstrap();
