# Mumin Agent

## Initial Admin setup

Admin creation is a deliberate, manual operation. The API does not create or
modify an Admin during normal startup.

1. Configure the backend's `MONGO_URI` for the intended MongoDB Atlas database.
2. Temporarily configure `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, and
   `ADMIN_PASSWORD`. Passwords must contain at least 6 characters; use a strong,
   unique password outside development.
3. From `backend`, run `npm run seed:admin`.
4. Confirm the command reports that the configured Admin was created or verified.
   If that exact email already exists, its configured profile, role, status, and
   password are synchronized. Unrelated users are never changed or deleted.
5. Remove `ADMIN_PASSWORD` from the environment after the bootstrap command.
6. Start the application and sign in with the configured Admin email and password.

Do not run `src/seeders/seed.ts` for production setup. It is development-only
test-data code and is not part of server startup.
