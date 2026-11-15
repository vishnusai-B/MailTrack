export type TrackingStatus = 'PENDING' | 'DISPATCHED' | 'SENT' | 'FAILED' | 'EXPIRED';

export type EventClassification = 'RECORDED' | 'LIKELY_PROXY' | 'SUSPECTED_SCANNER';

export type CampaignStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type ReminderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export type ReminderFilter = 'upcoming' | 'overdue' | 'completed' | 'cancelled' | 'all';

export interface User {
  id: string;
  email: string;
  name: string | null;
  defaultTrackingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackedEmail {
  id: string;
  userId: string;
  campaignId?: string | null;
  campaignName?: string | null;
  trackingTokenHash: string;
  subject: string | null;
  recipientReference: string;
  status: TrackingStatus;
  sentAt: string | null;
  expiresAt: string | null;
  firstRecordedAt: string | null;
  createdAt: string;
  eventCount?: number;
  lastRecordedAt?: string | null;
}

export interface TrackingEvent {
  id: string;
  trackedEmailId: string;
  eventType: string;
  classification: EventClassification;
  occurredAt: string;
  createdAt: string;
}

export interface TrackedEmailDetail extends TrackedEmail {
  events: TrackingEvent[];
}

export interface ActivityEventItem extends TrackingEvent {
  trackedEmail: {
    id: string;
    subject: string | null;
    recipientReference: string;
    status: TrackingStatus;
  };
}

export interface PaginatedTrackingEventsResponse {
  items: ActivityEventItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TrackingStatusCounts {
  PENDING: number;
  DISPATCHED: number;
  SENT: number;
  FAILED: number;
  EXPIRED: number;
  totalEmails: number;
}

export interface EventClassificationCounts {
  RECORDED: number;
  LIKELY_PROXY: number;
  SUSPECTED_SCANNER: number;
  totalEvents: number;
}

export interface DailyActivityPoint {
  date: string;
  totalEvents: number;
  recorded: number;
  likelyProxy: number;
  suspectedScanner: number;
}

export interface DashboardAnalyticsResponse {
  rangeDays: number;
  from: string;
  to: string;
  totalDispatchedEmails: number;
  emailsWithRecordedActivity: number;
  emailsWithLikelyProxyActivity: number;
  emailsWithSuspectedScannerActivity: number;
  emailsWithPixelActivity: number;
  totalPixelRequests: number;
  statusCounts: TrackingStatusCounts;
  classificationCounts: EventClassificationCounts;
  classificationBreakdown: EventClassificationCounts;
  dailyActivity: DailyActivityPoint[];
  pixelActivityHeatmap: number[][];
  recentEvents: ActivityEventItem[];
}

export interface RegisterTrackingRequest {
  recipientReference: string;
  subject?: string;
}

export interface RegisterTrackingResponse {
  trackingId: string;
  pixelUrl: string;
}

export interface UpdateTrackingStatusRequest {
  status: 'DISPATCHED' | 'FAILED';
}

export interface PaginatedTrackedEmailsResponse {
  items: TrackedEmail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken?: string;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  emailCount?: number;
}

export interface PaginatedCampaignsResponse {
  items: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'COMPLETED';
}

export interface AssignCampaignRequest {
  campaignId: string | null;
}

export interface FollowUpReminder {
  id: string;
  userId: string;
  trackedEmailId: string;
  dueAt: string;
  note: string | null;
  status: ReminderStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  trackedEmail?: {
    id: string;
    subject: string | null;
    recipientReference: string;
    status: TrackingStatus;
  };
}

export interface PaginatedRemindersResponse {
  items: FollowUpReminder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateReminderRequest {
  trackedEmailId: string;
  dueAt: string;
  note?: string;
}

export interface UpdateReminderRequest {
  dueAt?: string;
  note?: string | null;
}

export interface ReminderStatusCounts {
  upcoming: number;
  overdue: number;
  completed: number;
  cancelled: number;
}

export interface CampaignComparisonItem {
  id: string;
  name: string;
  status: CampaignStatus;
  totalEmails: number;
  totalEvents: number;
}

export interface CampaignAnalyticsResponse {
  campaign: Campaign;
  rangeDays: number;
  from: string;
  to: string;
  statusCounts: TrackingStatusCounts;
  classificationCounts: EventClassificationCounts;
  reminderCounts: ReminderStatusCounts;
  dailyActivity: DailyActivityPoint[];
  comparison: CampaignComparisonItem[];
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  database: 'connected' | 'disconnected';
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
}
