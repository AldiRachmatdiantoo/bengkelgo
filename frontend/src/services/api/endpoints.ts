// One function per backend endpoint, grouped by feature. Pages never call axios directly.
import { API_URL, call, http, tokenStore } from './client';
import type {
  AdminSearchResult,
  AdminUser,
  Place,
  Role,
  AdminStats,
  AdminWorkshop,
  AppNotification,
  AuditLog,
  Holiday,
  NextSlot,
  OwnerStats,
  ProblemCategory,
  PublicStats,
  StatusHistoryEntry,
  SystemHealth,
  Vehicle,
  WorkshopPhoto,
  AuthPayload,
  CreatedBooking,
  CreatedEmergency,
  Mechanic,
  Order,
  OrderStatus,
  OrderType,
  OwnWorkshop,
  PaymentInfo,
  Review,
  ScanWorkshop,
  Service,
  SlotAvailability,
  TransactionReport,
  VehicleType,
  Workshop,
  WorkshopDetail,
  WorkshopStatus,
} from './types';

type Paging = { page?: number; limit?: number };
const withSession = async (p: Promise<AuthPayload>) => {
  const s = await p;
  tokenStore.set(s);
  return s;
};

export const authApi = {
  registerCustomer: (b: { name: string; email: string; phone: string; password: string }) =>
    withSession(call(http.post('/auth/register/customer', b))),
  registerWorkshop: (b: {
    owner: { name: string; email: string; phone: string; password: string };
    workshop: {
      name: string;
      description?: string;
      address: string;
      phone: string;
      latitude: number;
      longitude: number;
      vehicle_types: VehicleType[];
      open_time: string;
      close_time: string;
      max_slot_per_hour: number;
    };
  }) => withSession(call(http.post('/auth/register/workshop', b))),
  login: (b: { email: string; password: string }) => withSession(call(http.post('/auth/login', b))),
  guest: (b: { name: string; whatsapp: string; latitude: number; longitude: number }) => withSession(call(http.post('/auth/guest', b))),
  google: (b: { code: string; code_verifier: string }) => withSession(call(http.post('/auth/google', b))),
  logout: async () => {
    await http.post('/auth/logout', {}).catch(() => undefined);
    tokenStore.set(null);
  },
};

export const workshopApi = {
  list: (
    q: Paging & {
      latitude?: number;
      longitude?: number;
      radius_km?: number;
      vehicle_type?: VehicleType;
      search?: string;
      sort?: 'distance' | 'rating' | 'recommended';
      /** with time_slot: only workshops that still have room in that slot */
      date?: string;
      time_slot?: string;
    },
  ) => call<Workshop[]>(http.get('/workshops', { params: q })),
  nextSlot: (id: string, from?: string) => call<NextSlot | null>(http.get(`/workshops/${id}/next-slot`, { params: { from } })),
  detail: (id: string) => call<WorkshopDetail>(http.get(`/workshops/${id}`)),
  availability: (id: string, date: string) => call<SlotAvailability[]>(http.get(`/workshops/${id}/availability`, { params: { date } })),
  reviews: (id: string, q: Paging = {}) => call<Review[]>(http.get(`/workshops/${id}/reviews`, { params: q })),
};

export const ownerApi = {
  me: () => call<OwnWorkshop>(http.get('/workshops/me')),
  updateProfile: (b: Partial<Omit<Workshop, 'id' | 'status' | 'avg_rating' | 'total_reviews' | 'has_qris' | 'created_at'>>) =>
    call<Workshop>(http.put('/workshops/profile', b)),
  uploadQris: (file: File) => {
    const fd = new FormData();
    fd.append('qris', file);
    return call<{ has_qris: boolean }>(http.put('/workshops/qris', fd));
  },
  services: () => call<Service[]>(http.get('/workshops/services')),
  createService: (b: { name: string; description?: string; price: number; duration_minutes: number; vehicle_type: VehicleType }) =>
    call<Service>(http.post('/workshops/services', b)),
  // These resend duration_minutes / specializations: older API versions reset omitted fields to their
  // create defaults. The backend is fixed now; resending the current value stays harmless.
  updateService: (s: Pick<Service, 'id' | 'duration_minutes'>, b: Partial<Pick<Service, 'name' | 'description' | 'price' | 'duration_minutes' | 'is_active'>>) =>
    call<Service>(http.patch(`/workshops/services/${s.id}`, { duration_minutes: s.duration_minutes, ...b })),
  mechanics: () => call<Mechanic[]>(http.get('/workshops/mechanics')),
  createMechanic: (b: { name: string; phone?: string; specializations: string[] }) => call<Mechanic>(http.post('/workshops/mechanics', b)),
  updateMechanic: (m: Pick<Mechanic, 'id' | 'specializations'>, b: Partial<Pick<Mechanic, 'name' | 'phone' | 'specializations' | 'is_active'>>) =>
    call<Mechanic>(http.patch(`/workshops/mechanics/${m.id}`, { specializations: m.specializations, ...b })),
  deactivateMechanic: (id: string) => call<Mechanic>(http.delete(`/workshops/mechanics/${id}`)),
  deleteService: (id: string) => call<{ id: string; deleted: boolean }>(http.delete(`/workshops/services/${id}`)),
  reviews: (q: Paging = {}) => call<Review[]>(http.get('/workshops/me/reviews', { params: q })),
  replyReview: (id: string, reply: string) => call<Review>(http.put(`/workshops/reviews/${id}/reply`, { reply })),
  deleteReply: (id: string) => call<Review>(http.delete(`/workshops/reviews/${id}/reply`)),
  stats: (date?: string) => call<OwnerStats>(http.get('/workshops/me/stats', { params: { date } })),
  holidays: () => call<Holiday[]>(http.get('/workshops/holidays')),
  addHoliday: (b: { date: string; note?: string }) => call<Holiday>(http.post('/workshops/holidays', b)),
  deleteHoliday: (id: string) => call<{ id: string }>(http.delete(`/workshops/holidays/${id}`)),
  setSchedule: (b: { closed_weekdays?: number[]; break_start?: string | null; break_end?: string | null }) =>
    call<Workshop>(http.put('/workshops/profile', b)),
  photos: () => call<WorkshopPhoto[]>(http.get('/workshops/photos')),
  addPhoto: (file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return call<WorkshopPhoto>(http.post('/workshops/photos', fd));
  },
  setCoverPhoto: (id: string) => call<{ id: string }>(http.patch(`/workshops/photos/${id}/cover`)),
  deletePhoto: (id: string) => call<{ id: string }>(http.delete(`/workshops/photos/${id}`)),
  setMechanicPhoto: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return call<{ id: string; has_photo: boolean }>(http.put(`/workshops/mechanics/${id}/photo`, fd));
  },
  deleteMechanicPhoto: (id: string) => call<{ id: string }>(http.delete(`/workshops/mechanics/${id}/photo`)),
  quotas: (date: string) => call<SlotAvailability[]>(http.get('/workshops/quotas', { params: { date } })),
  setSlotCapacity: (b: { date: string; time_slot: string; max_slot_per_hour: number }) =>
    call<{ current_booked: number; promoted_from_queue: number }>(http.put('/workshops/quotas', b)),
};

export const bookingApi = {
  create: (b: { workshop_id: string; service_id: string; booking_date: string; time_slot: string; vehicle_plate?: string; notes?: string; vehicle_id?: string }) =>
    call<CreatedBooking>(http.post('/booking', b)),
};

export const emergencyApi = {
  scan: (b: { latitude: number; longitude: number; vehicle_type?: VehicleType }) =>
    call<{ radius_meters: number; workshops: ScanWorkshop[] }>(http.post('/emergency/scan', b)),
  request: (b: {
    latitude: number;
    longitude: number;
    vehicle_type: VehicleType;
    vehicle_plate?: string;
    problem_description: string;
    address_note?: string;
    price_min?: number;
    price_max?: number;
    vehicle_id?: string;
    problem_category?: ProblemCategory;
  }) => call<CreatedEmergency>(http.post('/emergency/request', b)),
  respond: (orderId: string, b: { action: 'ACCEPT' | 'DECLINE'; estimated_price?: number; mechanic_id?: string }) =>
    call<{ status: OrderStatus; rerouted_to?: string | null }>(http.patch(`/emergency/${orderId}/respond`, b)),
  setPrice: (orderId: string, estimated_price: number) =>
    call<{ estimated_price: number }>(http.patch(`/emergency/${orderId}/price`, { estimated_price })),
};

type OrderFilter = Paging & { status?: OrderStatus; type?: OrderType; date?: string };
export const orderApi = {
  mine: (q: OrderFilter = {}) => call<Order[]>(http.get('/orders/me', { params: q })),
  workshop: (q: OrderFilter = {}) => call<Order[]>(http.get('/orders/workshop', { params: q })),
  detail: (id: string) => call<Order>(http.get(`/orders/${id}`)),
  updateStatus: (
    id: string,
    b: { status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; final_amount?: number; refund_confirmed?: boolean; refund_note?: string; cancel_reason?: string },
  ) => call<{ status: OrderStatus }>(http.patch(`/orders/${id}/status`, b)),
  cancel: (id: string, reason?: string) => call<{ status: OrderStatus }>(http.patch(`/orders/${id}/cancel`, reason ? { reason } : {})),
  reschedule: (id: string, b: { booking_date: string; time_slot: string }) =>
    call<{ status: OrderStatus; booking: { booking_date: string; time_slot: string; queue_number: number; waitlist_position: number | null } }>(
      http.patch(`/orders/${id}/reschedule`, b),
    ),
  history: (id: string) => call<StatusHistoryEntry[]>(http.get(`/orders/${id}/history`)),
};

export const paymentApi = {
  get: (orderId: string) => call<PaymentInfo>(http.get(`/payments/${orderId}`)),
  qrisPath: (orderId: string) => `/payments/${orderId}/qris`,
  proofPath: (orderId: string) => `/payments/${orderId}/proof`,
  upload: (orderId: string, file: File, payer: { payer_reference?: string; payer_name?: string } = {}) => {
    const fd = new FormData();
    fd.append('order_id', orderId);
    if (payer.payer_reference) fd.append('payer_reference', payer.payer_reference);
    if (payer.payer_name) fd.append('payer_name', payer.payer_name);
    fd.append('proof', file);
    return call<PaymentInfo>(http.post('/payments/upload', fd));
  },
  verify: (orderId: string, b: { approve: boolean; reason?: string }) => call<{ status: string }>(http.patch(`/payments/${orderId}/verify`, b)),
};

export const reviewApi = {
  create: (b: { order_id: string; rating: number; comment?: string }) => call<Review>(http.post('/reviews', b)),
};

export const adminApi = {
  workshops: (q: Paging & { status?: WorkshopStatus } = {}) => call<AdminWorkshop[]>(http.get('/admin/workshops', { params: q })),
  setApproval: (id: string, b: { action: 'APPROVE' | 'REJECT' | 'SUSPEND'; reason?: string }) =>
    call<{ status: WorkshopStatus }>(http.patch(`/admin/workshops/${id}/approval`, b)),
  report: (q: { from?: string; to?: string; workshop_id?: string } = {}) =>
    call<TransactionReport>(http.get('/admin/reports/transactions', { params: q })),
  stats: () => call<AdminStats>(http.get('/admin/stats')),
  search: (q: string) => call<AdminSearchResult>(http.get('/admin/search', { params: { q } })),
  auditLogs: (q: Paging & { entity?: string; action?: string; from?: string; to?: string } = {}) =>
    call<AuditLog[]>(http.get('/admin/audit-logs', { params: q })),
  health: () => call<SystemHealth>(http.get('/admin/health')),
  users: (q: Paging & { role?: Role; q?: string; active?: boolean } = {}) =>
    call<AdminUser[]>(http.get('/admin/users', { params: { ...q, active: q.active === undefined ? undefined : String(q.active) } })),
  setUserActive: (id: string, active: boolean, reason?: string) => call<{ id: string; is_active: boolean }>(http.patch(`/admin/users/${id}/active`, { active, reason })),
  createAdmin: (b: { name: string; email: string; phone?: string; password: string }) => call<AdminUser>(http.post('/admin/users/admins', b)),
};

export const notificationApi = {
  list: (q: Paging & { unread_only?: boolean } = {}) =>
    call<{ items: AppNotification[]; unread: number }>(http.get('/notifications', { params: { ...q, unread_only: q.unread_only ? 'true' : undefined } })),
  markRead: (ids?: string[]) => call<{ marked: number }>(http.patch('/notifications/read', ids ? { ids } : {})),
};

export const vehicleApi = {
  list: () => call<Vehicle[]>(http.get('/vehicles')),
  create: (b: Omit<Vehicle, 'id' | 'created_at' | 'model' | 'year' | 'color' | 'plate'> & Partial<Pick<Vehicle, 'model' | 'year' | 'color' | 'plate'>>) =>
    call<Vehicle>(http.post('/vehicles', b)),
  update: (id: string, b: Partial<Omit<Vehicle, 'id' | 'created_at'>>) => call<Vehicle>(http.patch(`/vehicles/${id}`, b)),
  remove: (id: string) => call<{ id: string }>(http.delete(`/vehicles/${id}`)),
};

export const statsApi = {
  public: () => call<PublicStats>(http.get('/stats/public')),
};

/** Place search (OpenStreetMap via the API). Search on submit only: the provider forbids type-ahead. */
export const geocodeApi = {
  search: (q: string, near?: { lat: number; lng: number }) =>
    call<Place[]>(http.get('/geocode/search', { params: { q, limit: 6, ...(near ? { lat: near.lat, lng: near.lng } : {}) } })),
  /** Approximate address of a map point; null when it has none (sea, outside Indonesia). */
  reverse: (p: { lat: number; lng: number }) => call<Place | null>(http.get('/geocode/reverse', { params: { lat: p.lat, lng: p.lng } })),
};

/** Absolute URL for a public image path returned by the API (photos are served by the API, not the web app). */
export const apiAsset = (path: string | null | undefined) => (path ? `${API_URL}${path}` : null);
