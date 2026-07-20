import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';
import { NotificationsService } from './notifications.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkUpcomingDeadlines() {
    this.logger.debug('Running checkUpcomingDeadlines cron job');
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    
    // Find upcoming tasks due in the next 30 minutes
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'COMPLETED' },
        deadline: { gte: now, lte: windowEnd },
      },
    });
    
    for (const task of tasks) {
      // 1. Save in-app notification
      await this.notificationsService.AddNotification(
        { 
          title: `⏰ "${task.title}" is due soon`, 
          description: `Due at ${task.deadline}`, 
          isRead: false 
        },
        task.userId,
      );

      // 2. Queue push notification job
      await this.notificationsQueue.add('send-push', {
        userId: task.userId,
        title: 'Task Deadline Approaching',
        body: `Your task "${task.title}" is due soon.`,
        data: { taskId: task.id.toString() },
      });
    }
  }
}
