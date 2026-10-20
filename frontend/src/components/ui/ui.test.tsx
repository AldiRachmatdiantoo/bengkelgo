import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge, Button, Modal, Segmented } from './index';

describe('Button', () => {
  it('runs onClick and is square-cornered (rounded-lg), not a pill', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Simpan</Button>);
    const btn = screen.getByRole('button', { name: 'Simpan' });
    expect(btn.className).toContain('rounded-lg');
    expect(btn.className).not.toContain('rounded-full');
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled while loading', () => {
    render(<Button loading>Kirim</Button>);
    expect(screen.getByRole('button', { name: /Kirim/ })).toBeDisabled();
  });

  it('danger variant uses the SOS orange token', () => {
    render(<Button variant="danger">Panggil SOS</Button>);
    expect(screen.getByRole('button', { name: 'Panggil SOS' }).className).toContain('bg-emergency');
  });
});

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge tone="success">Lunas</Badge>);
    expect(screen.getByText('Lunas')).toBeInTheDocument();
  });
});

describe('Segmented', () => {
  it('marks the selected option and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Panduan"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'Booking' },
          { value: 'b', label: 'SOS' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Booking' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'SOS' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('keeps one row with nowrap', () => {
    render(<Segmented nowrap label="x" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} />);
    expect(screen.getByRole('radiogroup').className).toContain('flex-nowrap');
  });
});

describe('Modal', () => {
  it('renders only when open and closes on Escape', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={false} onClose={onClose} title="Hapus teknisi?">
        isi
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <Modal open onClose={onClose} title="Hapus teknisi?">
        isi
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Hapus teknisi?');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
