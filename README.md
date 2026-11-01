# bifrost-usage-dashboard

A lightweight, read-only, self-service dashboard for LLM Gateway usage. Built for Bifrost OSS, with encrypted personal access links, provider budget rules, ranked model usage, and a single Request Volume chart.

No database, user directory, password login, stored virtual-key secrets, or Enterprise subscription is required. English interface, responsive layout, accessible shadcn/ui components, and light/dark themes.

```text
Browser → Next.js backend → LLM Gateway management API
```

## Requirements

- Node.js 26.13.0 LTS and pnpm 12.16.1 (Docker is also supported).
- Bifrost OSS with governance, logging, and internal management Basic Auth enabled.
- A private backend connection to the management API; HTTPS for the public dashboard.

The verified upstream contract is Bifrost `transports/v1.6.11`, commit [`0a8a38c`](https://github.com/maximhq/bifrost/tree/0a8a38c983b7b932a3f7b4e85adeac08ad99b497). Other versions require checking their API contract. This independent project is not affiliated with the upstream vendor.

## Quick start

```bash
git clone https://github.com/arashfarahani/bifrost-usage-dashboard.git
cd bifrost-usage-dashboard
npm install --global pnpm@12.16.1
pnpm install --frozen-lockfile
cp .env.example .env
```

Generate two **different** encryption keys, running this command separately for each:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

Put them in `.env`, configure the private gateway address and management credentials, then run:

```bash
pnpm dev
```

Open `http://localhost:3000`. The dashboard requires a personal link generated below. Production never uses fixture data.

## Supported toolchain and dependency security

The release image and CI use Node.js **26.13.0 LTS** (`.node-version`) and pnpm **12.16.1**. Next.js **16.4.3** and React/React DOM **19.3.1** are the stable registry releases verified on November 1, 2026. Corepack is not bundled with Node 26, so the Docker build installs the pinned pnpm package directly. Use `.node-version` with your preferred local Node version manager; this repository does not change your system-wide Node installation.

TypeScript **6.0.3** and ESLint **9.39.5** are retained for declared plugin compatibility: the current TypeScript ESLint parser supports TypeScript `<6.1`, and the current React/JSX lint plugins support ESLint through 9. ESLint 9 is deprecated upstream; migrate to 10 when those plugins declare support, rather than suppressing incompatible peer requirements.

`minimatch` is overridden to the fixed **11.0.3** release throughout the graph. The tracked pnpm patch only restores its legacy callable CommonJS export for older lint plugins; matching logic and modern named exports remain unchanged. Regression tests exercise both APIs through the actual lint consumers. Keep `patches/` with the lockfile, and review/remove this compatibility patch when upstream plugins migrate.

The full `pnpm audit` (production and development dependencies) reports **zero known advisories** as of November 1, 2026. CI reruns the unfiltered audit before a release; no advisory IDs or severities are excluded. This is a dated dependency-audit result, not a guarantee against future advisories or a scan of operating-system packages. The narrowly pinned `lucide-react@1.66.0` release-age exception permits that requested new stable version; it does not exclude vulnerabilities from auditing.

## Configuration

| Variable | Purpose |
| --- | --- |
| `APP_NAME` | Runtime dashboard header, home-page name, and browser title; defaults to `bifrost-usage-dashboard`. No rebuild required. |
| `NEXT_PUBLIC_APP_NAME` | Legacy fallback when `APP_NAME` is unset or blank. Read dynamically on the server, so this app also supports changing it at runtime. Prefer `APP_NAME` for new deployments. |
| `APP_BASE_URL` | Dashboard origin, such as `http://localhost:3000` or `https://usage.example.com`. HTTPS required in production. |
| `APP_TIMEZONE` | IANA report timezone, default `Asia/Tehran`. Dates use the Gregorian calendar. |
| `BIFROST_BASE_URL` | Direct private management API origin, for example `http://gateway:8080`. No path, query, or embedded credentials. |
| `BIFROST_ADMIN_USERNAME` | Server-only OSS management Basic Auth username. |
| `BIFROST_ADMIN_PASSWORD` | Server-only management password. |
| `BIFROST_TIMEOUT_MS` | Per-request timeout, default 8000, allowed 100–15000 milliseconds. |
| `ACCESS_TOKEN_ENCRYPTION_KEY` | Base64url-encoded 32-byte access-link key. |
| `SESSION_ENCRYPTION_KEY` | Different base64url-encoded 32-byte session key. |
| `IMAGE_TAG` | Optional Compose image version, default `latest`. |

Never put a user's virtual-key secret in environment variables. `APP_NAME` is presentation only and does not alter token identity. Credentials are runtime configuration; image builds need no live gateway or secrets. `APP_NAME` takes precedence over the legacy `NEXT_PUBLIC_APP_NAME`. Both update the visible dashboard header and browser title.

### One image, different environments

Build or pull a release once. Each installation supplies its own environment at container creation:

```bash
docker run --env-file .env -p 127.0.0.1:3000:3000 \
  ghcr.io/arashfarahani/bifrost-usage-dashboard:latest
```

App configuration (name, public origin, timezone, gateway address and management credentials, encryption keys, timeout) is read on the server at runtime. Of these settings, only the app name and report timezone are passed to the UI; credentials remain server-only. No deployment-specific build arguments or frontend env bundle is required.

For example, set `APP_NAME="My Team Usage"` in each deployment's `.env`. Existing deployments may instead use `NEXT_PUBLIC_APP_NAME="My Team Usage"` with `APP_NAME` absent. This fallback is deliberately read through the server environment object to avoid Next.js public-variable build-time inlining. Other `NEXT_PUBLIC_*` variables do not gain this behavior automatically.

After changing container environment variables, recreate the container (`docker compose up -d --force-recreate --no-build`). A container restart alone does not reload Compose's env file. Rebuilding or releasing the app is unnecessary. Keep encryption keys stable within an installation to preserve its links across restarts.

## Management authentication

Merge the following into your **existing gateway configuration**, using its supported environment references:

```json
{
  "governance": {
    "auth_config": {
      "is_enabled": true,
      "admin_username": "env.BIFROST_ADMIN_USERNAME",
      "admin_password": "env.BIFROST_ADMIN_PASSWORD",
      "disable_auth_on_inference": true
    }
  }
}
```

Provide matching credentials to the gateway and this app. Keep inference virtual-key enforcement enabled (`client.enforce_auth_on_inference`); `disable_auth_on_inference` controls the additional management Basic Auth layer, not virtual-key authentication. This dashboard makes no inference requests and changes no gateway configuration.

Use the internal API address when a public management URL sits behind interactive SSO. Basic Auth does not authenticate an OAuth login page. The backend rejects redirects, preserves TLS certificate verification, and never forwards credentials to another host. Container hostnames resolve only on their Docker network. Use trusted private networking or HTTPS; do not expose the management port publicly.

## Create a personal access link

Find the **virtual key ID** in the gateway. A key name is never used for lookup or mapping.

```bash
pnpm link:create --name "Alex" --virtual-key-id "vk-example-id" --expires-in 30d
pnpm link:create --name "Alex" --virtual-key-id "vk-example-id" --expires-in 1y
pnpm link:create --name "Alex" --virtual-key-id "vk-example-id" --expires-in never
```

The default is 30 days. Durations support minutes (`m`), hours (`h`), days (`d`), and a year (`1y`, exactly 365 days); timed links may last at most 365 days. `never` explicitly creates a link without an expiration date. The CLI checks the key's existence, activation, and expiry before printing a link. It writes no user files.

The result looks like `https://usage.example.com/access#token=<JWE>`. The fragment is removed before the client POSTs the encrypted credential to the backend. The payload is authenticated with JWE `dir` / `A256GCM` and contains a display name and key ID, never a virtual-key secret. Permanent links require an explicit authenticated `neverExpires` claim; missing expiry alone is invalid.

Treat the complete link as a bearer credential. Share it privately. A permanent link remains valid until the gateway key becomes inactive/deleted/expired or the encryption key is rotated. A link cannot independently outlive the gateway key's validity.

To run the CLI on a private Docker network:

```bash
docker build --target cli -t bifrost-usage-cli .
docker run --rm --env-file .env --network YOUR_GATEWAY_NETWORK \
  -e BIFROST_BASE_URL=http://gateway:8080 \
  bifrost-usage-cli --name "Alex" --virtual-key-id "vk-example-id" --expires-in 1y
```

## Reporting behavior

- Budgets come **only from `virtual_key.provider_configs`**, including nested model budget rules. Key-wide, team, and customer budgets are excluded. Independent rules are selectable and never summed.
- Active override amounts increase the base limit. Expired cycle overrides are ignored. Remaining budget is clamped at zero; unknown or absent limits are never represented as a zero budget.
- Budget cards represent the **current budget cycle**, independent of the selected history period.
- The verified management response has no authoritative next-reset timestamp. The UI labels the first day of the next Gregorian month in `APP_TIMEZONE` as **Estimated**; the actual gateway reset may differ. This does not change gateway budgets.
- Historical cards show requests, input/output/total tokens, cost, attempt success, final user success after fallbacks, and average latency. All overview totals, success rates, and average latency use the scoped `/stats` response; nullable metadata in individual logs does not erase the total token count. Missing fields display a dash. No synthetic trends or comparison percentages are generated.
- p95 uses the nearest-rank percentile of verified log latencies, only when every selected row has latency metadata. It loads with model details after the overview; its population can differ from an upstream histogram's.
- Models are ranked by cost by default, with sorting and pagination. Like the gateway rankings, only completed attempts (`success`, `error`, `cancelled`) with a nonempty recorded model are ranked. Model-discovery requests (`list_models`) have no model name and do not become a synthetic `Unknown` model; they remain in overall request totals and Request Volume.
- The only chart is **Request Volume**, grouped daily, weekly, or monthly, with stacked Success/Error/Cancelled bars. The header legend lists these three statuses; the tooltip and text counts also include Total. The default reporting period is the **last 7 calendar days**, including today in `APP_TIMEZONE`, in both the dashboard and API. Filters include today, yesterday, 7/30 days, this/last month, and custom dates.

### Verified API boundary

The overview loads first using `GET /api/governance/virtual-keys/{id}` and `GET /api/logs/stats`. Then Request Volume uses `GET /api/logs/histogram`, while a separate request loads model details using `GET /api/logs`. Chart and model errors do not discard the overview. Histogram queries use one scoped query per selected calendar bucket with at most four in flight, because native UTC buckets cannot be split accurately across local calendar boundaries. Every history request supplies `virtual_key_ids` from the authenticated session and explicit date boundaries. The model-detail reader checks every returned row's key ID and timestamp, detects duplicate rows, compares pagination counts and before/after stats, and probes past the reported end to reject silently truncated data.

See the pinned upstream [governance handler](https://github.com/maximhq/bifrost/blob/0a8a38c983b7b932a3f7b4e85adeac08ad99b497/transports/bifrost-http/handlers/governance.go), [logging handler](https://github.com/maximhq/bifrost/blob/0a8a38c983b7b932a3f7b4e85adeac08ad99b497/transports/bifrost-http/handlers/logging.go), [log schemas](https://github.com/maximhq/bifrost/blob/0a8a38c983b7b932a3f7b4e85adeac08ad99b497/framework/logstore/tables.go), and [budget implementation](https://github.com/maximhq/bifrost/blob/0a8a38c983b7b932a3f7b4e85adeac08ad99b497/framework/configstore/tables/budget.go).

Quota endpoints requiring real virtual-key secrets are not used. Raw API responses can transiently contain secrets or content in backend memory; they are projected into allowlisted DTOs and never cached, logged, persisted, or returned to the browser. No prompts or model responses are shown.

Model-detail limits: 10,000 log rows, 200 rows per page, and a 25-second detail deadline. These limits do not restrict overview stats. All reports support up to 366 calendar days and cap each upstream response at 4 MiB. The chart also has a 25-second deadline. Narrow the date range or use weekly/monthly chart grouping for long periods. Concurrent inserts, stale materialized totals, missing endpoints, or incompatible schemas disable only the affected section rather than return partial results. Logs depend on the gateway's logging and retention settings. Missing logs cannot distinguish disabled logging, retention expiry, and no activity.

## Docker deployment

```bash
docker compose build
docker compose up -d
```

Terminate HTTPS at your reverse proxy and set `APP_BASE_URL` to its public origin. Compose binds the app to loopback by default. Connect the app to the gateway's existing private network if needed. The runtime is non-root, read-only, and has a health check at `/api/health`; it needs no data volumes.

After the first successful release, use published packages instead of building locally:

```bash
docker compose pull
docker compose up -d --no-build
```

Images: `ghcr.io/arashfarahani/bifrost-usage-dashboard:latest`, `:1.0.0`, and `:1.0` (version examples). Both `linux/amd64` and `linux/arm64` are built on native GitHub-hosted runners (`ubuntu-24.04` and `ubuntu-24.04-arm`), then combined into one multi-platform image. This avoids running the Next.js compiler under QEMU emulation. Set the GHCR package visibility to **Public** in GitHub package settings after initial publication for anonymous pulls; a public source repository does not automatically make a new package public.

## Automatic releases and GitHub Packages

Exactly two workflows are included:

1. **Release** (`release.yml`): pull requests run lint, type generation/check, tests, and production build. Pushes to `main` run the same checks, determine the next version, and publish a GitHub Release with generated notes.
2. **Build and publish** (`build.yml`): called only after a successful published release, verifies its tag and exact commit, then builds and pushes the Docker image to GHCR. A manual dispatch can retry a failed image build using the existing release tag and full commit SHA.

The first release is `v1.0.0`; an existing stable tag at the same commit is reused on retries. Later releases use [`mathieudutour/github-tag-action@v7`](https://github.com/mathieudutour/github-tag-action/tree/v7) with Conventional Commits: `feat:` means minor, `!` or `BREAKING CHANGE:` means major, everything else means patch. Squash-merge titles should follow these rules. Tags and image metadata are the authoritative release version; release automation creates no source commits and does not rewrite `package.json`.

The build is a **reusable workflow** called through `needs: release`; it does not rely on a `release: published` event generated with `GITHUB_TOKEN`, which would not trigger a second workflow. See [GitHub event behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) and [reusing workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows). No PAT is required. Allow Actions to write repository contents and packages. Only the release job gets contents-write permission; the publish job gets packages-write permission. No deployment credentials belong in Actions secrets.

Publication is release-first: a Docker build failure leaves the release published and reports a failed workflow; repair the build and retry the published commit when possible, or publish a patch. Releases are serialized to keep `latest` ordered. Manual retrying an older version also replaces `latest`; use it only for the newest release.

## Security and stateless limitations

Sessions are JWE-encrypted cookies with HttpOnly, SameSite=Lax, path `/`, and Secure/`__Host-` in production. Each lasts **at most one hour**, bounded by the link expiry for timed links. Permanent links still create short-lived sessions. All authenticated requests recheck the key directly by ID. Logout removes the cookie; replay of a previously copied cookie remains possible until expiry because there is no revocation store.

Authentication and logout check Origin and request metadata. Sensitive responses use `Cache-Control: no-store`, pages use `Referrer-Policy: no-referrer`, and the app adds CSP and clickjacking protections. Request bodies are bounded and gateway errors are translated into safe English messages. No endpoint accepts a client-supplied identity or modifies gateway resources.

Stateless links cannot be revoked individually before expiry. Disable the virtual key to revoke its access, or rotate an encryption key to invalidate all affected credentials. Keep encryption keys stable across restarts and replicas. Links survive redeployments with the same keys. Links/sessions generated by earlier application token namespaces need regeneration after migration to this generic release.

Rate limits are bounded, transient, per-process counters, not stored users or sessions. They reset on restart and are not distributed across replicas. Apply shared limits at an ingress/WAF for distributed enforcement. Configure proxies to avoid logging auth bodies, cookies, or forwarded credentials. The CLI intentionally prints the bearer link; avoid recording terminal output in shared logs.

## Development and tests

```bash
pnpm audit
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Vitest covers encryption/tampering/audience/expiry, explicit permanent links with short sessions, cookie/logout/CSRF boundaries, scope isolation, provider budgets and overrides, date boundaries, safe projection, pagination integrity, ranked tables, reset estimates, and model-discovery exclusion. Tests use fixtures; application code does not.

An optional real HTTP contract test uses the test-only Postman simulation:

```bash
postman simulation run postman/simulations/bifrost/bifrost.sim.yaml \
  --proxy --proxy-port 4501 --no-history --output ndjson
# In another terminal:
RUN_HTTP_INTEGRATION=1 NODE_USE_ENV_PROXY=1 \
HTTP_PROXY=http://127.0.0.1:4501 HTTPS_PROXY=http://127.0.0.1:4501 \
NO_PROXY=localhost,127.0.0.1 pnpm test tests/http-integration.test.ts
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Gateway unavailable / timeout | Private DNS/network from the process running the CLI or backend, and `BIFROST_BASE_URL`. |
| Redirect / SSO error | Use a directly reachable private API, not an interactive login proxy. |
| Management authentication failed | Internal OSS Basic Auth enabled, credentials match, and proxy preserves Authorization. |
| Invalid/expired access link | Open the complete fragment link or issue a new one; check encryption keys and clock. |
| Missing/inactive/expired key | Verify the exact ID and key status in the gateway. |
| No budget | Configure provider/model budget rules under `provider_configs`. |
| Missing history / report limit | Enable gateway logging, check retention, narrow dates, and verify the pinned schema. |
| Rate limited | Wait a minute; review upstream and ingress limits. |
| Production session not retained | HTTPS and the configured origin must match; inspect reverse proxy settings. |
| Release succeeds but image fails | Inspect Build and publish, fix the cause, then retry with the published tag and commit. |

## Contributing and license

Issues and pull requests are welcome. Keep the no-database architecture, never add real credentials or user mappings, and include tests for security or reporting changes. Use Conventional Commits so release versions reflect the change. Run all checks above before opening a pull request.

[MIT](LICENSE) © Arash Farahani.
