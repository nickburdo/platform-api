# Настройка Google Cloud Console для Google Sign-In (V3, обновлено в V4)

> Это инструкция для ручного, одноразового шага, который блокирует Section 1 из `docs/plans/v3-plan.md` (Google Authentication). Выполняется один раз владельцем аккаунта — я (ассистент) не могу сделать это за вас, так как требуется доступ к вашему Google-аккаунту.
>
> **Что изменилось в V4** (ADR-014): платформа стала многопользовательской, Google-аккаунт больше не сверяется с email единственного администратора. Аккаунты ищутся и создаются по стабильному идентификатору Google (`sub`), поэтому нужен только scope `openid` (email не запрашивается и не хранится), а приложение должно быть **опубликовано (In production)** — иначе войти смогут только вручную добавленные test users. Если вы настраивали консоль под V3, пройдите шаги 3.3 и 3.4 заново.
>
> Результат этой инструкции — два значения: `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`. Их нужно будет передать так же, как передавался `JWT_SECRET` в V2 — через `wrangler secret put` для продакшена и `.dev.vars` для локальной разработки (детали — в `docs/deployment.md`, раздел «Google Authentication Setup»).

---

## 1. Открыть Google Cloud Console

Перейдите на **https://console.cloud.google.com/**

Войдите своим Google-аккаунтом — он владеет проектом в Cloud Console. Это не тот аккаунт, которым будут входить пользователи платформы: войти через Google сможет любой посетитель (после публикации приложения, см. шаг 3.4).

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

Нажмите **Add or remove scopes** и оставьте ровно один non-sensitive scope:

- `openid`

Scope `email` (`.../auth/userinfo.email`), который требовался в V3, нужно **удалить**: платформа не запрашивает и не хранит email (ADR-014). Идентификатор аккаунта (`sub`) приходит в `id_token` уже со scope `openid`. На экране согласия Google после этого не будет упоминания email.

### 3.4 Publish the app (In production)

Пока приложение в статусе **Testing**, войти через него смогут только явно добавленные test users (до 100). С V4 платформа открыта для любых посетителей двух фронтендов, поэтому режим Testing заблокировал бы всех, кроме вас. Приложение нужно **опубликовать**:

- На странице **OAuth consent screen** нажмите **Publish app** и подтвердите (статус станет **In production**).
- Verification review от Google при этом не ожидается: он обязателен для sensitive/restricted scopes, а `openid` — non-sensitive. Если консоль всё же покажет требование проверки или предупреждение — напишите об этом в сессию до деплоя.
- Test users после публикации больше не нужны.
- Refresh token в проекте не используется (Decision #4 из `v2-plan.md`), так что 7-дневное ограничение режима Testing никогда не было проблемой — причина публикации именно в доступе для всех посетителей.

Сохраните экран (**Save and Continue** на всех шагах мастера).

---

## 4. Создать OAuth 2.0 Client ID

Путь: **APIs & Services → Credentials** (или **https://console.cloud.google.com/apis/credentials**) → **Create Credentials → OAuth client ID**.

- **Application type**: **Web application**
- **Name**: произвольное, например `Platform API Web Client`
- **Authorized JavaScript origins** — **оставить пустым**. Это поле нужно только если браузер сам, из JS-кода, обращается к Google (Google Identity Services SDK, кнопка «Sign in with Google», One Tap и т.п.). В этом проекте flow другой (Decision #7 в `v3-plan.md`): браузер просто переходит обычным редиректом на `GET /auth/google`, сервер отвечает 302 на страницу согласия Google, а обмен кода на токен — это server-to-server `fetch` с бэкенда. Ни один запрос к Google не идёт из JS в браузере, так что CORS-whitelist через это поле не применяется.
- **Authorized redirect URIs** — добавить **оба** адреса на этот же клиент (Google поддерживает несколько redirect URI на одном клиенте, per `v3-plan.md` Decision #13):
  - `https://platform-api.nick-burdo.workers.dev/auth/google/callback` (продакшен)
  - `http://127.0.0.1:8787/auth/google/callback` (локальная разработка; работает только когда Worker запущен в локальном рантайме — `npx wrangler dev` с `"remote": true` на D1-биндингах. Под `npm run dev` (`wrangler dev --remote`) Worker видит адрес превью `*.workers.dev`, и вход через Google локально не работает — см. `development.md`, раздел про Google Sign-In)

Нажмите **Create**.

---

## 5. Скопировать Client ID и Client Secret

После создания Google покажет модальное окно с двумя значениями:

- **Client ID** — не секрет, но всё равно не стоит светить его без необходимости
- **Client Secret** — это настоящий секрет, обращайтесь с ним как с `JWT_SECRET`: никогда не коммитить, не вставлять в чаты/issue-трекеры

Их всегда можно посмотреть заново на странице **Credentials**, кликнув на созданный OAuth-клиент.

---

## 6. Передать значения в проект

Как только оба значения есть — не нужно присылать их мне в сессию (по той же причине, по которой любые секреты (как `JWT_SECRET`) вводятся только в вашем терминале). Установите их сами:

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

`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` установлены, scope — только `openid`, приложение опубликовано (In production). Redirect URI в консоли — это только адрес самого API (`/auth/google/callback`) и он не меняется.

Список фронтендов, на которые API может вернуть пользователя после входа, в Google Console **не** прописывается: он живёт в `ALLOWED_FRONTEND_ORIGINS` в `wrangler.jsonc` (см. `docs/connecting-a-frontend.md`).

Порядок деплоя V4, включая этот ручной шаг, — в `docs/deployment.md`, раздел «Version 4 Deployment Procedure».
