// Main Teacher Dashboard Application Logic
document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    info: null,
    currentTab: 'tab-drumband',
    ekskuls: [],
    selectedManualEkskulId: 'drumband',
    selectedQrEkskulId: 'voli',
    manualStudents: [],
    manualAttendance: {}, // nis -> { status: 'Alpa' | 'Hadir' | 'Izin', notes: '' }
    activeSession: null,
    activeSessionTimer: null,
    sseSource: null,
    rekapData: [],
    selectedNewEmoji: '🥁'
  };

  // Cache DOM Elements
  const serverIpText = document.getElementById('serverIpText');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Manual Attendance Elements (Tab 1)
  const manualEkskulSelect = document.getElementById('manualEkskulSelect');
  const manualEkskulHeaderTitle = document.getElementById('manualEkskulHeaderTitle');
  const drumbandDate = document.getElementById('drumbandDate');
  const drumbandStudentsGrid = document.getElementById('drumbandStudentsGrid');
  const drumbandPembimbing = document.getElementById('drumbandPembimbing');
  const drumbandJadwal = document.getElementById('drumbandJadwal');
  const drumbandTotalCount = document.getElementById('drumbandTotalCount');
  const drumbandFilterCount = document.getElementById('drumbandFilterCount');
  const drumbandSearch = document.getElementById('drumbandSearch');
  const drumbandClassFilter = document.getElementById('drumbandClassFilter');
  const btnMarkAllPresent = document.getElementById('btnMarkAllPresent');
  const btnResetAllAlpa = document.getElementById('btnResetAllAlpa');
  const btnSaveDrumbandAttendance = document.getElementById('btnSaveDrumbandAttendance');
  const sumHadirCount = document.getElementById('sumHadirCount');
  const sumIzinCount = document.getElementById('sumIzinCount');
  const sumAlpaCount = document.getElementById('sumAlpaCount');

  // QR Elements (Tab 2)
  const qrEkskulSelectorGrid = document.getElementById('qrEkskulSelectorGrid');
  const qrDurationSelect = document.getElementById('qrDurationSelect');
  const dynamicRotationToggle = document.getElementById('dynamicRotationToggle');
  const btnStartQrSession = document.getElementById('btnStartQrSession');
  const sessionSetupBox = document.getElementById('sessionSetupBox');
  const sessionActiveArea = document.getElementById('sessionActiveArea');
  const activeEkskulBadge = document.getElementById('activeEkskulBadge');
  const qrTimerDisplay = document.getElementById('qrTimerDisplay');
  const qrCodeImg = document.getElementById('qrCodeImg');
  const btnFullscreenQr = document.getElementById('btnFullscreenQr');
  const btnCopyScanLink = document.getElementById('btnCopyScanLink');
  const btnCloseQrSession = document.getElementById('btnCloseQrSession');
  const liveAttendanceCounter = document.getElementById('liveAttendanceCounter');
  const liveAttendeesList = document.getElementById('liveAttendeesList');
  const btnOpenManualAddModal = document.getElementById('btnOpenManualAddModal');

  // Rekap Elements (Tab 3)
  const rekapEkskulSelect = document.getElementById('rekapEkskulSelect');
  const rekapDateStart = document.getElementById('rekapDateStart');
  const rekapDateEnd = document.getElementById('rekapDateEnd');
  const rekapSearchInput = document.getElementById('rekapSearchInput');
  const btnFilterRekap = document.getElementById('btnFilterRekap');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnPrintReport = document.getElementById('btnPrintReport');
  const kpiRate = document.getElementById('kpiRate');
  const kpiHadir = document.getElementById('kpiHadir');
  const kpiSakit = document.getElementById('kpiSakit');
  const kpiIzin = document.getElementById('kpiIzin');
  const kpiAlpa = document.getElementById('kpiAlpa');
  const rekapTableBody = document.getElementById('rekapTableBody');
  const printMetaText = document.getElementById('printMetaText');

  // Student Master Elements (Tab 4)
  const siswaMasterSearch = document.getElementById('siswaMasterSearch');
  const siswaMasterTableBody = document.getElementById('siswaMasterTableBody');
  const siswaMasterEkskulFilter = document.getElementById('siswaMasterEkskulFilter');
  const siswaMasterClassFilter = document.getElementById('siswaMasterClassFilter');
  const siswaMasterCount = document.getElementById('siswaMasterCount');
  const btnOpenAddStudentModal = document.getElementById('btnOpenAddStudentModal');
  const btnManageCurrentEkskulMembers = document.getElementById('btnManageCurrentEkskulMembers');

  // Student Add/Edit Modal Elements
  const studentModal = document.getElementById('studentModal');
  const btnCloseStudentModal = document.getElementById('btnCloseStudentModal');
  const btnCancelStudentModal = document.getElementById('btnCancelStudentModal');
  const formStudent = document.getElementById('formStudent');
  const studentModalTitle = document.getElementById('studentModalTitle');
  const studentFormMode = document.getElementById('studentFormMode');
  const studentInputNis = document.getElementById('studentInputNis');
  const studentInputClass = document.getElementById('studentInputClass');
  const studentInputName = document.getElementById('studentInputName');
  const studentEkskulsCheckboxes = document.getElementById('studentEkskulsCheckboxes');
  const btnSubmitStudent = document.getElementById('btnSubmitStudent');

  // Modals
  const addEkskulModal = document.getElementById('addEkskulModal');
  const btnOpenAddEkskulModal = document.getElementById('btnOpenAddEkskulModal');
  const btnCloseAddEkskulModal = document.getElementById('btnCloseAddEkskulModal');
  const btnCancelAddEkskul = document.getElementById('btnCancelAddEkskul');
  const formAddEkskul = document.getElementById('formAddEkskul');
  const newEkskulName = document.getElementById('newEkskulName');
  const newEkskulPembimbing = document.getElementById('newEkskulPembimbing');
  const newEkskulJadwal = document.getElementById('newEkskulJadwal');
  const newEkskulLokasi = document.getElementById('newEkskulLokasi');
  const emojiChoiceBtns = document.querySelectorAll('.emoji-choice');

  const manualAddModal = document.getElementById('manualAddModal');
  const btnCloseManualModal = document.getElementById('btnCloseManualModal');
  const btnCancelManualAdd = document.getElementById('btnCancelManualAdd');
  const btnSubmitManualAdd = document.getElementById('btnSubmitManualAdd');
  const manualStudentSelect = document.getElementById('manualStudentSelect');
  const manualNotesInput = document.getElementById('manualNotesInput');

  const fullscreenQrModal = document.getElementById('fullscreenQrModal');
  const btnCloseFsModal = document.getElementById('btnCloseFsModal');
  const fsQrCodeImg = document.getElementById('fsQrCodeImg');
  const fsTimerDisplay = document.getElementById('fsTimerDisplay');
  const fsModalEkskulTitle = document.getElementById('fsModalEkskulTitle');

  const toastContainer = document.getElementById('toastContainer');

  // Audio Chime
  function playSuccessChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span style="font-size: 1.1rem; font-weight: 800;">${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Default dates
  const today = new Date().toISOString().split('T')[0];
  drumbandDate.value = today;
  rekapDateEnd.value = today;
  const pastWeek = new Date();
  pastWeek.setDate(pastWeek.getDate() - 14);
  rekapDateStart.value = pastWeek.toISOString().split('T')[0];

  // 1. Fetch System Info
  async function loadSystemInfo() {
    try {
      const res = await fetch('/api/info');
      state.info = await res.json();
      serverIpText.textContent = `Akses Wi-Fi Siswa: ${state.info.baseUrl}`;
    } catch (err) {
      serverIpText.textContent = 'Server: Offline / Standalone';
    }
  }

  // 2. Fetch and Render All Extracurriculars
  async function loadEkskuls() {
    try {
      const res = await fetch('/api/ekskul');
      state.ekskuls = await res.json();

      // A. Populate Manual Ekskul Select (Tab 1)
      const manualEkskuls = state.ekskuls.filter(e => e.method === 'manual');
      manualEkskulSelect.innerHTML = '';
      manualEkskuls.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = `${e.icon || '🥁'} ${e.name}`;
        manualEkskulSelect.appendChild(opt);
      });

      if (!manualEkskuls.some(e => e.id === state.selectedManualEkskulId) && manualEkskuls.length > 0) {
        state.selectedManualEkskulId = manualEkskuls[0].id;
      }
      manualEkskulSelect.value = state.selectedManualEkskulId;

      // B. Populate QR Ekskul Selector Grid (Tab 2)
      const qrEkskuls = state.ekskuls.filter(e => e.method === 'qr');
      qrEkskulSelectorGrid.innerHTML = '';
      if (!qrEkskuls.some(e => e.id === state.selectedQrEkskulId) && qrEkskuls.length > 0) {
        state.selectedQrEkskulId = qrEkskuls[0].id;
      }

      qrEkskuls.forEach(e => {
        const card = document.createElement('div');
        card.className = `ekskul-card ${e.id === state.selectedQrEkskulId ? 'selected' : ''}`;
        card.setAttribute('data-ekskul', e.id);
        card.innerHTML = `
          <div class="ekskul-card-header">
            <div class="ekskul-icon-wrap" style="color: ${e.color || '#2563eb'};">${e.icon || '📱'}</div>
            <span class="ekskul-method-badge badge-qr">QR Code</span>
          </div>
          <h3 class="ekskul-card-name">${e.name}</h3>
          <div class="ekskul-card-info">
            <span>👤 ${e.pembimbing}</span>
            <span>🕒 ${e.jadwal}</span>
            <span>📍 ${e.lokasi}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          if (state.activeSession) return alert('Sesi absensi sedang berlangsung! Tutup sesi terlebih dahulu sebelum berganti ekskul.');
          document.querySelectorAll('#qrEkskulSelectorGrid .ekskul-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          state.selectedQrEkskulId = e.id;
        });

        qrEkskulSelectorGrid.appendChild(card);
      });

      // C. Populate Rekapitulasi Filter Select
      rekapEkskulSelect.innerHTML = '<option value="all">Semua Ekstrakurikuler</option>';
      state.ekskuls.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = `${e.icon || '⭐'} ${e.name}`;
        rekapEkskulSelect.appendChild(opt);
      });

      // D. Populate Siswa Master Filter Select
      const prevSelectedSiswaEkskul = siswaMasterEkskulFilter ? siswaMasterEkskulFilter.value : 'all';
      if (siswaMasterEkskulFilter) {
        siswaMasterEkskulFilter.innerHTML = '<option value="all">Semua Ekstrakurikuler</option>';
        state.ekskuls.forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id;
          opt.textContent = `${e.icon || '⭐'} ${e.name}`;
          siswaMasterEkskulFilter.appendChild(opt);
        });
        siswaMasterEkskulFilter.value = prevSelectedSiswaEkskul || 'all';
      }

      // Refresh current manual ekskul display
      updateManualEkskulInfo();
      loadManualStudents();
    } catch (err) {
      console.error('Error loading ekskuls:', err);
      showToast('Gagal memuat daftar ekstrakurikuler', 'error');
    }
  }

  function updateManualEkskulInfo() {
    const cur = state.ekskuls.find(e => e.id === state.selectedManualEkskulId);
    if (!cur) return;
    manualEkskulHeaderTitle.innerHTML = `<span>${cur.icon || '🥁'}</span> ${cur.name}`;
    drumbandPembimbing.textContent = cur.pembimbing;
    drumbandJadwal.textContent = cur.jadwal;
    btnSaveDrumbandAttendance.innerHTML = `💾 Simpan Presensi ${cur.name.split(' ')[0]}`;
  }

  manualEkskulSelect.addEventListener('change', (e) => {
    state.selectedManualEkskulId = e.target.value;
    updateManualEkskulInfo();
    loadManualStudents();
  });

  // Tab Navigation Handling
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(targetTab);
      if (panel) panel.classList.add('active');
      state.currentTab = targetTab;

      if (targetTab === 'tab-rekap') loadRekapData();
      if (targetTab === 'tab-siswa') loadSiswaMaster();
    });
  });


  // ==========================================
  // TAB 1: PRESENSI MANUAL GURU
  // LOGIKA: HANYA ADA HADIR & IZIN.
  // JIKA TIDAK DIKLIK, OTOMATIS ALPA.
  // ==========================================
  async function loadManualStudents() {
    try {
      const ekskulId = state.selectedManualEkskulId;
      const res = await fetch(`/api/students?ekskul=${ekskulId}`);
      state.manualStudents = await res.json();
      drumbandTotalCount.textContent = `${state.manualStudents.length} Siswa`;

      // Check existing attendance for this date
      const dateVal = drumbandDate.value;
      const rekapRes = await fetch(`/api/rekap?ekskul=${ekskulId}&dateStart=${dateVal}&dateEnd=${dateVal}`);
      const rekapJson = await rekapRes.json();

      // Inisialisasi: Default ALPA jika belum ada data sebelumnya
      state.manualAttendance = {};
      state.manualStudents.forEach(s => {
        const existing = rekapJson.records.find(r => r.nis === s.nis);
        state.manualAttendance[s.nis] = {
          status: existing ? existing.status : 'Alpa', // Default Alpa jika belum diklik guru
          notes: existing ? existing.notes || '' : ''
        };
      });

      renderManualGrid();
      updateManualSummary();
    } catch (err) {
      console.error('Error loading manual students:', err);
      showToast('Gagal memuat data siswa', 'error');
    }
  }

  drumbandDate.addEventListener('change', loadManualStudents);

  function renderManualGrid() {
    const query = drumbandSearch.value.trim().toLowerCase();
    const classFilter = drumbandClassFilter.value;

    const filtered = state.manualStudents.filter(s => {
      const matchQuery = s.name.toLowerCase().includes(query) || s.nis.includes(query);
      const matchClass = classFilter === 'all' || s.class.startsWith(classFilter);
      return matchQuery && matchClass;
    });

    drumbandFilterCount.textContent = `Menampilkan ${filtered.length} dari ${state.manualStudents.length} siswa`;
    drumbandStudentsGrid.innerHTML = '';

    if (filtered.length === 0) {
      drumbandStudentsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--text-muted); background: #ffffff; border-radius: 12px; border: 1px dashed var(--border);">
          Belum ada siswa yang terdaftar di ekstrakurikuler ini atau tidak cocok dengan filter pencarian.
        </div>
      `;
      return;
    }

    filtered.forEach(student => {
      const currentAtt = state.manualAttendance[student.nis] || { status: 'Alpa', notes: '' };
      const card = document.createElement('div');
      card.className = `student-card status-${currentAtt.status.toLowerCase()}`;
      card.id = `card-manual-${student.nis}`;

      const avatarLetter = student.name.charAt(0).toUpperCase();

      // Badge status teks
      let statusBadgeHtml = '<span class="badge" style="background: #fee2e2; color: #dc2626; font-weight: 700;">🔴 Alpa (Otomatis)</span>';
      if (currentAtt.status === 'Hadir') {
        statusBadgeHtml = '<span class="badge" style="background: #ecfdf5; color: #059669; font-weight: 700;">🟢 Hadir</span>';
      } else if (currentAtt.status === 'Izin') {
        statusBadgeHtml = '<span class="badge" style="background: #eff6ff; color: #2563eb; font-weight: 700;">🔵 Izin</span>';
      }

      card.innerHTML = `
        <div class="student-info">
          <div class="student-avatar">${avatarLetter}</div>
          <div class="student-details" style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
              <h4>${student.name}</h4>
              <div class="status-indicator-badge">${statusBadgeHtml}</div>
            </div>
            <div class="student-meta">
              <span class="badge">NIS: ${student.nis}</span>
              <span class="badge">Kelas ${student.class}</span>
              <span class="badge">${student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
            </div>
          </div>
        </div>

        <!-- HANYA DUA TOMBOL: HADIR DAN IZIN (KLIK ULANG = KEMBALI KE ALPA) -->
        <div class="status-btn-group">
          <button type="button" class="status-btn btn-hadir ${currentAtt.status === 'Hadir' ? 'active' : ''}" data-nis="${student.nis}">
            ✓ Hadir
          </button>
          <button type="button" class="status-btn btn-izin ${currentAtt.status === 'Izin' ? 'active' : ''}" data-nis="${student.nis}">
            ℹ Izin
          </button>
        </div>

        <div>
          <input type="text" class="note-input" data-nis="${student.nis}" placeholder="Catatan izin/keterangan (opsional)..." value="${currentAtt.notes}">
        </div>
      `;

      // Button Hadir Click Handler
      const btnHadir = card.querySelector('.btn-hadir');
      btnHadir.addEventListener('click', () => {
        // Jika sudah hadir, klik ulang membatalkan menjadi Alpa
        if (state.manualAttendance[student.nis].status === 'Hadir') {
          state.manualAttendance[student.nis].status = 'Alpa';
        } else {
          state.manualAttendance[student.nis].status = 'Hadir';
        }
        updateCardVisual(card, student.nis);
        updateManualSummary();
      });

      // Button Izin Click Handler
      const btnIzin = card.querySelector('.btn-izin');
      btnIzin.addEventListener('click', () => {
        // Jika sudah izin, klik ulang membatalkan menjadi Alpa
        if (state.manualAttendance[student.nis].status === 'Izin') {
          state.manualAttendance[student.nis].status = 'Alpa';
        } else {
          state.manualAttendance[student.nis].status = 'Izin';
        }
        updateCardVisual(card, student.nis);
        updateManualSummary();
      });

      // Note input event
      const noteInput = card.querySelector('.note-input');
      noteInput.addEventListener('input', (e) => {
        state.manualAttendance[student.nis].notes = e.target.value;
      });

      drumbandStudentsGrid.appendChild(card);
    });
  }

  function updateCardVisual(card, nis) {
    const att = state.manualAttendance[nis];
    card.className = `student-card status-${att.status.toLowerCase()}`;

    const btnHadir = card.querySelector('.btn-hadir');
    const btnIzin = card.querySelector('.btn-izin');
    const badgeWrap = card.querySelector('.status-indicator-badge');

    btnHadir.classList.toggle('active', att.status === 'Hadir');
    btnIzin.classList.toggle('active', att.status === 'Izin');

    if (att.status === 'Hadir') {
      badgeWrap.innerHTML = '<span class="badge" style="background: #ecfdf5; color: #059669; font-weight: 700;">🟢 Hadir</span>';
    } else if (att.status === 'Izin') {
      badgeWrap.innerHTML = '<span class="badge" style="background: #eff6ff; color: #2563eb; font-weight: 700;">🔵 Izin</span>';
    } else {
      badgeWrap.innerHTML = '<span class="badge" style="background: #fee2e2; color: #dc2626; font-weight: 700;">🔴 Alpa (Otomatis)</span>';
    }
  }

  function updateManualSummary() {
    let hadir = 0, izin = 0, alpa = 0;
    Object.values(state.manualAttendance).forEach(item => {
      if (item.status === 'Hadir') hadir++;
      else if (item.status === 'Izin') izin++;
      else alpa++;
    });

    sumHadirCount.textContent = hadir;
    sumIzinCount.textContent = izin;
    sumAlpaCount.textContent = alpa;
  }

  drumbandSearch.addEventListener('input', renderManualGrid);
  drumbandClassFilter.addEventListener('change', renderManualGrid);

  // Tandai Semua Hadir
  btnMarkAllPresent.addEventListener('click', () => {
    state.manualStudents.forEach(s => {
      if (!state.manualAttendance[s.nis]) state.manualAttendance[s.nis] = { status: 'Hadir', notes: '' };
      state.manualAttendance[s.nis].status = 'Hadir';
    });
    renderManualGrid();
    updateManualSummary();
    showToast('Semua siswa ditandai Hadir.', 'info');
  });

  // Reset Semua ke Alpa
  btnResetAllAlpa.addEventListener('click', () => {
    state.manualStudents.forEach(s => {
      if (!state.manualAttendance[s.nis]) state.manualAttendance[s.nis] = { status: 'Alpa', notes: '' };
      state.manualAttendance[s.nis].status = 'Alpa';
    });
    renderManualGrid();
    updateManualSummary();
    showToast('Status semua siswa di-reset ke Alpa.', 'info');
  });

  // Simpan Presensi Manual
  btnSaveDrumbandAttendance.addEventListener('click', async () => {
    const dateVal = drumbandDate.value;
    if (!dateVal) return showToast('Pilih tanggal kegiatan terlebih dahulu!', 'error');

    const records = state.manualStudents.map(s => {
      const att = state.manualAttendance[s.nis] || { status: 'Alpa', notes: '' };
      return {
        nis: s.nis,
        studentName: s.name,
        class: s.class,
        status: att.status, // Hadir, Izin, atau Alpa otomatis
        notes: att.notes
      };
    });

    btnSaveDrumbandAttendance.disabled = true;
    btnSaveDrumbandAttendance.textContent = 'Menyimpan...';

    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ekskulId: state.selectedManualEkskulId,
          date: dateVal,
          records
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');

      showToast(`Presensi berhasil disimpan! (${data.summary.hadir} Hadir, ${data.summary.izin} Izin, ${data.summary.alpa} Alpa)`, 'success');
      playSuccessChime();
    } catch (err) {
      console.error('Error saving manual attendance:', err);
      showToast(err.message, 'error');
    } finally {
      btnSaveDrumbandAttendance.disabled = false;
      const cur = state.ekskuls.find(e => e.id === state.selectedManualEkskulId);
      btnSaveDrumbandAttendance.textContent = `💾 Simpan Presensi ${cur ? cur.name.split(' ')[0] : 'Ekskul'}`;
    }
  });


  // ========================================================
  // TAB 2: PRESENSI MANDIRI SISWA (QR CODE)
  // ========================================================
  btnStartQrSession.addEventListener('click', async () => {
    const ekskulId = state.selectedQrEkskulId;
    const durationMinutes = qrDurationSelect.value;
    const dynamicRotation = dynamicRotationToggle.checked;

    btnStartQrSession.disabled = true;
    btnStartQrSession.textContent = 'Membuka Sesi...';

    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ekskulId,
          durationMinutes,
          dynamicRotation
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulai sesi.');

      state.activeSession = data.session;
      showActiveSessionUI(data.session, data.qrDataUrl, data.scanUrl);
      connectSSE(data.session.id);
      showToast(`Sesi Absensi ${data.session.ekskulName} dibuka!`, 'success');
    } catch (err) {
      console.error('Start session error:', err);
      showToast(err.message, 'error');
    } finally {
      btnStartQrSession.disabled = false;
      btnStartQrSession.textContent = '🚀 Buat QR Code & Buka Absensi';
    }
  });

  function showActiveSessionUI(session, qrDataUrl, scanUrl) {
    sessionSetupBox.style.display = 'none';
    sessionActiveArea.style.display = 'block';

    activeEkskulBadge.textContent = session.ekskulName.toUpperCase();
    qrCodeImg.src = qrDataUrl;
    fsQrCodeImg.src = qrDataUrl;
    fsModalEkskulTitle.textContent = `Presensi ${session.ekskulName}`;

    liveAttendeesList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem; font-size: 0.9rem;">
        ⏳ Menunggu siswa melakukan scan QR Code...
      </div>
    `;

    let remainingSec = session.durationMinutes * 60;
    if (state.activeSessionTimer) clearInterval(state.activeSessionTimer);

    function updateTimer() {
      if (remainingSec <= 0) {
        clearInterval(state.activeSessionTimer);
        qrTimerDisplay.textContent = '⏱️ Sesi Telah Berakhir!';
        fsTimerDisplay.textContent = '⏱️ Sesi Telah Berakhir!';
        qrTimerDisplay.style.background = '#fee2e2';
        qrTimerDisplay.style.color = '#dc2626';
        showToast('Batas waktu sesi absensi telah habis!', 'error');
        return;
      }
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const timeStr = `⏱️ Sisa Waktu: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      qrTimerDisplay.textContent = timeStr;
      fsTimerDisplay.textContent = timeStr;
      remainingSec--;
    }
    updateTimer();
    state.activeSessionTimer = setInterval(updateTimer, 1000);

    refreshSessionStatus(session.id);
  }

  async function refreshSessionStatus(sessionId) {
    try {
      const res = await fetch(`/api/session/status/${sessionId}`);
      const data = await res.json();
      if (!res.ok) return;

      qrCodeImg.src = data.qrDataUrl;
      fsQrCodeImg.src = data.qrDataUrl;
      liveAttendanceCounter.textContent = `${data.totalAttended} / ${data.totalEnrolled}`;
      renderAttendeesList(data.attendees || []);
    } catch (err) {
      console.error('Error refreshing session status:', err);
    }
  }

  function renderAttendeesList(attendees) {
    if (!attendees || attendees.length === 0) {
      liveAttendeesList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem; font-size: 0.9rem;">
          ⏳ Menunggu siswa melakukan scan QR Code...
        </div>
      `;
      return;
    }

    liveAttendeesList.innerHTML = '';
    const sorted = [...attendees].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    sorted.forEach(item => {
      const row = document.createElement('div');
      row.className = 'attendee-item';
      const timeFormatted = new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      row.innerHTML = `
        <div class="attendee-info">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">
            ${item.studentName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; color: #0f172a;">${item.studentName}</h4>
            <p style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">NIS: ${item.nis} • Kelas ${item.class} • <span style="color: #059669;">${item.method === 'qr_scan' ? '📱 Scan QR' : '✍️ Manual Guru'}</span></p>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="background: #ecfdf5; color: #059669; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">
            ${item.status.toUpperCase()}
          </span>
          <p class="attendee-time">${timeFormatted} WIB</p>
        </div>
      `;
      liveAttendeesList.appendChild(row);
    });
  }

  // SSE Real-time stream with automatic polling fallback for serverless hosting
  function connectSSE(sessionId) {
    if (state.sseSource) {
      state.sseSource.close();
      state.sseSource = null;
    }
    if (state.pollingTimer) {
      clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }

    try {
      state.sseSource = new EventSource(`/api/session/stream/${sessionId}`);

      state.sseSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === 'NEW_ATTENDANCE') {
            playSuccessChime();
            const record = payload.data.attendance;
            showToast(`Siswa Masuk: ${record.studentName} (${record.class})`, 'success');
            liveAttendanceCounter.textContent = `${payload.data.totalAttended} / ${payload.data.totalEnrolled}`;
            refreshSessionStatus(sessionId);
          } else if (payload.event === 'TOKEN_ROTATED') {
            refreshSessionStatus(sessionId);
          } else if (payload.event === 'SESSION_EXPIRED' || payload.event === 'SESSION_CLOSED') {
            showToast('Sesi absensi telah berakhir/ditutup.', 'info');
          }
        } catch (err) {}
      };

      state.sseSource.onerror = () => {
        // Jika SSE ditutup oleh serverless proxy (Vercel/Render), otomatis aktifkan polling tiap 4 detik
        if (!state.pollingTimer && state.activeSession) {
          state.pollingTimer = setInterval(() => {
            if (state.activeSession) {
              refreshSessionStatus(sessionId);
            } else {
              clearInterval(state.pollingTimer);
              state.pollingTimer = null;
            }
          }, 4000);
        }
      };
    } catch (e) {
      state.pollingTimer = setInterval(() => {
        if (state.activeSession) {
          refreshSessionStatus(sessionId);
        }
      }, 4000);
    }
  }

  btnCloseQrSession.addEventListener('click', async () => {
    if (!state.activeSession) return;
    if (!confirm('Apakah Anda yakin ingin menutup sesi absensi ini? Siswa tidak akan dapat melakukan scan lagi.')) return;

    try {
      const res = await fetch(`/api/session/close/${state.activeSession.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (state.activeSessionTimer) clearInterval(state.activeSessionTimer);
      if (state.sseSource) state.sseSource.close();
      state.activeSession = null;

      sessionActiveArea.style.display = 'none';
      sessionSetupBox.style.display = 'flex';
      showToast('Sesi absensi resmi ditutup & dikunci!', 'info');
    } catch (err) {
      alert(err.message);
    }
  });

  btnFullscreenQr.addEventListener('click', () => fullscreenQrModal.classList.add('active'));
  btnCloseFsModal.addEventListener('click', () => fullscreenQrModal.classList.remove('active'));
  fullscreenQrModal.addEventListener('click', (e) => {
    if (e.target === fullscreenQrModal) fullscreenQrModal.classList.remove('active');
  });

  btnCopyScanLink.addEventListener('click', () => {
    if (!state.activeSession) return;
    const host = state.info ? state.info.baseUrl : window.location.origin;
    const url = `${host}/absen.html?session=${state.activeSession.id}&token=${state.activeSession.currentDynamicToken}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Tautan presensi berhasil disalin!', 'info');
    }).catch(() => prompt('Salin tautan ini:', url));
  });

  // Manual Add Student into Active QR Session
  btnOpenManualAddModal.addEventListener('click', async () => {
    if (!state.activeSession) return;
    try {
      const res = await fetch(`/api/students?ekskul=${state.activeSession.ekskulId}`);
      const list = await res.json();
      manualStudentSelect.innerHTML = '<option value="">-- Pilih Siswa --</option>';
      list.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.nis;
        opt.textContent = `${s.name} (${s.class}) - NIS: ${s.nis}`;
        manualStudentSelect.appendChild(opt);
      });
      manualNotesInput.value = 'HP habis baterai / lupa bawa HP';
      manualAddModal.classList.add('active');
    } catch (err) {
      alert('Gagal memuat daftar siswa.');
    }
  });

  btnCloseManualModal.addEventListener('click', () => manualAddModal.classList.remove('active'));
  btnCancelManualAdd.addEventListener('click', () => manualAddModal.classList.remove('active'));

  btnSubmitManualAdd.addEventListener('click', async () => {
    const nis = manualStudentSelect.value;
    const notes = manualNotesInput.value;
    if (!nis) return alert('Pilih nama siswa terlebih dahulu!');

    try {
      const res = await fetch('/api/session/add-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.activeSession.id,
          nis,
          status: 'Hadir',
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      manualAddModal.classList.remove('active');
      showToast(`Siswa ${data.record.studentName} dicatat hadir manual.`, 'success');
      playSuccessChime();
    } catch (err) {
      alert(err.message);
    }
  });


  // ==========================================
  // FITUR: TAMBAH EKSTRAKURIKULER BARU
  // ==========================================
  btnOpenAddEkskulModal.addEventListener('click', () => {
    formAddEkskul.reset();
    state.selectedNewEmoji = '🥁';
    emojiChoiceBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-emoji') === '🥁'));
    addEkskulModal.classList.add('active');
  });

  btnCloseAddEkskulModal.addEventListener('click', () => addEkskulModal.classList.remove('active'));
  btnCancelAddEkskul.addEventListener('click', () => addEkskulModal.classList.remove('active'));

  emojiChoiceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      emojiChoiceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedNewEmoji = btn.getAttribute('data-emoji');
    });
  });

  formAddEkskul.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newEkskulName.value.trim();
    const pembimbing = newEkskulPembimbing.value.trim();
    const method = document.querySelector('input[name="newEkskulMethod"]:checked').value;
    const jadwal = newEkskulJadwal.value.trim();
    const lokasi = newEkskulLokasi.value.trim();

    if (!name || !pembimbing) return alert('Nama ekskul dan nama pembimbing wajib diisi!');

    const btnSubmit = document.getElementById('btnSubmitAddEkskul');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Menyimpan...';

    try {
      const res = await fetch('/api/ekskul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          pembimbing,
          method,
          jadwal,
          lokasi,
          icon: state.selectedNewEmoji
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan ekskul');

      addEkskulModal.classList.remove('active');
      showToast(`Ekstrakurikuler "${name}" berhasil ditambahkan!`, 'success');

      // Auto switch target tab
      if (method === 'manual') {
        state.selectedManualEkskulId = data.ekskul.id;
        document.getElementById('tabBtnDrumband').click();
      } else {
        state.selectedQrEkskulId = data.ekskul.id;
        document.getElementById('tabBtnQr').click();
      }

      await loadEkskuls();
    } catch (err) {
      alert(err.message);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Simpan Ekstrakurikuler';
    }
  });


  // ==========================================
  // TAB 3: REKAPITULASI & CETAK PRESENSI
  // ==========================================
  async function loadRekapData() {
    const ekskul = rekapEkskulSelect.value;
    const dateStart = rekapDateStart.value;
    const dateEnd = rekapDateEnd.value;
    const search = rekapSearchInput.value.trim();

    const query = new URLSearchParams({ ekskul, dateStart, dateEnd, search });

    try {
      const res = await fetch(`/api/rekap?${query.toString()}`);
      const data = await res.json();
      state.rekapData = data.records;

      kpiRate.textContent = `${data.summary.attendanceRate}%`;
      kpiHadir.textContent = data.summary.hadir;
      kpiSakit.textContent = data.summary.sakit;
      kpiIzin.textContent = data.summary.izin;
      kpiAlpa.textContent = data.summary.alpa;

      const dateText = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      printMetaText.textContent = `Periode: ${dateStart || 'Awal'} s/d ${dateEnd || 'Sekarang'} • Dicetak pada: ${dateText}`;

      renderRekapTable(data.records);
    } catch (err) {
      console.error('Error loading rekap:', err);
      showToast('Gagal memuat rekap presensi', 'error');
    }
  }

  function renderRekapTable(records) {
    rekapTableBody.innerHTML = '';
    if (records.length === 0) {
      rekapTableBody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Tidak ada riwayat presensi yang sesuai dengan kriteria filter.
          </td>
        </tr>
      `;
      return;
    }

    records.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      const statusColor = r.status === 'Hadir' ? '#10b981' : r.status === 'Izin' ? '#3b82f6' : '#ef4444';
      const timeStr = new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      tr.innerHTML = `
        <td style="padding: 0.65rem 0.85rem;">${idx + 1}</td>
        <td style="padding: 0.65rem 0.85rem; font-weight: 600;">${r.date}</td>
        <td style="padding: 0.65rem 0.85rem;">${r.ekskulName || r.ekskulId}</td>
        <td style="padding: 0.65rem 0.85rem; font-family: monospace;">${r.nis}</td>
        <td style="padding: 0.65rem 0.85rem; font-weight: 700;">${r.studentName}</td>
        <td style="padding: 0.65rem 0.85rem;">${r.class}</td>
        <td style="padding: 0.65rem 0.85rem;">
          <span style="background: ${statusColor}18; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 0.2rem 0.55rem; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">
            ${r.status}
          </span>
        </td>
        <td style="padding: 0.65rem 0.85rem; font-size: 0.8rem; color: var(--text-muted);">
          ${r.method === 'qr_scan' ? '📱 QR Siswa' : '✍️ Guru'}
        </td>
        <td style="padding: 0.65rem 0.85rem; font-size: 0.8rem; color: var(--text-muted);">${timeStr}</td>
        <td style="padding: 0.65rem 0.85rem; font-size: 0.8rem; color: var(--text-muted);">${r.notes || '-'}</td>
      `;
      rekapTableBody.appendChild(tr);
    });
  }

  btnFilterRekap.addEventListener('click', loadRekapData);
  rekapEkskulSelect.addEventListener('change', loadRekapData);
  btnPrintReport.addEventListener('click', () => window.print());

  btnExportCsv.addEventListener('click', () => {
    if (state.rekapData.length === 0) return alert('Tidak ada data untuk diekspor!');

    const headers = ['No', 'Tanggal', 'Ekstrakurikuler', 'NIS', 'Nama Siswa', 'Kelas', 'Status', 'Metode', 'Waktu', 'Catatan'];
    const rows = state.rekapData.map((r, i) => [
      i + 1,
      r.date,
      `"${r.ekskulName || r.ekskulId}"`,
      `"${r.nis}"`,
      `"${r.studentName}"`,
      `"${r.class}"`,
      r.status,
      r.method,
      new Date(r.timestamp).toLocaleTimeString('id-ID'),
      `"${r.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_presensi_ekskul_mts_alfatah_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  });


  // ==========================================
  // TAB 4: PENGELOLAAN ANGGOTA & SISWA EKSKUL
  // ==========================================
  let allMasterStudents = [];

  async function loadSiswaMaster() {
    try {
      const res = await fetch('/api/students');
      allMasterStudents = await res.json();
      renderSiswaMaster();
    } catch (err) {
      console.error('Error loading siswa master:', err);
      showToast('Gagal memuat data siswa', 'error');
    }
  }

  function renderSiswaMaster() {
    const q = siswaMasterSearch.value.trim().toLowerCase();
    const ekskulFilter = siswaMasterEkskulFilter ? siswaMasterEkskulFilter.value : 'all';
    const classFilter = siswaMasterClassFilter ? siswaMasterClassFilter.value : 'all';

    const filtered = allMasterStudents.filter(s => {
      const matchQuery = s.name.toLowerCase().includes(q) || s.nis.includes(q) || s.class.toLowerCase().includes(q);
      const matchEkskul = ekskulFilter === 'all' || s.ekskuls.includes(ekskulFilter);
      const matchClass = classFilter === 'all' || s.class.startsWith(classFilter);
      return matchQuery && matchEkskul && matchClass;
    });

    if (siswaMasterCount) {
      siswaMasterCount.textContent = `Menampilkan ${filtered.length} dari ${allMasterStudents.length} siswa`;
    }

    siswaMasterTableBody.innerHTML = '';
    if (filtered.length === 0) {
      siswaMasterTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            Tidak ada siswa yang sesuai dengan kriteria filter.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(s => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      
      const ekskulBadges = (s.ekskuls || []).map(ekskulId => {
        const found = state.ekskuls.find(e => e.id === ekskulId);
        const name = found ? found.name : ekskulId;
        const icon = found ? found.icon : '⭐';
        const isQr = found ? found.method === 'qr' : false;
        return `<span class="badge ${isQr ? 'badge-qr' : 'badge-manual'}" style="margin-right: 4px; display: inline-flex; align-items: center; gap: 3px;">${icon} ${name}</span>`;
      }).join('') || '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Belum memilih ekskul</span>';

      tr.innerHTML = `
        <td style="padding: 0.75rem; font-family: monospace; font-weight: 700; color: #1e293b;">${s.nis}</td>
        <td style="padding: 0.75rem; font-weight: 700;">${s.name}</td>
        <td style="padding: 0.75rem;">${s.gender === 'L' ? '<span style="color: #2563eb; font-weight: 600;">L</span>' : '<span style="color: #db2777; font-weight: 600;">P</span>'}</td>
        <td style="padding: 0.75rem; font-weight: 600;">${s.class}</td>
        <td style="padding: 0.75rem;">${ekskulBadges}</td>
        <td style="padding: 0.75rem; text-align: center; white-space: nowrap;">
          <button class="btn btn-outline btn-edit-student" data-nis="${s.nis}" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; margin-right: 4px;">
            ✏️ Edit
          </button>
          <button class="btn btn-outline btn-delete-student" data-nis="${s.nis}" data-name="${s.name}" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; color: #dc2626; border-color: #fca5a5;">
            🗑️ Hapus
          </button>
        </td>
      `;

      // Edit Button Handler
      tr.querySelector('.btn-edit-student').addEventListener('click', () => {
        openStudentModal(s);
      });

      // Delete Button Handler
      tr.querySelector('.btn-delete-student').addEventListener('click', () => {
        deleteStudent(s.nis, s.name);
      });

      siswaMasterTableBody.appendChild(tr);
    });
  }

  // Filter Listeners
  siswaMasterSearch.addEventListener('input', renderSiswaMaster);
  if (siswaMasterEkskulFilter) siswaMasterEkskulFilter.addEventListener('change', renderSiswaMaster);
  if (siswaMasterClassFilter) siswaMasterClassFilter.addEventListener('change', renderSiswaMaster);

  // Quick Manage from Tab 1 (Presensi Guru)
  if (btnManageCurrentEkskulMembers) {
    btnManageCurrentEkskulMembers.addEventListener('click', () => {
      document.getElementById('tabBtnSiswa').click();
      if (siswaMasterEkskulFilter) {
        siswaMasterEkskulFilter.value = state.selectedManualEkskulId;
        renderSiswaMaster();
      }
    });
  }

  // Populate Checkboxes for Student's Extracurriculars in Modal
  function populateStudentEkskulsCheckboxes(checkedIds = []) {
    studentEkskulsCheckboxes.innerHTML = '';
    state.ekskuls.forEach(e => {
      const isChecked = checkedIds.includes(e.id);
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '0.45rem';
      label.style.fontSize = '0.82rem';
      label.style.fontWeight = '600';
      label.style.cursor = 'pointer';
      label.style.padding = '0.35rem 0.5rem';
      label.style.borderRadius = '6px';
      label.style.background = isChecked ? '#ecfdf5' : '#ffffff';
      label.style.border = isChecked ? '1px solid #10b981' : '1px solid var(--border)';

      label.innerHTML = `
        <input type="checkbox" name="studentEkskulItem" value="${e.id}" ${isChecked ? 'checked' : ''} style="accent-color: var(--primary);">
        <span>${e.icon || '⭐'} ${e.name}</span>
      `;

      const chk = label.querySelector('input');
      chk.addEventListener('change', () => {
        label.style.background = chk.checked ? '#ecfdf5' : '#ffffff';
        label.style.border = chk.checked ? '1px solid #10b981' : '1px solid var(--border)';
      });

      studentEkskulsCheckboxes.appendChild(label);
    });
  }

  // Open Student Modal (Add or Edit)
  function openStudentModal(student = null) {
    if (student) {
      // Edit Mode
      studentFormMode.value = 'edit';
      studentModalTitle.textContent = `✏️ Edit Data Siswa: ${student.name}`;
      studentInputNis.value = student.nis;
      studentInputNis.disabled = true; // NIS cannot be changed in edit mode
      studentInputName.value = student.name;
      studentInputClass.value = student.class;
      document.querySelector(`input[name="studentGender"][value="${student.gender || 'L'}"]`).checked = true;
      populateStudentEkskulsCheckboxes(student.ekskuls || []);
      btnSubmitStudent.textContent = 'Simpan Perubahan';
    } else {
      // Add Mode
      studentFormMode.value = 'add';
      studentModalTitle.textContent = '👤 Tambah Siswa Baru';
      studentInputNis.value = '';
      studentInputNis.disabled = false;
      studentInputName.value = '';
      studentInputClass.value = '';
      document.querySelector('input[name="studentGender"][value="L"]').checked = true;
      
      // If currently filtered by a specific ekskul in Tab 4, pre-check that ekskul!
      const currentFilteredEkskul = (siswaMasterEkskulFilter && siswaMasterEkskulFilter.value !== 'all') 
        ? [siswaMasterEkskulFilter.value] 
        : (state.currentTab === 'tab-drumband' ? [state.selectedManualEkskulId] : []);
      
      populateStudentEkskulsCheckboxes(currentFilteredEkskul);
      btnSubmitStudent.textContent = 'Tambah Siswa';
    }

    studentModal.classList.add('active');
  }

  btnOpenAddStudentModal.addEventListener('click', () => openStudentModal(null));
  btnCloseStudentModal.addEventListener('click', () => studentModal.classList.remove('active'));
  btnCancelStudentModal.addEventListener('click', () => studentModal.classList.remove('active'));

  // Save Student (Add / Edit)
  formStudent.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = studentFormMode.value;
    const nis = studentInputNis.value.trim();
    const name = studentInputName.value.trim();
    const className = studentInputClass.value.trim();
    const gender = document.querySelector('input[name="studentGender"]:checked').value;

    const checkedEkskuls = Array.from(document.querySelectorAll('input[name="studentEkskulItem"]:checked')).map(c => c.value);

    if (!nis || !name || !className) {
      return alert('NIS, Nama Siswa, dan Kelas wajib diisi!');
    }

    btnSubmitStudent.disabled = true;
    btnSubmitStudent.textContent = 'Menyimpan...';

    try {
      let res, data;
      if (mode === 'add') {
        res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nis,
            name,
            gender,
            class: className,
            ekskuls: checkedEkskuls
          })
        });
      } else {
        res = await fetch(`/api/students/${nis}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            gender,
            class: className,
            ekskuls: checkedEkskuls
          })
        });
      }

      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data siswa');

      studentModal.classList.remove('active');
      showToast(data.message || 'Data siswa berhasil disimpan!', 'success');
      playSuccessChime();

      // Refresh student master and current attendance list
      await loadSiswaMaster();
      loadManualStudents();
    } catch (err) {
      alert(err.message);
    } finally {
      btnSubmitStudent.disabled = false;
      btnSubmitStudent.textContent = mode === 'add' ? 'Tambah Siswa' : 'Simpan Perubahan';
    }
  });

  // Delete Student
  async function deleteStudent(nis, name) {
    if (!confirm(`Apakah Anda yakin ingin menghapus siswa:\n\n"${name}" (NIS: ${nis})\n\ndari pangkalan data madrasah?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/students/${nis}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus siswa');

      showToast(data.message || `Siswa ${name} berhasil dihapus.`, 'info');
      await loadSiswaMaster();
      loadManualStudents();
    } catch (err) {
      alert(err.message);
    }
  }

  // Start initialization
  loadSystemInfo();
  loadEkskuls();
});
