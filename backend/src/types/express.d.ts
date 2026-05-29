import 'express';
import 'express-session';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      displayName: string | null;
      avatarUrl: string | null;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
