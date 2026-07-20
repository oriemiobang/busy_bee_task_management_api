import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';
import { Day_Of_Week, Recurrence_Type, Task } from '@prisma/client';

@Injectable()
export class RecurrenceService {
  private readonly logger = new Logger(RecurrenceService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Starting daily recurrence generation job...');
    await this.generateOccurrences();
    this.logger.log('Finished recurrence generation job.');
  }

  async generateOccurrences() {
    // Find all recurring tasks that haven't passed their end date
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const lookAheadDays = 30;
    const lookAheadDate = new Date(now);
    lookAheadDate.setDate(lookAheadDate.getDate() + lookAheadDays);

    const recurringTasks = await this.prisma.task.findMany({
      where: {
        recurrenceType: { not: Recurrence_Type.ONCE },
        OR: [
          { recurrenceEndDate: null },
          { recurrenceEndDate: { gte: now } },
        ],
      },
    });

    for (const task of recurringTasks) {
      await this.generateForTask(task, now, lookAheadDate);
    }
  }

  async generateForTask(task: Task, startDate: Date, endDate: Date) {
    const dates = this.calculateOccurrenceDates(task, startDate, endDate);

    for (const date of dates) {
      // Upsert to ensure we don't duplicate occurrences
      try {
        await this.prisma.taskOccurrence.upsert({
          where: {
            taskId_occurrenceDate: {
              taskId: task.id,
              occurrenceDate: date,
            },
          },
          update: {}, // Do nothing if it exists
          create: {
            taskId: task.id,
            occurrenceDate: date,
            status: 'UPCOMING',
          },
        });
      } catch (e) {
        this.logger.error(`Error generating occurrence for task ${task.id} on ${date}: ${e.message}`);
      }
    }
  }

  private calculateOccurrenceDates(task: Task, startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    
    // We start from the task's start_time or startDate, whichever is later
    let current = new Date(task.start_time);
    current.setHours(0, 0, 0, 0);

    // If task start time is in the past, fast forward to startDate
    if (current < startDate) {
      current = new Date(startDate);
    }

    const end = task.recurrenceEndDate && task.recurrenceEndDate < endDate ? new Date(task.recurrenceEndDate) : new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const interval = task.recurrenceInterval || 1;

    while (current <= end) {
      if (this.matchesRecurrence(task, current)) {
        dates.push(new Date(current));
      }
      
      // Advance to next day
      current.setDate(current.getDate() + 1);
    }

    // For DAILY, if interval > 1, the above naive approach fails because it checks every day.
    // Let's refine DAILY with intervals.
    if (task.recurrenceType === Recurrence_Type.DAILY && interval > 1) {
       return this.calculateDailyIntervalDates(task, startDate, end, interval);
    }

    return dates;
  }

  private calculateDailyIntervalDates(task: Task, startDate: Date, endDate: Date, interval: number): Date[] {
    const dates: Date[] = [];
    let current = new Date(task.start_time);
    current.setHours(0, 0, 0, 0);

    // Fast forward to startDate by adding intervals
    while (current < startDate) {
      current.setDate(current.getDate() + interval);
    }

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + interval);
    }

    return dates;
  }

  private matchesRecurrence(task: Task, date: Date): boolean {
    switch (task.recurrenceType) {
      case Recurrence_Type.DAILY:
        // Handled specially if interval > 1 in calculateOccurrenceDates
        return task.recurrenceInterval === 1;

      case Recurrence_Type.WEEKLY:
        const dayMap: Record<number, Day_Of_Week> = {
          0: Day_Of_Week.SUN,
          1: Day_Of_Week.MON,
          2: Day_Of_Week.TUE,
          3: Day_Of_Week.WED,
          4: Day_Of_Week.THU,
          5: Day_Of_Week.FRI,
          6: Day_Of_Week.SAT,
        };
        const currentDay = dayMap[date.getDay()];
        return task.recurrenceDays.includes(currentDay);

      case Recurrence_Type.MONTHLY:
        return date.getDate() === task.recurrenceDayOfMonth;

      case Recurrence_Type.YEARLY:
        const start = new Date(task.start_time);
        return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();

      default:
        return false;
    }
  }
}
