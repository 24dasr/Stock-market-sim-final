# STXSIM — Closed Stock Market Simulator

A full-stack, multi-device web application simulating a closed, controlled stock market with real-time trading.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite (local) / PostgreSQL (production) via Prisma ORM |
| Real-time | Socket.io |
| Auth | JWT + bcrypt |

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Backend
cd server
npm install
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev        # Runs on port 3001

# Frontend (separate terminal)
cd client
npm install
npm run dev        # Runs on port 5173 with proxy to 3001
```

### Default Admin Accounts

| Username | Password |
|---|---|
| admin1 | AdminBRSI_1 |
| admin2 | AdminBRSI_2 |
| admin3 | AdminBRSI_3 |

Open **http://localhost:5173** and log in as admin to create companies.

---

## Production Deployment

### PRE-EVENT SETUP (do this 1–2 days before)

#### DATABASE
1. Go to **supabase.com** → New Project (free, no credit card)
2. Go to Settings → Database → Connection String → URI mode
3. Copy the connection string:
   ```
   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=10
   ```

#### Update Prisma for PostgreSQL
In `server/prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### BACKEND HOSTING (Render)
4. Push repo to GitHub
5. Go to **render.com** → New → Web Service
   - Connect your GitHub repo
   - Root directory: `/`
   - Build command:
     ```
     cd server && npm install && npx prisma generate && npx prisma migrate deploy && node prisma/seed.js && cd ../client && npm install && npm run build && cp -r dist ../server/public
     ```
   - Start command: `cd server && node server.js`
   - Environment variables:
     ```
     DATABASE_URL  = (Supabase connection string)
     JWT_SECRET    = (random 64-char string)
     NODE_ENV      = production
     PORT          = 10000
     ```

#### KEEP-ALIVE
6. Go to **uptimerobot.com** → New Monitor
   - Type: HTTP(s)
   - URL: your Render URL
   - Interval: every 5 minutes

#### LAUNCH
7. Log in as admin the night before
8. Create all participant accounts from the admin dashboard
9. Share the URL with participants

### Capacity
- **40 simultaneous Socket.io connections**: within Render free tier
- **Database connections**: Prisma pool + Supabase 200 limit = no bottleneck
- **Cost**: $0
