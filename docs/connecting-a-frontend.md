# Connecting a Frontend

> How to allow a new frontend application to use Platform API, including Google Sign-In.
>
> For how a frontend should behave once connected (guest prompts, error handling, Google flow) see `frontend-guide.md`.

---

# What Needs Allowing

Platform API accepts requests from any origin (CORS is open: `Access-Control-Allow-Origin: *`, authentication is a `Bearer` header, not cookies). Plain API calls therefore work from a new frontend immediately.

The only thing that is restricted is **where Google Sign-In may send the browser back to**. The API will redirect a login token only to an origin on the allowlist — otherwise a crafted link could deliver a token to a foreign site. A new frontend that wants Google Sign-In (or Google linking) must therefore be added to the allowlist.

---

# Where the Allowlist Lives

In `wrangler.jsonc`, under `vars`:

```jsonc
"vars": {
  "ALLOWED_FRONTEND_ORIGINS": "https://health-monitor-new.pages.dev,https://job-tracker-new.pages.dev"
}
```

It is a single comma-separated string. The current entries are the two existing frontends.

---

# Origin Format

Each entry is an **origin**: scheme + host + (optional) port. **No path, no query, no trailing slash.**

| Entry | Valid? |
|-------|--------|
| `https://my-app.pages.dev` | yes |
| `https://app.example.com` | yes |
| `https://app.example.com:8443` | yes (explicit port) |
| `https://my-app.pages.dev/` | no — trailing slash |
| `https://my-app.pages.dev/app` | no — path |
| `my-app.pages.dev` | no — scheme is required |

The redirect that a frontend passes to `GET /auth/google?redirect=<url>` is matched by **origin**: its scheme, host and port must equal an allowed origin exactly, so `https://my-app.pages.dev/auth/callback` is accepted when `https://my-app.pages.dev` is on the list, while `http://my-app.pages.dev/...` (a scheme downgrade) and `https://my-app.pages.dev.evil.com/...` are rejected. The redirect URL must not contain a `#`.

---

# Already Allowed: Localhost

You do not need to add anything for local development. These are always allowed, on **any port**:

- `http://localhost:<port>` and `https://localhost:<port>`
- `http://127.0.0.1:<port>` and `https://127.0.0.1:<port>`

For example `http://localhost:5173/auth/callback` works out of the box.

---

# Steps to Add a Frontend

1. **Edit `wrangler.jsonc`:** append the frontend's origin to `ALLOWED_FRONTEND_ORIGINS`, separated by a comma, following the format above:

   ```jsonc
   "ALLOWED_FRONTEND_ORIGINS": "https://health-monitor-new.pages.dev,https://job-tracker-new.pages.dev,https://my-new-app.pages.dev"
   ```

2. **Deploy the Worker:**

   ```bash
   npx wrangler deploy
   ```

   The allowlist is read from the deployed configuration, so the change takes effect only after the deploy.

3. **Verify** by opening, in a browser, a Google start URL whose `redirect` is a page of the new frontend:

   ```text
   https://platform-api.nick-burdo.workers.dev/auth/google?redirect=https://my-new-app.pages.dev/auth/callback
   ```

   - Allowed: the browser is redirected to Google's sign-in/consent screen.
   - Not allowed: the API answers `400` with `{"error":{"message":"redirect must be an allowed frontend URL"}}` and does not redirect — recheck the origin spelling (scheme, host, port, no trailing slash) and that the deploy finished.

   You can stop at the Google screen; completing sign-in ends on `https://my-new-app.pages.dev/auth/callback#token=...`.

4. **Implement the frontend side** following `frontend-guide.md` (reading the `#token` / `#error` fragment, cleaning the address bar, error messages).

---

# Google Cloud Console: No Change

Google Cloud Console is **not touched** when a frontend is added. The only redirect URI registered there is the API's own callback (`https://platform-api.nick-burdo.workers.dev/auth/google/callback`), which does not change. The frontend's URL travels inside the API's signed `state` and is validated against the allowlist, not against Google's configuration.

---

# Checklist

- [ ] Origin appended to `ALLOWED_FRONTEND_ORIGINS` (scheme + host + port, no path, no trailing slash)
- [ ] `npx wrangler deploy` done
- [ ] `GET /auth/google?redirect=…` redirects to Google (not `400`)
- [ ] Frontend follows `frontend-guide.md`
