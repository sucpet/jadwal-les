import { randomBytes } from 'crypto';

function id() {
  return randomBytes(4).toString('hex') + Date.now().toString(36);
}

const NOW = '2026-01-01T00:00:00.000Z';
const TODAY = new Date('2026-07-15');

function status(dateStr) {
  return new Date(dateStr) < TODAY ? 'completed' : 'scheduled';
}

// ─── TEACHERS ────────────────────────────────────────────────────────────────
const WENWEN_ID = id();
const teachers = [
  { id: WENWEN_ID, name: 'WenWen', color: '#6366f1', createdAt: NOW },
];

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
function student(name, billingType, rate, group) {
  return { id: id(), teacherId: WENWEN_ID, name, billingType, ratePerSession: rate, group, createdAt: NOW };
}

// Pribadi — postpaid per sesi
const ciDeasy    = student('Ci Deasy',     'per-session', 150000, 'pribadi');
const adel       = student('Adel',         'per-session', 135000, 'pribadi');
const aldrichD   = student('Aldrich D',    'per-session', 110000, 'pribadi');
const beryl      = student('Beryl',        'per-session', 140000, 'pribadi');
const dillon     = student('Dillon',       'per-session', 125000, 'pribadi');

// WenWen_AiZhongWen — prepaid paket
const koLucky    = student('Ko Lucky',     'package', 145000, 'wenwen_aizhongwen');
const nathan     = student('Nathan',       'package', 145000, 'wenwen_aizhongwen');
const ciKikis    = student('Ci Kikis',     'package', 150000, 'wenwen_aizhongwen');
const dionFiona  = student('Dion & Fiona', 'package', 150000, 'wenwen_aizhongwen');

// XuYuan — dari kalender, rate belum diketahui
const airyn      = student('Airyn',        'per-session', 0, 'xuyuan');
const aldrich    = student('Aldrich',      'per-session', 0, 'xuyuan');
const gevio      = student('Gevio',        'per-session', 0, 'xuyuan');
const shalyvnne  = student('Shalyvnne',   'per-session', 0, 'xuyuan');
const samuel     = student('Samuel',       'per-session', 0, 'xuyuan');
const raka       = student('Raka',         'per-session', 0, 'xuyuan');
const ravantino  = student('Ravantino',    'per-session', 0, 'xuyuan');
const grace      = student('Grace',        'per-session', 0, 'xuyuan');
const kiyan      = student('Kiyan',        'per-session', 0, 'xuyuan');
const gama       = student('Gama',         'per-session', 0, 'xuyuan');
const valerie    = student('Valerie',      'per-session', 0, 'xuyuan');
const juno       = student('Juno',         'per-session', 0, 'xuyuan');
const jasonJayden = student('Jason Jayden','per-session', 0, 'xuyuan');
const shailene   = student('Shailene',     'per-session', 0, 'xuyuan');
const alice      = student('Alice',        'per-session', 0, 'xuyuan');

const students = [
  ciDeasy, adel, aldrichD, beryl, dillon,
  koLucky, nathan, ciKikis, dionFiona,
  airyn, aldrich, gevio, shalyvnne, samuel, raka,
  ravantino, grace, kiyan, gama, valerie,
  juno, jasonJayden, shailene, alice,
];

// ─── PACKAGES ─────────────────────────────────────────────────────────────────
const packages = [
  {
    id: id(), studentId: koLucky.id, teacherId: WENWEN_ID,
    totalSessions: 8, pricingType: 'per-session', pricePerSession: 143750,
    startDate: '2026-06-01', notes: 'Initial booking Juni 2026', createdAt: NOW,
  },
  {
    id: id(), studentId: nathan.id, teacherId: WENWEN_ID,
    totalSessions: 8, pricingType: 'per-session', pricePerSession: 146250,
    startDate: '2026-06-01', notes: 'Initial booking Juni 2026', createdAt: NOW,
  },
  {
    id: id(), studentId: ciKikis.id, teacherId: WENWEN_ID,
    totalSessions: 7, pricingType: 'per-session', pricePerSession: 145000,
    startDate: '2026-06-01', notes: 'Initial booking Juni 2026', createdAt: NOW,
  },
  {
    id: id(), studentId: dionFiona.id, teacherId: WENWEN_ID,
    totalSessions: 5, pricingType: 'per-session', pricePerSession: 260000,
    startDate: '2026-06-01', notes: 'Initial booking 1 sesi + renewal 4 sesi Juni 2026', createdAt: NOW,
  },
];

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
function sess(studentId, date, start, end) {
  return {
    id: id(), studentId, teacherId: WENWEN_ID,
    date, startTime: start, endTime: end,
    status: status(date), createdAt: NOW,
  };
}

const sessions = [
  // ── CI DEASY (09:00-10:00) ──────────────────────────────────────────────────
  // Juni 2026: 1/6, 8/6, 12/6, 17/6, 19/6, 26/6, 29/6
  sess(ciDeasy.id, '2026-06-01', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-06-08', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-06-12', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-06-17', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-06-19', '09:00', '10:30'),
  sess(ciDeasy.id, '2026-06-26', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-06-29', '09:00', '10:00'),
  // Juli 2026: 3/7, 8/7, 10/7, 13/7, 15/7, 22/7, 31/7
  sess(ciDeasy.id, '2026-07-03', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-07-08', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-07-10', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-07-13', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-07-15', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-07-22', '09:00', '10:00'),
  sess(ciDeasy.id, '2026-07-31', '09:00', '10:00'),
  // Agustus: tidak ada jadwal

  // ── ADEL (Sabtu 15:30-17:00) ─────────────────────────────────────────────────
  // Juni 2026: 6/6, 13/6, 25/6, 30/6
  sess(adel.id, '2026-06-06', '15:30', '17:00'),
  sess(adel.id, '2026-06-13', '15:30', '17:00'),
  sess(adel.id, '2026-06-25', '11:00', '12:00'),
  sess(adel.id, '2026-06-30', '11:00', '12:00'),
  // Juli 2026: 2/7, 11/7, 16/7, 21/7, 23/7, 28/7
  sess(adel.id, '2026-07-02', '11:00', '12:00'),
  sess(adel.id, '2026-07-11', '11:00', '12:00'),
  sess(adel.id, '2026-07-16', '11:00', '12:00'),
  sess(adel.id, '2026-07-21', '11:00', '12:00'),
  sess(adel.id, '2026-07-23', '11:00', '12:00'),
  sess(adel.id, '2026-07-28', '11:00', '12:00'),
  // Agustus: 8/8
  sess(adel.id, '2026-08-08', '11:00', '12:00'),

  // ── ALDRICH D (10:00-11:00) ──────────────────────────────────────────────────
  // Juni 2026: 25/6, 30/6
  sess(aldrichD.id, '2026-06-25', '10:00', '11:00'),
  sess(aldrichD.id, '2026-06-30', '10:00', '11:00'),
  // Juli 2026: 2/7, 11/7, 16/7, 21/7, 23/7, 28/7
  sess(aldrichD.id, '2026-07-02', '10:00', '11:00'),
  sess(aldrichD.id, '2026-07-11', '10:00', '11:00'),
  sess(aldrichD.id, '2026-07-16', '10:00', '11:00'),
  sess(aldrichD.id, '2026-07-21', '10:00', '11:00'),
  sess(aldrichD.id, '2026-07-23', '10:00', '11:00'),
  sess(aldrichD.id, '2026-07-28', '10:00', '11:00'),

  // ── BERYL (14:00-15:00) ───────────────────────────────────────────────────────
  // Juni 2026: 6/6, 13/6, 19/6, 27/6
  sess(beryl.id, '2026-06-06', '14:00', '15:00'),
  sess(beryl.id, '2026-06-13', '13:00', '14:00'),
  sess(beryl.id, '2026-06-19', '13:00', '14:00'),
  sess(beryl.id, '2026-06-27', '14:00', '15:00'),
  // Juli 2026: 2/7, 18/7, 25/7
  sess(beryl.id, '2026-07-02', '13:00', '14:00'),
  sess(beryl.id, '2026-07-18', '14:00', '15:00'),
  sess(beryl.id, '2026-07-25', '14:00', '15:00'),
  // Agustus: 8/8
  sess(beryl.id, '2026-08-08', '14:00', '15:00'),

  // ── DILLON (14:00-15:00) ─────────────────────────────────────────────────────
  // Juni 2026: 5/6, 19/6
  sess(dillon.id, '2026-06-05', '14:00', '15:00'),
  sess(dillon.id, '2026-06-19', '14:00', '15:00'),
  // Juli 2026: 3/7, 17/7, 24/7
  sess(dillon.id, '2026-07-03', '14:00', '15:00'),
  sess(dillon.id, '2026-07-17', '14:00', '15:00'),
  sess(dillon.id, '2026-07-24', '14:00', '15:00'),
  // Agustus: 7/8, 14/8, 21/8, 28/8
  sess(dillon.id, '2026-08-07', '14:00', '15:00'),
  sess(dillon.id, '2026-08-14', '14:00', '15:00'),
  sess(dillon.id, '2026-08-21', '14:00', '15:00'),
  sess(dillon.id, '2026-08-28', '14:00', '15:00'),

  // ── KO LUCKY (19:30-21:00) ───────────────────────────────────────────────────
  // Juni 2026: 1/6, 8/6, 10/6, 24/6, 29/6 (5 dari 8 sesi paket)
  sess(koLucky.id, '2026-06-01', '19:30', '21:00'),
  sess(koLucky.id, '2026-06-08', '19:30', '21:00'),
  sess(koLucky.id, '2026-06-10', '18:00', '19:30'),
  sess(koLucky.id, '2026-06-24', '18:00', '19:30'),
  sess(koLucky.id, '2026-06-29', '19:30', '21:00'),
  // Juli 2026: 15/7, 20/7, 22/7, 27/7, 29/7 (renewal)
  sess(koLucky.id, '2026-07-15', '19:30', '21:00'),
  sess(koLucky.id, '2026-07-20', '19:30', '21:00'),
  sess(koLucky.id, '2026-07-22', '18:00', '19:30'),
  sess(koLucky.id, '2026-07-27', '19:30', '21:00'),
  sess(koLucky.id, '2026-07-29', '18:00', '19:30'),

  // ── NATHAN (18:30-20:00) ─────────────────────────────────────────────────────
  // Juni 2026: 8/6, 15/6, 22/6, 26/6 (4 dari 8 sesi paket)
  sess(nathan.id, '2026-06-08', '18:30', '20:00'),
  sess(nathan.id, '2026-06-15', '18:30', '20:00'),
  sess(nathan.id, '2026-06-22', '18:30', '20:00'),
  sess(nathan.id, '2026-06-26', '18:30', '20:00'),
  // Juli 2026: 10/7, 13/7, 17/7, 20/7, 24/7, 27/7, 31/7
  sess(nathan.id, '2026-07-10', '19:30', '20:30'),
  sess(nathan.id, '2026-07-13', '19:30', '20:30'),
  sess(nathan.id, '2026-07-17', '19:30', '20:30'),
  sess(nathan.id, '2026-07-20', '18:30', '20:00'),
  sess(nathan.id, '2026-07-24', '19:30', '20:30'),
  sess(nathan.id, '2026-07-27', '19:30', '20:30'),
  sess(nathan.id, '2026-07-31', '19:30', '20:30'),

  // ── CI KIKIS (17:00-18:00) ───────────────────────────────────────────────────
  // Juni 2026: 2/6, 11/6, 18/6, 23/6, 30/6 (5 dari 7 sesi paket)
  sess(ciKikis.id, '2026-06-02', '17:00', '18:00'),
  sess(ciKikis.id, '2026-06-11', '12:00', '13:00'),
  sess(ciKikis.id, '2026-06-18', '12:00', '13:00'),
  sess(ciKikis.id, '2026-06-23', '12:00', '13:00'),
  sess(ciKikis.id, '2026-06-30', '17:00', '18:00'),
  // Juli 2026: 9/7, 14/7, 21/7
  sess(ciKikis.id, '2026-07-09', '09:00', '10:00'),
  sess(ciKikis.id, '2026-07-14', '09:00', '10:00'),
  sess(ciKikis.id, '2026-07-21', '17:00', '18:00'),

  // ── DION & FIONA (20:30-21:30) ───────────────────────────────────────────────
  // Juni 2026: 5/6, 24/6 (2 sesi terpakai dari 5 tersedia)
  sess(dionFiona.id, '2026-06-05', '20:30', '21:30'),
  sess(dionFiona.id, '2026-06-24', '19:00', '20:00'),
  // Juli 2026: 1/7, 10/7, 17/7, 24/7, 31/7 (5 sesi, renewal)
  sess(dionFiona.id, '2026-07-01', '19:00', '20:00'),
  sess(dionFiona.id, '2026-07-10', '19:00', '20:00'),
  sess(dionFiona.id, '2026-07-17', '20:30', '21:30'),
  sess(dionFiona.id, '2026-07-24', '20:30', '21:30'),
  sess(dionFiona.id, '2026-07-31', '20:30', '21:30'),

  // ── AIRYN (13:00-14:00, Senin) ───────────────────────────────────────────────
  sess(airyn.id, '2026-06-01', '13:00', '14:00'),
  sess(airyn.id, '2026-06-15', '13:00', '14:00'),
  sess(airyn.id, '2026-06-29', '13:00', '14:00'),
  sess(airyn.id, '2026-07-13', '13:00', '14:00'),
  sess(airyn.id, '2026-07-27', '13:00', '14:00'),
  sess(airyn.id, '2026-08-03', '13:00', '14:00'),
  sess(airyn.id, '2026-08-10', '13:00', '14:00'),
  sess(airyn.id, '2026-08-17', '13:00', '14:00'),
  sess(airyn.id, '2026-08-24', '13:00', '14:00'),
  sess(airyn.id, '2026-08-31', '13:00', '14:00'),

  // ── ALDRICH (13:00-14:00, Rabu) ───────────────────────────────────────────────
  sess(aldrich.id, '2026-06-01', '13:00', '14:00'),
  sess(aldrich.id, '2026-06-15', '13:00', '14:00'),
  sess(aldrich.id, '2026-06-29', '13:00', '14:00'),
  sess(aldrich.id, '2026-07-01', '13:00', '14:00'),
  sess(aldrich.id, '2026-07-08', '13:00', '14:00'),
  sess(aldrich.id, '2026-07-15', '13:00', '14:00'),
  sess(aldrich.id, '2026-07-29', '13:00', '14:00'),
  sess(aldrich.id, '2026-08-05', '13:00', '14:00'),
  sess(aldrich.id, '2026-08-12', '13:00', '14:00'),
  sess(aldrich.id, '2026-08-19', '13:00', '14:00'),
  sess(aldrich.id, '2026-08-26', '13:00', '14:00'),

  // ── GEVIO (14:00-14:30, Senin & Rabu) ────────────────────────────────────────
  sess(gevio.id, '2026-06-01', '14:00', '14:30'),
  sess(gevio.id, '2026-06-03', '14:00', '14:30'),
  sess(gevio.id, '2026-06-08', '14:00', '14:30'),
  sess(gevio.id, '2026-06-15', '14:00', '14:30'),
  sess(gevio.id, '2026-06-17', '14:00', '14:30'),
  sess(gevio.id, '2026-06-29', '14:00', '14:30'),
  sess(gevio.id, '2026-07-07', '14:00', '14:30'),
  sess(gevio.id, '2026-07-13', '14:00', '14:30'),
  sess(gevio.id, '2026-07-15', '14:00', '14:30'),
  sess(gevio.id, '2026-07-27', '14:00', '14:30'),
  sess(gevio.id, '2026-07-29', '14:00', '14:30'),
  sess(gevio.id, '2026-08-03', '14:00', '14:30'),
  sess(gevio.id, '2026-08-10', '14:00', '14:30'),
  sess(gevio.id, '2026-08-17', '14:00', '14:30'),
  sess(gevio.id, '2026-08-24', '14:00', '14:30'),
  sess(gevio.id, '2026-08-31', '14:00', '14:30'),

  // ── SHALYVNNE (14:00-15:30, Selasa & Kamis) ──────────────────────────────────
  sess(shalyvnne.id, '2026-06-02', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-06-04', '14:30', '15:30'),
  sess(shalyvnne.id, '2026-06-09', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-06-16', '14:30', '15:30'),
  sess(shalyvnne.id, '2026-07-07', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-07-11', '10:00', '11:00'),
  sess(shalyvnne.id, '2026-07-15', '10:00', '11:00'),
  sess(shalyvnne.id, '2026-07-16', '16:30', '18:00'),
  sess(shalyvnne.id, '2026-07-27', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-07-29', '14:30', '15:30'),
  sess(shalyvnne.id, '2026-08-05', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-08-07', '14:30', '15:30'),
  sess(shalyvnne.id, '2026-08-12', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-08-14', '14:30', '15:30'),
  sess(shalyvnne.id, '2026-08-19', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-08-21', '14:30', '15:30'),
  sess(shalyvnne.id, '2026-08-26', '14:00', '15:30'),
  sess(shalyvnne.id, '2026-08-28', '14:30', '15:30'),

  // ── SAMUEL (14:30-15:30, Senin) ───────────────────────────────────────────────
  sess(samuel.id, '2026-06-08', '14:30', '15:30'),
  sess(samuel.id, '2026-06-15', '14:30', '15:30'),
  sess(samuel.id, '2026-07-13', '14:30', '15:30'),
  sess(samuel.id, '2026-07-27', '14:30', '15:30'),
  sess(samuel.id, '2026-08-03', '14:30', '15:30'),
  sess(samuel.id, '2026-08-10', '14:30', '15:30'),
  sess(samuel.id, '2026-08-17', '14:30', '15:30'),
  sess(samuel.id, '2026-08-24', '14:30', '15:30'),

  // ── RAKA (15:00-16:00, Selasa & Rabu) ────────────────────────────────────────
  sess(raka.id, '2026-06-02', '15:00', '16:00'),
  sess(raka.id, '2026-06-10', '15:30', '16:00'),
  sess(raka.id, '2026-06-17', '15:30', '16:00'),
  sess(raka.id, '2026-07-01', '15:30', '16:00'),
  sess(raka.id, '2026-07-08', '15:30', '16:00'),  // Assumed Rabu
  sess(raka.id, '2026-07-15', '15:30', '16:00'),
  sess(raka.id, '2026-07-29', '15:30', '16:00'),
  sess(raka.id, '2026-08-05', '15:00', '16:00'),
  sess(raka.id, '2026-08-12', '15:00', '16:00'),
  sess(raka.id, '2026-08-19', '15:00', '16:00'),
  sess(raka.id, '2026-08-26', '15:00', '16:00'),

  // ── RAVANTINO (15:30-16:00) ───────────────────────────────────────────────────
  sess(ravantino.id, '2026-06-01', '15:30', '16:00'),
  sess(ravantino.id, '2026-06-04', '15:30', '16:00'),
  sess(ravantino.id, '2026-06-11', '15:30', '16:00'),
  sess(ravantino.id, '2026-06-15', '15:30', '16:00'),
  sess(ravantino.id, '2026-06-29', '15:30', '16:00'),
  sess(ravantino.id, '2026-07-06', '15:30', '16:00'),
  sess(ravantino.id, '2026-07-11', '15:30', '16:00'),
  sess(ravantino.id, '2026-07-13', '15:30', '16:00'),
  sess(ravantino.id, '2026-07-27', '15:30', '16:00'),
  sess(ravantino.id, '2026-08-03', '15:30', '16:00'),
  sess(ravantino.id, '2026-08-10', '15:30', '16:00'),
  sess(ravantino.id, '2026-08-17', '15:30', '16:00'),
  sess(ravantino.id, '2026-08-24', '15:30', '16:00'),
  sess(ravantino.id, '2026-08-31', '15:30', '16:00'),

  // ── GRACE (15:30-16:30) ───────────────────────────────────────────────────────
  sess(grace.id, '2026-06-02', '15:30', '16:30'),
  sess(grace.id, '2026-06-29', '15:30', '16:30'),
  sess(grace.id, '2026-06-30', '16:00', '16:30'),

  // ── KIYAN (14:30-15:00 / 16:00-16:30) ───────────────────────────────────────
  sess(kiyan.id, '2026-06-03', '14:30', '15:00'),
  sess(kiyan.id, '2026-06-04', '16:00', '16:30'),
  sess(kiyan.id, '2026-06-08', '15:00', '16:00'), // Thu 11
  sess(kiyan.id, '2026-06-11', '15:00', '16:00'),
  sess(kiyan.id, '2026-06-22', '16:00', '16:30'),
  sess(kiyan.id, '2026-06-25', '14:30', '15:00'),
  sess(kiyan.id, '2026-07-09', '16:00', '16:30'),
  sess(kiyan.id, '2026-07-11', '14:30', '15:00'),
  sess(kiyan.id, '2026-07-13', '16:00', '16:30'),
  sess(kiyan.id, '2026-07-15', '16:00', '16:30'),
  sess(kiyan.id, '2026-07-27', '14:30', '15:00'),
  sess(kiyan.id, '2026-08-06', '16:00', '16:30'),
  sess(kiyan.id, '2026-08-13', '16:00', '16:30'),
  sess(kiyan.id, '2026-08-20', '16:00', '16:30'),
  sess(kiyan.id, '2026-08-27', '16:00', '16:30'),

  // ── GAMA (16:00-17:00) ────────────────────────────────────────────────────────
  sess(gama.id, '2026-06-03', '16:00', '17:00'),
  sess(gama.id, '2026-06-05', '16:30', '17:00'),
  sess(gama.id, '2026-06-10', '16:00', '17:00'),
  sess(gama.id, '2026-06-12', '16:30', '17:00'),
  sess(gama.id, '2026-06-17', '16:00', '17:00'),
  sess(gama.id, '2026-06-22', '16:30', '17:00'),
  sess(gama.id, '2026-06-24', '16:00', '17:00'),
  sess(gama.id, '2026-07-01', '16:30', '17:00'),
  sess(gama.id, '2026-07-03', '16:30', '17:00'),
  sess(gama.id, '2026-07-08', '16:00', '17:00'),
  sess(gama.id, '2026-07-10', '16:30', '17:00'),
  sess(gama.id, '2026-07-13', '16:00', '17:00'),
  sess(gama.id, '2026-07-15', '16:30', '17:00'),
  sess(gama.id, '2026-07-17', '16:30', '17:00'),
  sess(gama.id, '2026-07-22', '16:00', '17:00'),
  sess(gama.id, '2026-07-27', '16:30', '17:00'),
  sess(gama.id, '2026-07-29', '16:30', '17:00'),
  sess(gama.id, '2026-08-05', '16:00', '17:00'),
  sess(gama.id, '2026-08-07', '16:30', '17:00'),
  sess(gama.id, '2026-08-12', '16:00', '17:00'),
  sess(gama.id, '2026-08-14', '16:30', '17:00'),
  sess(gama.id, '2026-08-19', '16:00', '17:00'),
  sess(gama.id, '2026-08-21', '16:30', '17:00'),
  sess(gama.id, '2026-08-26', '16:00', '17:00'),
  sess(gama.id, '2026-08-28', '16:30', '17:00'),

  // ── VALERIE (16:30-17:00 / 18:00-18:30) ─────────────────────────────────────
  sess(valerie.id, '2026-06-03', '16:30', '17:00'),
  sess(valerie.id, '2026-06-08', '18:00', '18:30'),
  sess(valerie.id, '2026-06-10', '18:00', '18:30'),
  sess(valerie.id, '2026-06-12', '18:00', '18:30'),
  sess(valerie.id, '2026-06-17', '16:30', '17:00'),
  sess(valerie.id, '2026-06-22', '16:30', '17:00'),
  sess(valerie.id, '2026-06-24', '16:30', '17:00'),
  sess(valerie.id, '2026-07-01', '16:30', '17:00'),
  sess(valerie.id, '2026-07-08', '18:00', '18:30'),
  sess(valerie.id, '2026-07-10', '18:00', '18:30'),
  sess(valerie.id, '2026-07-15', '16:30', '17:00'),
  sess(valerie.id, '2026-07-17', '18:00', '18:30'),
  sess(valerie.id, '2026-07-22', '16:30', '17:00'),
  sess(valerie.id, '2026-07-27', '16:30', '17:00'),
  sess(valerie.id, '2026-07-29', '16:30', '17:00'),
  sess(valerie.id, '2026-08-07', '18:00', '18:30'),
  sess(valerie.id, '2026-08-14', '18:00', '18:30'),
  sess(valerie.id, '2026-08-21', '18:00', '18:30'),
  sess(valerie.id, '2026-08-28', '18:00', '18:30'),

  // ── JUNO (17:00-18:00) ────────────────────────────────────────────────────────
  sess(juno.id, '2026-06-05', '17:00', '18:00'),
  sess(juno.id, '2026-06-11', '17:30', '18:00'),
  sess(juno.id, '2026-06-12', '17:00', '18:00'),
  sess(juno.id, '2026-06-19', '17:00', '18:00'),
  sess(juno.id, '2026-06-26', '17:30', '18:00'),
  sess(juno.id, '2026-07-03', '17:00', '18:00'),
  sess(juno.id, '2026-07-04', '17:30', '18:00'),
  sess(juno.id, '2026-07-10', '17:00', '18:00'),
  sess(juno.id, '2026-07-11', '17:30', '18:00'),
  sess(juno.id, '2026-07-13', '17:00', '18:00'),
  sess(juno.id, '2026-07-15', '17:00', '18:00'),
  sess(juno.id, '2026-07-17', '17:00', '18:00'),
  sess(juno.id, '2026-07-24', '17:30', '18:00'),
  sess(juno.id, '2026-07-27', '17:00', '18:00'),
  sess(juno.id, '2026-07-29', '17:00', '18:00'),
  sess(juno.id, '2026-07-31', '17:00', '18:00'),
  sess(juno.id, '2026-08-07', '17:00', '18:00'),
  sess(juno.id, '2026-08-14', '17:00', '18:00'),
  sess(juno.id, '2026-08-21', '17:00', '18:00'),
  sess(juno.id, '2026-08-28', '17:00', '18:00'),

  // ── JASON JAYDEN (17:30-19:00) ────────────────────────────────────────────────
  sess(jasonJayden.id, '2026-06-06', '17:30', '18:30'),
  sess(jasonJayden.id, '2026-06-09', '18:30', '19:00'),
  sess(jasonJayden.id, '2026-06-23', '18:30', '19:00'),
  sess(jasonJayden.id, '2026-06-30', '18:30', '19:00'),
  sess(jasonJayden.id, '2026-07-06', '18:00', '18:30'),
  sess(jasonJayden.id, '2026-07-10', '18:30', '19:00'),
  sess(jasonJayden.id, '2026-07-27', '16:00', '16:30'),
  sess(jasonJayden.id, '2026-08-05', '18:30', '19:30'),
  sess(jasonJayden.id, '2026-08-07', '18:30', '19:00'),
  sess(jasonJayden.id, '2026-08-12', '18:30', '19:30'),
  sess(jasonJayden.id, '2026-08-14', '18:30', '19:00'),
  sess(jasonJayden.id, '2026-08-19', '18:30', '19:30'),
  sess(jasonJayden.id, '2026-08-21', '18:30', '19:00'),
  sess(jasonJayden.id, '2026-08-26', '18:30', '19:30'),
  sess(jasonJayden.id, '2026-08-28', '18:30', '19:00'),

  // ── SHAILENE (17:00-18:00) ────────────────────────────────────────────────────
  sess(shailene.id, '2026-06-08', '17:00', '18:00'),
  sess(shailene.id, '2026-07-13', '17:00', '18:00'),
  sess(shailene.id, '2026-07-27', '17:00', '18:00'),
  sess(shailene.id, '2026-08-03', '17:00', '18:00'),
  sess(shailene.id, '2026-08-10', '17:00', '18:00'),
  sess(shailene.id, '2026-08-17', '17:00', '18:00'),
  sess(shailene.id, '2026-08-24', '17:00', '18:00'),
  sess(shailene.id, '2026-08-31', '17:00', '18:00'),

  // ── ALICE (15:30-16:30) ───────────────────────────────────────────────────────
  sess(alice.id, '2026-07-27', '15:30', '16:30'),
];

const data = { teachers, students, packages, sessions };

import { writeFileSync } from 'fs';
writeFileSync('./scripts/import-data.json', JSON.stringify(data, null, 2));
console.log(`✓ Generated import data:`);
console.log(`  Teachers: ${teachers.length}`);
console.log(`  Students: ${students.length}`);
console.log(`  Packages: ${packages.length}`);
console.log(`  Sessions: ${sessions.length}`);
console.log('\nFile saved: scripts/import-data.json');
