# CV Tailor

[![CI](https://github.com/muhammadfawwazarshads/cv-tailor/actions/workflows/ci.yml/badge.svg)](https://github.com/muhammadfawwazarshads/cv-tailor/actions/workflows/ci.yml)

Aplikasi web untuk menyesuaikan CV ke setiap lowongan **tanpa mengarang pengalaman**.

Alurnya meniru proses manual yang paling efektif:

1. **Profil CV master.** Impor CV (PDF atau teks), AI mengubahnya jadi data terstruktur yang bisa diedit. Tulis semua pengalaman di sini.
2. **Lamaran baru.** Tempel deskripsi pekerjaan (JD). AI menilai kecocokan (skor, kekuatan, gap) lalu mengajukan **pertanyaan konfirmasi**, misalnya "Pernah pakai Kubernetes beneran atau baru belajar?".
3. **Jawab pertanyaan.** Jawaban bisa disimpan sebagai **fakta terkonfirmasi** yang dipakai lagi di lamaran berikutnya. Jawaban "belum pernah" membuat AI tidak mengklaim hal itu.
4. **CV disesuaikan.** AI memilih, mengurutkan, dan menulis ulang isi CV untuk JD tersebut, plus catatan apa yang diubah, apa yang sengaja tidak diklaim, dan persiapan interview.
5. **Revisi lewat instruksi** ("ganti jadi Technology Consultant", "Kubernetes hapus") atau edit manual. Setiap revisi tersimpan sebagai versi baru.
6. **Unduh PDF** yang ATS-friendly: satu kolom, tanpa tabel, teks bisa dipilih, karakter aman untuk parser.

### Lowongan: pilah lowongan dari LinkedIn

Menu **Lowongan** menampung lowongan sebelum kamu memutuskan melamar. LinkedIn tidak menyediakan API untuk mencari lowongan, dan scraping melanggar ketentuannya, jadi alurnya salin-tempel:

1. Buka halaman hasil pencarian, satu lowongan, atau postingan rekrutmen di LinkedIn (atau situs lain), tekan Ctrl+A lalu Ctrl+C, dan tempel.
2. AI memisahkan setiap lowongan dari teks menu dan iklan, lalu untuk tiap lowongan mengisi: posisi, perusahaan, lokasi, cara melamar, **ukuran perusahaan** (besar, menengah, kecil, tidak dikenal; berdasarkan pengetahuan AI, jadi tetap perkiraan), **tanda bahaya** (biaya rekrutmen, kontak hanya WhatsApp/Gmail, tanpa interview, dll.), skor kecocokan dengan profilmu, dan rekomendasi (layak daftar, coba aja, lewati).
3. Saring berdasarkan ukuran perusahaan, tanda bahaya, manufaktur, dan skor. Lowongan yang sama tidak masuk dua kali.
4. **Buat lamaran & CV** mengubah lowongan menjadi lamaran dan langsung menjalankan analisis. Kalau yang tersalin baru kartu ringkasnya, tempel deskripsi lengkapnya dulu di kotak "Lengkapi deskripsi".

Kolom **Fokus pencarian** (misalnya "Software engineer, DevOps, data. Jabodetabek. Fresh grad") dipakai setiap kali menilai.

### Email lamaran, cover letter, dan follow-up

Tab **Email** di setiap lamaran menulis draft dari lowongan dan CV yang sudah disesuaikan:

- **Email lamaran** dalam dua versi (ringkas dan lebih menjual). Kalau lowongan menyebut alamat email atau format subject (misalnya "IT Staff_Cikarang"), draft mengikutinya.
- **Cover letter** 3-4 paragraf.
- **Follow-up** seminggu setelah melamar dan ucapan terima kasih setelah interview.

Pilih bahasa, tambahkan instruksi ("sebut saya siap relokasi"), lalu salin atau buka langsung di aplikasi email. Aturan kejujuran yang sama berlaku: draft hanya memakai pengalaman yang ada di profil dan fakta terkonfirmasi.

Fitur lain:

- **Multi-user** dengan login. Akun pertama otomatis jadi admin. Data CV dan lamaran tiap pengguna privat.
- **Multi-provider AI dengan fallback otomatis**: Anthropic (Claude), OpenAI, Google Gemini, Azure OpenAI / AI Foundry, dan endpoint OpenAI-compatible (OpenRouter, Ollama, LM Studio, Groq, dst.). Provider dicoba sesuai urutan prioritas; kalau error, timeout, kena rate limit, atau balasannya tidak valid, sistem pindah ke provider berikutnya.
- **API key terenkripsi** (AES-256-GCM) dan hanya ditampilkan dalam bentuk tersamar.
- **Log pemakaian AI**: provider, model, tugas, status, durasi, dan token per panggilan, termasuk percobaan yang gagal.
- **Batas pemakaian harian** per pengguna (bisa diatur).
- **Pelacak status lamaran**: perlu konfirmasi, CV siap, sudah daftar, interview, offer, ditolak.

## Stack

| Bagian | Teknologi |
|---|---|
| Frontend | Vite, React, TypeScript, React Router |
| Backend | Node.js, Express 5, TypeScript, Zod |
| Database | PostgreSQL, atau PGlite (Postgres embedded) untuk development |
| Auth | Cookie httpOnly + JWT (jose), password bcrypt |
| PDF | pdfkit (render), unpdf (baca PDF upload) |

## Menjalankan secara lokal

Butuh Node.js 20 atau lebih baru.

```bash
npm install
cp .env.example .env      # opsional
npm run dev
```

Buka http://localhost:5173. Tanpa `DATABASE_URL`, data disimpan di PGlite pada folder `./data`, jadi tidak perlu install PostgreSQL.

Langkah pertama setelah daftar (akun pertama = admin):

1. Buka **Provider AI**, lalu tambahkan minimal satu provider beserta API key-nya. Klik **Tes** untuk memastikan koneksi.
2. Buka **Profil CV**, impor CV lama, periksa hasilnya, lalu klik **Simpan profil**.
3. Buka **Lamaran**, lalu tempel JD.

### Mode demo tanpa API key

```bash
ENABLE_MOCK_LLM=true npm run dev
```

Lalu tambahkan provider bertipe **Mock**. Hasilnya tidak ditulis ulang oleh AI, tapi seluruh alur (analisis, pertanyaan, versi CV, PDF, fallback) bisa dicoba. Isi model `fail` untuk mensimulasikan provider yang gagal.

## Contoh konfigurasi provider

| Tipe | Model | Base URL | Catatan |
|---|---|---|---|
| Anthropic | mis. `claude-sonnet-5-5` | kosong | |
| OpenAI | nama model dari dashboard OpenAI | kosong | |
| Gemini | nama model dari Google AI Studio | kosong | |
| Azure OpenAI / AI Foundry | **nama deployment** | `https://<resource>.openai.azure.com` | API version mis. `2024-10-21`, atau `v1` untuk endpoint `/openai/v1` |
| OpenAI-compatible | nama model di server tsb. | mis. `https://openrouter.ai/api/v1`, `http://localhost:11434/v1` | API key opsional |

Urutkan provider dengan tombol panah. Contoh pola yang umum: model utama di urutan 1, model cadangan dari vendor lain di urutan 2, dan model murah atau lokal di urutan 3.

## Versi satu file HTML (tanpa server)

```bash
npm run build:standalone
```

Hasilnya `dist-standalone/cv-tailor.html`, satu file yang bisa langsung dibuka di browser (klik dua kali, tanpa install). Fiturnya sama untuk satu pengguna:

- Data (profil, lamaran, versi CV, fakta, provider) tersimpan di `localStorage` browser tersebut. Gunakan **Profil CV → Cadangan data** untuk mengunduh dan memulihkan cadangan.
- AI dipanggil langsung dari browser dengan API key milikmu, yang juga hanya tersimpan di browser itu. Anthropic, OpenAI, dan Gemini mendukung panggilan dari browser; sebagian endpoint (misalnya Azure) bisa menolak karena CORS.
- **Unduh PDF** membuka dialog cetak browser dengan tampilan CV saja; pilih "Save as PDF" dengan kertas A4.
- Tidak ada login, pengguna lain, atau batas pemakaian harian.

## Production

### GitHub Codespaces (paling cepat, tanpa akun hosting)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/muhammadfawwazarshads/cv-tailor?quickstart=1)

Klik tombol di atas, lalu **Create codespace**. Dependensi di-install dan aplikasi di-build otomatis (sekitar 3 sampai 5 menit), kemudian server jalan di port 3000 dan tab browser terbuka sendiri. Kalau tidak terbuka, buka tab **Ports** dan klik ikon globe di baris port 3000.

- Mode demo aktif (`ENABLE_MOCK_LLM=true`), jadi alurnya bisa dicoba dengan provider tipe Mock. Provider asli tetap bisa ditambahkan.
- Data disimpan di PGlite dalam folder `data/` di codespace dan tetap ada selama codespace tidak dihapus.
- Port forwarding bersifat privat secara default: hanya akun GitHub kamu yang bisa membuka URL-nya.
- Codespace berhenti sendiri setelah tidak dipakai. Saat dibuka lagi, server otomatis jalan kembali. Log server ada di `/tmp/cv-tailor.log`.

### Render (sekali klik, gratis)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/muhammadfawwazarshads/cv-tailor)

Blueprint `render.yaml` membuat web service Node dan database PostgreSQL di plan gratis, lengkap dengan `APP_SECRET` acak. Setelah deploy selesai, buka URL `*.onrender.com`, daftar (akun pertama jadi admin), lalu tambahkan provider AI. Plan gratis tidur setelah tidak dipakai beberapa saat, jadi akses pertama bisa butuh sekitar satu menit.

### Docker Compose (app + PostgreSQL)

```bash
echo "APP_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")" > .env
docker compose up -d --build
```

Aplikasi berjalan di http://localhost:3000. Pasang reverse proxy dengan HTTPS (Nginx, Caddy, atau load balancer cloud) di depannya, karena cookie sesi diberi flag `Secure` di production.

### Tanpa Docker

```bash
npm ci
npm run build
NODE_ENV=production APP_SECRET=... DATABASE_URL=postgres://... npm start
```

Migrasi database berjalan otomatis saat server start.

### Variabel lingkungan

Lihat `.env.example`. Yang penting:

- `APP_SECRET` (wajib di production, min. 32 karakter): menandatangani sesi dan mengenkripsi API key. Jika diganti, semua pengguna logout dan API key harus dimasukkan ulang.
- `ALLOW_REGISTRATION=false`: menutup pendaftaran publik setelah akun admin dibuat.
- `DAILY_AI_LIMIT`: batas permintaan AI sukses per pengguna per 24 jam (0 = tanpa batas).
- `LLM_TIMEOUT_MS`: batas waktu satu permintaan sebelum pindah ke provider berikutnya.
- `ALLOWED_ORIGINS`: origin tambahan (dipisah koma) yang boleh memanggil API, misalnya saat aplikasi diakses lewat proxy dengan domain berbeda.

## Pengujian

```bash
# Terminal 1
ENABLE_MOCK_LLM=true DATA_DIR=./data-smoke PORT=3999 npm run dev:server
# Terminal 2
BASE_URL=http://localhost:3999 npm run smoke
```

Smoke test menjalankan seluruh alur lewat API: registrasi, hak akses admin, enkripsi API key, impor profil, analisis, jawaban dan fakta, CV, revisi, edit manual, PDF, pemilahan lowongan (label perusahaan, tanda bahaya, duplikat, lowongan jadi lamaran), isolasi data antar-pengguna, serta fallback dan pesan error saat semua provider gagal.

`npm run typecheck` memeriksa tipe frontend dan backend.

### CI

Workflow GitHub Actions (`.github/workflows/ci.yml`) berjalan di setiap push dan pull request:

1. **Typecheck dan build** frontend serta backend.
2. **Smoke test end-to-end** dua kali: dengan PGlite dan dengan PostgreSQL 16 sebagai service container. PDF hasil tes diunggah sebagai artifact.
3. **Docker**: image dibangun, container dijalankan, lalu health check `/api/health` harus menjawab.

## Struktur

```
client/                 Frontend (Vite + React)
  src/pages/            Lowongan, lamaran, detail lamaran, profil, admin
  src/components/       Pratinjau CV, komponen UI
server/
  index.ts              Express app
  auth.ts               Registrasi, login, sesi, manajemen pengguna
  db/                   Koneksi PostgreSQL/PGlite + migrasi
  llm/                  Adapter provider + router fallback
  ai/                   Prompt, layanan AI, mock
  pdf/                  Renderer PDF ATS-friendly
  routes/               Profil, fakta, lowongan, lamaran, admin
  shared/schemas.ts     Skema Zod yang dipakai server dan client
scripts/smoke.ts        Tes end-to-end
```

## Prinsip kejujuran

Prompt AI memuat aturan yang tidak boleh dilanggar: tidak menambah pengalaman, tanggal, angka, tools, atau sertifikasi yang tidak ada di profil, fakta terkonfirmasi, atau jawaban pengguna; tidak memakai placeholder metrik; tidak melebih-lebihkan kedalaman ("microservices", "led"); dan menjaga kerahasiaan klien. Tetap periksa setiap CV sebelum dikirim, karena kamu yang akan ditanya saat interview.

Font Carlito di `server/assets/fonts` berlisensi SIL Open Font License 1.1 (lihat `OFL.txt`).
