import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load the appropriate environment variables file based on NODE_ENV
const loadEnvFile = (env: string) => {
  const envFilePath = path.resolve(process.cwd(), `.env.${env}`);
  if (fs.existsSync(envFilePath)) {
    dotenv.config({ path: envFilePath });
  } else {
    dotenv.config(); // fallback to .env
  }
};

loadEnvFile(process.env.NODE_ENV || 'development');

const getAppConfig = () => ({
  environment: process.env.NODE_ENV || 'development',
  name: process.env.APP_NAME || 'App',
  database: process.env.DATABASE_URL,
  // JWT settings
  jwt_secret: process.env.JWT_SECRET || 'default-secret',
  jwt_expiration: process.env.JWT_EXPIRATION || '12h',
  jwt_refresh_token_secret:
    process.env.JWT_REFRESH_TOKEN_SECRET || 'default-refresh-secret',
  jwt_refresh_token_expiration:
    process.env.JWT_REFRESH_TOKEN_EXPIRATION || '1d',

  // App base URL
  baseUrl:
    process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  domain: process.env.DOMAIN || 'localhost',

  // Server settings
  port: parseInt(process.env.PORT, 10) || 3000,

  // CORS settings
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Redis settings
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Email settings
  email: {
    user: process.env.ZOHO_EMAIL_USER, // Your Zoho email address
    pass: process.env.ZOHO_EMAIL_PASS, // Your Zoho email password or app-specific password
    from: process.env.ZOHO_EMAIL_FROM, // Sender email address
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '0', 10),
  },
  vision: {
    serviceUrl: process.env.VISION_SERVICE_URL || 'http://localhost:5000',
  },
  radioBrowser: {
    baseUrl: process.env.RADIO_BROWSER_BASE_URL || 'https://de1.api.radio-browser.info',
  },
});

export const configuration = () => {
  return {
    app: getAppConfig(),
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '0', 10),
    },
    vision: {
      serviceUrl: process.env.VISION_SERVICE_URL || 'http://localhost:5000',
    },
    radioBrowser: {
      baseUrl: process.env.RADIO_BROWSER_BASE_URL || 'https://de1.api.radio-browser.info',
    },
    redis: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },
  };
};
