import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService){}


//     async taskSummary(userId: number) {
//   const [total, completed, pending] = await Promise.all([
//     this.prisma.task.count({ where: { userId } }),
//     this.prisma.task.count({
//       where: { userId, status: 'COMPLETED' },
//     }),
//     this.prisma.task.count({
//       where: {
//         userId,
//         status: { not: 'COMPLETED' },
//       },
//     }),
//   ]);

//   const completionRate =
//     total === 0 ? 0 : Math.round((completed / total) * 100);

//   return { total, completed, pending, completionRate };
// }

// async completedToday(userId: number) {
//   const start = new Date();
//   start.setHours(0, 0, 0, 0);

//   const end = new Date();
//   end.setHours(23, 59, 59, 999);

//   return this.prisma.task.count({
//     where: {
//       userId,
//       status: 'COMPLETED',
//       updatedAt: {
//         gte: start,
//         lte: end,
//       },
//     },
//   });
// }


// async weeklyOverview(userId: number) {
//   const startOfWeek = new Date();
//   startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
//   startOfWeek.setHours(0, 0, 0, 0);

//   return this.prisma.task.groupBy({
//     by: ['updatedAt'],
//     where: {
//       userId,
//       status: 'COMPLETED',
//       updatedAt: {
//         gte: startOfWeek,
//       },
//     },
//     _count: { id: true },
//   });
// }



// async bestDay(userId: number) {
//   const result = await this.prisma.$queryRaw<
//     { date: Date; count: number }[]
//   >`
//     SELECT 
//       DATE("updatedAt") AS date,
//       COUNT(*)::int AS count
//     FROM "Task"
//     WHERE "userId" = ${userId}
//       AND status = 'COMPLETED'
//     GROUP BY DATE("updatedAt")
//     ORDER BY count DESC
//     LIMIT 1
//   `;

//   return result[0] ?? null;
// }



// async currentStreak(userId: number) {
//   const dates = await this.prisma.$queryRaw<
//     { date: string }[]
//   >`
//     SELECT DISTINCT DATE("updatedAt") as date
//     FROM "Task"
//     WHERE "userId" = ${userId}
//       AND status = 'COMPLETED'
//     ORDER BY date DESC
//   `;

//   let streak = 0;
//   let current = new Date();
//   current.setHours(0, 0, 0, 0);

//   for (const row of dates) {
//     const taskDate = new Date(row.date);
//     taskDate.setHours(0, 0, 0, 0);

//     if (
//       taskDate.getTime() === current.getTime()
//     ) {
//       streak++;
//       current.setDate(current.getDate() - 1);
//     } else {
//       break;
//     }
//   }

//   return streak;
// }



// async averagePerDay(userId: number) {
//   const result = await this.prisma.$queryRaw<
//     { avg: number }[]
//   >`
//     SELECT ROUND(AVG(count), 1) as avg FROM (
//       SELECT DATE("updatedAt"), COUNT(*) as count
//       FROM "Task"
//       WHERE "userId" = ${userId}
//         AND status = 'COMPLETED'
//       GROUP BY DATE("updatedAt")
//     ) t
//   `;

//   return result[0]?.avg ?? 0;
// }


// async dashboard(userId: number) {
//   const [
//     summary,
//     today,
//     streak,
//     bestDay,
//     average,
//   ] = await Promise.all([
//     this.taskSummary(userId),
//     this.completedToday(userId),
//     this.currentStreak(userId),
//     this.bestDay(userId),
//     this.averagePerDay(userId),
//   ]);

//   return {
//     summary,
//     todayCompleted: today,
//     streak,
//     bestDay,
//     average,
//   };
// }


  // =========================
  // DASHBOARD (MAIN ENTRY)
  // =========================
  async dashboard(userId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);

    const [
      todayCompleted,
      todayTotal,
      weeklyOverview,
      totalDone,
      bestDay,
      streak,
      avgPerDay,
    ] = await Promise.all([
      // ✅ Tasks completed today
      this.prisma.task.count({
        where: {
          userId,
          status: 'COMPLETED',
          updatedAt: { gte: today },
        },
      }),

      // ✅ Tasks created today (goal base)
      this.prisma.task.count({
        where: {
          userId,
          createdAt: { gte: today },
        },
      }),

      // ✅ Weekly overview (chart)
      this.prisma.$queryRaw<
        { day: string; count: number }[]
      >`
        SELECT 
          TO_CHAR("updatedAt", 'Dy') AS day,
          COUNT(*)::int AS count
        FROM "tasks"
        WHERE "userId" = ${userId}
          AND status = 'COMPLETED'
          AND "updatedAt" >= ${weekStart}
        GROUP BY day
        ORDER BY MIN("updatedAt")
      `,

      // ✅ Total completed (all time)
      this.prisma.task.count({
        where: { userId, status: 'COMPLETED' },
      }),

      // ✅ Best productivity day
      this.bestDay(userId),

      // ✅ Current streak
      this.calculateStreak(userId),

      // ✅ Average tasks per day
      this.averagePerDay(userId),
    ]);

    const dailyGoalPercent =
      todayTotal === 0
        ? 0
        : Math.round((todayCompleted / todayTotal) * 100);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
   
    const lastWeekCompleted = await this.prisma.task.count({
      where: {
        userId,
        status: 'COMPLETED',
        updatedAt: { gte: lastWeekStart, lt: weekStart },
      },
    });

    const thisWeekCompletedCount = weeklyOverview.reduce((sum, day) => sum + day.count, 0);
    const insightPercent = lastWeekCompleted === 0
      ? (thisWeekCompletedCount > 0 ? 100 : 0)
      : Math.round(((thisWeekCompletedCount - lastWeekCompleted) / lastWeekCompleted) * 100);

    return {
      dailyGoalPercent,
      todayCompleted,
      todayTotal,

      insightPercent,

      weeklyOverview,

      stats: {
        totalDone,
        bestDay,
        streak,
        avgPerDay,
      },
    };
  }

  // =========================
  // BEST DAY EVER
  // =========================
  async bestDay(userId: number) {
    const result = await this.prisma.$queryRaw<
      { date: Date; count: number }[]
    >`
      SELECT 
        DATE("updatedAt") AS date,
        COUNT(*)::int AS count
      FROM "tasks"
      WHERE "userId" = ${userId}
        AND status = 'COMPLETED'
      GROUP BY DATE("updatedAt")
      ORDER BY count DESC
      LIMIT 1
    `;

    if (!result.length) return null;

    return {
      day: result[0].date.toLocaleDateString('en-US', {
        weekday: 'long',
      }),
      count: result[0].count,
    };
  }

  // =========================
  // STREAK (CONSECUTIVE DAYS)
  // =========================
  async calculateStreak(userId: number) {
    const dates = await this.prisma.$queryRaw<
      { date: Date }[]
    >`
      SELECT DISTINCT DATE("updatedAt") AS date
      FROM "tasks"
      WHERE "userId" = ${userId}
        AND status = 'COMPLETED'
      ORDER BY date DESC
    `;

    let streak = 0;
    let current = new Date();
    current.setHours(0, 0, 0, 0);

    for (const row of dates) {
      if (row.date.getTime() === current.getTime()) {
        streak++;
        current.setDate(current.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  // =========================
  // AVERAGE TASKS / DAY (SAFE)
  // =========================
  async averagePerDay(userId: number) {
    const result = await this.prisma.$queryRaw<
      { avg: number | null }[]
    >`
      SELECT 
        ROUND(
          COUNT(*)::numeric / NULLIF(COUNT(DISTINCT DATE("updatedAt")), 0),
          1
        ) AS avg
      FROM "tasks"
      WHERE "userId" = ${userId}
        AND status = 'COMPLETED'
    `;

    return result[0]?.avg ?? 0;
  }


}
