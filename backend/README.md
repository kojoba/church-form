# Church Connect frontend

This is the portable React and Vite version of the Church Connect frontend.

## Start the project

Open PowerShell in this folder and run:

```powershell
npm install
npm run dev
```

The frontend opens at `http://localhost:5173` and expects the Node backend at
`http://localhost:5000/api`.

## Change the backend address

Copy `.env.example` to `.env` and update:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

For production, replace this with the HTTPS URL of the deployed Node backend.

## API routes used

- `POST /api/members` — public form submission
- `POST /api/auth/login` — administrator login
- `GET /api/members` — protected member directory

Do not put the Supabase secret key or administrator password in this frontend.
