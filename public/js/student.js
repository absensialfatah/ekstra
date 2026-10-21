// Student Mobile Attendance Controller
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session');
  const token = urlParams.get('token');

  const stateLoading = document.getElementById('stateLoading');
  const stateError = document.getElementById('stateError');
  const stateForm = document.getElementById('stateForm');
  const stateSuccess = document.getElementById('stateSuccess');

  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');

  const formEkskulBadge = document.getElementById('formEkskulBadge');
  const formEkskulTitle = document.getElementById('formEkskulTitle');
  const formSessionDate = document.getElementById('formSessionDate');
  const formTimerPill = document.getElementById('formTimerPill');

  const studentNisInput = document.getElementById('studentNisInput');
  const studentIdentityPreview = document.getElementById('studentIdentityPreview');
  const studentNotFoundHint = document.getElementById('studentNotFoundHint');
  const previewAvatar = document.getElementById('previewAvatar');
  const previewName = document.getElementById('previewName');
  const previewClass = document.getElementById('previewClass');
  const btnSubmitCheckin = document.getElementById('btnSubmitCheckin');
  const studentCheckinForm = document.getElementById('studentCheckinForm');

  const receiptName = document.getElementById('receiptName');
  const receiptNisClass = document.getElementById('receiptNisClass');
  const receiptEkskul = document.getElementById('receiptEkskul');
  const receiptTime = document.getElementById('receiptTime');
  const btnDoneClose = document.getElementById('btnDoneClose');

  const studentDeviceLockedHint = document.getElementById('studentDeviceLockedHint');
  const deviceLockedMessage = document.getElementById('deviceLockedMessage');

  // --- Device Identifier Helper (Anti-Titip Absen: 1 HP = 1 Siswa) ---
  function getOrCreateDeviceId() {
    const STORAGE_KEY = 'mts_device_uuid';
    const COOKIE_KEY = 'mts_dev_id';
    let id = null;

    try {
      id = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}

    if (!id) {
      const match = document.cookie.match(new RegExp('(^|;\\s*)' + COOKIE_KEY + '=([^;]+)'));
      if (match && match[2]) {
        id = decodeURIComponent(match[2]);
      }
    }

    if (!id) {
      try {
        id = sessionStorage.getItem(STORAGE_KEY);
      } catch (e) {}
    }

    if (!id) {
      const rand = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      id = 'dev_' + Date.now().toString(36) + '_' + rand;
    }

    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_KEY, id); } catch (e) {}
    try {
      document.cookie = `${COOKIE_KEY}=${encodeURIComponent(id)}; max-age=315360000; path=/; SameSite=Lax`;
    } catch (e) {}

    return id;
  }

  // Pre-initialize device ID
  const currentDeviceId = getOrCreateDeviceId();

  // Check if this device is already bound to a student
  const boundNisn = (localStorage.getItem('mts_bound_nisn') || '').trim();
  const boundStudentName = (localStorage.getItem('mts_bound_student_name') || '').trim();

  let sessionData = null;
  let enrolledStudents = [];
  let selectedStudent = null;
  let timerInterval = null;

  function showError(title, msg) {
    stateLoading.style.display = 'none';
    stateForm.style.display = 'none';
    stateSuccess.style.display = 'none';
    stateError.style.display = 'block';
    errorTitle.textContent = title;
    errorMessage.textContent = msg;
  }

  if (!sessionId || !token) {
    showError('Parameter Presensi Tidak Lengkap', 'Tautan presensi tidak memiliki sesi atau token pengaman. Silakan scan ulang QR Code yang ditunjukkan oleh Guru Pembimbing.');
    return;
  }

  try {
    // 1. Fetch Session Status
    const res = await fetch(`/api/session/status/${sessionId}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      showError('Sesi Tidak Ditemukan', data.error || 'Sesi presensi ini tidak ditemukan atau telah dihapus.');
      return;
    }

    sessionData = data.session;

    if (data.isExpired || sessionData.status !== 'active') {
      showError('Sesi Telah Berakhir', 'Waktu presensi untuk sesi ini telah ditutup oleh Guru Pembimbing atau batas waktu telah habis.');
      return;
    }

    // 2. Fetch Enrolled Students for this Ekskul
    const studRes = await fetch(`/api/students?ekskul=${sessionData.ekskulId}`);
    enrolledStudents = await studRes.json();

    // Setup Header Info
    formEkskulBadge.textContent = `${sessionData.ekskulId === 'voli' ? '🏐' : '🏸'} ${sessionData.ekskulName}`;
    formEkskulTitle.textContent = `Presensi ${sessionData.ekskulName}`;
    formSessionDate.textContent = `Tanggal: ${new Date(sessionData.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

    // Start local countdown
    let remainingSec = data.remainingSeconds;
    function updateCountdown() {
      if (remainingSec <= 0) {
        clearInterval(timerInterval);
        formTimerPill.textContent = '⏱️ Waktu Sesi Habis!';
        formTimerPill.style.background = '#fee2e2';
        formTimerPill.style.color = '#dc2626';
        btnSubmitCheckin.disabled = true;
        return;
      }
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      formTimerPill.textContent = `⏱️ Sisa waktu sesi: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      remainingSec--;
    }
    updateCountdown();
    timerInterval = setInterval(updateCountdown, 1000);

    // Switch to Form state (Input NISN selalu kosong agar siswa terlatih menghapal & mengetik NISN sendiri)
    stateLoading.style.display = 'none';
    stateForm.style.display = 'block';

    if (studentNisInput) {
      studentNisInput.value = '';
      setTimeout(() => studentNisInput.focus(), 300);
    }

  } catch (err) {
    console.error('Error initializing student scan page:', err);
    showError('Koneksi Gagal', 'Gagal terhubung ke server MTs Al Fatah. Pastikan HP terhubung ke internet.');
  }

  // Handle Student Selection via Typed NISN
  function selectStudent(student) {
    selectedStudent = student;
    if (student) {
      const studentNis = String(student.nisn || student.nis || '').trim();
      studentIdentityPreview.style.display = 'block';
      if (studentNotFoundHint) studentNotFoundHint.style.display = 'none';
      if (studentDeviceLockedHint) studentDeviceLockedHint.style.display = 'none';
      previewName.textContent = student.name;
      previewClass.textContent = `NISN: ${studentNis} • Kelas: ${student.class} • ${student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}`;
      previewAvatar.textContent = student.name.charAt(0).toUpperCase();
      btnSubmitCheckin.disabled = false;
    } else {
      studentIdentityPreview.style.display = 'none';
      btnSubmitCheckin.disabled = true;
    }
  }

  // Real-time search by NISN as student types
  studentNisInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      selectStudent(null);
      if (studentNotFoundHint) studentNotFoundHint.style.display = 'none';
      if (studentDeviceLockedHint) studentDeviceLockedHint.style.display = 'none';
      return;
    }

    // Anti-Titip Absen: Proteksi 1 HP = 1 Siswa
    if (boundNisn && query !== boundNisn.toLowerCase()) {
      selectStudent(null);
      if (studentNotFoundHint) studentNotFoundHint.style.display = 'none';
      if (studentDeviceLockedHint) {
        studentDeviceLockedHint.style.display = 'block';
        if (deviceLockedMessage) {
          deviceLockedMessage.innerHTML = `Perangkat HP ini sudah terdaftar untuk presensi siswa: <strong>${boundStudentName || 'Siswa Lain'}</strong> (NISN: <code>${boundNisn}</code>).<br>1 HP hanya dapat digunakan untuk 1 siswa. Siswa lain yang tidak membawa HP dipersilakan melapor ke Guru Pembimbing untuk absensi manual.`;
        }
      }
      return;
    } else {
      if (studentDeviceLockedHint) studentDeviceLockedHint.style.display = 'none';
    }

    const found = enrolledStudents.find(s => 
      (s.nisn && s.nisn.toLowerCase() === query) || 
      (s.nis && s.nis.toLowerCase() === query)
    );

    if (found) {
      selectStudent(found);
      if (studentNotFoundHint) studentNotFoundHint.style.display = 'none';
    } else {
      selectStudent(null);
      // Tampilkan hint jika sudah mengetik 4 digit atau lebih tapi belum cocok
      if (query.length >= 4 && studentNotFoundHint) {
        studentNotFoundHint.style.display = 'block';
      } else if (studentNotFoundHint) {
        studentNotFoundHint.style.display = 'none';
      }
    }
  });

  // Submit Check-in
  studentCheckinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    btnSubmitCheckin.disabled = true;
    btnSubmitCheckin.textContent = 'Memverifikasi Kehadiran...';

    try {
      const activeDeviceId = getOrCreateDeviceId();
      const response = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          token,
          nis: String(selectedStudent.nisn || selectedStudent.nis || '').trim(),
          nisn: String(selectedStudent.nisn || selectedStudent.nis || '').trim(),
          deviceId: activeDeviceId
        })
      });

      const text = await response.text();
      let resData = {};
      try {
        resData = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server respon: ${text.slice(0, 100)}`);
      }

      if (!response.ok) {
        if (studentDeviceLockedHint && resData.error && resData.error.includes('Anti-Titip Absen')) {
          studentDeviceLockedHint.style.display = 'block';
          if (deviceLockedMessage) deviceLockedMessage.innerHTML = resData.error;
        }
        alert(resData.error || 'Presensi gagal.');
        btnSubmitCheckin.disabled = false;
        btnSubmitCheckin.textContent = '✓ Konfirmasi Hadir Sekarang';
        return;
      }

      // Save NISN & Student Name to permanently bind device (Anti-Titip Absen)
      const studentNis = String(selectedStudent.nisn || selectedStudent.nis || '').trim();
      localStorage.setItem('mts_device_uuid', activeDeviceId);
      localStorage.setItem('mts_bound_nisn', studentNis);
      localStorage.setItem('mts_bound_student_name', selectedStudent.name);
      localStorage.setItem('mts_extra_nisn', studentNis);
      localStorage.setItem('mts_extra_nis', studentNis);

      // Render digital receipt
      if (timerInterval) clearInterval(timerInterval);
      receiptName.textContent = selectedStudent.name;
      receiptNisClass.textContent = `${studentNis} (${selectedStudent.class})`;
      receiptEkskul.textContent = sessionData.ekskulName;
      receiptTime.textContent = new Date(resData.record.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      // Switch to success view
      stateForm.style.display = 'none';
      stateSuccess.style.display = 'block';

    } catch (err) {
      console.error('Checkin error:', err);
      alert('Terjadi kesalahan jaringan saat mengirim presensi.');
      btnSubmitCheckin.disabled = false;
      btnSubmitCheckin.textContent = '✓ Konfirmasi Hadir Sekarang';
    }
  });

  btnDoneClose.addEventListener('click', () => {
    window.location.href = '/';
  });
});

