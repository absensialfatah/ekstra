/**
 * =========================================================================
 * SISTEM PRESENSI EKSTRAKURIKULER MTS AL FATAH - GOOGLE APPS SCRIPT
 * =========================================================================
 * ID Spreadsheet: 1rEmre6j8mfRVnImvf0_YX8JuF_by4XGpnJEInYK-PeU
 * 
 * FUNGSI UTAMA:
 * 1. setupDatabase(): Otomatis membuat 4 sheet utama dengan header warna & format rapi.
 * 2. seedInitialData(): Mengisi data awal ekskul & siswa MTs Al Fatah.
 * 3. onOpen(): Menambahkan menu khusus di bilah atas Google Sheets.
 * 4. doGet() & doPost(): REST API Web App untuk integrasi langsung dengan aplikasi web.
 * =========================================================================
 */

const SPREADSHEET_ID = "1rEmre6j8mfRVnImvf0_YX8JuF_by4XGpnJEInYK-PeU";

// Konfigurasi Nama Sheet
const SHEETS = {
  EKSKUL: "Ekskul",
  SISWA: "Siswa",
  PRESENSI: "Presensi",
  SESI_QR: "Sesi_QR"
};

/**
 * Menu otomatis saat Google Sheet dibuka oleh Guru / Admin
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎯 Presensi Ekskul MTs Al Fatah')
    .addItem('⚡ 1. Setup Otomatis Sheet & Kolom', 'setupDatabase')
    .addItem('📥 2. Isi Data Awal (Siswa & Ekskul)', 'seedInitialData')
    .addSeparator()
    .addItem('🧹 Bersihkan Data Presensi Uji Coba', 'clearAttendanceLogs')
    .addToUi();
}

/**
 * 1. SETUP OTOMATIS: Membuat seluruh sheet dan kolom yang diperlukan
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Definisi struktur kolom dan warna header tiap sheet
  const schemas = [
    {
      name: SHEETS.EKSKUL,
      color: "#059669", // Emerald Green
      headers: [
        "ID Ekskul", 
        "Nama Ekstrakurikuler", 
        "Guru Pembimbing", 
        "Jadwal Rutin", 
        "Lokasi Latihan", 
        "Metode (manual / qr)", 
        "Ikon Emoji", 
        "Warna Tema"
      ]
    },
    {
      name: SHEETS.SISWA,
      color: "#2563eb", // Royal Blue
      headers: [
        "NISN", 
        "Nama Lengkap Siswa", 
        "Jenis Kelamin (L/P)", 
        "Kelas", 
        "Ekskul Diikuti (Pisahkan Koma)", 
        "Status Siswa"
      ]
    },
    {
      name: SHEETS.PRESENSI,
      color: "#0f766e", // Teal Dark
      headers: [
        "ID Presensi", 
        "Tanggal Kegiatan", 
        "Waktu Presensi", 
        "ID Ekskul", 
        "Nama Ekstrakurikuler", 
        "NISN", 
        "Nama Siswa", 
        "Kelas", 
        "Status (Hadir / Izin / Alpa)", 
        "Metode (manual_guru / qr_scan)", 
        "Catatan / Keterangan Izin"
      ]
    },
    {
      name: SHEETS.SESI_QR,
      color: "#7c3aed", // Violet Purple
      headers: [
        "ID Sesi", 
        "ID Ekskul", 
        "Nama Ekskul", 
        "Tanggal", 
        "Waktu Dibuat", 
        "Waktu Kadaluarsa", 
        "Token Dinamis", 
        "Status (active / closed / expired)"
      ]
    }
  ];

  schemas.forEach(schema => {
    let sheet = ss.getSheetByName(schema.name);
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
    }

    // Tulis Header Kolom
    const headerRange = sheet.getRange(1, 1, 1, schema.headers.length);
    headerRange.setValues([schema.headers]);
    headerRange.setBackground(schema.color);
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Arial");
    headerRange.setFontSize(10);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");

    // Bekukan (Freeze) baris pertama agar header selalu terlihat saat scroll
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 36);

    // Format lebar kolom otomatis
    for (let i = 1; i <= schema.headers.length; i++) {
      sheet.autoResizeColumn(i);
      // Berikan margin minimal
      const currentWidth = sheet.getColumnWidth(i);
      sheet.setColumnWidth(i, Math.max(currentWidth + 25, 120));
    }

    // Set format kolom NISN sebagai Plain Text (@) agar angka 0 di depan tidak hilang
    if (schema.name === SHEETS.SISWA) {
      sheet.getRange("A:A").setNumberFormat("@");
    } else if (schema.name === SHEETS.PRESENSI) {
      sheet.getRange("F:F").setNumberFormat("@");
    }
  });

  // Hapus "Sheet1" default jika ada dan sudah ada sheet lain
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  SpreadsheetApp.getActiveSpreadsheet()?.toast(
    "Seluruh sheet dan kolom berhasil dibuat dengan rapi!", 
    "Setup Selesai ✅", 
    5
  );
}

/**
 * 2. SEED DATA AWAL: Mengisi data awal ekstrakurikuler & siswa MTs Al Fatah
 */
function seedInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // A. Data Ekskul
  const sheetEkskul = ss.getSheetByName(SHEETS.EKSKUL);
  if (sheetEkskul && sheetEkskul.getLastRow() === 1) {
    const ekskulData = [
      ["drumband", "Drumband Bahana Gita Al Fatah", "Ust. M. Syarifuddin, S.Pd", "Sabtu, 14:00 - 16:30 WIB", "Lapangan Utama MTs", "manual", "🥁", "#059669"],
      ["voli", "Bola Voli Putra/Putri", "Ust. Hendra Wijaya, S.Pd.I", "Jumat, 15:30 - 17:30 WIB", "Lapangan Voli MTs", "qr", "🏐", "#2563eb"],
      ["bulutangkis", "Bulutangkis PB Al Fatah", "Ust. Ahmad Fauzan, S.Pd", "Ahad, 08:00 - 10:30 WIB", "GOR Serbaguna", "qr", "🏸", "#7c3aed"],
      ["futsal", "Futsal MTs Al Fatah", "Ust. Rizky Pratama, S.Pd", "Selasa, 15:30 - 17:30 WIB", "Lapangan Futsal", "qr", "⚽", "#ea580c"]
    ];
    sheetEkskul.getRange(2, 1, ekskulData.length, ekskulData[0].length).setValues(ekskulData);
  }

  // B. Data Siswa
  const sheetSiswa = ss.getSheetByName(SHEETS.SISWA);
  if (sheetSiswa && sheetSiswa.getLastRow() === 1) {
    const siswaData = [
      ["2024001", "Ahmad Fauzi Ridho", "L", "8A", "drumband, voli", "Aktif"],
      ["2024002", "Aisyah Nur Aini", "P", "8B", "drumband", "Aktif"],
      ["2024003", "Bagus Arya Pratama", "L", "9A", "voli, bulutangkis, futsal", "Aktif"],
      ["2024004", "Chandra Bayu Saputra", "L", "7A", "drumband", "Aktif"],
      ["2024005", "Dewi Sartika Putri", "P", "8A", "drumband, bulutangkis", "Aktif"],
      ["2024006", "Dimas Wahyu Utomo", "L", "9B", "voli, futsal", "Aktif"],
      ["2024007", "Farhan Zulkarnain", "L", "8B", "drumband, voli", "Aktif"],
      ["2024008", "Fatimah Az-Zahra", "P", "7B", "drumband", "Aktif"],
      ["2024009", "Gilang Ramadhan", "L", "9A", "voli, futsal", "Aktif"],
      ["2024010", "Habibie Akbar", "L", "8A", "bulutangkis", "Aktif"],
      ["2024011", "Indah Permatasari", "P", "7A", "drumband", "Aktif"],
      ["2024012", "Jofan Alamsyah", "L", "9B", "voli, bulutangkis", "Aktif"],
      ["2024013", "Khadijah Marwah", "P", "8B", "drumband", "Aktif"],
      ["2024014", "Lukman Hakim", "L", "8A", "drumband, voli", "Aktif"],
      ["2024015", "Maulana Malik Ibrahim", "L", "9A", "bulutangkis", "Aktif"],
      ["2024016", "Nabil Ahmad", "L", "7B", "drumband", "Aktif"],
      ["2024017", "Nadira Salsabila", "P", "8B", "bulutangkis", "Aktif"],
      ["2024018", "Oki Setiawan", "L", "9B", "voli, futsal", "Aktif"],
      ["2024019", "Putri Rahmadani", "P", "7A", "drumband", "Aktif"],
      ["2024020", "Qoriatul Hasanah", "P", "8A", "bulutangkis", "Aktif"],
      ["2024021", "Rizky Dwi Ananda", "L", "9A", "voli, futsal", "Aktif"],
      ["2024022", "Siti Nurhaliza", "P", "7B", "drumband", "Aktif"],
      ["2024023", "Teguh Santoso", "L", "8B", "drumband, voli", "Aktif"],
      ["2024024", "Umar Al-Faruq", "L", "9B", "bulutangkis", "Aktif"],
      ["2024025", "Vina Anggraini", "P", "8A", "drumband", "Aktif"],
      ["2024026", "Wahyu Tri Hidayat", "L", "7A", "voli", "Aktif"],
      ["2024027", "Yusuf Habibi", "L", "8B", "bulutangkis", "Aktif"],
      ["2024028", "Zaidan Ilham Pratama", "L", "9A", "drumband, voli, bulutangkis, futsal", "Aktif"]
    ];
    sheetSiswa.getRange(2, 1, siswaData.length, siswaData[0].length).setValues(siswaData);
  }

  SpreadsheetApp.getActiveSpreadsheet()?.toast(
    "Data awal ekstrakurikuler & siswa MTs Al Fatah berhasil dimasukkan!", 
    "Berhasil 🚀", 
    5
  );
}

/**
 * 3. MEMBERSIHKAN LOG PRESENSI (OPSIONAL)
 */
function clearAttendanceLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.PRESENSI);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    SpreadsheetApp.getActiveSpreadsheet()?.toast("Riwayat presensi telah dibersihkan.", "Selesai 🧹", 3);
  }
}

/**
 * =========================================================================
 * 4. WEB APP REST API (doGet & doPost)
 * Mengizinkan aplikasi web membaca & menulis data langsung ke Google Sheets!
 * =========================================================================
 */

function doGet(e) {
  const action = e.parameter.action || "getAll";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  try {
    let result = {};

    if (action === "getEkskul") {
      result = getSheetDataAsJson(ss.getSheetByName(SHEETS.EKSKUL));
    } else if (action === "getStudents") {
      result = getSheetDataAsJson(ss.getSheetByName(SHEETS.SISWA));
    } else if (action === "getAttendance") {
      result = getSheetDataAsJson(ss.getSheetByName(SHEETS.PRESENSI));
    } else {
      // Ambil seluruh data awal sekaligus
      result = {
        ekskuls: getSheetDataAsJson(ss.getSheetByName(SHEETS.EKSKUL)),
        students: getSheetDataAsJson(ss.getSheetByName(SHEETS.SISWA)),
        attendances: getSheetDataAsJson(ss.getSheetByName(SHEETS.PRESENSI))
      };
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    // A. Simpan Presensi Manual (Batch Guru)
    if (action === "saveManualAttendance") {
      const sheet = ss.getSheetByName(SHEETS.PRESENSI);
      const records = postData.records; // Array of attendance records
      const ekskulId = postData.ekskulId;
      const ekskulName = postData.ekskulName || ekskulId;
      const date = postData.date;
      const nowTime = Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");

      const rowsToAdd = records.map(r => [
        "att-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000),
        date,
        nowTime,
        ekskulId,
        ekskulName,
        "'" + String(r.nisn || r.nis || '').trim(), // Petik satu memastikan angka 0 di depan tetap utuh
        r.studentName,
        r.class,
        r.status, // Hadir, Izin, atau Alpa otomatis
        "manual_guru",
        r.notes || (r.status === 'Alpa' ? 'Tidak ada keterangan (Alpa otomatis)' : '')
      ]);

      if (rowsToAdd.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Berhasil mencatat presensi ${rowsToAdd.length} siswa ke Google Sheets!`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // B. Simpan Presensi Scan Siswa (Mandiri via QR)
    if (action === "saveScanAttendance") {
      const sheet = ss.getSheetByName(SHEETS.PRESENSI);
      const r = postData.record;
      const nowTime = Utilities.formatDate(new Date(), "Asia/Jakarta", "HH:mm:ss");

      sheet.appendRow([
        r.id || ("att-" + new Date().getTime()),
        r.date,
        nowTime,
        r.ekskulId,
        r.ekskulName,
        "'" + String(r.nisn || r.nis || '').trim(), // Simpan format text murni
        r.studentName,
        r.class,
        "Hadir",
        "qr_scan",
        r.notes || "Hadir mandiri via scan QR"
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Kehadiran siswa ${r.studentName} tercatat di Google Sheets!`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // C. Tambah Siswa Baru
    if (action === "addStudent") {
      const sheet = ss.getSheetByName(SHEETS.SISWA);
      const s = postData.student;
      sheet.appendRow([
        "'" + String(s.nisn || s.nis || '').trim(), // Angka 0 di depan NISN tidak hilang
        s.name,
        s.gender,
        s.class,
        Array.isArray(s.ekskuls) ? s.ekskuls.join(", ") : s.ekskuls,
        "Aktif"
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Siswa ${s.name} berhasil ditambahkan ke Google Sheets!`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // D. Tambah Ekstrakurikuler Baru
    if (action === "addEkskul") {
      const sheet = ss.getSheetByName(SHEETS.EKSKUL);
      const e = postData.ekskul;
      sheet.appendRow([
        e.id,
        e.name,
        e.pembimbing,
        e.jadwal,
        e.lokasi,
        e.method,
        e.icon,
        e.color || "#059669"
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Ekskul ${e.name} berhasil ditambahkan ke Google Sheets!`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // E. Edit Ekstrakurikuler
    if (action === "editEkskul") {
      const sheet = ss.getSheetByName(SHEETS.EKSKUL);
      const e = postData.ekskul;
      const data = sheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === e.id || data[i][1] === e.name) {
          sheet.getRange(i + 1, 2).setValue(e.name);
          sheet.getRange(i + 1, 3).setValue(e.pembimbing);
          sheet.getRange(i + 1, 4).setValue(e.jadwal);
          sheet.getRange(i + 1, 5).setValue(e.lokasi);
          sheet.getRange(i + 1, 6).setValue(e.method);
          sheet.getRange(i + 1, 7).setValue(e.icon);
          sheet.getRange(i + 1, 8).setValue(e.color || "#059669");
          found = true;
          break;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: found ? `Ekskul ${e.name} berhasil diperbarui di Google Sheets!` : "Ekskul tidak ditemukan di baris sheet."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // F. Hapus Ekstrakurikuler
    if (action === "deleteEkskul") {
      const sheet = ss.getSheetByName(SHEETS.EKSKUL);
      const id = postData.id;
      const data = sheet.getDataRange().getValues();
      let deleted = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: deleted ? `Ekskul berhasil dihapus dari Google Sheets!` : "Ekskul tidak ditemukan."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Aksi tidak dikenali."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper: Konversi Baris Sheet Menjadi Array of Object JSON
 */
function getSheetDataAsJson(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  // Gunakan getDisplayValues() agar string dengan 0 di depan (misal: 0081234567) dibaca persis teksnya
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      // Normalisasi nama key menjadi camelCase sederhana
      const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      obj[key] = row[index];
    });
    // Alias nis & nisn agar kompatibel di kedua sisi
    if (obj.nisn && !obj.nis) obj.nis = obj.nisn;
    if (obj.nis && !obj.nisn) obj.nisn = obj.nis;
    return obj;
  });
}
