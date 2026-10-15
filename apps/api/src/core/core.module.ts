import { Global, Module } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { CryptoService } from './crypto.service.js';

/** Services every feature module uses: notifications (outbox), live updates, encryption. */
@Global()
@Module({
  providers: [RealtimeGateway, NotificationsService, CryptoService],
  exports: [RealtimeGateway, NotificationsService, CryptoService],
})
export class CoreModule {}
