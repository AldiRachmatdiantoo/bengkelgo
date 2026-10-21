// Shapes returned by the Bengkel API (backend/src/features/*). Shared by every page.

export type Role = 'CUSTOMER' | 'GUEST' | 'WORKSHOP_OWNER' | 'ADMIN';
export type VehicleType = 'MOTOR' | 'MOBIL';
export type WorkshopStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type OrderType = 'EMERGENCY' | 'BOOKING';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_QUEUE' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'UNASSIGNED';
export type PaymentStatus = 'UNPAID' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'REFUNDED';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}
export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: { location?: string; issues?: { path: string; message: string }[] } };
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
}

export interface AuthPayload {
  user: User;
  access_token: string;
  token_type: 'Bearer';
  refresh_expires_at: string;
}

export interface Workshop {
  id: string;
  name: string;
  description: string | null;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  vehicle_types: VehicleType[];
  status: WorkshopStatus;
  is_open: boolean;
  accepts_emergency: boolean;
  open_time: string;
  close_time: string;
  max_slot_per_hour: number;
  avg_rating: number;
  total_reviews: number;
  has_qris: boolean;
  distance_meters?: number | null;
  created_at: string;
  /** 0 = Sunday ... 6 = Saturday */
  closed_weekdays?: number[];
  break_start?: string | null;
  break_end?: string | null;
}

export interface OwnWorkshop extends Workshop {
  owner_id: string;
  status_reason: string | null;
}

export interface Service {
  id: string;
  workshop_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  vehicle_type: VehicleType;
  is_active: boolean;
}

export interface Mechanic {
  id: string;
  workshop_id?: string;
  name: string;
  phone?: string | null;
  specializations: string[];
  is_active: boolean;
  avg_rating: number;
  total_reviews: number;
  has_photo?: boolean;
  photo_url?: string | null;
}

export interface WorkshopPhoto {
  id: string;
  is_cover: boolean;
  url: string;
  sort_order?: number;
}

export interface WorkshopDetail extends Workshop {
  services: Service[];
  mechanics: Mechanic[];
  photos?: WorkshopPhoto[];
}

export interface Holiday {
  id: string;
  holiday_date: string;
  note: string | null;
}

export interface NextSlot {
  booking_date: string;
  time_slot: string;
  remaining: number;
}

export type ProblemCategory = 'BATTERY' | 'TIRE' | 'ENGINE' | 'FUEL' | 'TOWING' | 'LOCKOUT' | 'OTHER';

export interface Vehicle {
  id: string;
  vehicle_type: VehicleType;
  brand: string;
  model: string | null;
  year: number | null;
  color: string | null;
  plate: string | null;
  created_at?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface StatusHistoryEntry {
  kind: 'ORDER' | 'PAYMENT';
  from_status: string | null;
  to_status: string;
  actor_role: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface OwnerStats {
  date: string;
  bookings: number;
  waitlisted: number;
  bookings_completed: number;
  emergencies: number;
  emergencies_handled: number;
  quota_booked: number;
  quota_capacity: number;
  quota_utilization: number | null;
  verified_revenue: number;
  payments_to_verify: number;
  active_mechanics: number;
  avg_rating: number;
  total_reviews: number;
}

export interface PublicStats {
  active_workshops: number;
  active_mechanics: number;
  total_customers: number;
  completed_orders: number;
  avg_platform_rating: number | null;
  total_reviews: number;
  avg_emergency_response_minutes: number | null;
}

export interface AdminStats {
  date: string;
  workshops_by_status: Partial<Record<WorkshopStatus, number>>;
  users_by_role: Partial<Record<Role, number>>;
  orders_today: number;
  live_emergencies: number;
  payments_to_verify: number;
  verified_revenue_30d: number;
  refunded_30d: number;
}

export interface AdminSearchResult {
  query: string;
  workshops: { id: string; name: string; status: WorkshopStatus; phone: string }[];
  orders: { id: string; order_number: string; type: OrderType; status: OrderStatus; created_at: string; workshop_name: string | null }[];
  payments: { order_id: string; order_number: string; invoice_number: string | null; payer_reference: string | null; payer_name: string | null; amount: number; status: PaymentStatus }[];
  users: { id: string; name: string; email: string | null; role: Role; is_active: boolean }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  workshop_id: string | null;
  workshop_name: string | null;
  orders: number;
}

export interface AuditLog {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface SystemHealth {
  status: 'ok' | 'degraded';
  version: string;
  node: string;
  uptime_seconds: number;
  database: { ok: boolean; latency_ms: number; error?: string };
  postgis: { ok: boolean; latency_ms: number; version: string | null; error?: string };
  migrations: string[];
  redis: { ok: boolean; latency_ms: number; detail: string | null; error?: string };
  scheduler: { enabled: boolean; reminder_cron: string; timezone: string; next_reminder_run: string | null };
  /** The caller's IP as the API sees it (rate limits use it); behind proxies it must match the admin's real IP. */
  client_ip?: string;
  /** Raw proxy headers seen by the API (diagnostic for TRUST_PROXY). */
  proxy_headers?: Record<string, string | null>;
}

export interface SlotAvailability {
  time_slot: string;
  max_slot_per_hour: number;
  current_booked: number;
  remaining: number;
  waitlisted: number;
  bookable: boolean;
  unavailable_reason?: string | null;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
  mechanic_name: string | null;
  owner_reply?: string | null;
  replied_at?: string | null;
}

export interface ScanWorkshop {
  id: string;
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  avg_rating: number;
  vehicle_types: VehicleType[];
  distance_meters: number;
  top_mechanic_rating: number;
  rated_mechanics: number;
  available_mechanics: number;
  score: number;
}

export interface Order {
  id: string;
  order_number: string;
  type: OrderType;
  status: OrderStatus;
  customer_id: string;
  workshop_id: string | null;
  vehicle_type: VehicleType;
  vehicle_plate: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason?: string | null;
  cancelled_by?: 'CUSTOMER' | 'WORKSHOP' | null;
  vehicle_id?: string | null;
  vehicle?: Vehicle | null;
  customer: { id: string; name: string; phone: string | null };
  workshop: { id: string; name: string; phone: string; address: string; latitude: number; longitude: number } | null;
  mechanic: { id: string; name: string; phone: string | null; avg_rating: number } | null;
  emergency: {
    latitude: number;
    longitude: number;
    address_note: string | null;
    problem_description: string;
    distance_meters: number | null;
    response_deadline: string | null;
    routing_attempts: number;
    price_min?: number | null;
    price_max?: number | null;
    problem_category?: ProblemCategory | null;
  } | null;
  booking: { service_id: string; service_name: string; booking_date: string; time_slot: string; queue_number: number } | null;
  payment: {
    status: PaymentStatus;
    amount: number;
    uploaded_at: string | null;
    verified_at: string | null;
    rejection_reason: string | null;
    refunded_at?: string | null;
    refund_note?: string | null;
    invoice_number?: string | null;
    payer_reference?: string | null;
    payer_name?: string | null;
  };
  reviewed: boolean;
}

export interface CreatedBooking {
  id: string;
  order_number: string;
  status: OrderStatus;
  booking: { booking_date: string; time_slot: string; queue_number: number; waitlist_position: number | null };
  service: { id: string; name: string; price: number };
}

export interface CreatedEmergency {
  id: string;
  order_number: string;
  status: OrderStatus;
  response_timeout_seconds: number;
  assigned_workshop: { id: string; name: string; phone: string; address: string; distance_meters: number; score: number };
}

export interface PaymentInfo {
  order_id: string;
  order_number: string;
  amount: number;
  status: PaymentStatus;
  has_proof: boolean;
  has_qris: boolean;
  uploaded_at: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  refunded_at?: string | null;
  refund_note?: string | null;
  invoice_number?: string | null;
  payer_reference?: string | null;
  payer_name?: string | null;
}

export interface AdminWorkshop extends OwnWorkshop {
  owner_name: string;
  owner_email: string | null;
  owner_phone: string | null;
}

export interface TransactionReport {
  period: { from: string; to: string };
  summary: {
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    verified_revenue: number;
    pending_verification_amount: number;
    verified_payments: number;
    rejected_payments: number;
    refunded_amount: number;
    refunded_payments: number;
  };
  by_type: { type: OrderType; orders: number; verified_revenue: number }[];
  by_status: { status: OrderStatus; orders: number }[];
  top_workshops: { id: string; name: string; orders: number; verified_revenue: number }[];
  daily: { date: string; orders: number; verified_revenue: number }[];
}

/** A place found by the location search (OpenStreetMap data). */
export interface Place {
  name: string;
  detail: string;
  lat: number;
  lng: number;
  source: 'photon' | 'nominatim';
}
