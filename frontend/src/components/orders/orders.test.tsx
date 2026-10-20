import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Order } from '@/services/api/types';
import { EmergencyCostCard, OrderCard, isPayable } from './OrderComponents';

const base: Order = {
  id: 'o1',
  order_number: 'EM-20261019-000001',
  type: 'EMERGENCY',
  status: 'ACCEPTED',
  customer_id: 'c1',
  workshop_id: 'w1',
  vehicle_type: 'MOTOR',
  vehicle_plate: 'B 1234 XYZ',
  notes: null,
  total_amount: 0,
  created_at: '2026-10-19T02:00:00Z',
  updated_at: '2026-10-19T02:00:00Z',
  completed_at: null,
  cancelled_at: null,
  customer: { id: 'c1', name: 'Sinta', phone: '081200002222' },
  workshop: { id: 'w1', name: 'Bengkel Uji', phone: '0811', address: 'Jl. Uji', latitude: -6.2, longitude: 106.8 },
  mechanic: null,
  emergency: {
    latitude: -6.2,
    longitude: 106.8,
    address_note: null,
    problem_description: 'Ban bocor di jalan\nKisaran biaya: Rp 100.000 – Rp 250.000',
    distance_meters: 900,
    response_deadline: null,
    routing_attempts: 1,
  },
  booking: null,
  payment: { status: 'UNPAID', amount: 0, uploaded_at: null, verified_at: null, rejection_reason: null },
  reviewed: false,
};

describe('OrderCard', () => {
  it('shows the problem without the encoded price line, and "harga bisa dibicarakan" when unpriced', () => {
    render(
      <MemoryRouter>
        <OrderCard order={base} to="/orders/o1" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Ban bocor di jalan')).toBeInTheDocument();
    expect(screen.queryByText(/Kisaran biaya:/)).not.toBeInTheDocument();
    expect(screen.getByText('Harga bisa dibicarakan')).toBeInTheDocument();
  });
});

describe('EmergencyCostCard', () => {
  it('never says GRATIS for an accepted SOS without a price', () => {
    render(<EmergencyCostCard order={base} />);
    expect(screen.queryByText(/GRATIS/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Bisa dibicarakan').length).toBeGreaterThan(0);
    expect(screen.getByText(/Rp\s100\.000 – Rp\s250\.000/)).toBeInTheDocument();
  });
});

describe('isPayable', () => {
  it('needs a price before the customer can pay', () => {
    expect(isPayable(base)).toBe(false);
    expect(isPayable({ ...base, total_amount: 75_000 })).toBe(true);
  });
});
