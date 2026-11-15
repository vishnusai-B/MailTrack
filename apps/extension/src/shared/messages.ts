import type { RegisterTrackingResponse } from '@mailtrack/shared';

export interface ExtensionPreferences {
  defaultTrackingEnabled: boolean;
  authenticated: boolean;
  userEmail: string | null;
}

export type ExtensionMessage =
  | { type: 'PING' }
  | { type: 'GET_PREFERENCES' }
  | { type: 'SET_DEFAULT_TRACKING'; enabled: boolean }
  | { type: 'LOGIN'; email: string; password: string }
  | { type: 'REGISTER'; email: string; password: string; name?: string }
  | { type: 'LOGOUT' }
  | { type: 'REGISTER_TRACKING'; recipientReference: string; subject?: string }
  | {
      type: 'UPDATE_TRACKING_STATUS';
      trackingId: string;
      status: 'DISPATCHED' | 'SENT' | 'FAILED';
    };

export type ExtensionResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export type RegisterTrackingResult = RegisterTrackingResponse;
