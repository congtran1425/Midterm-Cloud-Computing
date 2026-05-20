# Cloud POS SaaS

Multi-tenant SaaS Point-of-Sale application for the Cloud Computing assignment.

## Local Setup

1. Create the MySQL schema by running `Database/Create_DB.sql` in MySQL Workbench.
2. Copy `.env.example` to `.env` and fill in your local MySQL credentials.
3. Install dependencies:

```powershell
npm.cmd install
```

4. Seed demo accounts:

```powershell
npm.cmd run seed
```

5. Start the app:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000`.

## Demo Accounts

After running the seed script:

- Platform admin: `superadmin` / `Admin@123`
- Coffee tenant: tenant code `coffeehouse`, username `owner`, password `Tenant@123`
- Mini Mart tenant: tenant code `minimart`, username `owner`, password `Tenant@123`
