import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { FirebaseService } from './firebase.service';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

interface PushNotificationJob {
  userId: number;
  title: string;
  body: string;
  data?: any;
}

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('send-push')
  async handleSendPush(job: Job<PushNotificationJob>) {
    this.logger.debug('Start processing push notification job...');
    const { userId, title, body, data } = job.data;

    // Retrieve the user's FCM token from DB
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user && user.fcmToken) {
      await this.firebaseService.sendPushNotification(
        user.fcmToken,
        title,
        body,
        data,
      );
    } else {
      this.logger.debug(
        `User ${userId} has no FCM token, skipping push notification.`,
      );
    }
  }
}
