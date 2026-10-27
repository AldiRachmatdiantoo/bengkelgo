/**
 * Demo data for presentations. Empties the database like db:reset but keeps ONE admin, then adds 20 approved
 * workshops in Surabaya (each with its owner account, services and mechanics) and 3 customer accounts.
 *
 *   npm run db:demo -- --confirm=<database host> [--admin=<email>] [--out=<file>]
 *   docker compose exec api node dist/db/demo.js --confirm=db --out=/tmp/demo-accounts.local.md   (local Docker stack)
 *
 * Without --confirm it only shows what it would do. The admin kept is --admin=<email>, else SEED_ADMIN_EMAIL
 * (its password does not change). Every demo account gets the same random password (or DEMO_PASSWORD), written
 * with the emails to demo-accounts.local.md (git-ignored); it is never printed. Demo emails use the reserved
 * .test domain, so nothing is ever mailed to them.
 *
 * The map pins are real repair-shop locations in Surabaya (OpenStreetMap, Oct 2026) with their street names;
 * the workshop names, people and phone numbers are made up.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { pool } from '../config/database';
import { hashPassword } from '../common/utils/crypto';
import { authRepository } from '../features/auth/auth.repository';
import { vehicleRepository } from '../features/vehicle/vehicle.repository';
import { mechanicRepository, serviceRepository, workshopRepository } from '../features/workshop/workshop.repository';
import { counts, host, resetDatabase, resetStorage } from './reset';

type Kind = 'MOTOR' | 'MOBIL' | 'BOTH';
interface Shop {
  name: string;
  kind: Kind;
  address: string;
  lat: number;
  lng: number;
  hours: [string, string];
  slots: number;
  closedSunday?: boolean;
  lunchBreak?: boolean;
  about: string;
}

const SHOPS: Shop[] = [
  { name: 'Dukuh Jaya Autoservice', kind: 'MOBIL', address: 'Jl. Tembok Dukuh, Tembok Dukuh, Bubutan, Surabaya 60173', lat: -7.25492, lng: 112.72185, hours: ['08:00', '17:00'], slots: 3, closedSunday: true, about: 'Servis berkala dan perbaikan mesin mobil keluarga.' },
  { name: 'Ngagel Speed Motor', kind: 'MOTOR', address: 'Jl. Ngagel Rejo, Ngagelrejo, Wonokromo, Surabaya 60245', lat: -7.29558, lng: 112.74587, hours: ['08:00', '20:00'], slots: 4, about: 'Spesialis motor matic dan sport harian.' },
  { name: 'Panjang Jiwo Car Care', kind: 'MOBIL', address: 'Jl. Raya Panjang Jiwo Permai, Panjang Jiwo, Tenggilis Mejoyo, Surabaya 60299', lat: -7.30948, lng: 112.76746, hours: ['08:00', '17:00'], slots: 2, lunchBreak: true, about: 'Servis AC, spooring, dan perawatan rutin mobil.' },
  { name: 'Lontar Mobil Mandiri', kind: 'MOBIL', address: 'Jl. Raya Lontar, Lontar, Sambikerep, Surabaya 60216', lat: -7.28235, lng: 112.66012, hours: ['07:30', '16:30'], slots: 3, closedSunday: true, about: 'Bengkel umum mobil bensin dan diesel di Surabaya Barat.' },
  { name: 'Pandegiling Motor Service', kind: 'MOTOR', address: 'Jl. Pandegiling, Dr. Sutomo, Tegalsari, Surabaya 60264', lat: -7.27575, lng: 112.73481, hours: ['08:00', '18:00'], slots: 3, about: 'Servis motor cepat di tengah kota, bisa ditunggu.' },
  { name: 'Genteng Kali Motor', kind: 'MOTOR', address: 'Jl. Simpang Dukuh, Genteng, Surabaya 60261', lat: -7.26093, lng: 112.74163, hours: ['07:00', '17:00'], slots: 4, about: 'Ganti oli, tune up injeksi, dan servis CVT.' },
  { name: 'Manukan Ban & Motor', kind: 'MOTOR', address: 'Jl. Manukan Tama, Manukan Kulon, Tandes, Surabaya 60185', lat: -7.26052, lng: 112.66763, hours: ['08:00', '21:00'], slots: 3, about: 'Tambal ban tubeless, ganti ban, dan servis ringan.' },
  { name: 'Medokan Elektrik Motor', kind: 'MOTOR', address: 'Jl. Medokan Asri Tengah, Medokan Ayu, Rungkut, Surabaya 60295', lat: -7.3261, lng: 112.78948, hours: ['09:00', '17:00'], slots: 2, closedSunday: true, about: 'Servis motor listrik dan kelistrikan motor bensin.' },
  { name: 'Sambikerep Motor Center', kind: 'MOTOR', address: 'Jl. Raya Ngemplak, Made, Sambikerep, Surabaya 60219', lat: -7.26983, lng: 112.63722, hours: ['07:30', '16:00'], slots: 3, about: 'Servis rutin semua merek motor.' },
  { name: 'Wonorejo Auto Detailing', kind: 'MOBIL', address: 'Jl. Wonorejo Permai Utara, Wonorejo, Rungkut, Surabaya 60296', lat: -7.31657, lng: 112.79074, hours: ['09:00', '18:00'], slots: 2, lunchBreak: true, about: 'Detailing, servis ringan, dan perawatan cat mobil.' },
  { name: 'Simo Gunung Motor', kind: 'MOTOR', address: 'Jl. Simo Gunung, Putat Jaya, Sawahan, Surabaya 60222', lat: -7.27329, lng: 112.71049, hours: ['09:00', '18:00'], slots: 3, about: 'Bengkel motor keluarga, harga bersahabat.' },
  { name: 'Lidah Wetan Autocare', kind: 'BOTH', address: 'Jl. Raya Unesa, Lidah Wetan, Lakarsantri, Surabaya 60213', lat: -7.29998, lng: 112.66347, hours: ['08:00', '17:00'], slots: 3, about: 'Melayani motor dan mobil, dekat kampus Unesa.' },
  { name: 'Jemursari Mobil Sehat', kind: 'MOBIL', address: 'Jl. Jemursari II, Jemur Wonosari, Wonocolo, Surabaya 60237', lat: -7.32028, lng: 112.74288, hours: ['08:00', '17:00'], slots: 3, closedSunday: true, lunchBreak: true, about: 'Servis berkala, kaki-kaki, dan rem mobil.' },
  { name: 'Ampel Motor Sejahtera', kind: 'MOTOR', address: 'Jl. Sultan Iskandar Muda, Ampel, Semampir, Surabaya 60151', lat: -7.22551, lng: 112.74203, hours: ['08:00', '20:00'], slots: 4, about: 'Servis motor di Surabaya Utara, buka sampai malam.' },
  { name: 'Kenjeran Auto Garage', kind: 'MOBIL', address: 'Jl. Kenjeran, Dukuh Sutorejo, Mulyorejo, Surabaya 60121', lat: -7.25074, lng: 112.78894, hours: ['08:00', '17:00'], slots: 3, about: 'Perbaikan mesin dan kelistrikan mobil.' },
  { name: 'Darmo Matic Center', kind: 'MOTOR', address: 'Jl. Raya Diponegoro, Darmo, Wonokromo, Surabaya 60241', lat: -7.29326, lng: 112.73815, hours: ['08:00', '19:00'], slots: 3, about: 'Spesialis motor matic: CVT, injeksi, dan kelistrikan.' },
  { name: 'HR Muhammad Motor Sport', kind: 'MOTOR', address: 'Jl. Mayjen HR. Muhammad, Putat Gede, Sukomanunggal, Surabaya 60189', lat: -7.28626, lng: 112.69907, hours: ['10:00', '20:00'], slots: 2, about: 'Servis dan setting motor sport.' },
  { name: 'Selatan Jaya Auto Service', kind: 'BOTH', address: 'Jl. Ahmad Yani, Gayungan, Surabaya 60231', lat: -7.31224, lng: 112.73372, hours: ['07:00', '17:00'], slots: 4, about: 'Bengkel motor dan mobil di jalur utama Ahmad Yani.' },
  { name: 'Gayungan Diesel & Mobil', kind: 'MOBIL', address: 'Jl. Ahmad Yani, Menanggal, Gayungan, Surabaya 60235', lat: -7.33682, lng: 112.72877, hours: ['08:00', '16:00'], slots: 2, closedSunday: true, about: 'Spesialis mesin diesel dan mobil niaga.' },
  { name: 'Kapasari Mobil Klasik', kind: 'MOBIL', address: 'Jl. Pecindilan, Kapasari, Genteng, Surabaya 60273', lat: -7.24551, lng: 112.74806, hours: ['09:00', '17:00'], slots: 2, about: 'Perawatan mobil lama dan mobil harian.' },
];

const OWNERS = [
  'Hendra Wijaya Kusuma', 'Agus Salim Prakoso', 'Bambang Eko Saputro', 'Lilis Suryani', 'Yusuf Maulana Akbar',
  'Wahyu Setiawan', 'Dedi Kurniawan', 'Slamet Riyadi Putra', 'Teguh Santoso', 'Rahmat Hidayatullah',
  'Endang Purwanti', 'Imam Syafii', 'Didik Hartanto', 'Hari Mulyono', 'Kevin Tanoto',
  'Anton Gunawan', 'Fitri Handayani', 'Arif Budiman Sakti', 'Ratna Sari Utami', 'Mochammad Fauzi',
];

const CUSTOMERS = [
  { name: 'Rizky Ananda Putra', email: 'rizky@bengkelgo.test', vehicle: { vehicle_type: 'MOTOR' as const, brand: 'Honda', model: 'Vario 125', year: 2021, color: 'Hitam' } },
  { name: 'Nadia Salsabila', email: 'nadia@bengkelgo.test', vehicle: { vehicle_type: 'MOTOR' as const, brand: 'Yamaha', model: 'NMAX', year: 2022, color: 'Putih' } },
  { name: 'Galih Prasetyo', email: 'galih@bengkelgo.test', vehicle: { vehicle_type: 'MOBIL' as const, brand: 'Toyota', model: 'Avanza', year: 2019, color: 'Silver' } },
];

const MOTOR_SERVICES: [string, string, number, number][] = [
  ['Servis Rutin Motor', 'Cek mesin, rem, rantai/CVT, dan kelistrikan.', 70000, 60],
  ['Ganti Oli Mesin', 'Oli sesuai spesifikasi pabrikan sudah termasuk.', 55000, 20],
  ['Servis CVT Motor Matic', 'Bersihkan dan cek roller, kampas ganda, dan v-belt.', 95000, 60],
  ['Tune Up Injeksi', 'Bersihkan throttle body dan injektor, reset ECU.', 120000, 75],
  ['Ganti Kampas Rem Motor', 'Jasa pasang, harga kampas terpisah.', 35000, 30],
  ['Tambal Ban Tubeless', 'Tambal dari luar tanpa bongkar ban.', 25000, 15],
];
const CAR_SERVICES: [string, string, number, number][] = [
  ['Servis Berkala 10.000 km', 'Ganti oli, filter oli, dan pemeriksaan 25 titik.', 450000, 120],
  ['Ganti Oli Mesin Mobil', 'Oli 4 liter dan filter oli.', 380000, 45],
  ['Spooring & Balancing', 'Empat roda.', 175000, 60],
  ['Servis AC Mobil', 'Cek tekanan, isi freon, bersihkan evaporator ringan.', 275000, 90],
  ['Tune Up Mesin', 'Busi, filter udara, dan throttle body.', 400000, 120],
  ['Ganti Kampas Rem Mobil', 'Jasa pasang, harga kampas terpisah.', 150000, 60],
];
const MOTOR_SKILLS = ['matic', 'injeksi', 'kelistrikan', 'cvt', 'tambal ban', 'karburator', 'motor sport'];
const CAR_SKILLS = ['ac mobil', 'kaki-kaki', 'mesin bensin', 'diesel', 'kelistrikan', 'spooring', 'rem'];
const FIRST = ['Andika', 'Bagus', 'Cahyo', 'Dimas', 'Eko', 'Ferry', 'Gilang', 'Hadi', 'Irfan', 'Jefri', 'Lukman', 'Miftah', 'Nanang', 'Okta', 'Purnomo', 'Rendi', 'Sugeng', 'Taufik', 'Wawan', 'Yoga', 'Zainal', 'Fikri', 'Ilham', 'Rio'];
const LAST = ['Saputra', 'Pratama', 'Wibowo', 'Susanto', 'Hakim', 'Ramadhan', 'Firmansyah', 'Nugroho', 'Setiadi', 'Kusnadi', 'Prabowo'];

/** Same pick every run (no randomness), so a re-run gives the same demo. */
const pick = <T>(list: T[], i: number, n: number) => Array.from({ length: Math.min(n, list.length) }, (_, k) => list[(i * 2 + k) % list.length]);
const priceFor = (base: number, i: number, k: number) => Math.round((base * (1 + (((i * 7 + k * 3) % 9) - 4) / 20)) / 5000) * 5000;
const phone = (prefix: string, n: number) => `${prefix}${String(n).padStart(8, '0')}`;

function demoPassword() {
  const given = process.env.DEMO_PASSWORD;
  if (given) {
    if (!(given.length >= 8 && /[a-z]/.test(given) && /[A-Z]/.test(given) && /\d/.test(given))) throw new Error('DEMO_PASSWORD needs 8+ characters with lower case, upper case and a digit.');
    return given;
  }
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const word = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
  return `Demo${word}${crypto.randomInt(1000, 10000)}`;
}

const ownerEmail = (i: number) => `mitra${String(i + 1).padStart(2, '0')}@bengkelgo.test`;

/** Who gets an account (known before anything is written, so the list can be saved first). */
const demoAccounts = () => [
  ...SHOPS.map((s, i) => ({ role: 'Pemilik bengkel', name: OWNERS[i], email: ownerEmail(i), workshop: s.name })),
  ...CUSTOMERS.map((c) => ({ role: 'Pelanggan', name: c.name, email: c.email, workshop: undefined as string | undefined })),
];

async function addDemoData(password: string) {
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  let mechanicNo = 0;
  try {
    await client.query('BEGIN');
    for (const [i, s] of SHOPS.entries()) {
      const email = ownerEmail(i);
      const owner = await authRepository.createUser(client, { name: OWNERS[i], email, phone: phone('0813', i + 1), passwordHash, role: 'WORKSHOP_OWNER', emailVerified: true });
      const w = await workshopRepository.create(client, {
        ownerId: owner.id,
        name: s.name,
        description: `${s.about} Data contoh untuk demo BengkelGo.`,
        address: s.address,
        phone: phone('0812', i + 1),
        latitude: s.lat,
        longitude: s.lng,
        vehicle_types: s.kind === 'BOTH' ? ['MOTOR', 'MOBIL'] : [s.kind],
        open_time: s.hours[0],
        close_time: s.hours[1],
        max_slot_per_hour: s.slots,
      });
      await client.query(
        `UPDATE workshops SET status = 'APPROVED', approved_at = NOW(), closed_weekdays = $2::smallint[],
           break_start = $3, break_end = $4 WHERE id = $1`,
        [w.id, s.closedSunday ? [0] : [], s.lunchBreak ? '12:00' : null, s.lunchBreak ? '13:00' : null],
      );

      const menus: ['MOTOR' | 'MOBIL', [string, string, number, number][]][] =
        s.kind === 'BOTH' ? [['MOTOR', MOTOR_SERVICES], ['MOBIL', CAR_SERVICES]] : [[s.kind, s.kind === 'MOTOR' ? MOTOR_SERVICES : CAR_SERVICES]];
      for (const [type, menu] of menus) {
        for (const [k, [name, description, base, minutes]] of pick(menu, i, s.kind === 'BOTH' ? 3 : 3 + (i % 3)).entries()) {
          await serviceRepository.create(client, w.id, { name, description, price: priceFor(base, i, k), duration_minutes: minutes, vehicle_type: type });
        }
      }

      const skills = s.kind === 'MOBIL' ? CAR_SKILLS : s.kind === 'MOTOR' ? MOTOR_SKILLS : [...MOTOR_SKILLS.slice(0, 3), ...CAR_SKILLS.slice(0, 3)];
      for (let m = 0; m < 2 + (i % 2); m++) {
        // Every first name with a different surname each round: unique for FIRST x LAST mechanics.
        const name = `${FIRST[mechanicNo % FIRST.length]} ${LAST[(mechanicNo + Math.floor(mechanicNo / FIRST.length)) % LAST.length]}`;
        mechanicNo++;
        await mechanicRepository.create(client, w.id, { name, specializations: pick(skills, i + m, 3) });
      }
    }

    for (const [i, c] of CUSTOMERS.entries()) {
      const u = await authRepository.createUser(client, {
        name: c.name,
        email: c.email,
        phone: phone('0814', i + 1),
        passwordHash,
        role: 'CUSTOMER',
        emailVerified: true,
        lat: -7.2575,
        lng: 112.7521,
      });
      await vehicleRepository.insert(client, u.id, c.vehicle);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}


function writeAccounts(file: string, admin: string, password: string, accounts: ReturnType<typeof demoAccounts>) {
  const rows = accounts.map((a) => `| ${a.role} | ${a.name} | ${a.email} | ${a.workshop ?? '-'} |`);
  const text = [
    '# Akun demo BengkelGo',
    '',
    `Dibuat ${new Date().toISOString()} di database \`${host}\`. File ini tidak masuk git; jangan dibagikan ke publik.`,
    '',
    `- **Password semua akun demo:** \`${password}\``,
    `- **Admin:** ${admin} (password tidak berubah)`,
    '- Masuk memakai **email** (tidak ada username). Email `@bengkelgo.test` tidak pernah dikirimi email sungguhan, jadi "Lupa password" tidak berlaku untuk akun ini.',
    '',
    '| Peran | Nama | Email | Bengkel |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  fs.writeFileSync(file, text, 'utf8');
}

async function main() {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  const confirm = arg('confirm');
  const admin = (arg('admin') ?? process.env.SEED_ADMIN_EMAIL ?? '').toLowerCase();
  if (!admin) throw new Error('Which admin should stay? Pass --admin=<email> or set SEED_ADMIN_EMAIL.');
  const { rows } = await pool.query(`SELECT 1 FROM users WHERE role = 'ADMIN' AND email = $1`, [admin]);
  if (!rows.length) throw new Error(`No admin account with email ${admin}: refusing to continue (nobody could sign in afterwards).`);

  const before = await counts();
  console.log(`Database: ${host} · storage: ${env.STORAGE_DRIVER}`);
  console.log(`Now: ${before.users} accounts (${before.admins} admin), ${before.workshops} workshops, ${before.orders} orders`);
  if (confirm !== host) {
    console.log(`\nNothing changed. To delete everything except the admin ${admin}, all uploaded files, and add ${SHOPS.length} demo workshops in Surabaya + ${CUSTOMERS.length} customers, run again with --confirm=${host}`);
    return;
  }

  // The password is random: save it before anything is deleted, so a failed write never leaves unknown passwords.
  const password = demoPassword();
  const file = path.resolve(arg('out') ?? 'demo-accounts.local.md');
  writeAccounts(file, admin, password, demoAccounts());
  await resetDatabase(admin);
  const files = await resetStorage();
  await addDemoData(password);
  const after = await counts();
  console.log(`Done: ${after.users} accounts (1 admin, ${SHOPS.length} owners, ${CUSTOMERS.length} customers), ${after.workshops} approved workshops, ${files} old uploaded files deleted.`);
  console.log(`Demo emails and the shared password: ${file}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
