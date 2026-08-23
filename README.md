# PLC - Project Lifecycle Control

An Autodesk Platform Services (APS) app for phase/gate project lifecycle
control: sign in with your Autodesk account, browse your ACC hubs/projects/
files, define phases and gates, tie each gate's criteria to a real ACC
review, and see which gates are open/closed/locked at both the project and
hub level.

Built fresh (not a fork) - the APS integration patterns (OAuth flow shape,
Data Management endpoints, ACC Reviews endpoints) were verified against a
known-working reference implementation and Autodesk's current docs, then
written from scratch here.

## Stack

- **Frontend**: React (Create React App) + Tailwind CSS
- **Backend**: Node.js + Express
- **Storage**: JSON files on disk, one per project, under `/data` (see
  "Known limitations" below)

## Setup

1. Create an app at <https://aps.autodesk.com/myapps> to get a Client ID and
   Client Secret. Add a callback URL matching `APS_CALLBACK_URL` below
   (default: `http://localhost:3001/api/auth/callback`).
2. Copy `.env.example` to `.env` and fill in `APS_CLIENT_ID` and
   `APS_CLIENT_SECRET`.
3. Install dependencies:
   ```
   npm install
   ```
4. Run both the backend and frontend:
   ```
   npm run dev
   ```
   Or separately:
   ```
   npm run server   # Express backend on :3001
   npm start        # React dev server on :3000, proxies /api to :3001
   ```
5. Open <http://localhost:3000> and sign in with Autodesk (3-legged OAuth).

## How auth works

- **3-legged (user sign-in)**: `GET /api/auth/login` redirects to Autodesk's
  login page. Autodesk redirects back to `/api/auth/callback` with a code,
  which the server exchanges for tokens. Tokens are kept server-side in
  `server/sessionStore.js`, keyed by a random session id stored in an
  httpOnly cookie - the browser never sees the actual APS access/refresh
  tokens. `requireAuth` middleware refreshes the token automatically when
  it's close to expiring.
- **2-legged (client credentials)**: `getTwoLeggedToken()` in
  `server/apsClient.js` is cached and used for any account-scoped call that
  doesn't need a specific signed-in user's identity.

## Architecture

```
server.js                  Express entry point, wires up all routes
server/apsClient.js         All direct calls to Autodesk's auth endpoints
server/sessionStore.js      In-memory session -> token mapping
server/dataStore.js         File-based JSON store for gates/phases
server/middleware/requireAuth.js   Loads/refreshes the signed-in user's token
server/routes/
  auth.js       /api/auth/*        - login, callback, status, logout
  hubs.js       /api/hubs/*        - hubs, hub projects
  folders.js    /api/*folders*     - top folders, folder contents
  reviews.js    /api/projects/:id/reviews*, /workflows  - ACC Reviews proxy
  gates.js      /api/projects/:id/gates, /phases, /api/hub/gates

src/
  api/            fetch-based client + one service module per concern
  context/        AuthContext (drives login state app-wide)
  components/      Login, Sidebar, FileBrowser, GateManager,
                   ProjectDashboard, HubDashboard
  utils/gateStatus.js   pure lock/completion/summary logic, shared by
                        the project and hub dashboards
```

### The gate model

A **phase** is just `{ id, name }`. A **gate** belongs to a phase and has an
`order` (its position in the sequence) and a list of **criteria**:
`{ id, description, reviewId?, reviewStatus? }`. A gate is:

- **locked** if it's not first and the previous gate (by `order`) isn't
  fully completed
- **completed** once every criterion's `reviewStatus` is `'approved'`
- **in-progress** if any criterion has a review attached but isn't approved
  yet
- **pending** otherwise

Sending a criterion "for review" creates a real ACC review
(`POST /api/projects/:id/reviews`) against a workflow already configured in
that ACC project. Clicking the sync button on a gate calls
`GET .../reviews/:reviewId/progress` for each attached review and updates
the criterion's status.

## Known limitations / things to adjust before production use

1. **Gate/phase storage is file-based** (`/data/gates/*.json`,
   `/data/phases/*.json`), one file per project. This works fine on a normal
   server or VM but **will not work on serverless hosts** with an ephemeral
   or read-only filesystem (e.g. Vercel functions). Swap `server/dataStore.js`
   for a real database and keep the same function signatures - nothing else
   needs to change.
2. **`deriveReviewStatus()` in `GateManager.js` is defensive/best-guess.**
   I wasn't able to test against a live ACC project with real review data
   (no network access to Autodesk's API from the environment this was built
   in), so it tries a few reasonable field names (`status`, `reviewStatus`,
   a `steps` array) rather than assuming one fixed shape. Check this against
   your tenant's actual `/reviews/:id/progress` response and adjust field
   names if needed.
3. **Gate/phase routes have no auth check** (`server/routes/gates.js`) -
   they're pure backend storage, not APS calls, so they were left open for
   MVP simplicity. Before letting more than one team use this, put them
   behind `requireAuth` (or an API key) too, so one project's gates can't be
   read/overwritten by an arbitrary caller.
4. **Sessions are in-memory** (`server/sessionStore.js`) - restarting the
   server logs everyone out. Fine for a small team; swap for Redis or a DB
   table for anything longer-lived.
5. No automated tests yet - the routes were smoke-tested manually with curl
   (health check, gate/phase CRUD, hub bulk fetch, and the auth redirect/401
   behavior) and the frontend build was verified to compile clean, but
   there's no test suite.
