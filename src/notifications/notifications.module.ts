import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from 'src/prisma.service';
import { JwtStrategy } from 'src/users/auth/jwt.strategy';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from 'src/users/auth/jwt-auth.guard';
// import { builtinRules } from 'eslint/use-at-your-own-risk';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
      ScheduleModule.forRoot(), // Import ScheduleModule for scheduling tasks
      BullModule.forRoot({
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        }
      })
    ],
    controllers: [NotificationsController],
    providers: [
          JwtStrategy,
                  {
                    provide: APP_GUARD,
                    useClass: JwtAuthGuard,
                  },
        NotificationsService, PrismaService]
})
export class NotificationsModule {}
