import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

/**
 * WebSocket User Decorator
 * 
 * Extracts the authenticated user from the WebSocket connection
 * Use with @WsAuthGuard()
 * 
 * Usage:
 * @SubscribeMessage('some-event')
 * @UseGuards(WsAuthGuard)
 * handleEvent(@WsUser() user: any) {
 *   console.log(user.id);
 * }
 */
export const WsUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const client: Socket = ctx.switchToWs().getClient();
    return client.data.user;
  },
);
