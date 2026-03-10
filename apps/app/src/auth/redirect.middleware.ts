import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RedirectMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const desired = req.query.redirectUrl as string | undefined;
    if (desired) {
      console.log('[RedirectMiddleware] saving redirectUrl to session:', desired);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req.session as any).redirectUrl = desired;
    }
    next();
  }
}
