# 🐝 Busy Bee — Project Issues Tracker

> **Full scan completed:** Backend (NestJS + Prisma + PostgreSQL) & Frontend (Flutter + Provider)  
> **Date:** 2026-07-20  
> **Total Issues:** 32

---

## 📋 Issue Categories

| Priority | Label | Count |
|----------|-------|-------|
| 🔴 | `critical` — Blocks launch / security risk | 7 |
| 🟠 | `high` — Major functionality gaps | 8 |
| 🟡 | `medium` — Important but not blocking | 10 |
| 🟢 | `low` — Polish, cleanup, nice-to-have | 7 |

---

## 🔴 CRITICAL — Must Fix Before Launch

---

### Issue #1: Hardcoded Secrets & Credentials Exposed in Source Code

**Labels:** `critical` `security` `backend` `frontend`

**Current State:**  
- JWT secret is hardcoded as `"Atiango-Task-Secret-Key"` in `backend/src/users/constant.ts`
- Supabase anon key & URL are hardcoded in `frontend/lib/main.dart` (lines 25-27)
- `.env` file is committed to git with real database URL, Supabase service role key, Google OAuth secrets
- `PORT` env var is set to a URL string (`https://busy-bee-task-management-api.onrender.com`) instead of a port number

**Impact:** Anyone with repo access has full database access, can forge JWT tokens, and access your Supabase storage.

**How to Approach:**
1. **Backend** — Move JWT secret to `.env`:
   ```typescript
   // constant.ts
   export const jwtConstants = {
     secret: process.env.JWT_SECRET || 'dev-fallback-secret',
   };
   ```
2. **Backend** — Install `@nestjs/config` and use `ConfigModule.forRoot()` in `AppModule` to properly load `.env`:
   ```bash
   npm install @nestjs/config
   ```
   Then in `app.module.ts`, add `ConfigModule.forRoot({ isGlobal: true })` to `imports`.
3. **Frontend** — Use `--dart-define` for build-time config or a `lib/core/constants/env.dart` file that reads from `String.fromEnvironment()`.
4. **Git** — Add `.env` to `.gitignore`, delete it from git history:
   ```bash
   git rm --cached backend/.env
   echo "backend/.env" >> .gitignore
   ```
5. **Fix PORT** — Change `PORT = "https://..."` to `PORT = 3000` in `.env`.
6. **Rotate ALL secrets** — After cleanup, regenerate the JWT secret, Supabase keys, Google OAuth credentials, and database password since they've been exposed.

---

### Issue #2: Notification Scheduler is Empty — No Push Notifications Working

**Labels:** `critical` `backend` `feature-gap`

**Current State:**  
- `backend/src/notifications/notification.scheduler.ts` is a completely **empty file** (0 bytes)
- The `NotificationsModule` imports `ScheduleModule` and `BullModule` (Redis queue), but neither is connected to anything
- Task completion triggers only `console.log()` instead of creating actual notifications (see `tasks.service.ts` line 193)
- No Firebase Cloud Messaging (FCM) integration despite `firebase-admin` being installed
- Docker Compose has Redis configured but the app never queues notification jobs

**Impact:** Users never get notified about upcoming deadlines or task changes — a core feature of a task management app.

**How to Approach:**
1. **Implement the scheduler** in `notification.scheduler.ts`:
   ```typescript
   @Injectable()
   export class NotificationScheduler {
     constructor(
       private prisma: PrismaService,
       private notificationsService: NotificationsService,
     ) {}
   
     @Cron(CronExpression.EVERY_5_MINUTES)
     async checkUpcomingDeadlines() {
       const now = new Date();
       const window = new Date(now.getTime() + 30 * 60 * 1000);
       
       const tasks = await this.prisma.task.findMany({
         where: {
           status: { not: 'COMPLETED' },
           deadline: { gte: now, lte: window },
         },
         include: { user: true },
       });
       
       for (const task of tasks) {
         await this.notificationsService.AddNotification(
           { title: `⏰ "${task.title}" is due soon`, description: `Due at ${task.deadline}`, isRead: false },
           task.userId,
         );
       }
     }
   }
   ```
2. **Register** `NotificationScheduler` as a provider in `NotificationsModule`.
3. **Wire up FCM** — Create a `firebase.service.ts` that initializes `firebase-admin` and sends push messages when creating notifications.
4. **Bull queue** — Use the existing Bull/Redis setup to queue notification jobs for reliability (e.g., delayed sends, retries).
5. **Frontend** — Implement a `NotificationsProvider` and `NotificationsScreen` to display in-app notifications (see Issue #12).

---

### Issue #3: `GetNotifications` Queries by Wrong Field — Returns Wrong Data

**Labels:** `critical` `bug` `backend`

**Current State:**  
In `notifications.service.ts` line 55:
```typescript
where: {id: userId}  // ❌ BUG: queries by notification ID, not user ID
```

**Impact:** Users see other users' notifications (or none at all). This is a data leak and broken functionality.

**How to Approach:**
1. Change the query to filter by `userId`:
   ```typescript
   where: { userId: userId }
   ```
2. Add proper pagination:
   ```typescript
   async GetNotifications(userId: number, page = 1, limit = 20) {
     return this.Prisma.notification.findMany({
       where: { userId },
       orderBy: { createdAt: 'desc' },
       skip: (page - 1) * limit,
       take: limit,
     });
   }
   ```
3. Return an empty array instead of throwing `NotFoundException` when there are no notifications — throwing 404 for empty results is bad API design.

---

### Issue #4: `PORT` Environment Variable is a URL, Not a Port Number

**Labels:** `critical` `bug` `backend` `config`

**Current State:**  
In `backend/.env` line 14:
```
PORT = "https://busy-bee-task-management-api.onrender.com"
```

`main.ts` uses `process.env.PORT ?? 3000` — with this value, the app will try to listen on a URL string, which will crash or produce unexpected behavior.

**Impact:** App may fail to start locally or produce confusing errors.

**How to Approach:**
1. Fix `.env`:
   ```
   PORT=3000
   API_URL=https://busy-bee-task-management-api.onrender.com
   ```
2. Update any code that referenced `PORT` for the API URL to use `API_URL` instead.

---

### Issue #5: Google Strategy File Has Typo in Filename — `goole.strategy.ts`

**Labels:** `critical` `bug` `backend`

**Current State:**  
- File is named `goole.strategy.ts` (missing a 'g')
- The `GoogleStrategy` class is missing the `@Injectable()` decorator
- Uses `GOOGLE_CALLBACK_URL` env var but `.env` has `GOOGLE_REDIRECT_URI`
- The Google OAuth web flow (`@Get()` in `UsersController`) has no callback handler route

**Impact:** Google OAuth via web flow is completely broken. Mobile flow works because it uses a separate `googleMobileLogin` method.

**How to Approach:**
1. Rename file: `goole.strategy.ts` → `google.strategy.ts`
2. Update the import in `users.module.ts` accordingly
3. Add `@Injectable()` decorator to the class
4. Fix env var name to match: either rename in `.env` or in the strategy
5. Add a callback route:
   ```typescript
   @Get('google/callback')
   @UseGuards(AuthGuard('google'))
   async googleAuthCallback(@Req() req) {
     return this.userService.googleLogin(req);
   }
   ```

---

### Issue #6: No Logout Endpoint on Backend

**Labels:** `critical` `backend` `auth`

**Current State:**  
- Frontend `AuthProvider` calls `_authRepository.logout()` which only clears local storage
- Backend has NO `/auth/logout` endpoint
- JWT tokens have a 7-day expiry with no way to invalidate them
- `ApiEndpoints` has a commented-out logout endpoint: `// static const String logout = '/auth/logout';`

**Impact:** Users can't truly log out — their tokens remain valid for 7 days. If a token is stolen, there's no way to revoke it.

**How to Approach:**
1. **Simple approach** — Add a blacklist table or Redis set for invalidated tokens:
   ```typescript
   @Public()
   @Post('/logout')
   async logout(@Req() req) {
     const token = req.headers.authorization?.split(' ')[1];
     // Add to blacklist in Redis with TTL matching token expiry
     return { message: 'Logged out successfully' };
   }
   ```
2. **Update `JwtAuthGuard`** to check the blacklist before allowing access.
3. **Shorter token expiry** — Consider reducing from `7d` to `1d` with a refresh token mechanism.
4. **Frontend** — Uncomment and wire up the logout endpoint in `ApiEndpoints`.

---

### Issue #7: `PrismaService` Not Using `onModuleDestroy` — Connection Leak Risk

**Labels:** `critical` `backend` `database`

**Current State:**  
`prisma.service.ts` implements `OnModuleInit` but does NOT implement `OnModuleDestroy`:
```typescript
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
  // Missing: onModuleDestroy to disconnect
}
```

**Impact:** Database connections may leak on app shutdown/restart, eventually exhausting the connection pool.

**How to Approach:**
```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

---

## 🟠 HIGH — Major Functionality Gaps

---

### Issue #8: Forgot Password / Reset Password — Backend Not Implemented

**Labels:** `high` `backend` `auth` `feature-gap`

**Current State:**  
- Frontend has a fully built `ForgotPasswordScreen` UI
- Frontend `AuthProvider` has a `forgotPassword()` method
- `ApiEndpoints` defines `forgotPassword` and `resetPassword` routes
- Backend has **NO** `/auth/forgot-password` or `/auth/reset-password` endpoints

**Impact:** Users who forget their password are permanently locked out of their accounts.

**How to Approach:**
1. **Choose an email provider** — Options: Supabase Auth (already in dependencies), SendGrid, AWS SES, or NodeMailer
2. **Create endpoints** in `UsersController`:
   - `POST /auth/forgot-password` — Generate a reset token, store it in DB (with expiry), send email with link
   - `POST /auth/reset-password` — Validate token, update password, invalidate token
3. **Add a `password_reset_tokens` table** to Prisma schema:
   ```prisma
   model PasswordResetToken {
     id        Int      @id @default(autoincrement())
     token     String   @unique
     userId    Int
     user      User     @relation(fields: [userId], references: [id])
     expiresAt DateTime
     used      Boolean  @default(false)
     createdAt DateTime @default(now())
   }
   ```
4. **Run migration**: `npx prisma migrate dev --name add_password_reset_tokens`

---

### Issue #9: Notifications Feature — Frontend Not Implemented

**Labels:** `high` `frontend` `feature-gap`

**Current State:**  
- `structure.txt` describes planned `features/notifications/` with data, models, state, and UI layers
- None of these files exist in the actual codebase
- Dashboard has no notification bell/badge
- No `NotificationsProvider`, `NotificationModel`, or `NotificationsScreen`

**Impact:** Users have no way to see notifications in the app.

**How to Approach:**
1. **Create the notification model** at `lib/features/notifications/model/notification_model.dart`:
   ```dart
   class NotificationModel {
     final int id;
     final String title;
     final String description;
     final bool isRead;
     final DateTime createdAt;
     final int? taskId;
     // ... fromJson, toJson, copyWith
   }
   ```
2. **Create the API layer** at `lib/features/notifications/data/notification_api.dart` with methods: `getNotifications()`, `markAsRead(id)`, `deleteNotification(id)`
3. **Create the repository** at `lib/features/notifications/data/notification_repository.dart`
4. **Create the provider** at `lib/features/notifications/state/notification_provider.dart`
5. **Create the UI** at `lib/features/notifications/ui/notifications_screen.dart`
6. **Register the provider** in `main.dart`'s `MultiProvider`
7. **Add a notification bell icon** to the dashboard header

---

### Issue #10: `TaskOccurrence` Model Unused — Recurring Tasks Don't Generate Occurrences

**Labels:** `high` `backend` `feature-gap`

**Current State:**  
- Prisma schema defines `TaskOccurrence` model with fields for `occurrenceDate`, `status`, `completedAt`
- **No code anywhere** creates, reads, or manages `TaskOccurrence` records
- Backend creates recurring tasks with metadata (`recurrenceType`, `recurrenceDays`, etc.) but never generates actual occurrences
- Frontend sends recurrence fields when creating tasks but there's no logic to show upcoming occurrences

**Impact:** Recurring tasks exist in name only — they don't actually repeat. Users who set "repeat weekly" see only the original task.

**How to Approach:**
1. **Create a `RecurrenceService`** in the backend:
   ```typescript
   @Injectable()
   export class RecurrenceService {
     @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
     async generateOccurrences() {
       // Find all recurring tasks
       // For each, generate TaskOccurrence records for the next N days
       // Skip dates that already have occurrences
     }
   }
   ```
2. **Add API endpoints** to fetch occurrences for a date range:
   ```
   GET /tasks/occurrences?start=2026-07-01&end=2026-07-31
   ```
3. **Frontend** — Update `CalendarProvider` to fetch and display occurrences on their respective dates instead of just the parent task's `createdAt`.

---

### Issue #11: Calendar Uses `createdAt` Instead of `startTime`/`deadline` for Date Matching

**Labels:** `high` `bug` `frontend`

**Current State:**  
In `calender_provier.dart`, tasks are matched to calendar dates by `createdAt`:
```dart
task.createdAt.year == _selectedDate.year &&
task.createdAt.month == _selectedDate.month &&
task.createdAt.day == _selectedDate.day
```

**Impact:** If you create a task today with a start time of next Monday, it shows on today's calendar date — not Monday's. Calendar is essentially useless for planning.

**How to Approach:**
1. Change the filter to use `startTime` (primary) and optionally also show tasks by `deadline`:
   ```dart
   List<TaskModel> get tasksForSelectedDate => allTasks.where((task) {
     final date = _selectedDate;
     final matchesStart = task.startTime.year == date.year &&
         task.startTime.month == date.month &&
         task.startTime.day == date.day;
     final matchesDeadline = task.deadline != null &&
         task.deadline!.year == date.year &&
         task.deadline!.month == date.month &&
         task.deadline!.day == date.day;
     return matchesStart || matchesDeadline;
   }).toList();
   ```
2. Update `getTaskCountForDate()` with the same logic for dot indicators.

---

### Issue #12: Delete Notification Lacks Ownership Check — Any User Can Delete Any Notification

**Labels:** `high` `security` `backend`

**Current State:**  
`NotificationsService.DeleteNotification()` only checks if the notification exists, not whether it belongs to the requesting user:
```typescript
async DeleteNotification(notificationId: number) {
  const notification = await this.Prisma.notification.findUnique({
    where: { id: notificationId }
  });
  // No userId check!
}
```
Same issue with `ReadNotification()`.

**Impact:** Any authenticated user can read/delete any other user's notifications by guessing IDs.

**How to Approach:**
1. Pass `userId` from the controller to all notification service methods
2. Add ownership validation:
   ```typescript
   async DeleteNotification(notificationId: number, userId: number) {
     const notification = await this.Prisma.notification.findUnique({
       where: { id: notificationId }
     });
     if (!notification) throw new NotFoundException('...');
     if (notification.userId !== userId) throw new ForbiddenException('Not authorized');
     // ... delete
   }
   ```
3. Apply the same pattern to `ReadNotification()`

---

### Issue #13: Notification DTO Missing Fields — `type`, `taskId`, `triggerTime` Not Accepted

**Labels:** `high` `backend` `data-model`

**Current State:**  
`NotificationsDto` only accepts `title`, `description`, `isRead`. The Prisma schema supports `type`, `taskId`, `triggerTime`, `actionUrl`, `actionType` — none of which can be set via the API.

**Impact:** All notifications are created as generic `SYSTEM` type with no task association. You can't link a notification to a specific task or schedule it for a future time.

**How to Approach:**
1. Update `NotificationsDto`:
   ```typescript
   export class NotificationsDto {
     @IsString() title: string;
     @IsString() description: string;
     @IsOptional() @IsBoolean() isRead?: boolean;
     @IsOptional() @IsEnum(Notification_Type) type?: Notification_Type;
     @IsOptional() @IsNumber() taskId?: number;
     @IsOptional() @IsDateString() triggerTime?: string;
     @IsOptional() @IsString() actionUrl?: string;
     @IsOptional() @IsString() actionType?: string;
   }
   ```
2. Update `AddNotification()` in the service to use these fields.

---

### Issue #14: `insightPercent` is Hardcoded to `20` — Analytics Comparison Not Implemented

**Labels:** `high` `backend` `feature-gap`

**Current State:**  
In `analytics.service.ts` line 241:
```typescript
insightPercent: 20, // placeholder (week vs last week)
```

**Impact:** The stats screen shows a fake "20% improvement" insight that never changes.

**How to Approach:**
1. Calculate actual week-over-week change:
   ```typescript
   const lastWeekStart = new Date(weekStart);
   lastWeekStart.setDate(lastWeekStart.getDate() - 7);
   
   const lastWeekCompleted = await this.prisma.task.count({
     where: {
       userId,
       status: 'COMPLETED',
       updatedAt: { gte: lastWeekStart, lt: weekStart },
     },
   });
   
   const thisWeekCompleted = todayCompleted; // or a proper this-week count
   const insightPercent = lastWeekCompleted === 0
     ? (thisWeekCompleted > 0 ? 100 : 0)
     : Math.round(((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100);
   ```

---

### Issue #15: Raw SQL Queries Reference `"Task"` Table — Prisma Mapped Table is `"tasks"`

**Labels:** `high` `bug` `backend`

**Current State:**  
The Prisma schema maps `Task` to `@@map("tasks")`, but all raw SQL queries in `analytics.service.ts` reference `"Task"`:
```sql
FROM "Task"
WHERE "userId" = ${userId}
```

**Impact:** Every analytics query will throw a "relation Task does not exist" PostgreSQL error. The dashboard analytics page is completely broken.

**How to Approach:**
1. Replace all `"Task"` references in raw SQL with `"tasks"`:
   ```sql
   FROM "tasks"
   WHERE "userId" = ${userId}
   ```
2. Do the same check for any other raw queries referencing Prisma model names instead of mapped table names.
3. Better yet — rewrite these queries using Prisma's `groupBy` and aggregate functions to avoid raw SQL entirely.

---

## 🟡 MEDIUM — Important Improvements

---

### Issue #16: `MainLayout` / Bottom Navigation Not Wired Up

**Labels:** `medium` `frontend` `navigation`

**Current State:**  
- `shared/main_layout.dart` exists with a bottom nav bar but the `_routes` list only has `dashboard` — the other two are commented out
- Routes for Calendar, Stats, and Profile are not defined in `app_routes.dart`
- The dashboard has a `CustomBottomNav` widget already, but `MainLayout` is unused

**Impact:** Navigation between main sections works through the custom bottom nav in `DashboardScreen`, but the shared layout approach is abandoned midway. This makes the architecture inconsistent.

**How to Approach:**
1. **Option A (recommended):** Delete `main_layout.dart` and keep the custom bottom nav approach already working in `DashboardScreen`
2. **Option B:** Implement `ShellRoute` in GoRouter for proper nested navigation:
   ```dart
   ShellRoute(
     builder: (context, state, child) => MainLayout(child: child),
     routes: [
       GoRoute(path: '/dashboard', ...),
       GoRoute(path: '/calendar', ...),
       GoRoute(path: '/stats', ...),
       GoRoute(path: '/profile', ...),
     ],
   )
   ```

---

### Issue #17: Calendar Feature — `data/` and `model/` Directories Are Empty

**Labels:** `medium` `frontend` `cleanup`

**Current State:**  
- `features/calender/data/` — empty directory
- `features/calender/model/` — empty directory
- Calendar works by piggybacking on `TasksProvider` via `CalendarProvider`

**Impact:** Skeleton directories add confusion. Either they should be deleted or populated if there are planned calendar-specific features.

**How to Approach:**
1. **Delete** the empty `data/` and `model/` directories since `CalendarProvider` correctly delegates to `TasksProvider`
2. **Or** add a `CalendarEvent` model if you plan to support non-task events in the future

---

### Issue #18: `app_theme.dart` Missing — Theme Directory is Empty

**Labels:** `medium` `frontend` `design`

**Current State:**  
- `core/theme/` directory exists but is completely empty
- Theme is inline in `main.dart` with `ThemeData.dark().copyWith(...)`
- Colors are partially defined in `core/constants/colors.dart` but not consistently used

**Impact:** Theme is not centralized — color/style changes require hunting through every widget file.

**How to Approach:**
1. Create `lib/core/theme/app_theme.dart`:
   ```dart
   class AppTheme {
     static ThemeData get darkTheme => ThemeData.dark().copyWith(
       scaffoldBackgroundColor: AppColors.background,
       useMaterial3: true,
       colorScheme: ColorScheme.fromSeed(
         seedColor: AppColors.primary,
         brightness: Brightness.dark,
       ),
       // ... text themes, button themes, card themes, etc.
     );
   }
   ```
2. Use `AppTheme.darkTheme` in `main.dart` instead of the inline definition
3. Reference `AppColors` constants throughout all widgets

---

### Issue #19: `structure.txt` is Outdated — Doesn't Match Actual Code Structure

**Labels:** `medium` `frontend` `documentation`

**Current State:**  
`frontend/lib/structure.txt` describes a planned structure that diverges from reality:
- Lists `features/tasks/` but actual task code lives in `features/dashboard/`
- Lists `features/dashboard/data/dashboard_api.dart` but actual file is `tasks_api.dart`
- Lists `features/profile/state/profile_provider.dart` but actual file is `account_provider.dart`
- Missing `features/calender/` and `features/stats/` entirely

**Impact:** Misleads developers who reference this file for project navigation.

**How to Approach:**
1. Regenerate the file from the actual structure
2. Or delete the file entirely — the codebase structure should be self-documenting

---

### Issue #20: Signup Returns User Data But No Token — Forces Double Request

**Labels:** `medium` `backend` `auth`

**Current State:**  
`UsersService.signup()` returns `{ id, email, name, profile_image_url }` but **no access token**. Frontend `AuthProvider.register()` detects this and calls `login()` immediately after registration:
```dart
if (!response.hasTokens) {
  await login(email: email, password: password);
}
```

**Impact:** Every registration makes two API calls unnecessarily. Adds latency and complexity.

**How to Approach:**
1. Return a token from signup:
   ```typescript
   async signup(payload: SignUpDto) {
     // ... create user ...
     const token = await this.jwtService.signAsync({
       id: newUser.id,
       email: newUser.email,
       name: newUser.name,
       imageUrl: newUser.profile_image_url,
     });
     return { ...newUser, accessToken: token };
   }
   ```
2. Update frontend `AuthRepository` to handle the token from signup response.

---

### Issue #21: Backend Has Duplicate Auth Guard Registration

**Labels:** `medium` `backend` `architecture`

**Current State:**  
`JwtAuthGuard` is registered as a global `APP_GUARD` in **both** `UsersModule` and `NotificationsModule`:
```typescript
{ provide: APP_GUARD, useClass: JwtAuthGuard }
```
`JwtStrategy` is also duplicated in both modules' providers.

**Impact:** NestJS will execute the auth guard twice for every request. This may cause subtle bugs and definitely causes confusion.

**How to Approach:**
1. Keep the global guard registration **only** in `UsersModule` (since it exports the auth infrastructure)
2. Remove `APP_GUARD` and `JwtStrategy` from `NotificationsModule` providers
3. Better yet — create a dedicated `AuthModule` that's imported by `AppModule`:
   ```typescript
   @Module({
     imports: [PassportModule, JwtModule.register(...)],
     providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
     exports: [JwtStrategy],
   })
   export class AuthModule {}
   ```

---

### Issue #22: `PrismaService` Not Shared via a Module — Created Multiple Times

**Labels:** `medium` `backend` `architecture`

**Current State:**  
`PrismaService` is listed as a provider in `UsersModule`, `NotificationsModule`, `AnalyticsModule`, and `ProfileModule` independently. Each module creates its own instance.

**Impact:** Multiple database connection pools, increased memory usage, and potential connection exhaustion.

**How to Approach:**
1. Create a `PrismaModule`:
   ```typescript
   @Global()
   @Module({
     providers: [PrismaService],
     exports: [PrismaService],
   })
   export class PrismaModule {}
   ```
2. Import `PrismaModule` once in `AppModule`
3. Remove `PrismaService` from all other module providers

---

### Issue #23: `updateSubTask` Endpoint Uses Full URL in `ApiEndpoints` — Inconsistent

**Labels:** `medium` `frontend` `bug`

**Current State:**  
In `api_endpoints.dart` line 18:
```dart
static String updateSubTask(int taskId, int subTaskId) =>
    'https://busy-bee-task-management-api.onrender.com/tasks/update-subTask/$taskId/subtask/$subTaskId';
```
This is a hardcoded full URL while all other endpoints are relative paths that get appended to `baseUrl`.

**Impact:** If `baseUrl` changes (e.g., during local development), subtask updates will still hit the production server.

**How to Approach:**
```dart
static String updateSubTask(int taskId, int subTaskId) =>
    '/tasks/update-subTask/$taskId/subtask/$subTaskId';
```

---

### Issue #24: Typos in Filenames — `calender`, `provoder`, `provier`

**Labels:** `medium` `frontend` `cleanup`

**Current State:**  
Multiple files have typos in their names:
- `features/calender/` → should be `calendar/`
- `features/calender/state/calender_provier.dart` → should be `calendar_provider.dart`
- `features/stats/state/stats_provoder.dart` → should be `stats_provider.dart`

**Impact:** Makes the codebase look unprofessional and harder to find files via search.

**How to Approach:**
1. Rename directories and files
2. Update ALL imports across the entire codebase — use IDE refactoring tools or find-and-replace:
   ```
   calender → calendar
   calender_provier → calendar_provider
   stats_provoder → stats_provider
   ```
3. **Critical:** Also update `main.dart` imports since they reference these files

---

### Issue #25: No Error Handling for Profile Service — Throws Generic `Error`

**Labels:** `medium` `backend`

**Current State:**  
In `profile.service.ts` line 19:
```typescript
if (!profile) throw new Error('User not found');
```
Uses JavaScript `Error` instead of NestJS `NotFoundException`.

**Impact:** Returns a generic 500 Internal Server Error instead of a proper 404 with a structured error response.

**How to Approach:**
```typescript
if (!profile) throw new NotFoundException('User not found');
```

---

## 🟢 LOW — Polish & Cleanup

---

### Issue #26: Backend Tests Are All Boilerplate — No Real Tests Written

**Labels:** `low` `backend` `testing`

**Current State:**  
- `app.controller.spec.ts`, `users.controller.spec.ts`, `tasks.controller.spec.ts`, etc. — all contain only the auto-generated NestJS boilerplate ("should be defined" tests)
- `test/app.e2e-spec.ts` is the default template
- 0% meaningful test coverage

**Impact:** No safety net for refactoring. Bugs can be introduced without detection.

**How to Approach:**
1. Start with **service-level unit tests** since they contain the business logic:
   - `tasks.service.spec.ts` — Test CRUD, ownership checks, validation
   - `users.service.spec.ts` — Test signup (duplicate email), signin (wrong password), etc.
   - `notifications.service.spec.ts` — Test ownership, read/delete
2. Use **jest mocking** for PrismaService:
   ```typescript
   const mockPrisma = {
     task: { create: jest.fn(), findMany: jest.fn(), ... }
   };
   ```
3. Add **e2e tests** for critical auth flows
4. Add test coverage to CI pipeline

---

### Issue #27: Frontend Tests Are Empty — Only Default Widget Test

**Labels:** `low` `frontend` `testing`

**Current State:**  
`frontend/test/` likely only has the default `widget_test.dart`. No tests for providers, repositories, or widgets.

**Impact:** Same as Issue #26 — no safety net.

**How to Approach:**
1. Test providers with mock repositories using `mockito` or `mocktail`
2. Test critical widgets: `LoginScreen`, `DashboardScreen`, `TaskCard`
3. Test routing/auth guard logic

---

### Issue #28: `app.dart` Referenced in `structure.txt` But Doesn't Exist

**Labels:** `low` `frontend` `cleanup`

**Current State:**  
`structure.txt` lists `app.dart` at the root of `lib/` but this file doesn't exist. `MyApp` class lives directly in `main.dart`.

**Impact:** Minor confusion if following the documented structure.

**How to Approach:**
1. Either extract `MyApp` class into `lib/app.dart` and import it in `main.dart`
2. Or update/delete `structure.txt` (see Issue #19)

---

### Issue #29: Unused Imports and Dead Code Throughout Codebase

**Labels:** `low` `cleanup` `both`

**Current State:**  
Backend:
- `tasks.controller.ts` imports `stat` from `fs` (line 6) — completely unused
- `analytics.controller.ts` has ~130 lines of commented-out code
- `analytics.service.ts` has ~100 lines of commented-out code
- `tasks_provider.dart` has ~40 lines of commented-out code

Frontend:
- `core/providers/app_provider.dart` and `core/providers/initailize.dart` exist but aren't imported anywhere in the active codebase
- `main_layout.dart` is unused (see Issue #16)

**Impact:** Code clutter, harder to navigate and maintain.

**How to Approach:**
1. **Backend:** Run `npm run lint` and fix all unused import warnings
2. **Backend:** Delete all commented-out code — it's in git history if needed
3. **Frontend:** Run `flutter analyze` and fix warnings
4. **Frontend:** Delete unused provider files and `main_layout.dart` if not needed

---

### Issue #30: `core/providers/` Files (`app_provider.dart`, `initailize.dart`) — Orphaned Code

**Labels:** `low` `frontend` `cleanup`

**Current State:**  
- `core/providers/app_provider.dart` (4792 bytes) and `core/providers/initailize.dart` (802 bytes) exist but are never imported
- `main.dart` sets up providers inline rather than using these files
- `initailize.dart` has a typo in the filename (should be `initialize.dart`)

**Impact:** Dead code that may confuse developers.

**How to Approach:**
1. Check if these files contain useful logic that should be merged into `main.dart`
2. If redundant, delete them
3. If useful, fix the filename typo and integrate them

---

### Issue #31: Backend README is Default NestJS Boilerplate

**Labels:** `low` `documentation` `backend`

**Current State:**  
`backend/README.md` is the untouched NestJS starter template with no project-specific information.

**Impact:** New developers have no guidance on project setup, architecture, or API documentation.

**How to Approach:**
1. Replace with project-specific README covering:
   - Project overview (Busy Bee task management API)
   - Prerequisites (Node.js version, PostgreSQL, Redis)
   - Setup steps (`npm install`, `npx prisma migrate dev`, env vars)
   - API endpoint documentation (or link to Swagger if added)
   - Architecture overview (modules, auth flow)
2. Consider adding **Swagger** via `@nestjs/swagger` for auto-generated API docs

---

### Issue #32: No CI/CD Pipeline Configured

**Labels:** `low` `devops`

**Current State:**  
- `.github/` directory exists at root and in both backend/frontend but contains only an `appmod/` directory — no workflow files
- No GitHub Actions, no automated testing, no automated deployment

**Impact:** Manual deployment only, no automated quality gates.

**How to Approach:**
1. Create `.github/workflows/backend-ci.yml`:
   ```yaml
   name: Backend CI
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: cd backend && npm ci
         - run: cd backend && npm run lint
         - run: cd backend && npm test
   ```
2. Create `.github/workflows/frontend-ci.yml` for Flutter analysis and tests
3. Add deployment workflow for Render (backend) using deploy hooks

---

## 📌 Recommended Execution Order

> Start with critical bugs and security issues, then fill feature gaps, then polish.

| Phase | Issues | Focus |
|-------|--------|-------|
| **Phase 1: Security & Crashers** | #1, #3, #4, #5, #7 | Fix the things that are broken or dangerous right now |
| **Phase 2: Core Backend Fixes** | #6, #8, #12, #13, #15, #20, #21, #22, #25 | Make the backend solid and correct |
| **Phase 3: Notifications System** | #2, #9 | Build the full notification pipeline (backend scheduler → frontend UI) |
| **Phase 4: Recurring Tasks** | #10 | Make recurring tasks actually work |
| **Phase 5: Frontend Fixes** | #11, #14, #16, #23, #24 | Fix calendar logic, analytics, navigation, filenames |
| **Phase 6: Cleanup & Polish** | #17, #18, #19, #28, #29, #30 | Remove dead code, centralize theme, fix docs |
| **Phase 7: Testing & CI/CD** | #26, #27, #31, #32 | Add tests and automation |
