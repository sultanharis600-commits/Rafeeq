import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthUsersService } from '../auth/auth-users.service.js';

/**
 * Live updates (Socket.IO). Clients connect with `auth: { token }` and are put in rooms:
 *   user:<id>        — their own bookings, orders, bags, alerts
 *   provider:<id>    — owners and staff of a provider
 *   group:<id>       — travel group members (lost alerts, locations)
 *   admin            — admin roles
 * Events: booking.updated, order.updated, bag.scanned, staff.location, lost.alert, lost.updated
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly log = new Logger('Realtime');
  @WebSocketServer() server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthUsersService) private readonly users: AuthUsersService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = (socket.handshake.auth?.token as string | undefined) ?? '';
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.users.load(sub);
      if (!user) throw new Error('unknown user');
      await socket.join(`user:${user.id}`);
      for (const p of user.providerIds) await socket.join(`provider:${p}`);
      for (const s of user.staff) await socket.join(`provider:${s.providerId}`);
      if (user.role.startsWith('admin_')) await socket.join('admin');
      const groups = (socket.handshake.auth?.groups as string[] | undefined) ?? [];
      // Group rooms are joined via RealtimeService.joinGroups after membership is checked.
      socket.data.userId = user.id;
      socket.data.requestedGroups = groups;
    } catch {
      socket.disconnect(true);
    }
  }

  emit(room: string, event: string, payload: unknown) {
    this.server?.to(room).emit(event, payload);
  }

  /** Put a user's open sockets into their travel groups' rooms. */
  async joinGroups(userId: string, groupIds: string[]) {
    if (!this.server) return;
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const s of sockets) for (const g of groupIds) s.join(`group:${g}`);
    this.log.debug(`user ${userId} joined ${groupIds.length} group room(s)`);
  }
}
