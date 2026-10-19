# EvacFit — Web (frontend)

Prototipe publik: **https://evacfit.vercel.app** (mode supabase, deploy dari folder `web/` ke Vercel; env `VITE_*` diatur di proyek Vercel `evacfit`).

Frontend web app EvacFit. Tampilan mengikuti `DESIGN.md`; token warna/tipografi diambil apa adanya dari `tailwind.theme.json` (salinan dari folder PRD).

Dua mode data, dipilih lewat `VITE_DATA_MODE` (salin `.env.example` ke `.env`):

- **`demo`** (bawaan) — semua data fiktif di `localStorage` browser, tanpa server. Cadangan untuk live demo bila internet bermasalah.
- **`supabase`** — backend Supabase proyek **EvacFit** (`../supabase/migrations`). Pencocokan, kunci kapasitas (`FOR UPDATE`), state machine, kedaluwarsa soft-lock (`pg_cron`), dan audit log berjalan di Postgres. Browser hanya membaca (dibatasi RLS per peran) dan memanggil RPC.

### Supabase

| Migrasi | Isi |
| --- | --- |
| `…01_schema.sql` | Tabel model data PRD §8, kolom `geography` + indeks GIST (PostGIS) |
| `…02_rls.sql` | RLS di semua tabel: warga → keluarganya, relawan → tugasnya, posko → poskonya, koordinator → semua. Klien tidak punya izin tulis langsung |
| `…03_rpc.sql` | Satu RPC per aksi (`run_matching`, `confirm_assignment`, `reject_assignment`, `check_in`, `set_shelter_status`, …) |
| `…04_audit_cron.sql` | Trigger audit + `expire_soft_locks()` tiap menit |
| `…05_seed.sql` | Data contoh (= `src/data/mock.ts`) + 4 akun demo |
| `…08_bmkg_poll.sql` | `pg_cron` tiap menit memanggil Edge Function `bmkg-poll` lewat `pg_net` |
| `…09`–`…14` | **Wilayah operasi** (`countries`, `operation_areas`): RLS per wilayah, matching per wilayah + tetangga, impor 33 kab/kota Sumatera Utara (geoBoundaries IDN ADM2 = BPS/WFP/OCHA, CC BY 3.0 IGO) |

**Wilayah operasi & lokasi per peran.** Setiap keluarga, posko, dan relawan otomatis masuk ke wilayah (kabupaten/kota) tempat koordinatnya berada (trigger PostGIS, bukan isian klien). Koordinator hanya melihat data wilayahnya; posko di wilayah tetangga boleh menerima keluarga lintas batas. Nomor darurat dan bahasa layanan dibaca dari tabel `countries` lewat wilayah akun. Semua peran menetapkan lokasi lewat komponen **Pemilih Lokasi** (GPS + indikator akurasi, cari alamat via Photon/OSM, pin di peta, kartu konfirmasi wilayah, koordinat manual). Menambah wilayah/negara = impor batas + baris `countries`, tanpa ubah kode. Rancangan lengkap: `../RISET-Skala-Universal.md`.

**Integrasi BMKG (EMER-2/EMER-3).** `supabase/functions/bmkg-poll` membaca data terbuka BMKG (`gempaterkini.json` = gempa M ≥ 5,0, `gempadirasakan.json` = gempa dirasakan), lalu menyimpan gempa M > 5,0 atau dirasakan, ≤ 24 jam, dalam radius wilayah kerja sebagai `disaster_events` berstatus `draft` (deduplikasi lewat `external_event_id`). Tidak ada yang aktif sebelum koordinator mengesahkan draf di panel *Peringatan BMKG*. Draf yang tidak disahkan ditutup otomatis setelah 24 jam. Wilayah kerja bawaan: seluruh Indonesia (titik tengah -2,5; 118, radius 2800 km, dari Sabang sampai Merauke) agar panel menampilkan gempa nyata; persempit ke satu wilayah BPBD lewat secret `WORK_AREA_LAT`, `WORK_AREA_LNG`, `WORK_AREA_KM`. Tes: `deno test supabase/functions/bmkg-poll`.

Akun uji (data fiktif). Sementara belum ada auth sungguhan, form masuk menerima email & kata sandi apa saja lalu masuk ke akun peran halaman itu (`demoAccounts` di `src/config.ts`): `koordinator@evacfit.demo`, `posko@evacfit.demo` (Posko Padang Bulan), `relawan@evacfit.demo` (Andi Pratama, van kursi roda), `warga@evacfit.demo` (Keluarga Siregar + 2 keluarga dampingan). Atur ulang data: jalankan `select private.seed_demo();` di SQL Editor.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173 (mode dari .env)
npm run dev:demo   # mode demo: data di browser, tanpa Supabase (cadangan live pitch; peta tetap butuh internet)
npm run check      # self-check pencocokan & state machine
npm run build      # typecheck + build produksi
```

## Dua tampilan

- **Warga (HP, prioritas utama)** — `/warga`: satu kolom, teks 18px, tombol 60px, ikon + teks di semua kontrol, tombol darurat 112 di posisi tetap, tombol "Dengarkan" (dibacakan suara), pendaftaran berupa wizard satu pertanyaan per layar dengan penghitung −/+ dan kartu pilihan besar.
- **Petugas (laptop)** — `/koordinator`, `/posko`: sidebar kiri dengan logo, badge tindakan, ringkasan KPI, bar progres evakuasi, meter kapasitas posko. Di HP berubah menjadi bilah navigasi bawah. `/relawan` dioptimalkan untuk HP di lapangan.

### Bahasa & negara

- **Bahasa:** Bahasa Indonesia dan English (`src/i18n/id.ts`, `src/i18n/en.ts`). Bahasa awal mengikuti browser; warga mengganti lewat tombol **Tampilan**, petugas lewat **ID / EN** di bilah atas. Kamus English bertipe sama dengan kamus Indonesia, jadi build gagal bila ada teks yang belum diterjemahkan.
- **Teks dari sistem** (alasan pencocokan, pemberitahuan, defisit backlog) disimpan sebagai data dan disusun saat ditampilkan, sehingga ikut berganti bahasa.
- **Angka & jam** diformat sesuai bahasa (`id-ID` / `en-GB`).
- **Negara lain = konfigurasi**, bukan ubah kode: nomor darurat, bahasa layanan posko, dan pusat peta ada di `src/config.ts`. Menambah bahasa = menambah satu file kamus.

### Referensi desain

| Sumber | Pola yang diambil |
| --- | --- |
| GOV.UK "One thing per page" | Wizard satu pertanyaan per layar untuk pengguna yang kurang percaya diri |
| Red Cross Emergency App (Family Safe) | Satu status besar + satu aksi besar |
| FEMA App redesign | Bahasa sederhana, kompatibel pembaca layar, tata letak konsisten |
| Japan "Safety tips" (JNTO) | Layar disederhanakan, lebih banyak ikon/ilustrasi |
| Riset target sentuh lansia (Leitão & Silva 2012; WCAG 2.5.5/2.5.8) | Target ≥48px, 60px untuk aksi utama |
| UC3M "Disability-Inclusive Mobile App Requirements" (2024) | Ukuran teks yang bisa diubah, kontras tinggi, dukungan teknologi bantu |
| Juvare Crisis Track / Sahana Eden | Dashboard komando: peta + daftar + ringkasan, registri posko |

## Alur demo (±3 menit)

1. **Koordinator** → Aktifkan Status Darurat (skenario banjir Sungai Deli sudah terisi) → Jalankan Optimasi. Hasil: 11 keluarga direkomendasikan, 1 masuk backlog.
2. **Posko** → Konfirmasi *Keluarga Siregar*; tolak *Keluarga Ginting* (genset rusak) → tidak ada alternatif → masuk backlog.
3. **Koordinator → Posko** → verifikasi *Posko Kantor Camat Medan Johor* → **Backlog** → Jalankan ulang → backlog kosong.
4. **Koordinator → Penugasan** → tugaskan van kursi roda ke Siregar (mobil biasa otomatis ditolak).
5. **Relawan** → Simulasikan sinyal putus → Mulai Perjalanan (masuk antrean *Pending Sync*) → Pulihkan sinyal.
6. **Posko → Check-in** → Selesai Check-In. **Warga** (buka di ukuran HP) → status *Sudah sampai dengan selamat*.

Coba juga di HP: **Warga → Keluarga → Daftarkan keluarga dampingan** untuk melihat wizard pendaftaran.

"Atur ulang data demo" ada di halaman beranda.

## Yang masih sementara (diganti saat backend dibangun)

| Sementara | Pengganti (PRD) |
| --- | --- |
| Greedy matcher: `src/lib/matching.ts` (mode demo) dan `private.match()` di Postgres (mode supabase), syarat wajib & preferensi sama | Google OR-Tools worker (MTCH-1) |
| Jarak garis lurus × 1,3 | Matriks & rute OpenRouteService profil kursi roda (NAV-1) |
| Tombol "Simulasikan sinyal putus" | Service Worker + IndexedDB outbox (OFFL-1..5) |
