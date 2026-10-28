# Consensia

Prywatna platforma organizacji: artykuły + uchwały z głosowaniem. Next.js 16 (App Router), Auth.js v5, Prisma 7 + PostgreSQL, next-intl (en / pl / es / fr), Tailwind 4 + shadcn/ui.

## Wymagania

- **Node.js ≥ 22.12** (Prisma 7 i Next 16 tego wymagają)
- PostgreSQL 14+ (z rozszerzeniem `pg_trgm` — jest w standardowej instalacji; testowane na 18)

## Pierwsze uruchomienie (lokalnie)

```bash
npm install
cp .env.example .env          # uzupełnij DATABASE_URL i AUTH_SECRET (npx auth secret)
npm run db:deploy             # tworzy tabele, triggery i ograniczenia
npm run db:seed               # pierwsze konto ADMIN z SEED_ADMIN_* w .env
npm run dev                   # http://localhost:3000
```

Bez `RESEND_API_KEY` e-maile (weryfikacja, reset hasła, powiadomienia) są wypisywane w konsoli serwera — wystarczy skopiować link.

`SEED_DEMO_CONTENT="true"` w `.env` dodaje przy `db:seed` przykładowe artykuły i uchwały (tylko do pustych tabel).

## Moduły

- **Artykuły** — strona główna: wyszukiwanie po tytule (z opóźnieniem), sortowanie, filtr dat (w strefie `APP_TIME_ZONE`), paginacja. Strona artykułu z obrazem, treścią i stopką. Brak tłumaczenia → wersja angielska (lub inna) z informacją.
- **CMS artykułów** (`/admin/articles`, tylko ADMIN) — tworzenie, edycja, usuwanie; edytor Tiptap; zakładki językowe; obraz z adresu https:// lub wgrany plik.
- **Pliki** — wgrywane do `UPLOAD_DIR` (poza `/public`), serwowane tylko zalogowanym. Na hostingu serverless podmień `src/lib/storage.ts` na S3/R2/Blob.
- **Uchwały i głosowanie** (`/resolutions`) — lista (trwa / zakończone), strona uchwały z paskiem stanu, kartą do głosowania (wybór + potwierdzenie) i wynikami na żywo z frekwencją po oddaniu głosu. Wyniki są liczone na serwerze tylko dla osób, które już głosowały (lub po zamknięciu).
- **Panel moderatora** (`/admin/resolutions`, MODERATOR i ADMIN) — szkice z opcjami w 4 językach, otwieranie, zamykanie, usuwanie szkiców. Po otwarciu treść, opcje i termin są zablokowane także w bazie (triggery). Otwarcie głosowania wysyła e-mail do członków, którzy mają włączone powiadomienia.
- **Członkowie** (`/admin/users`, tylko ADMIN) — lista z wyszukiwaniem i filtrami, nadawanie ról (z potwierdzeniem), blokowanie i odblokowywanie kont. Zablokowanie wylogowuje ze wszystkich urządzeń. Baza nie pozwala usunąć ani zablokować ostatniego aktywnego administratora.
- **Dziennik zmian** (`/admin/audit`, tylko ADMIN) — kto, co i kiedy: role, blokady, hasła, e-maile, artykuły, uchwały (także automatyczne zamknięcie po terminie). Wpisów nie da się zmienić ani usunąć (trigger).
- **Konto** (`/account`, każdy) — imię, język e-maili, powiadomienia o uchwałach, zmiana hasła (wylogowuje inne urządzenia), zmiana e-maila (link na nowy adres + powiadomienie na stary), wylogowanie innych urządzeń.

## Wdrożenie (VPS + Docker)

Obraz i cały zestaw są w repozytorium: `Dockerfile`, `docker-compose.yml`, `deploy/Caddyfile`. Caddy sam pobiera certyfikat HTTPS.

1. Serwer z Dockerem, domena z rekordem A/AAAA wskazującym na serwer, otwarte porty 80 i 443.
2. `cp .env.example .env.production` i uzupełnij:
   - `DOMAIN` (np. `glosowania.twojawspolnota.pl`), `APP_URL=https://<DOMAIN>`
   - `POSTGRES_PASSWORD` (losowe), `AUTH_SECRET` i `CRON_SECRET` (`openssl rand -base64 33`)
   - `RESEND_API_KEY` i `EMAIL_FROM` z **zweryfikowaną domeną** w Resend
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME`, `SEED_DEMO_CONTENT=false`
   - `DATABASE_URL` może zostać przykładowy — compose podmienia go na bazę z kontenera
3. Start i pierwsze konto:
   ```bash
   docker compose --env-file .env.production up -d --build
   docker compose --env-file .env.production run --rm migrate npm run db:seed
   ```
4. Aktualizacja: `git pull && docker compose --env-file .env.production up -d --build` (migracje wykonują się same przed startem aplikacji).

Kopie zapasowe: wolumeny `pgdata` (baza) i `uploads` (obrazy), np. `docker compose exec db pg_dump -U consensia consensia > backup.sql`.

**Inny hosting.** Aplikacja musi stać za jednym zaufanym reverse proxy, które nadpisuje `X-Real-IP` (albo dopisuje `X-Forwarded-For`) — na tym opierają się limity prób z adresu IP. Na Vercelu działa to od razu, ale pliki trzeba przenieść na S3/R2/Blob (`src/lib/storage.ts`), a zadanie porządkowe ustawić w Vercel Cron (`GET /api/cron/maintenance`, nagłówek `Authorization: Bearer $CRON_SECRET` jest dodawany automatycznie).

## Utrzymanie

- `GET /api/health` — stan aplikacji i bazy (dla load balancera / Dockera).
- `GET|POST /api/cron/maintenance` z `Authorization: Bearer $CRON_SECRET` — co godzinę (w Dockerze robi to usługa `cron`): zamyka uchwały po terminie, usuwa wygasłe sesje i linki, niepotwierdzone rejestracje starsze niż 7 dni oraz osierocone pliki starsze niż doba.

## Testy

```bash
npm test                      # testy jednostkowe (schematy, strefy czasowe, przekierowania, katalogi tłumaczeń, …)
# reguły bazy (triggery, ograniczenia) — na OSOBNEJ bazie z "test" w nazwie; tabele są czyszczone:
DATABASE_URL=postgresql://…/consensia_test npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://…/consensia_test npm run test:db
```

CI (`.github/workflows/ci.yml`): typecheck, migracje, wszystkie testy (z PostgreSQL 18) i build przy każdym pushu.

## Projektowanie (Impeccable)

Projekt używa skilla [Impeccable](https://github.com/pbakaus/impeccable) (`.claude/skills/impeccable`, zainstalowany bez automatycznego hooka). Kontekst: `PRODUCT.md` (produkt), `DESIGN.md` (system wizualny „Sala zebrań”), `.impeccable/` (briefy ekranów, zrzuty z przeglądu). Hook detektora można włączyć poleceniem `/impeccable hooks on`.

## Skrypty

| Skrypt | Opis |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript (strict) |
| `npm test` / `test:watch` / `test:db` | Vitest |
| `npm run db:migrate` | nowa migracja po zmianie `schema.prisma` |
| `npm run db:deploy` | zastosowanie migracji (produkcja) |
| `npm run db:seed` | konto ADMIN (+ dane demo) |
| `npm run db:studio` | podgląd bazy |

## Architektura bezpieczeństwa (skrót)

- **Walled garden**: `src/proxy.ts` przekierowuje każde żądanie bez cookie sesji na logowanie (deny-by-default). Publiczne są tylko strony logowania/rejestracji, Auth.js, `/api/health` i `/api/cron` (chroniony sekretem).
- **Autorytatywna kontrola**: `verifySession()` / `requireRole()` w `src/lib/dal.ts` — wywoływać w każdej stronie, zapytaniu i Server Action.
- **Sesje w bazie danych** (odwoływalne): wylogowanie, reset i zmiana hasła, blokada konta usuwają wiersze z `sessions`.
- **Hasła**: argon2id; blokada konta po 5 błędnych próbach (15 min) + limity z adresu IP (logowanie, rejestracja, e-maile, linki, wgrywanie plików) w tabeli `rate_limits`.
- **CSP** z nonce na każde żądanie (`src/proxy.ts`), `frame-ancestors 'none'`, HSTS w Caddy, `X-Robots-Tag: noindex`.
- **Głosowanie** egzekwowane w bazie: jeden głos na osobę (`UNIQUE`), głosy niezmienne (trigger), głos tylko przy statusie `ACTIVE` i przed terminem (trigger z blokadą wiersza), opcja musi należeć do uchwały (złożony klucz obcy).
- **Dziennik zmian** tylko do dopisywania, **ostatni administrator** chroniony triggerem (z blokadą doradczą przeciw wyścigom).
