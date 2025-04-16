import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';

// Types
interface ServerToClientEvents {
  notification: (data: any) => void;
  'project-update': (data: any) => void;
  'version-update': (data: any) => void;
}

interface ClientToServerEvents {
  'join-project': (projectId: string) => void;
  'leave-project': (projectId: string) => void;
}

// Singleton Socket.io instance
class SocketService {
  private static instance: SocketService;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private connected = false;
  private projectsJoined: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public connect(token: string): void {
    if (this.connected) return;

    try {
      this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      this.setupEventListeners();
      this.connected = true;
      console.log('Socket connected');

      // Rejoin any rooms that were previously joined
      this.projectsJoined.forEach(projectId => {
        this.joinProject(projectId);
      });
    } catch (error) {
      console.error('Socket connection error:', error);
      this.connected = false;
    }
  }

  public disconnect(): void {
    if (!this.socket || !this.connected) return;

    this.socket.disconnect();
    this.connected = false;
    this.projectsJoined.clear();
    console.log('Socket disconnected');
  }

  public joinProject(projectId: string): void {
    if (!this.socket || !this.connected) return;

    this.socket.emit('join-project', projectId);
    this.projectsJoined.add(projectId);
    console.log(`Joined project room: ${projectId}`);
  }

  public leaveProject(projectId: string): void {
    if (!this.socket || !this.connected) return;

    this.socket.emit('leave-project', projectId);
    this.projectsJoined.delete(projectId);
    console.log(`Left project room: ${projectId}`);
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket.io connected');
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`Socket.io disconnected: ${reason}`);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      this.connected = false;
      
      // Try to reconnect once with a new token
      // In a real app, we might want to refresh the token here
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.connect(token);
      }
    });

    // Application events
    this.socket.on('notification', (data) => {
      console.log('Notification received:', data);
      
      // Show toast notification
      toast({
        title: 'New Notification',
        description: data.notification.message
      });
      
      // Trigger any notification handlers registered by components
      document.dispatchEvent(new CustomEvent('socket:notification', { detail: data }));
    });

    this.socket.on('project-update', (data) => {
      console.log('Project update:', data);
      document.dispatchEvent(new CustomEvent('socket:project-update', { detail: data }));
    });

    this.socket.on('version-update', (data) => {
      console.log('Version update:', data);
      document.dispatchEvent(new CustomEvent('socket:version-update', { detail: data }));
    });
  }

  public isConnected(): boolean {
    return this.connected;
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();

// Helper hook to use socket in React components
export function initializeSocket(): void {
  const token = localStorage.getItem('auth_token');
  if (token) {
    socketService.connect(token);
  }
}

export function cleanupSocket(): void {
  socketService.disconnect();
}

export default socketService;