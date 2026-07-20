import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';


import { RecurrenceService } from './recurrence.service';

@Module({
    controllers: [TasksController],
    providers: [
        TasksService,
        RecurrenceService
    ]
})
export class TasksModule {}
