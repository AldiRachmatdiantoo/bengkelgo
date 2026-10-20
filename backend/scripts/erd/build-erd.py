"""
Builds the ERD (Mermaid) from the live database schema.

Usage (from backend/, with the Docker stack running):
  docker compose exec -T db psql -U bengkel -d bengkel -At -F '|' -f - < scripts/erd/columns.sql > /tmp/cols.txt
  docker compose exec -T db psql -U bengkel -d bengkel -At -F '|' -f - < scripts/erd/fks.sql > /tmp/fks.txt
  python scripts/erd/build-erd.py /tmp/cols.txt /tmp/fks.txt docs/erd.md [html_out]

The Markdown output renders on GitHub / VS Code; the optional HTML output is the visual page.
"""
import html
import json
import sys
from collections import OrderedDict

cols_file, fks_file, md_out = sys.argv[1], sys.argv[2], sys.argv[3]
html_out = sys.argv[4] if len(sys.argv) > 4 else None

# ---------- read schema ----------
tables = OrderedDict()
for line in open(cols_file, encoding='utf8'):
    line = line.strip()
    if not line or '|' not in line:
        continue
    t, col, dtype, udt, nullable, pk, uk = line.split('|')
    tables.setdefault(t, []).append({'col': col, 'udt': udt, 'null': nullable == 'YES', 'pk': pk == 'PK', 'uk': uk == 'UK'})

fks = []
for line in open(fks_file, encoding='utf8'):
    line = line.strip()
    if line:
        t, col, rt, rcol, rule = line.split('|')
        fks.append({'t': t, 'col': col, 'rt': rt, 'rcol': rcol, 'rule': rule})
fk_cols = {(f['t'], f['col']) for f in fks}

TYPE = {
    'uuid': 'uuid', 'varchar': 'varchar', 'text': 'text', 'bpchar': 'char', 'timestamptz': 'timestamptz', 'numeric': 'numeric',
    'bool': 'boolean', 'int2': 'smallint', 'int4': 'int', 'int8': 'bigint', 'date': 'date', 'time': 'time',
    'geography': 'geography_point', 'jsonb': 'jsonb', '_int2': 'smallint_array', '_text': 'text_array', '_uuid': 'uuid_array',
    '_vehicle_type': 'vehicle_type_array',
}
ENUMS = {'user_role', 'workshop_status', 'vehicle_type', 'order_type', 'order_status', 'payment_status'}

def ty(udt):
    if udt in TYPE:
        return TYPE[udt]
    if udt in ENUMS:
        return f'enum_{udt}'
    return udt

# ---------- domains (what the reader thinks in) ----------
DOMAINS = [
    ('akun', 'Akun & pelanggan', 'Pengguna semua peran, sesi login, notifikasi, dan kendaraan tersimpan.',
     ['users', 'refresh_tokens', 'notifications', 'vehicles']),
    ('bengkel', 'Bengkel', 'Profil bengkel mitra beserta layanan, mekanik, kuota per jam, hari libur, dan foto.',
     ['workshops', 'services', 'mechanics', 'workshop_quotas', 'workshop_holidays', 'workshop_photos']),
    ('pesanan', 'Pesanan & pembayaran', 'Satu pesanan (booking atau SOS) dengan detailnya, pembayaran QRIS, ulasan, dan riwayat status.',
     ['orders', 'booking_details', 'emergency_details', 'transactions', 'reviews', 'order_status_history']),
    ('audit', 'Audit', 'Jejak tindakan penting yang tidak bisa diubah atau dihapus.', ['audit_logs']),
]
assigned = {t for d in DOMAINS for t in d[3]}
missing = [t for t in tables if t not in assigned]
if missing:
    raise SystemExit(f'Tables without a domain: {missing}')

ORIGIN = {
    'notifications': '004', 'vehicles': '004', 'workshop_holidays': '004', 'workshop_photos': '004',
    'order_status_history': '004', 'audit_logs': '004',
}
NOTES = {
    'users': 'Semua peran: CUSTOMER, GUEST, WORKSHOP_OWNER, ADMIN.',
    'refresh_tokens': 'Hanya hash SHA-256 yang disimpan; satu family dicabut bila token dipakai ulang.',
    'notifications': 'Notifikasi di dalam aplikasi per pengguna.',
    'vehicles': 'Kendaraan tersimpan pelanggan (soft delete).',
    'workshops': 'Satu bengkel per pemilik; lokasi PostGIS untuk radius 5 km.',
    'services': 'Layanan dengan harga dan durasi (soft delete).',
    'mechanics': 'Mekanik dengan rating dan tag keahlian.',
    'workshop_quotas': 'Kapasitas per jam, dikunci FOR UPDATE saat booking.',
    'workshop_holidays': 'Tanggal libur bengkel.',
    'workshop_photos': 'Galeri foto; satu foto sampul per bengkel.',
    'orders': 'Pesanan booking atau SOS.',
    'booking_details': 'Tanggal, jam, dan nomor antrean booking.',
    'emergency_details': 'Lokasi, keluhan, dan routing SOS.',
    'transactions': 'Pembayaran QRIS satu pesanan: bukti, verifikasi, invoice, refund.',
    'reviews': 'Satu ulasan per pesanan selesai, dengan balasan bengkel.',
    'order_status_history': 'Diisi otomatis oleh trigger setiap status pesanan atau pembayaran berubah.',
    'audit_logs': 'Append-only: trigger menolak UPDATE dan DELETE.',
}

def unique_cols(t):
    return {c['col'] for c in tables[t] if c['pk'] or c['uk']}

def rel_line(f):
    # child side: many, or one when the FK column is itself unique (1:1 detail tables)
    child_one = f['col'] in unique_cols(f['t'])
    nullable = next(c['null'] for c in tables[f['t']] if c['col'] == f['col'])
    parent = '|o' if nullable else '||'
    child = 'o|' if child_one else 'o{'
    return f'    {f["rt"]} {parent}--{child} {f["t"]} : "{f["col"]}"'

def entity(t, with_cols=True):
    if not with_cols:
        return f'    {t} {{\n        uuid id PK\n    }}'
    rows = []
    for c in tables[t]:
        keys = []
        if c['pk']:
            keys.append('PK')
        if (t, c['col']) in fk_cols:
            keys.append('FK')
        if c['uk'] and not c['pk']:
            keys.append('UK')
        rows.append(f'        {ty(c["udt"])} {c["col"]}' + (f' {",".join(keys)}' if keys else ''))
    return f'    {t} {{\n' + '\n'.join(rows) + '\n    }'

def diagram(focus, all_cols=True):
    """ERD of `focus` tables with full columns; tables they reference from elsewhere appear as id-only boxes."""
    rels = [f for f in fks if f['t'] in focus or f['rt'] in focus]
    rels = [f for f in rels if (f['t'] in focus) or (f['rt'] in focus and f['t'] in focus)]
    neighbours = sorted({f['rt'] for f in rels} - set(focus))
    parts = ['erDiagram']
    parts += [entity(t, all_cols) for t in focus]
    parts += [entity(t, False) for t in neighbours]
    parts += [rel_line(f) for f in rels]
    return '\n'.join(parts)

overview_lines = ['erDiagram'] + [rel_line(f) for f in fks]
overview = '\n'.join(overview_lines)
full = diagram(list(tables.keys()))

# ---------- markdown ----------
md = ['# ERD Database BengkelGo', '',
      'Dibuat otomatis dari skema database yang berjalan (`backend/scripts/erd/build-erd.py`). '
      f'{len(tables)} tabel, {len(fks)} relasi. Migrasi: `001_init` s/d `005_reminder_2h`.', '',
      'Cara baca garis: `||` tepat satu, `|o` nol atau satu, `o{` nol atau banyak. Label garis = kolom foreign key.', '',
      '## Gambaran relasi', '', '```mermaid', overview, '```', '']
for key, name, desc, ts in DOMAINS:
    md += [f'## {name}', '', desc, '', '```mermaid', diagram(ts), '```', '', '| Tabel | Isi |', '|---|---|']
    md += [f'| `{t}` | {NOTES.get(t, "")}{" *(baru, migrasi " + ORIGIN[t] + ")*" if t in ORIGIN else ""} |' for t in ts]
    md.append('')
md += ['## Aturan hapus (ON DELETE)', '', '| Tabel.kolom | Mengacu ke | Saat induk dihapus |', '|---|---|---|']
md += [f'| `{f["t"]}.{f["col"]}` | `{f["rt"]}.{f["rcol"]}` | {f["rule"]} |' for f in fks]
md.append('')
open(md_out, 'w', encoding='utf8').write('\n'.join(md))

if html_out:
    data = {
        'overview': overview,
        'domains': [{'key': k, 'name': n, 'desc': d, 'diagram': diagram(ts), 'tables': [
            {'name': t, 'note': NOTES.get(t, ''), 'new': ORIGIN.get(t), 'cols': len(tables[t])} for t in ts]} for k, n, d, ts in DOMAINS],
        'fks': fks,
        'counts': {'tables': len(tables), 'fks': len(fks), 'columns': sum(len(v) for v in tables.values())},
    }
    open(html_out, 'w', encoding='utf8').write(json.dumps(data, ensure_ascii=False))
print(f'{len(tables)} tables, {len(fks)} relations -> {md_out}')
