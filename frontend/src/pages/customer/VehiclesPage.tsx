import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { Vehicle, VehicleType } from '@/services/api/types';
import { vehicleIcon, vehicleLabel } from '@/components/workshop/WorkshopComponents';
import { Alert, Button, Card, EmptyState, Icon, Input, Loading, Modal, PageHeader, Segmented, toast } from '@/components/ui';
import { vehicleName } from '@/utils/format';

type Form = { vehicle_type: VehicleType; brand: string; model: string; year: string; color: string; plate: string };
const EMPTY: Form = { vehicle_type: 'MOTOR', brand: '', model: '', year: '', color: '', plate: '' };
const toForm = (v: Vehicle): Form => ({ vehicle_type: v.vehicle_type, brand: v.brand, model: v.model ?? '', year: v.year ? String(v.year) : '', color: v.color ?? '', plate: v.plate ?? '' });
const toBody = (f: Form) => ({
  vehicle_type: f.vehicle_type,
  brand: f.brand.trim(),
  model: f.model.trim() || undefined,
  year: f.year ? Number(f.year) : undefined,
  color: f.color.trim() || undefined,
  plate: f.plate.trim() || undefined,
});

/** Saved vehicles: picked in one tap when booking or sending an SOS. */
export default function VehiclesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list });
  const [editing, setEditing] = useState<Vehicle | 'new' | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['vehicles'] });
  const remove = useMutation({
    mutationFn: (v: Vehicle) => vehicleApi.remove(v.id),
    onSuccess: (_d, v) => {
      setRemoving(null);
      void refresh();
      toast('Kendaraan dihapus', { text: vehicleName(v) });
    },
  });
  const vehicles = list.data ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow="Akun"
        title="Kendaraan Saya"
        subtitle="Simpan kendaraan sekali, lalu pilih saat booking servis atau meminta bantuan darurat."
        actions={
          <Button icon="add" onClick={() => setEditing('new')} disabled={vehicles.length >= 10} data-testid="vehicle-add">
            Tambah kendaraan
          </Button>
        }
      />
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : vehicles.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {vehicles.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5 shadow-sm" data-testid="vehicle-card">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky text-primary">
                  <Icon name={vehicleIcon(v.vehicle_type)} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-navy">{vehicleName(v)}</p>
                  <p className="font-label text-xs text-ink-3">{vehicleLabel(v.vehicle_type)}</p>
                </div>
                {v.plate && <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-bold text-white">{v.plate}</span>}
              </div>
              <div className="flex gap-2 border-t border-line pt-3">
                <Button size="sm" variant="ghost" icon="edit" className="bg-surface-low" onClick={() => setEditing(v)}>
                  Ubah
                </Button>
                <Button size="sm" variant="ghost" icon="delete" className="text-emergency-ink hover:bg-emergency-soft" onClick={() => setRemoving(v)}>
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="garage" action={<Button icon="add" onClick={() => setEditing('new')}>Tambah kendaraan pertama</Button>}>
          Belum ada kendaraan tersimpan.
        </EmptyState>
      )}
      <p className="font-label text-xs text-ink-3">Maksimal 10 kendaraan. Pesanan lama tetap menyimpan data kendaraannya walaupun kendaraan dihapus dari daftar ini.</p>

      {editing && <VehicleModal vehicle={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        icon="delete"
        tone="danger"
        title="Hapus kendaraan?"
        actions={
          <>
            <Button variant="ghost" className="bg-surface-low" onClick={() => setRemoving(null)}>
              Batal
            </Button>
            <Button variant="danger" icon="delete" loading={remove.isPending} onClick={() => removing && remove.mutate(removing)}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="mt-2">{removing && vehicleName(removing)} dihapus dari daftar kendaraan Anda.</p>
      </Modal>
    </div>
  );
}

function VehicleModal({ vehicle, onClose, onSaved }: { vehicle: Vehicle | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(vehicle ? toForm(vehicle) : EMPTY);
  const year = Number(f.year);
  const badYear = f.year !== '' && (!Number.isInteger(year) || year < 1950 || year > 2100);
  const save = useMutation({
    mutationFn: () => (vehicle ? vehicleApi.update(vehicle.id, toBody(f)) : vehicleApi.create(toBody(f))),
    onSuccess: () => {
      onSaved();
      onClose();
      toast(vehicle ? 'Kendaraan diperbarui' : 'Kendaraan disimpan', { text: vehicleName(toBody(f)) });
    },
  });
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (f.brand.trim().length >= 2 && !badYear) save.mutate();
  };
  return (
    <Modal
      open
      onClose={onClose}
      icon="garage"
      title={vehicle ? 'Ubah kendaraan' : 'Tambah kendaraan'}
      actions={
        <>
          <Button variant="ghost" className="bg-surface-low" onClick={onClose}>
            Batal
          </Button>
          <Button icon="save" loading={save.isPending} disabled={f.brand.trim().length < 2 || badYear} onClick={() => submit()} data-testid="vehicle-save">
            Simpan
          </Button>
        </>
      }
    >
      <form className="mt-3 flex flex-col gap-3" onSubmit={submit}>
        <Card>
          <Segmented
            label="Jenis kendaraan"
            value={f.vehicle_type}
            onChange={(v) => setF({ ...f, vehicle_type: v })}
            options={[
              { value: 'MOTOR', label: 'Motor', icon: 'two_wheeler' },
              { value: 'MOBIL', label: 'Mobil', icon: 'directions_car' },
            ]}
          />
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Merek" required value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder="Honda" data-testid="vehicle-brand" />
          <Input label="Model (opsional)" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="Vario 125" />
          <Input label="Tahun (opsional)" type="number" min={1950} max={2100} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} error={badYear ? '1950–2100' : undefined} />
          <Input label="Warna (opsional)" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} placeholder="Hitam" />
          <Input label="Plat nomor (opsional)" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value.toUpperCase() })} placeholder="B 1234 XYZ" maxLength={15} data-testid="vehicle-plate" />
        </div>
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <button type="submit" className="sr-only">
          Simpan
        </button>
      </form>
    </Modal>
  );
}
