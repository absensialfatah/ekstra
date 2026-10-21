# 🏫 Sistem Presensi Ekstrakurikuler - MTs Al Fatah

Aplikasi web presensi ekstrakurikuler dengan arsitektur **Dual-Flow Presence**:
1. **Presensi Manual Guru** (untuk kegiatan seperti *Drumband* di mana siswa tidak membawa HP): Guru menandai siswa yang **Hadir** atau **Izin**; siswa yang tidak diklik otomatis tercatat **Alpa**.
2. **Presensi Mandiri via QR Code** (untuk kegiatan seperti *Bola Voli*, *Bulutangkis*, *Futsal* di mana siswa membawa HP): Siswa memindai QR Code berotasi dinamis setiap 30 detik (Anti-Titip Absen via WhatsApp) dan menerima bukti digital.
3. **Fitur Tambah Ekstrakurikuler**: Bebas menambah ekstrakurikuler baru kapan saja.

---

## 🚀 Panduan Deploy ke GitHub & Render.com (Gratis)

### Langkah 1: Buat Repositori di GitHub
1. Buka [GitHub.com](https://github.com/) dan masuk ke akun Anda.
2. Klik tombol **New** (Buat repositori baru).
3. Beri nama repositori, contoh: `presensi-ekskul-alfatah`.
4. Pilih **Public** atau **Private**.
5. Klik **Create repository**.

---

### Langkah 2: Unggah Berkas ke GitHub

#### Opsi A: Menggunakan GitHub Web (Paling Praktis Tanpa Install Git)
1. Di halaman repositori GitHub yang baru dibuat, klik tautan **"uploading an existing file"**.
2. Tarik (*drag and drop*) seluruh berkas dan folder dari folder `d:\web\Extra` **KECUALI folder `node_modules`**:
   * `public/` (seluruh isi folder)
   * `data/` (`database.json`)
   * `server.js`
   * `package.json`
   * `render.yaml`
   * `.gitignore`
   * `README.md`
3. Ketik pesan commit: *"Initial commit presensi MTs Al Fatah"*.
4. Klik **Commit changes**.

#### Opsi B: Menggunakan Git CLI / GitHub Desktop
Jika Anda memiliki Git terpasang di komputer:
```bash
git init
git add .
git commit -m "Initial commit presensi MTs Al Fatah"
git branch -M main
git remote add origin https://github.com/USERNAME-ANDA/presensi-ekskul-alfatah.git
git push -u origin main
```

---

### Langkah 3: Deploy di Render.com (100% Gratis)

1. Buka [Render.com](https://render.com/) dan daftar / masuk dengan akun GitHub Anda.
2. Di dashboard Render, klik tombol **New +** $\rightarrow$ pilih **Web Service** (atau **Blueprint**).
3. Pilih repositori GitHub Anda: `presensi-ekskul-alfatah`.
4. Render akan mendeteksi berkas `render.yaml` secara otomatis:
   * **Name**: `presensi-ekskul-alfatah`
   * **Region**: `Singapore` *(paling cepat untuk akses di Indonesia)*
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Instance Type**: `Free`
5. Klik **Create Web Service**.
6. Tunggu sekitar 1-2 menit hingga proses build selesai. Render akan memberikan alamat website resmi Anda:
   👉 **`https://presensi-ekskul-alfatah.onrender.com`**

Aplikasi presensi kini sudah online dan dapat diakses dari mana saja oleh guru dan siswa menggunakan HP Android maupun iPhone!

---

## 💻 Menjalankan di Komputer Lokal Madrasah (Offline)

Jika ingin dijalankan di komputer server madrasah tanpa internet:
```bash
# 1. Masuk ke direktori
cd d:\web\Extra

# 2. Install dependensi (hanya pertama kali)
npm install

# 3. Jalankan aplikasi
node server.js
```
* Akses Guru: `http://localhost:3000`
* Akses Siswa via Wi-Fi Madrasah: `http://192.168.100.2:3000`
