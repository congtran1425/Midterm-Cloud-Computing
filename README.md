# Cloud POS SaaS

Multi-tenant SaaS Point-of-Sale application for the Cloud Computing assignment.

## Local Setup

1. Create the MySQL schema by running `Backend/Database/Create_DB.sql` in MySQL Workbench.
2. Copy `.env.example` to `.env` and fill in your local MySQL credentials.
3. Install dependencies:

```powershell
npm.cmd install
```

4. Seed demo accounts:

```powershell
npm.cmd run seed
```

5. Start the backend API:

```powershell
npm.cmd run dev
```

6. Start the React frontend in a second terminal:

```powershell
npm.cmd run client:dev
```

Open `http://localhost:5173`.

For a production-style local run:

```powershell
npm.cmd run build
npm.cmd start
```

Then open `http://localhost:3000`.

## AWS Deployment

See [DEPLOY_AWS.md](DEPLOY_AWS.md) for a step-by-step deployment guide using `EC2 + RDS + Nginx + PM2`, with optional `AWS SES` SMTP for receipt emails.

## Demo Accounts

After running the seed script:

- Platform admin: `superadmin` / `Admin@123`
- Coffee tenant: tenant code `coffeehouse`, username `owner`, password `Tenant@123`
- Mini Mart tenant: tenant code `minimart`, username `owner`, password `Tenant@123`
- Tenant staff: usernames such as `cashier1`, `cashier2`, `barista`, `stockstaff` / `Staff@123`

## Backend Structure

Backend source code, database scripts, seed scripts, and deploy config now live in `Backend/`.

Important paths:

- Backend API: `Backend/src`
- Database schema and migrations: `Backend/Database`
- Seed and maintenance scripts: `Backend/scripts`
- AWS/PM2/Nginx backend deploy assets: `Backend/deploy`, `Backend/ecosystem.config.cjs`
