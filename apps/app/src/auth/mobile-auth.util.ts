import crypto from 'crypto';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export interface MobileAuthPayload {
  sub: string;
  type: 'mobile-auth';
  exp: number;
}

function getMobileAuthSecret() {
  return (
    process.env.MOBILE_AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    'your-secret-key'
  );
}

export function createMobileAuthToken(userId: string, ttlMs = DEFAULT_TTL_MS) {
  const payload: MobileAuthPayload = {
    sub: userId,
    type: 'mobile-auth',
    exp: Date.now() + ttlMs,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signature = crypto
    .createHmac('sha256', getMobileAuthSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyMobileAuthToken(
  token?: string | null,
): MobileAuthPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', getMobileAuthSecret())
    .update(encodedPayload)
    .digest();

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as MobileAuthPayload;

    if (
      payload.type !== 'mobile-auth' ||
      !payload.sub ||
      !payload.exp ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
