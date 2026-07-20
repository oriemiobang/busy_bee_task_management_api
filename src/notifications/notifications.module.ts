import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationScheduler } from './notification.scheduler';
import { NotificationProcessor } from './notification.processor';
import { FirebaseService } from './firebase.service';

@Module({
    imports: [
      ScheduleModule.forRoot(),
      BullModule.forRoot({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        }
      }),
      BullModule.registerQueue({
        name: 'notifications',
      }),
    ],
    controllers: [NotificationsController],
    providers: [
      NotificationsService, 
      NotificationScheduler,
      NotificationProcessor,
      FirebaseService,
    ]
})
export class NotificationsModule {}
