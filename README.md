# Busy Bee API

The backend for the **Busy Bee** task management application, built with [NestJS](https://nestjs.com/) and [Prisma](https://www.prisma.io/).

## Features

- **Task Management**: Create, read, update, and delete tasks and subtasks.
- **Analytics & Stats**: Dashboards for task completion rates and analytics.
- **Notifications**: System for managing user notifications.
- **Authentication**: JWT-based authentication combined with Supabase for robust user management.

## Prerequisites

- **Node.js**: v20 or later
- **PostgreSQL**: Local or hosted database
- **Supabase**: Configured instance for Firebase/Auth integrations (if applicable)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root of the backend directory based on the `.env.example` file (or provide the necessary environment variables).
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/busybee?schema=public"
   JWT_SECRET="your-secret"
   ```

3. **Database Setup:**
   Run Prisma migrations to set up your database schema:
   ```bash
   npx prisma migrate dev
   ```

4. **Running the App:**
   ```bash
   # development
   npm run start

   # watch mode
   npm run start:dev

   # production mode
   npm run start:prod
   ```

## Testing

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Architecture

- **Auth**: Uses Passport & JWT for local auth.
- **Controllers/Services**: The logic is split cleanly into controllers for routing and services for business logic (`users`, `tasks`, `notifications`, `analytics`, `profile`, `stats`).
- **Prisma**: Acts as the ORM to communicate with the PostgreSQL database.
