# dip-feedback

Şirket-geneli, self-hosted **görsel geri bildirim hub'ı**. Tek dashboard, çok proje.
Widget her uygulamaya/web sitesine düşer; feedback tek merkezde toplanır. GitHub'a bağımlı değil.

## Parçalar
- **`api/`** — Fastify + Postgres. Feedback alır/saklar/servis eder.
- **`widget/`** — framework-agnostic (vanilla TS) gömülebilir widget. Screenshot + annotation + yorum → API.
- **`dashboard/`** — Vue 3 + Vite. Tüm projelerin feedback'ini listele/triage et.

## Hızlı başlangıç (Docker)
```bash
docker compose up --build
# api:       http://localhost:4000
# dashboard: http://localhost:4173
# postgres:  localhost:5433
```
Şema ilk açılışta otomatik uygulanır ve örnek projeler (`metaworks`, `app2`) eklenir.

## Bir uygulamaya widget ekleme (staging/dev'de)
```html
<script
  src="http://localhost:4000/widget.js"
  data-project="metaworks"
  data-api="http://localhost:4000"
  data-env="staging"
  defer
></script>
```
- `data-project` — proje anahtarı (API'de tanımlı olmalı).
- `data-env` — sadece `dev`/`staging`'de yüklenir; `production`'da hiç çalışmaz.

## İki mod
Dashboard ve widget **dual-mode** çalışır:
- **Yerel / self-host:** yukarıdaki Docker stack (Fastify API + Postgres). Widget `data-api`, dashboard `VITE_API_URL` kullanır. Auth yok.
- **Bulut / ücretsiz (Supabase):** Node API'siz. Widget doğrudan Supabase'e yazar, dashboard Supabase'ten okur (giriş gerektirir). Widget `data-supabase`+`data-anon`, dashboard `VITE_SUPABASE_URL`+`VITE_SUPABASE_ANON_KEY` kullanır.

**Ücretsiz yayınlamak için:** `supabase/SETUP.md` (Supabase projesi + `schema.sql` + Cloudflare Pages). Kod aynı; sadece env değişir.

## Yeni proje ekleme (no-code)
```sql
INSERT INTO projects (key, name) VALUES ('websitex', 'Web Site X');
```

## Geliştirme (Docker'sız)
Her alt klasörde `npm install`. Postgres için `DATABASE_URL` ver. Bkz. alt README'ler.
