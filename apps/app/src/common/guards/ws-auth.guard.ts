import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket Auth Guard
 * 
 * Protects WebSocket connections by validating the session/JWT token
 * Integrate with your existing auth system
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    try {
      // Option 1: Check session (if using express-session)
      // const session = client.request.session;
      // if (!session?.passport?.user) {
      //   throw new WsException('Unauthorized');
      // }
      // client.data.user = session.passport.user;

      // Option 2: Check JWT token
      // const token = this.extractToken(client);
      // if (!token) {
      //   throw new WsException('Unauthorized');
      // }
      // const user = await this.validateToken(token);
      // client.data.user = user;

      // Option 3: Check custom auth header
      const userId = client.handshake.auth?.userId;
      if (!userId) {
        throw new WsException('Unauthorized - No user ID provided');
      }

      // Store user data on socket for later use
      client.data.user = { id: userId };

      return true;
    } catch (error) {
      this.logger.error(`WebSocket auth failed: ${error.message}`);
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    
    return type === 'Bearer' ? token : null;
  }

  // Implement this based on your JWT strategy
  // private async validateToken(token: string): Promise<any> {
  //   // Use your JWT service to validate
  //   return this.jwtService.verify(token);
  // }
}
