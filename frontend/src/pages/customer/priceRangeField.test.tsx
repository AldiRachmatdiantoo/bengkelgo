import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PriceRange } from '@/utils/priceRange';
import { PriceRangeField } from './EmergencyPage';

function Harness() {
  const [r, setR] = useState<PriceRange>({});
  return <PriceRangeField value={r} onChange={setR} />;
}

describe('PriceRangeField (SOS budget)', () => {
  it('defaults to "Bisa dibicarakan"', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Bisa dibicarakan' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Dikirim ke bengkel:/)).toHaveTextContent('Bisa dibicarakan');
  });

  it('applies a preset and flags min > max', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Rp100–250rb' }));
    expect(screen.getByLabelText('Minimal (Rp)')).toHaveValue(100000);
    expect(screen.getByLabelText('Maksimal (Rp)')).toHaveValue(250000);

    const min = screen.getByLabelText('Minimal (Rp)');
    await userEvent.clear(min);
    await userEvent.type(min, '300000');
    expect(screen.getByText('Nilai minimal lebih besar dari maksimal.')).toBeInTheDocument();
  });
});
