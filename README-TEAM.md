# EvacFit (catatan tim)

> README publik (bahasa Inggris, untuk pengumpulan) ada di `README.md`. File ini untuk internal tim.

Platform koordinasi evakuasi: mencocokkan keluarga terdampak dengan posko yang sesuai kebutuhannya.

| Folder | Isi |
| --- | --- |
| `web/` | Frontend (React + Vite + Tailwind), deploy ke Vercel. Lihat `web/README.md` |
| `supabase/` | Backend: migrasi Postgres (schema, RLS, RPC) dan Edge Function `bmkg-poll` |
| `solver/` | Layanan optimasi penempatan (FastAPI + OR-Tools CP-SAT) |

## Mulai

```bash
cd web
cp .env.example .env   # isi VITE_SUPABASE_URL & VITE_SUPABASE_PUBLISHABLE_KEY dari Supabase > Settings > API
npm install
npm run dev
```

Tanpa Supabase: `npm run dev:demo` (data fiktif di browser).

## Aturan kontribusi

- Kerja di branch, buka Pull Request ke `main`; merge ke `main` otomatis men-deploy ke Vercel.
- Jangan commit `.env` atau kunci rahasia (terutama `service_role`). Hanya kunci publishable/anon yang boleh ada di frontend.
- Perubahan database = file migrasi baru di `supabase/migrations/` (jangan ubah migrasi lama).
