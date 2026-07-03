Продолжаем platform-api (Cloudflare Workers + Hono + Drizzle ORM + D1, три независимые облачные БД: job-tracker-db, health-monitor-db, auth-db — только `--remote`, никакого локального D1).

Все правила процесса — в CLAUDE.md (корень репо, подхватывается автоматически). Вся техническая история и решения — в `docs/plans/v1-plan.md`, `v2-plan.md`, `v3-plan.md` (там же — полный лог Decisions #1–22 для V3). Эти файлы (плюс сам этот саммари) — всё, что реально нужно для контекста перед стартом.

---

## Статус

**V1** (Job Tracker + Health Monitor, без авторизации), **V2** (аутентификация, single-tenant, JWT) и **V3** (Google Sign-In, OpenAPI, Swagger UI, DX-улучшения, мониторинг) — **все три версии полностью реализованы, задеплоены, покрыты тестами, прошли code review**. Прод: https://platform-api.nick-burdo.workers.dev.

Текущий прод: **Version ID `e08b5dd4-93b0-4796-9814-fda3a156896c`**, коммит `1a126de`. Документация синхронизирована коммитом `56053c0`.

Активного v4-плана нет — `docs/roadmap.md`'s "Future Versions" содержит только нереализованный бэклог идей (PostgreSQL, Redis, Cloudflare Queues/R2, background jobs, full-text search, rate limiting, API versioning, webhooks, audit log), которые "should only be implemented when justified by real requirements" — ничего из этого не запланировано и не обсуждалось.

### Section 1 — Google Sign-In (готово, задеплоено)

- `GET /auth/google` (редирект на Google, signed CSRF `state`), `GET /auth/google/callback` (обмен кода, поиск по email в `auth-db`, выдача обычного JWT — неотличим от password-логина)
- Новые файлы: `src/utils/oauth-state.ts`, `src/services/google-oauth.service.ts`, `loginWithGoogle()` в `auth.service.ts`
- Ключевая деталь: `redirect_uri` вычисляется из `c.req.url`, а не из конфига — потому что `wrangler dev --remote` резолвит origin как прод (нет отдельного custom domain), так что реальная проверка Google-флоу возможна только через деплой (Decision #20)
- Секреты `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` уже установлены пользователем и в `.dev.vars`, и через `wrangler secret put`
- Пользователь лично прошёл живой Google-консент на проде — редирект и логин подтверждены
- Код-ревью нашло и починили: проглоченная ошибка exchangeGoogleCode без логирования, отсутствующий 400 в OpenAPI-спеке, `api.md` не отражал точные 401-сообщения/verified_email-правило

### Section 2 — OpenAPI (готово, задеплоено)

- `src/openapi/registry.ts` — реестр всех ~24 эндпоинтов (Health, Job Tracker, Health Monitor, Auth), обёрнутых `.openapi()` метаданными; схемы из `src/schemas/*` не трогаются, только оборачиваются
- `src/openapi/extend-zod.ts` — обязательно первый импорт в registry.ts (Zod v4 не патчит уже созданные схемы задним числом — если бы `extendZodWithOpenApi` вызывался после импорта схем, `.openapi()` бы не заработал)
- `scripts/generate-openapi.ts` → `src/openapi/openapi.json` (генерируется, коммитится; `npm run openapi:generate` = generate + redocly lint)
- Все request-схемы (create/update/query) обёрнуты `.openapi()` и зарегистрированы как компоненты — это было упущено в первом проходе и починено по код-ревью
- Табличный рефакторинг для 4 Health Monitor ресурсов вместо 12 дублирующихся `registerPath()`
- ADR-011 (`decisions.md`) промоутнут из Planned в Accepted при финальном doc-sync

### Section 3 — Swagger UI на `/docs` (готово, задеплоено)

- `src/routes/docs.routes.ts`: `GET /docs` (swaggerUI, версия зафиксирована `5.32.8`) + `GET /openapi.json` (спека, предсериализована один раз при старте, не на каждый запрос)
- Decision #18: спека отдаётся отдельным публичным роутом (`url`), а не встроена в `/docs` (`spec`) — так ожидают внешние тулы (codegen, Postman)
- Живая проверка через Playwright: группировка по тегам, Authorize-диалог, гостевой доступ без токена — всё ок

### Section 4 — Developer Experience (готово, задеплоено)

- Заменены технические Zod-дефолты ("Too small...", "Invalid input: expected int...") на человеческие сообщения по всем схемам
- **Важный найденный и починенный баг**: `.min(1, msg)`-конструкции ловили сообщение только для пустой строки, а полностью отсутствующий ключ давал сырой Zod-жаргон — самый частый случай "забыл поле". Починено добавлением сообщения на базовый тип-вызов (`z.string(msg).min(1, msg)`), включая `measuredAt`/`happenedAt`/`email` (у которых сообщение для некорректного значения намеренно осталось дефолтным Zod, но для отсутствующего ключа тоже была та же дыра)
- Добавлен generic regression test `src/schemas/no-raw-zod-messages.test.ts` — парсит `{}` против каждой create-схемы, ловит будущие поля без сообщения автоматически
- `api.md` дополнен секциями `### Errors` (400/401/404) по каждому ресурсу
- Найдена и **осознанно оставлена** несогласованность `notes` (JobApplication) vs `note` (Health Monitor) — задокументирована в `models.md`, ренейм = breaking change, вне скоупа DX-прохода

### Section 5 — Monitoring (готово, задеплоено)

- `src/middleware/logging.ts` — `requestLogger` теперь пишет одну JSON-строку на запрос (`requestId`, `method`, `path`, `status`, `durationMs`) вместо текстовой строки V1; `crypto.randomUUID()` генерируется один раз на запрос, кладётся в `c.set('requestId', ...)` и возвращается через `X-Request-Id` response header на каждый ответ (Decision #12)
- `src/middleware/error.ts` — необработанные 500-ки логируются с тем же `requestId` для корреляции клиент↔сервер-лог; клиенту по-прежнему уходит только generic `Internal server error`
- Код-ревью (8 углов) нашло 2 PLAUSIBLE finding'а, оба починены: (1) `c.get('requestId')` мог тихо вернуться `undefined` при нарушении порядка middleware, а `JSON.stringify` молча выкидывал ключ — теперь fallback на `'unknown'`; (2) дублирование `{requestId, method, path}` между двумя файлами — вынесено в общий `requestLogContext()` в `logging.ts`
- Живая проверка на проде: `X-Request-Id` присутствует на 200/404/400, структурированные логи видны в Cloudflare Observability (вкладка в дашборде переименована из "Logs" в "Observability")
- Пользователь лично подтвердил в Cloudflare Dashboard: Analytics и D1 Metrics видны для всех трёх БД

### Section 6 — Testing (закрыто без нового кода)

Все пункты чек-листа уже были покрыты по ходу предыдущих секций — формально сверено и отмечено в `v3-plan.md`:
- Google OAuth (matching/non-matching email) — покрыто тестами `resolveGoogleCallback` в `auth.routes.test.ts` + живым Google-консентом пользователя на проде
- OpenAPI lint-clean — `npm run openapi:lint` проходит ("valid", 28 не блокирующих warning'ов)
- Swagger UI — живая Playwright-проверка из Section 3, `/docs` и `/openapi.json` пере-проверены на проде после деплоя Section 5
- Мониторинг — подтверждено пользователем в дашборде

### Section 7 — Documentation (готово)

- `decisions.md`: ADR-011 → Accepted; ADR-013 (Google login single-tenant) уже существовал с doc-first прохода Section 1, новый ADR не понадобился
- `deployment.md`: инструкции по мониторингу и все три БД были написаны doc-first ещё до кода (Decision #13) — сверено с реализацией, изменений не потребовалось
- `roadmap.md`: все чекбоксы Version 3 отмечены выполненными, добавлена строка про no-version-prefix decision (#5)

---

## Что дальше

V3 полностью закрыта. Активного плана на V4 нет и не обсуждался — следующий шаг только если появится новая задача/версия, которую нужно будет сначала спланировать (`docs/plans/v4-plan.md`) и обсудить по процессу из CLAUDE.md, прежде чем писать код.

---

## Процесс (важно помнить)

- Максимальная декомпозиция, ничего не менять без обсуждения спорных моментов, план не патчится молча — по каждому неочевидному техническому решению при реализации добавляется новый пронумерованный Decision в план версии
- После каждой секции: `/code-review` (skill, high effort, 8 агентов-искателей + верификация) → фикс confirmed/plausible находок → отдельный `fix:`-коммит → **деплой только по явному запросу пользователя** (расплывчатое "продолжай"/"go" не триггерит деплой, нужно явное "deploy"/"деплой")
- Каждый коммит проверяется полным набором: `npm run typecheck && npm run lint && npm run test:unit && npm run test:repo`, плюс `npm run openapi:generate` если тронуты схемы/роуты
- Живая проверка (`wrangler dev --remote` и/или прод после деплоя) обязательна для UI/route-изменений — curl и/или Playwright
- `feat:` и связанный `fix:` код-ревью коммит — отдельные коммиты (не амендить), как и `docs:`-коммит для синхронизации документации после реализации
