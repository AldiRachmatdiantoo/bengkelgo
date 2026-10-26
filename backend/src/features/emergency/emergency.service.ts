import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { db, withTransaction, type Queryable } from '../../common/db/transaction';
import { AppError } from '../../common/errors/AppError';
import { SYSTEM, audit, setActor, type ActorRole } from '../../common/db/actor';
import { authRepository } from '../auth/auth.repository';
import { notificationService as notif } from '../notification/notification.service';
import { vehicleService } from '../vehicle/vehicle.service';
import { orderRepository } from '../order/order.repository';
import { workshopRepository } from '../workshop/workshop.repository';
import { pickNext, rankCandidates } from './emergency.logic';
import { emergencyRepository, type PendingEmergency } from './emergency.repository';
import type { EmergencyRequestInput, PriceInput, RespondInput, ScanInput } from './emergency.schema';

const RADIUS = () => env.EMERGENCY_RADIUS_METERS;
const TIMEOUT = () => env.EMERGENCY_RESPONSE_TIMEOUT_SECONDS;

/**
 * Moves a PENDING emergency to the next best workshop, or marks it UNASSIGNED when no
 * untried workshop remains / max attempts reached. Caller holds the order row lock.
 */
async function reroute(tx: Queryable, order: PendingEmergency): Promise<{ workshopId: string | null }> {
  const unassigned = async () => {
    await emergencyRepository.markUnassigned(tx, order.id);
    await notif.notifyOrder(tx, order.id, 'CUSTOMER', {
      type: 'SOS_UNASSIGNED',
      title: 'Belum ada bengkel yang bisa membantu',
      body: 'Semua bengkel terdekat sedang tidak tersedia. Coba kirim ulang permintaan atau hubungi bengkel langsung.',
    });
    return { workshopId: null };
  };
  if (order.routing_attempts >= env.EMERGENCY_MAX_ROUTING_ATTEMPTS) return unassigned();
  const candidates = await emergencyRepository.scan(tx, { lat: order.latitude, lng: order.longitude, radiusMeters: RADIUS(), vehicleType: order.vehicle_type });
  const next = pickNext(candidates, RADIUS(), order.attempted_workshop_ids);
  if (!next) return unassigned();
  await emergencyRepository.reassign(tx, order.id, next.id, next.distance_meters, TIMEOUT());
  await notif.notifyOrder(tx, order.id, 'OWNER', { type: 'SOS_INCOMING', title: 'SOS masuk dari {customer}', body: `Respons dalam ${Math.round(TIMEOUT() / 60)} menit` });
  await notif.notifyOrder(tx, order.id, 'CUSTOMER', { type: 'SOS_REROUTED', title: 'Permintaan dialihkan ke bengkel lain', body: next.name });
  return { workshopId: next.id };
}

export const emergencyService = {
  /** PBI-201/202: workshops within 5 km, ranked by proximity + mechanic rating. */
  async scan(input: ScanInput) {
    const rows = await emergencyRepository.scan(db, { lat: input.latitude, lng: input.longitude, radiusMeters: RADIUS(), vehicleType: input.vehicle_type });
    return { radius_meters: RADIUS(), workshops: rankCandidates(rows, RADIUS()) };
  },

  /**
   * PBI-203 / FR-EME-02: the whole emergency order (orders + emergency_details + transactions)
   * is created atomically; any failure rolls back everything.
   */
  async request(customerId: string, input: EmergencyRequestInput, role: ActorRole = 'CUSTOMER') {
    // The mechanic calls the customer on the way (guests always give a number; Google sign-ups may not have one yet).
    if (!(await authRepository.findUserById(db, customerId))?.phone) {
      throw AppError.unprocessable('Add your WhatsApp number so the mechanic can reach you', 'PHONE_REQUIRED');
    }
    const vehicle = input.vehicle_id ? await vehicleService.forOrder(db, customerId, input.vehicle_id, input.vehicle_type) : null;
    return withTransaction(async (tx) => {
      await setActor(tx, { id: customerId, role });
      // Serialise per customer so double-taps on the SOS button can't create two live emergencies.
      await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended('emergency:' || $1::text, 0))`, [customerId]);
      if (await emergencyRepository.hasActiveEmergency(tx, customerId)) {
        throw AppError.conflict('You already have an active emergency request', 'ACTIVE_EMERGENCY_EXISTS');
      }

      const candidates = await emergencyRepository.scan(tx, { lat: input.latitude, lng: input.longitude, radiusMeters: RADIUS(), vehicleType: input.vehicle_type });
      const target = pickNext(candidates, RADIUS(), []);
      if (!target) throw AppError.unprocessable('No available workshop within 5 km of your location', 'NO_WORKSHOP_NEARBY');

      const order = await orderRepository.insert(tx, {
        orderNumber: await orderRepository.nextOrderNumber(tx, 'EM'),
        type: 'EMERGENCY',
        status: 'PENDING',
        customerId,
        workshopId: target.id,
        vehicleType: input.vehicle_type,
        vehiclePlate: input.vehicle_plate ?? vehicle?.plate ?? undefined,
        vehicleId: vehicle?.id,
        totalAmount: 0,
      });
      await emergencyRepository.insertDetails(tx, {
        orderId: order.id,
        lat: input.latitude,
        lng: input.longitude,
        addressNote: input.address_note,
        problem: input.problem_description,
        distance: target.distance_meters,
        timeoutSeconds: TIMEOUT(),
        workshopId: target.id,
        priceMin: input.price_min,
        priceMax: input.price_max,
        problemCategory: input.problem_category,
      });
      await orderRepository.insertTransaction(tx, order.id, 0);
      await notif.notifyOrder(tx, order.id, 'OWNER', { type: 'SOS_INCOMING', title: 'SOS masuk dari {customer}', body: `Respons dalam ${Math.round(TIMEOUT() / 60)} menit` });

      return {
        ...order,
        response_timeout_seconds: TIMEOUT(),
        assigned_workshop: { id: target.id, name: target.name, phone: target.phone, address: target.address, distance_meters: target.distance_meters, score: target.score },
      };
    });
  },

  /** PBI-204: assigned workshop accepts (dispatching a mechanic) or declines (auto re-route). */
  async respond(ownerId: string, orderId: string, input: RespondInput) {
    const workshop = await workshopRepository.findByOwner(db, ownerId);
    if (!workshop) throw AppError.notFound('Order not found');

    return withTransaction(async (tx) => {
      await setActor(tx, { id: ownerId, role: 'WORKSHOP_OWNER' });
      const order = await emergencyRepository.findPendingForUpdate(tx, orderId);
      // Same 404 for "doesn't exist" and "not yours" to avoid leaking other orders (BOLA).
      if (!order || order.type !== 'EMERGENCY' || order.workshop_id !== workshop.id) throw AppError.notFound('Order not found');
      if (order.status !== 'PENDING') throw AppError.conflict(`Order is already ${order.status}`, 'INVALID_ORDER_STATE');
      if (order.response_deadline && order.response_deadline.getTime() < Date.now()) {
        throw AppError.conflict('Response window has expired; the request was re-routed', 'RESPONSE_WINDOW_EXPIRED');
      }

      if (input.action === 'DECLINE') {
        const { workshopId } = await reroute(tx, order);
        return { order_id: orderId, action: 'DECLINED', rerouted_to: workshopId, status: workshopId ? 'PENDING' : 'UNASSIGNED' };
      }

      let mechanic: { id: string; name: string; phone: string | null } | null;
      if (input.mechanic_id) {
        const chosen = await emergencyRepository.lockChosenMechanic(tx, workshop.id, input.mechanic_id);
        if (!chosen) throw AppError.notFound('Mechanic not found');
        if (chosen.busy) throw AppError.conflict('This mechanic is on another job; choose someone else', 'MECHANIC_BUSY');
        mechanic = { id: chosen.id, name: chosen.name, phone: chosen.phone };
      } else {
        mechanic = await emergencyRepository.pickFreeMechanic(tx, workshop.id);
      }
      if (!mechanic) throw AppError.conflict('No mechanic is available to dispatch; decline instead', 'NO_MECHANIC_AVAILABLE');
      const amount = input.estimated_price ?? 0;
      await orderRepository.setStatus(tx, orderId, 'ACCEPTED', { mechanicId: mechanic.id, totalAmount: amount });
      await orderRepository.syncTransactionAmount(tx, orderId, amount);
      await emergencyRepository.markResponded(tx, orderId);
      await notif.notifyOrder(tx, orderId, 'CUSTOMER', {
        type: 'SOS_ACCEPTED',
        title: `${workshop.name} menerima panggilan darurat`,
        body: `${mechanic.name} menuju lokasi${amount > 0 ? ` · estimasi ${notif.rupiah(amount)}` : ''}`,
      });
      return { order_id: orderId, action: 'ACCEPTED', status: 'ACCEPTED', mechanic, estimated_price: amount };
    });
  },

  /**
   * Owner revises the price of an accepted SOS. Only while the customer hasn't paid: once a proof is
   * waiting or verified, the amount is what the customer transferred and must not move.
   */
  async setPrice(ownerId: string, orderId: string, input: PriceInput) {
    const workshop = await workshopRepository.findByOwner(db, ownerId);
    if (!workshop) throw AppError.notFound('Order not found');
    return withTransaction(async (tx) => {
      const actor = { id: ownerId, role: 'WORKSHOP_OWNER' as const };
      await setActor(tx, actor);
      const order = await orderRepository.findByIdForUpdate(tx, orderId);
      if (!order || order.type !== 'EMERGENCY' || order.workshop_id !== workshop.id) throw AppError.notFound('Order not found');
      if (!['ACCEPTED', 'IN_PROGRESS'].includes(order.status)) {
        throw AppError.conflict(`Price cannot be changed while the order is ${order.status}`, 'INVALID_ORDER_STATE');
      }
      const { rows } = await tx.query<{ status: string }>(`SELECT status FROM transactions WHERE order_id = $1 FOR UPDATE`, [orderId]);
      if (!['UNPAID', 'REJECTED'].includes(rows[0]?.status ?? 'UNPAID')) {
        throw AppError.conflict('The customer already paid or sent a payment proof; the price is locked', 'PRICE_LOCKED');
      }
      await orderRepository.setStatus(tx, orderId, order.status, { totalAmount: input.estimated_price });
      await orderRepository.syncTransactionAmount(tx, orderId, input.estimated_price);
      await audit(tx, actor, { action: 'EMERGENCY_PRICE_CHANGED', entity: 'order', entityId: orderId, details: { from: order.total_amount, to: input.estimated_price } });
      await notif.notifyOrder(tx, orderId, 'CUSTOMER', { type: 'PRICE_UPDATED', title: 'Estimasi biaya diperbarui bengkel', body: notif.rupiah(input.estimated_price) });
      return { order_id: orderId, status: order.status, estimated_price: input.estimated_price };
    });
  },

  /** PBI-205: fallback re-routing for workshops that did not respond within the window. */
  async rerouteExpired(batchSize = 20): Promise<number> {
    return withTransaction(async (tx) => {
      await setActor(tx, SYSTEM);
      const expired = await emergencyRepository.claimExpired(tx, batchSize);
      for (const order of expired) {
        const { workshopId } = await reroute(tx, order);
        logger.info({ orderId: order.id, from: order.workshop_id, to: workshopId }, 'Emergency re-routed after response timeout');
      }
      return expired.length;
    });
  },
};
