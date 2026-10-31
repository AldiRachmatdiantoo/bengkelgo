import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import RouteErrorPage from '@/pages/public/RouteErrorPage';
import { AppLayout, RequireRole } from '@/components/layout/AppLayout';
import HomePage from '@/pages/public/HomePage';
import { SkeletonPage } from '@/components/ui';
// Small and already used by the header bell, so it stays in the main bundle.
import NotificationsPage from '@/pages/shared/NotificationsPage';

// Code-splitting: the landing page ships in the main bundle; every other page (and its libraries,
// e.g. Leaflet maps) is downloaded the first time it is opened.
const named = <M,>(load: () => Promise<M>, name: keyof M) => lazy(async () => ({ default: (await load())[name] as ComponentType }));

const WorkshopSearchPage = lazy(() => import('@/pages/public/WorkshopSearchPage'));
const WorkshopDetailPage = lazy(() => import('@/pages/public/WorkshopDetailPage'));
const EmergencyPage = lazy(() => import('@/pages/customer/EmergencyPage'));
const VehiclesPage = lazy(() => import('@/pages/customer/VehiclesPage'));
const AccountPage = lazy(() => import('@/pages/shared/AccountPage'));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'));
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'));
const auth = () => import('@/pages/auth/AuthPages');
const LoginPage = named(auth, 'LoginPage');
const RegisterPage = named(auth, 'RegisterPage');
const RegisterWorkshopPage = named(auth, 'RegisterWorkshopPage');
const GoogleCallbackPage = named(auth, 'GoogleCallbackPage');
const VerifyEmailPage = named(auth, 'VerifyEmailPage');
const ForgotPasswordPage = named(auth, 'ForgotPasswordPage');
const ResetPasswordPage = named(auth, 'ResetPasswordPage');
const orders = () => import('@/pages/customer/OrderPages');
const MyOrdersPage = named(orders, 'MyOrdersPage');
const OrderDetailPage = named(orders, 'OrderDetailPage');
const PaymentPage = named(orders, 'PaymentPage');
const owner = () => import('@/pages/owner/OwnerPages');
const OwnerDashboardPage = named(owner, 'OwnerDashboardPage');
const OwnerEmergencyPage = named(owner, 'OwnerEmergencyPage');
const OwnerMechanicsPage = named(owner, 'OwnerMechanicsPage');
const OwnerOrdersPage = named(owner, 'OwnerOrdersPage');
const OwnerPaymentsPage = named(owner, 'OwnerPaymentsPage');
const OwnerProfilePage = named(owner, 'OwnerProfilePage');
const OwnerQuotasPage = named(owner, 'OwnerQuotasPage');
const OwnerReviewsPage = named(owner, 'OwnerReviewsPage');
const admin = () => import('@/pages/admin/AdminPages');
const AdminDashboardPage = named(admin, 'AdminDashboardPage');
const AdminReportsPage = named(admin, 'AdminReportsPage');
const AdminWorkshopsPage = named(admin, 'AdminWorkshopsPage');
const adminTools = () => import('@/pages/admin/AdminToolsPages');
const AdminSearchPage = named(adminTools, 'AdminSearchPage');
const AdminAuditPage = named(adminTools, 'AdminAuditPage');
const AdminHealthPage = named(adminTools, 'AdminHealthPage');
const AdminUsersPage = named(adminTools, 'AdminUsersPage');

const page = (node: ReactNode) => <Suspense fallback={<SkeletonPage />}>{node}</Suspense>;

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      // Public
      { path: '/', element: <HomePage /> },
      { path: '/workshops', element: page(<WorkshopSearchPage />) },
      { path: '/workshops/:id', element: page(<WorkshopDetailPage />) },
      { path: '/emergency', element: page(<EmergencyPage />) },
      { path: '/login', element: page(<LoginPage />) },
      { path: '/register', element: page(<RegisterPage />) },
      { path: '/register/workshop', element: page(<RegisterWorkshopPage />) },
      { path: '/privasi', element: page(<PrivacyPage />) },
      { path: '/auth/google/callback', element: page(<GoogleCallbackPage />) },
      { path: '/verifikasi-email', element: page(<VerifyEmailPage />) },
      { path: '/lupa-password', element: page(<ForgotPasswordPage />) },
      { path: '/reset-password', element: page(<ResetPasswordPage />) },

      // Customer & guest
      {
        element: <RequireRole roles={['CUSTOMER', 'GUEST']} />,
        children: [
          { path: '/orders', element: page(<MyOrdersPage />) },
          { path: '/orders/:id/pay', element: page(<PaymentPage />) },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/vehicles', element: page(<VehiclesPage />) },
          { path: '/akun', element: page(<AccountPage />) },
        ],
      },
      // Any party of an order (server enforces ownership)
      {
        element: <RequireRole roles={['CUSTOMER', 'GUEST', 'WORKSHOP_OWNER', 'ADMIN']} />,
        children: [{ path: '/orders/:id', element: page(<OrderDetailPage />) }],
      },

      // Workshop owner
      {
        element: <RequireRole roles={['WORKSHOP_OWNER']} />,
        children: [
          { path: '/owner', element: page(<OwnerDashboardPage />) },
          { path: '/owner/emergency', element: page(<OwnerEmergencyPage />) },
          { path: '/owner/payments', element: page(<OwnerPaymentsPage />) },
          { path: '/owner/orders', element: page(<OwnerOrdersPage />) },
          // Services now live under "Pengaturan Bengkel" (Stitch tab layout).
          { path: '/owner/services', element: <Navigate to={{ pathname: '/owner/profile', hash: '#layanan' }} replace /> },
          { path: '/owner/mechanics', element: page(<OwnerMechanicsPage />) },
          { path: '/owner/quotas', element: page(<OwnerQuotasPage />) },
          { path: '/owner/profile', element: page(<OwnerProfilePage />) },
          { path: '/owner/reviews', element: page(<OwnerReviewsPage />) },
          { path: '/owner/notifications', element: <NotificationsPage /> },
          { path: '/owner/akun', element: page(<AccountPage />) },
        ],
      },

      // Admin
      {
        element: <RequireRole roles={['ADMIN']} />,
        children: [
          { path: '/admin', element: page(<AdminDashboardPage />) },
          { path: '/admin/workshops', element: page(<AdminWorkshopsPage />) },
          { path: '/admin/reports', element: page(<AdminReportsPage />) },
          { path: '/admin/search', element: page(<AdminSearchPage />) },
          { path: '/admin/audit', element: page(<AdminAuditPage />) },
          { path: '/admin/health', element: page(<AdminHealthPage />) },
          { path: '/admin/users', element: page(<AdminUsersPage />) },
          { path: '/admin/notifications', element: <NotificationsPage /> },
          { path: '/admin/akun', element: page(<AccountPage />) },
        ],
      },

      { path: '*', element: page(<NotFoundPage />) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
