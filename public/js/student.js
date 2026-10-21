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

  const studentSelect = document.getElementById('studentSelect');
  const studentNisInput = document.getElementById('studentNisInput');
  const studentIdentityPreview = document.getElementById('studentIdentityPreview');
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

    // Populate dropdown
    studentSelect.innerHTML = '<option value="">-- Pilih Nama Anda --</option>';
    enrolledStudents.forEach(s => {
      const studentNis = String(s.nisn || s.nis || '').trim();
      const opt = document.createElement('option');
      opt.value = studentNis;
      opt.textContent = `${s.name} (${s.class}) - ${studentNis}`;
      studentSelect.appendChild(opt);
    });

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

    // Check remember NISN from localStorage
    const savedNis = localStorage.getItem('mts_extra_nisn') || localStorage.getItem('mts_extra_nis');
    if (savedNis) {
      const match = enrolledStudents.find(s => (s.nisn && s.nisn === savedNis) || s.nis === savedNis);
      if (match) {
        const studentNis = String(match.nisn || match.nis || '').trim();
        studentSelect.value = studentNis;
        studentNisInput.value = studentNis;
        selectStudent(match);
      }
    }

    // Switch to Form state
    stateLoading.style.display = 'none';
    stateForm.style.display = 'block';

  } catch (err) {
    console.error('Error initializing student scan page:', err);
    showError('Koneksi Gagal', 'Gagal terhubung ke server MTs Al Fatah. Pastikan HP terhubung ke jaringan Wi-Fi madrasah.');
  }

  // Handle Student Selection
  function selectStudent(student) {
    selectedStudent = student;
    if (student) {
      const studentNis = String(student.nisn || student.nis || '').trim();
      studentIdentityPreview.style.display = 'block';
      previewName.textContent = student.name;
      previewClass.textContent = `NISN: ${studentNis} • Kelas: ${student.class} • ${student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}`;
      previewAvatar.textContent = student.name.charAt(0).toUpperCase();
      btnSubmitCheckin.disabled = false;
    } else {
      studentIdentityPreview.style.display = 'none';
      btnSubmitCheckin.disabled = true;
    }
  }

  studentSelect.addEventListener('change', (e) => {
    const nis = e.target.value;
    studentNisInput.value = nis;
    const found = enrolledStudents.find(s => (s.nisn && s.nisn === nis) || s.nis === nis);
    selectStudent(found || null);
  });

  studentNisInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    const found = enrolledStudents.find(s => 
      (s.nisn && s.nisn.toLowerCase() === query) || 
      (s.nis && s.nis.toLowerCase() === query)
    );
    if (found) {
      studentSelect.value = String(found.nisn || found.nis).trim();
      selectStudent(found);
    } else {
      studentSelect.value = '';
      selectStudent(null);
    }
  });

  // Submit Check-in
  studentCheckinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    btnSubmitCheckin.disabled = true;
    btnSubmitCheckin.textContent = 'Memverifikasi Kehadiran...';

    try {
      const response = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          token,
          nis: String(selectedStudent.nisn || selectedStudent.nis || '').trim(),
          nisn: String(selectedStudent.nisn || selectedStudent.nis || '').trim()
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
        alert(resData.error || 'Presensi gagal.');
        btnSubmitCheckin.disabled = false;
        btnSubmitCheckin.textContent = '✓ Konfirmasi Hadir Sekarang';
        return;
      }

      // Save NISN to localStorage for next time
      const studentNis = String(selectedStudent.nisn || selectedStudent.nis || '').trim();
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
