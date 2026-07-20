import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

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
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
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
      todayTotal === 0 ? 0 : Math.round((todayCompleted / todayTotal) * 100);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekCompleted = await this.prisma.task.count({
      where: {
        userId,
        status: 'COMPLETED',
        updatedAt: { gte: lastWeekStart, lt: weekStart },
      },
    });

    const thisWeekCompletedCount = weeklyOverview.reduce(
      (sum, day) => sum + day.count,
      0,
    );
    const insightPercent =
      lastWeekCompleted === 0
        ? thisWeekCompletedCount > 0
          ? 100
          : 0
        : Math.round(
            ((thisWeekCompletedCount - lastWeekCompleted) / lastWeekCompleted) *
              100,
          );

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
    const result = await this.prisma.$queryRaw<{ date: Date; count: number }[]>`
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
    const dates = await this.prisma.$queryRaw<{ date: Date }[]>`
      SELECT DISTINCT DATE("updatedAt") AS date
      FROM "tasks"
      WHERE "userId" = ${userId}
        AND status = 'COMPLETED'
      ORDER BY date DESC
    `;

    let streak = 0;
    const current = new Date();
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
    const result = await this.prisma.$queryRaw<{ avg: number | null }[]>`
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
