# Настройка Google Cloud Console для Google Sign-In (V3)

> Это инструкция для ручного, одноразового шага, который блокирует Section 1 из `docs/plans/v3-plan.md` (Google Authentication). Выполняется один раз владельцем аккаунта — я (ассистент) не могу сделать это за вас, так как требуется доступ к вашему Google-аккаунту.
>
> Результат этой инструкции — два значения: `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`. Их нужно будет передать так же, как передавался `JWT_SECRET` в V2 — через `wrangler secret put` для продакшена и `.dev.vars` для локальной разработки (детали — в `docs/deployment.md`, раздел «Google Authentication Setup»).

---

## 1. Открыть Google Cloud Console

Перейдите на **https://console.cloud.google.com/**

Войдите тем Google-аккаунтом, который будет единственным admin-аккаунтом платформы (тем же email, что уже сохранён в `auth-db` через `scripts/create-admin.ts` — Google-логин будет сверяться именно с ним).

---

## 2. Создать или выбрать проект

Наверху страницы, рядом с логотипом Google Cloud, есть выпадающий список проектов.

- Если проекта для этой платформы ещё нет — **Новый проект** (New Project). Имя произвольное, например `platform-api`. Организацию/биллинг можно не привязывать — OAuth-клиенты и consent screen бесплатны и не требуют billing account.
- Если проект уже есть — просто выберите его.

Дождитесь, пока вверху страницы не подтвердится, что выбран нужный проект (это важно — следующие шаги применяются к текущему выбранному проекту).

---

## 3. Настроить OAuth consent screen

Это экран, который увидит браузер при переходе на `/auth/google` — то, что Google показывает пользователю перед тем, как отдать доступ.

Путь в интерфейсе: **APIs & Services → OAuth consent screen** (или прямая ссылка **https://console.cloud.google.com/apis/credentials/consent** — на неё нужно попасть уже с выбранным на шаге 2 проектом).

### 3.1 User Type

- **External** — если это обычный личный Google-аккаунт (gmail.com и т.п.). Это почти наверняка ваш случай.
- **Internal** — доступно только если аккаунт состоит в Google Workspace-организации. Проще (не нужен режим Testing/verification), но нерелевантно для личного gmail-аккаунта.

Выбирайте **External**, если не уверены.

### 3.2 App information

- **App name** — любое, например `Platform API`. Это то, что увидит пользователь на экране согласия ("Platform API wants to access your Google Account").
- **User support email** — ваш email.
- **App logo** — необязательно, можно пропустить.

### 3.3 Scopes

Нажмите **Add or remove scopes** и добавьте ровно два non-sensitive scope (per `v3-plan.md` Decision #9 — минимальный scope, без `profile`):

- `openid`
- `.../auth/userinfo.email` (соответствует `email`)

Больше ничего добавлять не нужно — коду для сверки аккаунта достаточно email.

### 3.4 Test users

Пока приложение в статусе **Testing** (а не **In production**), войти через него смогут только явно добавленные test users.

- Нажмите **Add users** и добавьте свой же Google-аккаунт (тот, что будет логиниться).
- **Оставаться в режиме Testing — это нормально и рекомендуется** для одноразового personal-приложения: режим Testing не требует прохождения verification review от Google (который обязателен для публикации с sensitive/restricted scopes или при желании убрать лимит в 100 test users). Раз пользователь платформы — только вы, публиковать приложение (In production) не нужно.
- Единственное следствие режима Testing: OAuth refresh token (если бы использовался) истекал бы через 7 дней — но в этом проекте refresh token вообще не используется (Decision #4 из `v2-plan.md`: только access-токен, без refresh), так что это ограничение не имеет значения.

Сохраните экран (**Save and Continue** на всех шагах мастера).

---

## 4. Создать OAuth 2.0 Client ID

Путь: **APIs & Services → Credentials** (или **https://console.cloud.google.com/apis/credentials**) → **Create Credentials → OAuth client ID**.

- **Application type**: **Web application**
- **Name**: произвольное, например `Platform API Web Client`
- **Authorized JavaScript origins** — **оставить пустым**. Это поле нужно только если браузер сам, из JS-кода, обращается к Google (Google Identity Services SDK, кнопка «Sign in with Google», One Tap и т.п.). В этом проекте flow другой (Decision #7 в `v3-plan.md`): браузер просто переходит обычным редиректом на `GET /auth/google`, сервер отвечает 302 на страницу согласия Google, а обмен кода на токен — это server-to-server `fetch` с бэкенда. Ни один запрос к Google не идёт из JS в браузере, так что CORS-whitelist через это поле не применяется.
- **Authorized redirect URIs** — добавить **оба** адреса на этот же клиент (Google поддерживает несколько redirect URI на одном клиенте, per `v3-plan.md` Decision #13):
  - `https://platform-api.nick-burdo.workers.dev/auth/google/callback` (продакшен)
  - `http://127.0.0.1:8787/auth/google/callback` (локальная разработка через `wrangler dev --remote`)

Нажмите **Create**.

---

## 5. Скопировать Client ID и Client Secret

После создания Google покажет модальное окно с двумя значениями:

- **Client ID** — не секрет, но всё равно не стоит светить его без необходимости
- **Client Secret** — это настоящий секрет, обращайтесь с ним как с `JWT_SECRET`: никогда не коммитить, не вставлять в чаты/issue-трекеры

Их всегда можно посмотреть заново на странице **Credentials**, кликнув на созданный OAuth-клиент.

---

## 6. Передать значения в проект

Как только оба значения есть — не нужно присылать их мне в сессию (по той же причине, по которой пароль admin-аккаунта в V2 вводился только в вашем терминале). Установите их сами:

**Продакшен** (аналогично тому, как был установлен `JWT_SECRET`):

```powershell
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

(команда спросит значение интерактивно — ничего не попадёт в историю терминала).

**Локальная разработка** — добавить в `.dev.vars` (файл в `.gitignore`, рядом с уже существующим `JWT_SECRET`):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Когда это готово

Как только `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` установлены (хотя бы в `.dev.vars` для начала разработки) — можно начинать Section 1 из `v3-plan.md`. Код ещё не написан; сама фича появится только после реализации:

- `src/utils/oauth-state.ts`
- `src/services/google-oauth.service.ts`
- дополнения в `src/routes/auth.routes.ts` (`GET /auth/google`, `GET /auth/google/callback`)

До этого момента наличие Client ID/Secret просто разблокирует старт работы — само приложение их ещё нигде не использует.
