Продолжаем platform-api (Cloudflare Workers + Hono + Drizzle ORM + D1, три независимые облачные БД: job-tracker-db, health-monitor-db, auth-db — только `--remote`, никакого локального D1).

Все правила процесса — в CLAUDE.md (корень репо, подхватывается автоматически). Вся техническая история и решения — в `docs/plans/v1-plan.md` … `v4.3-plan.md` (в каждом — свой лог Decisions). Спека V4 — `docs/superpowers/specs/2026-11-06-v4-multi-user-auth-design.md`. Эти файлы (плюс сам этот саммари) — всё, что реально нужно для контекста перед стартом.

---

## Статус

**V1** (Job Tracker + Health Monitor), **V2** (JWT-аутентификация), **V3** (Google Sign-In, OpenAPI, Swagger UI, DX, мониторинг) и **V4** (открытая многопользовательская модель) — **все реализованы, задеплоены, покрыты тестами, прошли review**. Прод: https://platform-api.nick-burdo.workers.dev.

Текущий прод: **Version ID `cb138a87-b65a-40c2-a9aa-305c58d8a85f`** (V4.3 — глюкоза в mmol/L, задеплоен 2026-11-09). Ранее: V4.2 `af170344-990d-41c8-8139-1a8d1d58fff1` (ежедневный сдвиг демо-дат Health Monitor, 2026-11-08), V4.1 `19a15177-132f-49ae-907d-6a1b2eef4ffa` (страница `/privacy`), V4 `6987b8fd-842a-4e4b-95fd-9609ca7cb115`. Точки отката (V3 version ID + Time Travel bookmarks трёх БД) записаны в `v4-plan.md`, Task 9.

## Version 4 — что изменилось (ADR-014)

- **Гость** (нет токена) видит только демо-данные (`user_id IS NULL`), любая запись → `401 Authentication required`.
- **Регистрация** `POST /auth/register` — username + password, **без email** (email нигде не хранится и не запрашивается). Логин — `POST /auth/login` или Google.
- **Google** — scope только `openid`, аккаунт ищется/создаётся по `sub` (автологин вида `user-xxxxxx`); токен уходит на фронтенд из allowlist (`ALLOWED_FRONTEND_ORIGINS` в `wrangler.jsonc` + любой localhost/127.0.0.1) во фрагменте `#token=`.
- **Данные per-user** — колонка `user_id` во всех бизнес-таблицах вместо `is_demo`; ролей и админа больше нет.
- **`DELETE /auth/me`** — удаляет аккаунт со всеми данными; старый токен → `401`.
- **Привязка в обе стороны**: Google к паролю — двухшагово (`POST /auth/google/link` → `#link_ticket=` → `POST /auth/google/link/complete`, защита от CSRF); пароль к Google-аккаунту — `POST /auth/me/password`.
- Памятки для фронтенда: `docs/frontend-guide.md` (включая обязательное правило nonce для callback-страниц) и `docs/connecting-a-frontend.md`.
- Перед деплоем V4 прошла **staging-репетиция** (Task 8c): копии прод-БД в облаке, миграции, живые проверки, Google в браузере.

## Version 4.2 и 4.3

- **V4.2 (ADR-015):** Cron Trigger `0 0 * * *` сдвигает все даты демо-строк Health Monitor на целое число прошедших суток; состояние — `demo_refresh_state` в `health-monitor-db`, его пишет `seed.sql` (первым оператором). Откат: сначала `"crons": []` + `wrangler triggers deploy`, потом `wrangler rollback` — триггеры не версионируются. **Открыто:** шаг 6.6 (живая проверка после первого реального сдвига 2026-11-10 00:00 UTC) и закрытие v4.2.
- **V4.3:** глюкоза в mmol/L (mg/dL ÷ 18, 1 знак); единица в `models.md`, `api.md`, OpenAPI. Прод сконвертирован разовым `UPDATE` без пересида, чтобы не сбросить состояние сдвига дат.

## Практические заметки

- `npm run dev` (`wrangler dev --remote`) работает на **прод-базах**, и Google Sign-In в этом режиме локально **не работает** (хост подменяется на превью `*.workers.dev`). Для локального Google — `npx wrangler dev` с копией конфига, где у D1-биндингов `"remote": true` (см. `development.md`).
- После остановки `wrangler dev` из инструмента на Windows может остаться `workerd.exe` на порту 8787 — убить перед перезапуском.
- Wrangler авторизован через OAuth (`wrangler login`), токен в `.env` не нужен; `.env` в `.gitignore`.
- Google Cloud Console: приложение опубликовано (In production), scopes пустые (код запрашивает только `openid`), в Branding home page → `/docs`, privacy policy → `/privacy` (v4.1).

## Что дальше

V4 закрыта. Возможные следующие шаги (не запланированы, требуют обсуждения и плана по CLAUDE.md):
- `verifyToken` может дополнительно отвергать JWT с claim `purpose` (defense in depth; сейчас путаница токенов невозможна и закреплена тестами);
- бэклог `roadmap.md` → "Future Versions" (PostgreSQL, Redis, Queues/R2, rate limiting и т.д.) — только при реальной потребности.

---

## Процесс (важно помнить)

- Максимальная декомпозиция, ничего не менять без обсуждения спорных моментов, план не патчится молча — каждое неочевидное решение — новый пронумерованный Decision в плане версии; ревизии плана — только с одобрения.
- Реализация V4 шла через subagent-driven development: implementer + task review на каждую задачу, финальное whole-branch review; рабочая папка `.superpowers/sdd/` (git-ignored).
- **Деплой только по явному «deploy»/«деплой»** от пользователя.
- Каждый коммит проверяется: `npm run typecheck && npm run lint && npm run test:unit && npm run test:repo`, плюс `npm run openapi:generate`, если тронуты схемы/роуты.
- Коммиты не амендятся; `feat:`, `fix:` и `docs:` — отдельными коммитами.
