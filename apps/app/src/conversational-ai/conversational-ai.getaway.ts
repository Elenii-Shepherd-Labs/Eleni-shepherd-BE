import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { AudioProcessingService } from '../audio-processing/audio-processing.service';
// Uncomment if you want WebSocket authentication
// import { WsAuthGuard } from '@app/common/guards/ws-auth.guard';
// import { WsUser } from '@app/common/decorators/ws-user.decorator';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure based on your CORS_ORIGIN env
    credentials: true,
  },
  namespace: '/conversational-ai', // Optional: separate namespace
})
export class ConversationalAiGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConversationalAiGateway.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly audioProcessingService: AudioProcessingService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Initialize session
    await this.conversationService.initializeSession(client.id);
    
    client.emit('connected', {
      sessionId: client.id,
      message: 'Connected to conversational AI',
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Cleanup
    await this.conversationService.endSession(client.id);
    await this.audioProcessingService.cleanup(client.id);
  }

  @SubscribeMessage('start-conversation')
  // @UseGuards(WsAuthGuard) // Uncomment for auth
  async handleStartConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { context?: string; language?: string },
    // @WsUser() user?: any, // Uncomment for auth
  ) {
    this.logger.log(`Starting conversation for client: ${client.id}`);
    
    if (data.context) {
      await this.conversationService.addContext(client.id, data.context);
    }

    client.emit('conversation-started', {
      sessionId: client.id,
      status: 'ready',
    });
  }

  @SubscribeMessage('audio-chunk')
  async handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { audio: ArrayBuffer; sampleRate?: number },
  ) {
    try {
      const result = await this.audioProcessingService.processAudioChunk(
        client.id,
        Buffer.from(data.audio),
        data.sampleRate || 16000,
      );

      if (result.transcript) {
        client.emit('transcript', {
          text: result.transcript,
          isFinal: result.isFinal,
        });

        if (result.isFinal) {
          await this.handleUserMessage(client, result.transcript);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing audio chunk: ${error.message}`);
      client.emit('error', {
        message: 'Failed to process audio',
        error: error.message,
      });
    }
  }

  @SubscribeMessage('text-message')
  async handleTextMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string },
  ) {
    this.logger.log(`Text message from ${client.id}: ${data.text}`);
    await this.handleUserMessage(client, data.text);
  }

  @SubscribeMessage('interrupt')
  async handleInterrupt(@ConnectedSocket() client: Socket) {
    this.logger.log(`Interrupt received from client: ${client.id}`);
    
    await this.audioProcessingService.stopAudioPlayback(client.id);
    await this.conversationService.setInterrupted(client.id, true);
    
    client.emit('interrupted', {
      message: 'Current response interrupted',
    });
  }

  @SubscribeMessage('add-context')
  async handleAddContext(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { context: string },
  ) {
    await this.conversationService.addContext(client.id, data.context);
    
    client.emit('context-updated', {
      message: 'Context added successfully',
    });
  }

  @SubscribeMessage('clear-history')
  async handleClearHistory(@ConnectedSocket() client: Socket) {
    await this.conversationService.clearHistory(client.id);
    
    client.emit('history-cleared', {
      message: 'Conversation history cleared',
    });
  }

  private async handleUserMessage(client: Socket, message: string) {
    try {
      client.emit('processing', { status: 'thinking' });

      const response = await this.conversationService.processMessage(
        client.id,
        message,
      );

      client.emit('ai-response', {
        text: response,
      });

      client.emit('processing', { status: 'generating-audio' });
      
      await this.streamAudioResponse(client, response);
      
      client.emit('response-complete', {
        message: 'Response complete',
      });
    } catch (error) {
      this.logger.error(`Error handling user message: ${error.message}`);
      client.emit('error', {
        message: 'Failed to process message',
        error: error.message,
      });
    }
  }

  private async streamAudioResponse(client: Socket, text: string) {
    try {
      const audioStream = await this.audioProcessingService.textToAudioStream(
        client.id,
        text,
      );

      for await (const audioChunk of audioStream) {
        const session = await this.conversationService.getSession(client.id);
        if (session?.interrupted) {
          break;
        }

        client.emit('audio-chunk', {
          audio: audioChunk,
        });
      }
    } catch (error) {
      this.logger.error(`Error streaming audio: ${error.message}`);
      throw error;
    }
  }
}
