import { Socket } from 'socket.io';
import { JwtPayload } from './jwt-payload.interface';

export interface SocketData {
  user: JwtPayload;
}

export interface AuthenticatedSocket extends Socket {
  data: SocketData;
}
