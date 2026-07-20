import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { JwtStrategy } from 'src/users/auth/jwt.strategy';
import { JwtAuthGuard } from 'src/users/auth/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';


import { RecurrenceService } from './recurrence.service';

@Module({
    controllers: [TasksController],
    providers: [
        JwtStrategy,
          {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
          },
        PrismaService, 
        TasksService,
        RecurrenceService
    ]
})
export class TasksModule {}
