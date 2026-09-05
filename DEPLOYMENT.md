# Deploy MicroWorkout

MicroWorkout deploys to Vercel, uses Neon PostgreSQL for synced data, and uses Google OAuth for invite-only sign-in. The checked-in GitHub Actions workflow deploys every push to main.

## 1. Prepare the project

Install dependencies and verify the project locally:

    npm install
    npm run typecheck
    npm run lint
    npm run test

Copy the environment template for a full local production check:

    Copy-Item .env.example .env.local

Generate an authentication secret:

    node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

Set these values in .env.local. Do not commit this file.

| Variable | Value |
| --- | --- |
| DATABASE_URL | Neon PostgreSQL connection string with sslmode=require. |
| BETTER_AUTH_SECRET | The generated secret. Keep this stable after deployment. |
| BETTER_AUTH_URL | http://localhost:3000 locally, then your exact production URL, such as https://workout.example.com. |
| GOOGLE_CLIENT_ID | Google OAuth web-client ID. |
| GOOGLE_CLIENT_SECRET | Google OAuth web-client secret. |
| OWNER_EMAIL | The Google email address for the first administrator. Use lowercase. |

## 2. Create the Neon database

1. Create a Neon project and database.
2. Copy its PostgreSQL connection string and add ?sslmode=require if Neon did not include it.
3. Set that value as DATABASE_URL in .env.local.
4. Apply the checked-in schema migrations:

    npm run db:migrate

The migration creates the Better Auth tables, invitations, workout plans, sessions, sets, rest intervals, and sync records.

## 3. Configure Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Configure the OAuth consent screen. Add the Google accounts that may test the app while the consent screen is in testing mode.
3. Create an OAuth 2.0 Web application client.
4. Add these authorized JavaScript origins:

   - http://localhost:3000
   - https://your-domain

5. Add these authorized redirect URIs:

   - http://localhost:3000/api/auth/callback/google
   - https://your-domain/api/auth/callback/google

6. Copy the generated client ID and client secret into GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.

Google OAuth is the only external API configuration required. The app's sync, invitation, and account APIs are deployed with the Next.js application; they do not require separate hosting or API keys.

## 4. Configure Vercel

1. Import this GitHub repository into Vercel and create the project.
2. Set the production domain in Vercel, then use that exact HTTPS URL for BETTER_AUTH_URL and the Google OAuth URLs above.
3. In Settings > Environment Variables, add all six application variables from the table above for the Production environment.
4. In Settings > General, copy the project and team IDs. They are used as VERCEL_PROJECT_ID and VERCEL_ORG_ID.
5. Create a Vercel access token from Account Settings > Tokens. Treat it as a secret.

## 5. Configure GitHub deployment secrets

In GitHub, open Settings > Secrets and variables > Actions. Create the following secrets in the production environment:

| Secret | Source |
| --- | --- |
| DATABASE_URL | Neon connection string |
| BETTER_AUTH_SECRET | Generated secret |
| BETTER_AUTH_URL | Production site URL |
| GOOGLE_CLIENT_ID | Google OAuth client |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| OWNER_EMAIL | Owner's Google email |
| VERCEL_TOKEN | Vercel access token |
| VERCEL_ORG_ID | Vercel team/account ID |
| VERCEL_PROJECT_ID | Vercel project ID |

The existing [deploy workflow](.github/workflows/deploy.yml) installs dependencies, runs validation, builds with Vercel, applies Drizzle migrations, and deploys the prebuilt application when main receives a push.

## 6. Deploy and verify

1. Push the prepared code to main.
2. Open the GitHub Actions Production workflow and confirm every step succeeds.
3. Visit the production URL and sign in first with OWNER_EMAIL. This creates the protected administrator account.
4. Open Settings > Manage access, invite a test email, then sign in as that invited user.
5. Create a plan, complete a workout, and confirm its data remains after a page refresh.
6. Check that unauthorized requests to /api/sync return 401. If the production environment is missing a required app variable, the app shows its configuration screen and POST /api/sync returns 503.

## Updating production

Use a normal pull request and merge it into main. Do not rotate BETTER_AUTH_SECRET during routine deployments: rotating it invalidates active sign-in sessions. Add any future database migration to drizzle/; the production workflow applies it before deployment.
