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
    .setDescription('Google Authentication API')
    .setVersion('1.0')
    .addTag('auth')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = config.get('app.port') || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
}

bootstrap();
