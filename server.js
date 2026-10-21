const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Database file locations (uses /tmp on Vercel to allow write operations in serverless runtime)
const DB_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');
const SEED_FILE = path.join(__dirname, 'data', 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel Serverless Function URL normalizer
app.use((req, res, next) => {
  if (req.url === '/api/[...all]' || req.url === '/api/index.js' || req.url === '/api' || req.url === '/api/') {
    const raw = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.originalUrl;
    if (raw && !raw.includes('[...all]') && raw !== '/api/index.js') {
      req.url = raw;
    }
  }
  // Ensure requests routed to catch-all without /api prefix still match our /api routes
  const isStaticFile = req.url.startsWith('/css') || 
                       req.url.startsWith('/js') || 
                       req.url.startsWith('/images') || 
                       req.url === '/' || 
                       req.url.startsWith('/manifest.json') ||
                       req.url.startsWith('/sw.js') ||
                       req.url.endsWith('.html') ||
                       req.url.endsWith('.json') ||
                       req.url.endsWith('.js') ||
                       req.url.endsWith('.svg') ||
                       req.url.endsWith('.png') ||
                       req.url.endsWith('.jpg') ||
                       req.url.endsWith('.webp') ||
                       req.url.endsWith('.ico');

  if (!req.url.startsWith('/api') && !isStaticFile) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// PWA Static Endpoints
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Explicit page routes
app.get('/', (req, res) => {
  const p = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.send('Sistem Presensi Ekstrakurikuler MTs Al Fatah API Running');
});

app.get('/absen', (req, res) => {
  const p = path.join(__dirname, 'public', 'absen.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.redirect('/absen.html');
});

// Google Apps Script Web App Sync URL (Google Spreadsheet MTs Al Fatah)
const GS_WEBAPP_URL = process.env.GS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbycSuDYDMnZirE2TVKI2dDvhBeU3RhBwsFguGetW1DUZPfRRc5Nld-JI1zCcsKCTOcC2w/exec';

async function syncToGoogleSheets(action, payload) {
  if (!GS_WEBAPP_URL) return;
  try {
    fetch(GS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow'
    }).then(async r => {
      const text = await r.text();
      try {
        const data = JSON.parse(text);
        console.log('✅ Google Sheets sync status:', data.message || 'Synced');
      } catch (e) {
        console.log('Google Sheets sync response received.');
      }
    }).catch(err => console.warn('Google Sheets sync background error:', err.message));
  } catch (e) {
    console.warn('Failed to dispatch Google Sheets sync:', e.message);
  }
}

// Database helper functions with safe file operations
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      if (fs.existsSync(SEED_FILE)) {
        try {
          if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
          fs.copyFileSync(SEED_FILE, DB_FILE);
        } catch (e) {
          console.warn('Could not copy seed file to DB_FILE:', e.message);
        }
      } else {
        return { ekskuls: [], students: [], sessions: [], attendances: [] };
      }
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database:', err);
    return { ekskuls: [], students: [], sessions: [], attendances: [] };
  }
}

function writeDB(data) {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

// Helper to get local network IPv4 address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// SSE (Server-Sent Events) connection manager for live teacher screens
const sseSubscribers = new Map(); // sessionId -> Set of res objects

function broadcastToSession(sessionId, eventType, payload) {
  const clients = sseSubscribers.get(sessionId);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() });
  for (const res of clients) {
    res.write(`data: ${data}\n\n`);
  }
}

// Periodic check for dynamic QR code rotation & expiration cleanup
setInterval(() => {
  const db = readDB();
  let changed = false;
  const now = Date.now();

  for (const session of db.sessions) {
    if (session.status !== 'active') continue;

    // Check expiration
    if (new Date(session.expiresAt).getTime() <= now) {
      session.status = 'expired';
      changed = true;
      broadcastToSession(session.id, 'SESSION_EXPIRED', { sessionId: session.id });
      continue;
    }

    // Dynamic token rotation (every 30 seconds if enabled)
    if (session.dynamicRotation) {
      const lastRot = session.lastTokenRotatedAt ? new Date(session.lastTokenRotatedAt).getTime() : 0;
      if (now - lastRot >= 30000) {
        session.previousDynamicToken = session.currentDynamicToken;
        session.currentDynamicToken = crypto.randomBytes(4).toString('hex');
        session.lastTokenRotatedAt = new Date().toISOString();
        changed = true;

        broadcastToSession(session.id, 'TOKEN_ROTATED', {
          sessionId: session.id,
          currentToken: session.currentDynamicToken,
          expiresAt: session.expiresAt
        });
      }
    }
  }

  if (changed) {
    writeDB(db);
  }
}, 5000);

// API: System & Network info
app.get('/api/info', (req, res) => {
  const localIp = getLocalIp();
  const host = req.headers.host || `${localIp}:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  res.json({
    localIp,
    port: PORT,
    host,
    baseUrl: `${protocol}://${host}`,
    serverTime: new Date().toISOString()
  });
});

// API: Get extracurricular list
app.get('/api/ekskul', (req, res) => {
  const db = readDB();
  const result = db.ekskuls.map(e => {
    const memberCount = db.students.filter(s => s.ekskuls.includes(e.id)).length;
    // Check if there is an active session
    const activeSession = db.sessions.find(s => s.ekskulId === e.id && s.status === 'active');
    return {
      ...e,
      memberCount,
      activeSessionId: activeSession ? activeSession.id : null
    };
  });
  res.json(result);
});

// API: Get students (filter by ekskul)
app.get('/api/students', (req, res) => {
  const { ekskul } = req.query;
  const db = readDB();
  let students = db.students;
  if (ekskul === 'none') {
    students = students.filter(s => !s.ekskuls || s.ekskuls.length === 0);
  } else if (ekskul && ekskul !== 'all') {
    students = students.filter(s => Array.isArray(s.ekskuls) && s.ekskuls.includes(ekskul));
  }
  // Sort alphabetically by name
  students.sort((a, b) => a.name.localeCompare(b.name));
  res.json(students);
});

// API: Get Unique Classes from Student Data
app.get('/api/classes', (req, res) => {
  const db = readDB();
  const classes = [...new Set(db.students.map(s => s.class && s.class.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  res.json(classes);
});

// API: Add New Student / Member
app.post('/api/students', (req, res) => {
  const rawNisn = req.body.nisn || req.body.nis;
  const { name, gender = 'L', class: className, ekskuls = [] } = req.body;
  if (!rawNisn || !name || !className) {
    return res.status(400).json({ error: 'NISN, Nama Siswa, dan Kelas wajib diisi.' });
  }

  const nisn = String(rawNisn).trim(); // Selalu perlakukan NISN sebagai String (0 di depan tidak hilang)

  const db = readDB();
  const existing = db.students.find(s => (s.nisn && s.nisn === nisn) || (s.nis && s.nis === nisn));
  if (existing) {
    return res.status(409).json({ error: `Siswa dengan NISN "${nisn}" sudah terdaftar atas nama ${existing.name}.` });
  }

  const newStudent = {
    nisn,
    nis: nisn, // Alias untuk kompatibilitas
    name: name.trim(),
    gender: gender === 'P' ? 'P' : 'L',
    class: className.trim(),
    ekskuls: Array.isArray(ekskuls) ? ekskuls : []
  };

  db.students.push(newStudent);
  writeDB(db);

  syncToGoogleSheets('addStudent', { student: newStudent });

  res.json({
    success: true,
    message: `Siswa ${newStudent.name} (NISN: ${newStudent.nisn}) berhasil ditambahkan.`,
    student: newStudent
  });
});

// API: Edit Student / Member
app.put('/api/students/:nis', (req, res) => {
  const targetNis = String(req.params.nis).trim();
  const { name, gender, class: className, ekskuls, nisn: updatedNisn } = req.body;

  const db = readDB();
  const index = db.students.findIndex(s => (s.nisn && s.nisn === targetNis) || (s.nis && s.nis === targetNis));
  if (index === -1) {
    return res.status(404).json({ error: `Siswa dengan NISN "${targetNis}" tidak ditemukan.` });
  }

  if (updatedNisn) {
    const cleanNisn = String(updatedNisn).trim();
    db.students[index].nisn = cleanNisn;
    db.students[index].nis = cleanNisn;
  }
  if (name) db.students[index].name = name.trim();
  if (gender) db.students[index].gender = gender === 'P' ? 'P' : 'L';
  if (className) db.students[index].class = className.trim();
  if (Array.isArray(ekskuls)) db.students[index].ekskuls = ekskuls;

  writeDB(db);

  res.json({
    success: true,
    message: `Data siswa ${db.students[index].name} berhasil diperbarui.`,
    student: db.students[index]
  });
});

// API: Delete Student / Member
app.delete('/api/students/:nis', (req, res) => {
  const targetNis = String(req.params.nis).trim();
  const db = readDB();
  const student = db.students.find(s => (s.nisn && s.nisn === targetNis) || (s.nis && s.nis === targetNis));
  if (!student) {
    return res.status(404).json({ error: `Siswa dengan NISN "${targetNis}" tidak ditemukan.` });
  }

  db.students = db.students.filter(s => (s.nisn && s.nisn !== targetNis) && (s.nis && s.nis !== targetNis));
  writeDB(db);

  res.json({
    success: true,
    message: `Siswa ${student.name} berhasil dihapus dari sistem.`
  });
});

// API: Create New Extracurricular
app.post('/api/ekskul', (req, res) => {
  const { name, pembimbing, jadwal, lokasi, method = 'manual', icon = '⭐', color = '#059669' } = req.body;
  if (!name || !pembimbing) {
    return res.status(400).json({ error: 'Nama ekstrakurikuler dan nama pembimbing wajib diisi.' });
  }

  const db = readDB();
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) + '_' + Math.random().toString(36).substr(2, 4);

  const newEkskul = {
    id,
    name: name.trim(),
    pembimbing: pembimbing.trim(),
    jadwal: jadwal || 'Sesuai Jadwal Madrasah',
    lokasi: lokasi || 'Lingkungan MTs Al Fatah',
    method: method === 'qr' ? 'qr' : 'manual',
    icon: icon || (method === 'qr' ? '📱' : '✍️'),
    color: color || (method === 'qr' ? '#2563eb' : '#059669'),
    badge: method === 'qr' ? 'Presensi Mandiri via QR Code' : 'Presensi Manual oleh Guru'
  };

  db.ekskuls.push(newEkskul);
  writeDB(db);

  syncToGoogleSheets('addEkskul', { ekskul: newEkskul });

  res.json({
    success: true,
    message: `Ekstrakurikuler "${newEkskul.name}" berhasil ditambahkan!`,
    ekskul: newEkskul
  });
});

// API: Edit Extracurricular
app.put('/api/ekskul/:id', (req, res) => {
  const { id } = req.params;
  const { name, pembimbing, jadwal, lokasi, method, icon, color } = req.body;

  const db = readDB();
  const index = db.ekskuls.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Ekstrakurikuler tidak ditemukan.' });
  }

  if (name) db.ekskuls[index].name = name.trim();
  if (pembimbing) db.ekskuls[index].pembimbing = pembimbing.trim();
  if (jadwal) db.ekskuls[index].jadwal = jadwal.trim();
  if (lokasi) db.ekskuls[index].lokasi = lokasi.trim();
  if (method) {
    db.ekskuls[index].method = method === 'qr' ? 'qr' : 'manual';
    db.ekskuls[index].badge = method === 'qr' ? 'Presensi Mandiri via QR Code' : 'Presensi Manual oleh Guru';
  }
  if (icon) db.ekskuls[index].icon = icon;
  if (color) db.ekskuls[index].color = color;

  writeDB(db);

  syncToGoogleSheets('editEkskul', { ekskul: db.ekskuls[index] });

  res.json({
    success: true,
    message: `Ekstrakurikuler "${db.ekskuls[index].name}" berhasil diperbarui!`,
    ekskul: db.ekskuls[index]
  });
});

// API: Delete Extracurricular
app.delete('/api/ekskul/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.ekskuls.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Ekstrakurikuler tidak ditemukan.' });
  }

  const deletedEkskul = db.ekskuls[index];
  db.ekskuls.splice(index, 1);

  // Remove this ekskul ID from students enrolled
  db.students.forEach(s => {
    if (Array.isArray(s.ekskuls)) {
      s.ekskuls = s.ekskuls.filter(eid => eid !== id);
    }
  });

  writeDB(db);

  syncToGoogleSheets('deleteEkskul', { id, name: deletedEkskul.name });

  res.json({
    success: true,
    message: `Ekstrakurikuler "${deletedEkskul.name}" berhasil dihapus dari sistem!`
  });
});

// API: Save Manual Attendance (Hadir & Izin saja, siswa yang tidak diklik otomatis menjadi Alpa)
app.post('/api/attendance/manual', (req, res) => {
  const { ekskulId, date, records } = req.body;
  if (!ekskulId || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Parameter ekskulId, date, dan records wajib diisi.' });
  }

  const db = readDB();
  const ekskul = db.ekskuls.find(e => e.id === ekskulId);
  if (!ekskul) {
    return res.status(404).json({ error: 'Ekstrakurikuler tidak ditemukan.' });
  }

  // Remove existing records for this ekskul and date to allow updating
  db.attendances = db.attendances.filter(a => !(a.ekskulId === ekskulId && a.date === date));

  const newRecords = records.map(r => {
    const studentNis = String(r.nisn || r.nis || '').trim();
    const student = db.students.find(s => (s.nisn && s.nisn === studentNis) || (s.nis && s.nis === studentNis));
    // Aturan bisnis: Hanya ada 'Hadir' dan 'Izin'. Jika tidak diklik guru, otomatis 'Alpa'.
    let finalStatus = 'Alpa';
    if (r.status === 'Hadir') finalStatus = 'Hadir';
    else if (r.status === 'Izin') finalStatus = 'Izin';
    else if (r.status === 'Sakit') finalStatus = 'Izin'; // Sakit diintegrasikan ke Izin

    return {
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ekskulId,
      ekskulName: ekskul.name,
      date,
      nisn: studentNis,
      nis: studentNis, // Kompatibel
      studentName: student ? student.name : r.studentName || 'Siswa',
      class: student ? student.class : r.class || '-',
      gender: student ? student.gender : '-',
      status: finalStatus,
      method: 'manual_guru',
      timestamp: new Date().toISOString(),
      notes: r.notes || (finalStatus === 'Alpa' ? 'Tidak ada keterangan (Alpa otomatis)' : '')
    };
  });

  db.attendances.push(...newRecords);
  writeDB(db);

  syncToGoogleSheets('saveManualAttendance', {
    ekskulId,
    ekskulName: ekskul.name,
    date,
    records: newRecords
  });

  res.json({
    success: true,
    message: `Berhasil menyimpan presensi ${newRecords.length} siswa untuk ekskul ${ekskul.name}.`,
    totalSaved: newRecords.length,
    summary: {
      hadir: newRecords.filter(r => r.status === 'Hadir').length,
      izin: newRecords.filter(r => r.status === 'Izin').length,
      alpa: newRecords.filter(r => r.status === 'Alpa').length
    }
  });
});

// API: Start QR Session (for Voli & Bulutangkis)
app.post('/api/session/start', async (req, res) => {
  const { ekskulId, durationMinutes = 15, dynamicRotation = true } = req.body;
  const db = readDB();
  const ekskul = db.ekskuls.find(e => e.id === ekskulId);
  if (!ekskul) {
    return res.status(404).json({ error: 'Ekstrakurikuler tidak ditemukan.' });
  }

  // Close previous active sessions for this ekskul
  db.sessions.forEach(s => {
    if (s.ekskulId === ekskulId && s.status === 'active') {
      s.status = 'closed';
    }
  });

  const now = new Date();
  const durationMs = parseInt(durationMinutes, 10) * 60 * 1000;
  const expiresAt = new Date(now.getTime() + durationMs);
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const currentToken = crypto.randomBytes(4).toString('hex');

  const newSession = {
    id: sessionId,
    ekskulId,
    ekskulName: ekskul.name,
    date: now.toISOString().split('T')[0],
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    durationMinutes: parseInt(durationMinutes, 10),
    dynamicRotation: Boolean(dynamicRotation),
    currentDynamicToken: currentToken,
    previousDynamicToken: null,
    lastTokenRotatedAt: now.toISOString(),
    status: 'active'
  };

  db.sessions.push(newSession);
  writeDB(db);

  // Generate initial QR code
  const host = req.headers.host || `${getLocalIp()}:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const scanUrl = `${protocol}://${host}/absen.html?session=${sessionId}&token=${currentToken}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, {
    width: 380,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M'
  });

  res.json({
    success: true,
    session: newSession,
    scanUrl,
    qrDataUrl
  });
});

// API: Get Session Status & QR Code (Auto-generates fresh QR for current token)
app.get('/api/session/status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const db = readDB();
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Sesi absensi tidak ditemukan.' });
  }

  const now = Date.now();
  const expiresAtMs = new Date(session.expiresAt).getTime();
  const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

  if (remainingSeconds <= 0 && session.status === 'active') {
    session.status = 'expired';
    writeDB(db);
  }

  // Attendees for this session
  const attendees = db.attendances.filter(a => a.sessionId === sessionId || (a.ekskulId === session.ekskulId && a.date === session.date));
  const totalEnrolled = db.students.filter(s => s.ekskuls.includes(session.ekskulId)).length;

  // Generate QR code for current dynamic token
  const host = req.headers.host || `${getLocalIp()}:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const scanUrl = `${protocol}://${host}/absen.html?session=${session.id}&token=${session.currentDynamicToken}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, {
    width: 380,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M'
  });

  res.json({
    session,
    remainingSeconds,
    isExpired: remainingSeconds <= 0 || session.status !== 'active',
    totalEnrolled,
    totalAttended: attendees.length,
    attendees,
    scanUrl,
    qrDataUrl
  });
});

// API: Close Session
app.post('/api/session/close/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const db = readDB();
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Sesi absensi tidak ditemukan.' });
  }

  session.status = 'closed';
  writeDB(db);

  broadcastToSession(sessionId, 'SESSION_CLOSED', { sessionId });
  res.json({ success: true, message: 'Sesi absensi berhasil ditutup.' });
});

// API: SSE Live Stream for Teacher screen
app.get('/api/session/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseSubscribers.has(sessionId)) {
    sseSubscribers.set(sessionId, new Set());
  }
  sseSubscribers.get(sessionId).add(res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ event: 'CONNECTED', sessionId })}\n\n`);

  // Heartbeat ping every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseSubscribers.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseSubscribers.delete(sessionId);
      }
    }
  });
});

// API: Student Check-in via QR Scan
app.post('/api/attendance/scan', (req, res) => {
  const { sessionId, token, nis, deviceId } = req.body;
  if (!sessionId || !token || !nis) {
    return res.status(400).json({ error: 'Data absensi tidak lengkap (sessionId, token, atau NIS kosong).' });
  }

  const cleanDeviceId = String(deviceId || '').trim();
  if (!cleanDeviceId) {
    return res.status(400).json({
      error: 'ID Perangkat tidak terdeteksi. Silakan muat ulang (refresh) halaman presensi di browser HP Anda.'
    });
  }

  const db = readDB();
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Sesi absensi tidak valid atau tidak ditemukan.' });
  }

  if (session.status !== 'active') {
    return res.status(403).json({ error: 'Sesi absensi ini sudah ditutup atau telah kadaluarsa.' });
  }

  // Check expiration
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    session.status = 'expired';
    writeDB(db);
    return res.status(403).json({ error: 'Waktu absensi telah habis. Silakan lapor ke Guru Pembimbing.' });
  }

  // Token security check (Anti-share WhatsApp protection)
  // Accepts either current token OR previous token (within rotation grace period)
  const isTokenValid = (token === session.currentDynamicToken) ||
    (session.previousDynamicToken && token === session.previousDynamicToken);

  if (!isTokenValid) {
    return res.status(403).json({
      error: 'Token QR Code tidak valid atau sudah berganti (Anti-Cheating). Silakan scan ulang kode terbaru di layar Guru.'
    });
  }

  // Verify student exists and is enrolled in this extracurricular
  const targetNis = String(nis).trim();
  const student = db.students.find(s => (s.nisn && s.nisn === targetNis) || (s.nis && s.nis === targetNis));
  if (!student) {
    return res.status(404).json({ error: `Siswa dengan NISN "${targetNis}" tidak terdaftar dalam sistem.` });
  }

  if (!student.ekskuls.includes(session.ekskulId)) {
    return res.status(400).json({
      error: `Siswa ${student.name} (${student.class}) tidak terdaftar dalam ekstrakurikuler ${session.ekskulName}.`
    });
  }

  // Check duplicate attendance for today
  const studentKey = student.nisn || student.nis;
  const alreadyAttended = db.attendances.find(a =>
    a.ekskulId === session.ekskulId &&
    a.date === session.date &&
    ((a.nisn && a.nisn === studentKey) || (a.nis && a.nis === studentKey))
  );

  if (alreadyAttended) {
    const timeFormatted = new Date(alreadyAttended.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return res.status(409).json({
      error: `Siswa ${student.name} sudah melakukan absensi hari ini pada pukul ${timeFormatted} WIB.`,
      alreadyAttended
    });
  }

  // 1 HP = 1 Siswa Check (Anti-Titip Absen Device Lock)
  // Periksa apakah perangkat ini sudah pernah digunakan untuk presensi siswa lain pada tanggal hari ini
  const deviceUsed = db.attendances.find(a => {
    if (a.date !== session.date) return false;
    if (!a.deviceId || a.deviceId !== cleanDeviceId) return false;
    const isSameStudent = (a.nisn && a.nisn === studentKey) || (a.nis && a.nis === studentKey);
    return !isSameStudent;
  });

  if (deviceUsed) {
    return res.status(403).json({
      error: `⛔ Akses Ditolak (Anti-Titip Absen): HP ini sudah digunakan untuk presensi siswa lain (${deviceUsed.studentName} - ${deviceUsed.class}). 1 HP hanya boleh digunakan untuk 1 siswa!`
    });
  }

  // Create attendance record
  const record = {
    id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    sessionId: session.id,
    ekskulId: session.ekskulId,
    ekskulName: session.ekskulName,
    date: session.date,
    nisn: studentKey,
    nis: studentKey,
    studentName: student.name,
    class: student.class,
    gender: student.gender,
    status: 'Hadir',
    method: 'qr_scan',
    timestamp: new Date().toISOString(),
    ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    userAgent: req.headers['user-agent'] || '',
    deviceId: cleanDeviceId
  };

  db.attendances.push(record);
  writeDB(db);

  syncToGoogleSheets('saveScanAttendance', { record });

  // Broadcast to teacher's live screen instantly via SSE
  const currentAttendees = db.attendances.filter(a => a.sessionId === session.id || (a.ekskulId === session.ekskulId && a.date === session.date));
  const totalEnrolled = db.students.filter(s => s.ekskuls.includes(session.ekskulId)).length;

  broadcastToSession(session.id, 'NEW_ATTENDANCE', {
    attendance: record,
    totalAttended: currentAttendees.length,
    totalEnrolled
  });

  res.json({
    success: true,
    message: 'Kehadiran Anda berhasil diverifikasi!',
    record
  });
});

// API: Manual Add Single Student into Active Session by Teacher
app.post('/api/session/add-manual', (req, res) => {
  const { sessionId, nis, status = 'Hadir', notes = '' } = req.body;
  const db = readDB();
  const session = db.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  }

  const student = db.students.find(s => s.nis === nis);
  if (!student) {
    return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
  }

  // Remove existing if any
  db.attendances = db.attendances.filter(a => !(a.ekskulId === session.ekskulId && a.date === session.date && a.nis === nis));

  const record = {
    id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    sessionId: session.id,
    ekskulId: session.ekskulId,
    ekskulName: session.ekskulName,
    date: session.date,
    nis: student.nis,
    studentName: student.name,
    class: student.class,
    gender: student.gender,
    status,
    method: 'manual_guru',
    timestamp: new Date().toISOString(),
    notes: notes || 'Ditambahkan manual oleh Guru Pembimbing'
  };

  db.attendances.push(record);
  writeDB(db);

  const currentAttendees = db.attendances.filter(a => a.sessionId === session.id || (a.ekskulId === session.ekskulId && a.date === session.date));
  const totalEnrolled = db.students.filter(s => s.ekskuls.includes(session.ekskulId)).length;

  broadcastToSession(session.id, 'NEW_ATTENDANCE', {
    attendance: record,
    totalAttended: currentAttendees.length,
    totalEnrolled
  });

  res.json({ success: true, record });
});

// API: Attendance Recap & Analytics
app.get('/api/rekap', (req, res) => {
  const { ekskul, dateStart, dateEnd, search } = req.query;
  const db = readDB();
  let list = db.attendances;

  if (ekskul && ekskul !== 'all') {
    list = list.filter(a => a.ekskulId === ekskul);
  }

  if (dateStart) {
    list = list.filter(a => a.date >= dateStart);
  }
  if (dateEnd) {
    list = list.filter(a => a.date <= dateEnd);
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(a =>
      a.studentName.toLowerCase().includes(q) ||
      (a.nisn && a.nisn.toLowerCase().includes(q)) ||
      (a.nis && a.nis.toLowerCase().includes(q)) ||
      a.class.toLowerCase().includes(q)
    );
  }

  // Sort by date desc, then timestamp desc
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Statistics: Strictly Hadir, Izin, and Alpa
  const totalRecords = list.length;
  const hadirCount = list.filter(a => a.status === 'Hadir').length;
  const izinCount = list.filter(a => a.status === 'Izin').length;
  const alpaCount = list.filter(a => a.status === 'Alpa').length;
  const attendanceRate = totalRecords > 0 ? Math.round((hadirCount / totalRecords) * 100) : 0;

  res.json({
    totalRecords,
    summary: {
      hadir: hadirCount,
      izin: izinCount,
      alpa: alpaCount,
      attendanceRate
    },
    records: list
  });
});

// API: Sync pull data from Google Sheets into application database
app.post('/api/sync/pull', async (req, res) => {
  if (!GS_WEBAPP_URL) {
    return res.status(400).json({ error: 'GS_WEBAPP_URL belum dikonfigurasi.' });
  }
  try {
    const fetchRes = await fetch(`${GS_WEBAPP_URL}?action=getAll`);
    const json = await fetchRes.json();
    if (!json.success || !json.data) {
      throw new Error(json.error || 'Gagal mengambil data dari Google Sheets.');
    }
    const db = readDB();
    if (json.data.ekskuls && json.data.ekskuls.length > 0) {
      db.ekskuls = json.data.ekskuls.map(e => ({
        id: e.id_ekskul || e.id,
        name: e.nama_ekstrakurikuler || e.name,
        pembimbing: e.guru_pembimbing || e.pembimbing,
        jadwal: e.jadwal_rutin || e.jadwal,
        lokasi: e.lokasi_latihan || e.lokasi,
        method: e.metode__manual___qr_ || e.method || 'manual',
        icon: e.ikon_emoji || e.icon || '⭐',
        color: e.warna_tema || e.color || '#059669',
        badge: (e.metode__manual___qr_ || e.method) === 'qr' ? 'Presensi Mandiri via QR Code' : 'Presensi Manual oleh Guru'
      }));
    }
    if (json.data.students && json.data.students.length > 0) {
      db.students = json.data.students.map(s => {
        const nisnVal = String(s.nisn || s.nis || '').trim();
        const ekskulList = typeof s.ekskul_diikuti__pisahkan_koma_ === 'string'
          ? s.ekskul_diikuti__pisahkan_koma_.split(',').map(x => x.trim()).filter(Boolean)
          : (Array.isArray(s.ekskuls) ? s.ekskuls : []);
        return {
          nisn: nisnVal,
          nis: nisnVal,
          name: s.nama_lengkap_siswa || s.name,
          gender: s.jenis_kelamin__l_p_ || s.gender || 'L',
          class: s.kelas || s.class || '',
          ekskuls: ekskulList
        };
      });
    }
    writeDB(db);
    res.json({
      success: true,
      message: `Sinkronisasi berhasil! Memuat ${db.students.length} siswa dan ${db.ekskuls.length} ekskul dari Google Sheets.`,
      studentsCount: db.students.length,
      ekskulsCount: db.ekskuls.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server locally
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`=======================================================`);
    console.log(` SISTEM ABSENSI EKSTRAKURIKULER - MTS AL FATAH`);
    console.log(` Server berjalan di port ${PORT}`);
    console.log(` - Akses Lokal (Komputer Guru): http://localhost:${PORT}`);
    console.log(` - Akses Jaringan/WiFi (HP Siswa): http://${localIp}:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;

