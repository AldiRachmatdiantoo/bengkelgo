import { Router } from 'express';
import adminRoutes from '../features/admin/admin.routes';
import authRoutes from '../features/auth/auth.routes';
import bookingRoutes from '../features/booking/booking.routes';
import emergencyRoutes from '../features/emergency/emergency.routes';
import notificationRoutes from '../features/notification/notification.routes';
import orderRoutes from '../features/order/order.routes';
import paymentRoutes from '../features/payment/payment.routes';
import reviewRoutes from '../features/review/review.routes';
import statsRoutes from '../features/stats/stats.routes';
import vehicleRoutes from '../features/vehicle/vehicle.routes';
import workshopRoutes from '../features/workshop/workshop.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/booking', bookingRoutes);
router.use('/workshops', workshopRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/stats', statsRoutes);

export default router;
