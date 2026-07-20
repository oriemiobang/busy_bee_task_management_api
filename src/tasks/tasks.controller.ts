import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';

import { TasksDto } from './dto/tasks.dto';
import { TasksService } from './tasks.service';
import { Status_Enum } from '@prisma/client';

import { SubTaskDto } from './dto/sub_task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private taskService: TasksService) {}

  // add task
  @Post('/add-task')
  async addTask(@Body() body: TasksDto, @Req() req) {
    return await this.taskService.addTask(body, req.user.id);
  }

  // update task
  @Patch('/update-task/:id')
  async updateTask(
    @Param('id') taskId: number,
    @Body() body: TasksDto,
    @Req() req,
  ) {
    return this.taskService.updateTask(body, +taskId, req.user.id);
  }

  // get tasks
  @Get('/get-tasks')
  async getTasks(@Req() req) {
    return this.taskService.getAllTask(req.user.id);
  }

  // delete task
  @Delete('/delete-task/:id')
  async deleteTask(@Param('id') id: number, @Req() req) {
    return await this.taskService.deleteTask(+id, req.user.id);
  }

  @Patch('/update-status/:id')
  async updateStatus(
    @Param('id') taskId: number,
    @Body('status') status: Status_Enum,
    @Req() req,
  ) {
    if (!status || !Object.values(Status_Enum).includes(status)) {
      throw new BadRequestException('Valid status is required');
    }
    return this.taskService.updateStatus(req.user.id, +taskId, status);
  }

  @Patch('/update-subTask/:taskId/subtask/:subTaskId')
  async updateSubTask(
    @Param('taskId') taskId: number,
    @Param('subTaskId') subTaskId: number,
    @Body() dto: SubTaskDto,
    @Req() req,
  ) {
    return this.taskService.updateSubTask(
      +taskId,
      +subTaskId,
      req.user.id,
      dto,
    );
  }

  @Get('upcoming/notifications')
  async getUpcomingTasksForNotifications() {
    return this.taskService.getUpcomingTasksForNotifications();
  }

  @Get('occurrences')
  async getOccurrences(
    @Req() req,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!start || !end) {
      throw new BadRequestException('Start and end dates are required');
    }
    return this.taskService.getOccurrences(
      req.user.id,
      new Date(start),
      new Date(end),
    );
  }
}
