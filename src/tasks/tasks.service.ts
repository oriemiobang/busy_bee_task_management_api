import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TasksDto } from './dto/tasks.dto';
import { Status_Enum, Recurrence_Type, Day_Of_Week } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async addTask(payload: TasksDto, userId: number) {
    // Validate recurrence days if provided
    if (payload.recurrenceDays && payload.recurrenceDays.length > 0) {
      const invalidDays = payload.recurrenceDays.filter(
        day => !Object.values(Day_Of_Week).includes(day as Day_Of_Week)
      );
      if (invalidDays.length > 0) {
        throw new BadRequestException(`Invalid recurrence days: ${invalidDays.join(', ')}`);
      }
    }

    // Validate recurrence type
    if (payload.recurrenceType && !Object.values(Recurrence_Type).includes(payload.recurrenceType)) {
      throw new BadRequestException(`Invalid recurrence type: ${payload.recurrenceType}`);
    }

    return this.prisma.task.create({
      data: {
        title: payload.title?.trim() || 'Untitled Task',
        description: payload.description?.trim() || '',
        status: payload.status || Status_Enum.UPCOMING,
        start_time: new Date(payload.start_time || new Date()),
        deadline: payload.deadline ? new Date(payload.deadline) : null,
        
        // ✅ RECURRENCE FIELDS (with defaults matching Prisma schema)
        recurrenceType: payload.recurrenceType || Recurrence_Type.ONCE,
        recurrenceInterval: payload.recurrenceInterval ?? 1,
        recurrenceDays: payload.recurrenceDays as Day_Of_Week[] || [],
        recurrenceDayOfMonth: payload.recurrenceDayOfMonth ?? 1,
        recurrenceEndDate: payload.recurrenceEndDate ? new Date(payload.recurrenceEndDate) : null,
        
        // Subtasks
        subTasks: payload.subtasks?.length
          ? {
              create: payload.subtasks.map(subtask => ({
                title: subtask.title.trim(),
                isDone: subtask.isDone ?? false,
              })),
            }
          : undefined,
        
        // Relations
        userId,
      },
      include: {
        subTasks: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  // ✅ PARTIAL UPDATE WITH VALIDATION (critical fix)
  async updateTask(payload: TasksDto, taskId: number, userId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { user: true },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Not authorized to update this task');

    // Build update data conditionally (only include provided fields)
    const updateData: any = {};
    
    if (payload.title !== undefined) updateData.title = payload.title.trim();
    if (payload.description !== undefined) updateData.description = payload.description.trim() || '';
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.start_time !== undefined) updateData.start_time = new Date(payload.start_time);
    if (payload.deadline !== undefined) {
      updateData.deadline = payload.deadline ? new Date(payload.deadline) : null;
    }
    
    // ✅ RECURRENCE VALIDATION & UPDATE
    if (payload.recurrenceType !== undefined) {
      if (!Object.values(Recurrence_Type).includes(payload.recurrenceType)) {
        throw new BadRequestException(`Invalid recurrence type: ${payload.recurrenceType}`);
      }
      updateData.recurrenceType = payload.recurrenceType;
    }
    
    if (payload.recurrenceInterval !== undefined) {
      if (payload.recurrenceInterval < 1) {
        throw new BadRequestException('Recurrence interval must be at least 1');
      }
      updateData.recurrenceInterval = payload.recurrenceInterval;
    }
    
    if (payload.recurrenceDays !== undefined) {
      if (payload.recurrenceDays.length > 0) {
        const invalidDays = payload.recurrenceDays.filter(
          day => !Object.values(Day_Of_Week).includes(day as Day_Of_Week)
        );
        if (invalidDays.length > 0) {
          throw new BadRequestException(`Invalid recurrence days: ${invalidDays.join(', ')}`);
        }
      }
      updateData.recurrenceDays = payload.recurrenceDays as Day_Of_Week[];
    }
    
    if (payload.recurrenceDayOfMonth !== undefined) {
      if (payload.recurrenceDayOfMonth < 1 || payload.recurrenceDayOfMonth > 31) {
        throw new BadRequestException('Recurrence day of month must be between 1 and 31');
      }
      updateData.recurrenceDayOfMonth = payload.recurrenceDayOfMonth;
    }
    
    if (payload.recurrenceEndDate !== undefined) {
      updateData.recurrenceEndDate = payload.recurrenceEndDate 
        ? new Date(payload.recurrenceEndDate) 
        : null;
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        subTasks: { orderBy: { id: 'asc' } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ✅ DELETE TASK (with ownership check)
  async deleteTask(taskId: number, userId: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Not authorized to delete this task');
    
    // ✅ CASCADE DELETE: Prisma handles subtasks via onDelete: Cascade
    await this.prisma.task.delete({ where: { id: taskId } });
    
    // ✅ CLEANUP: Delete associated notifications (handled by Prisma onDelete: SetNull)
    await this.prisma.notification.deleteMany({ 
      where: { taskId } 
    });
    
    return { message: 'Task deleted successfully' };
  }

  // ✅ GET USER TASKS (optimized query)
  async getAllTask(userId: number) {
    const tasks = await this.prisma.task.findMany({
      where: { userId },
      include: {
        subTasks: { orderBy: { id: 'asc' } },
        user: { select: { id: true, name: true, email: true } },
        // ✅ INCLUDE NOTIFICATIONS FOR CONTEXT (optional)
        // notifications: {
        //   where: { isRead: false },
        //   orderBy: { createdAt: 'desc' },
        //   take: 3,
        // },
      },
      orderBy: [
        { start_time: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    if (!tasks.length) throw new NotFoundException('No tasks found');
    return tasks;
  }

  // ✅ UPDATE TASK STATUS (with validation)
  async updateStatus(userId: number, taskId: number, status: Status_Enum) {
    if (!Object.values(Status_Enum).includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const task = await this.prisma.task.findUnique({ 
      where: { id: taskId },
      include: { user: true },
    });
    
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Not authorized');
    
    // ✅ CREATE NOTIFICATION FOR COMPLETION (future-ready)
    if (status === Status_Enum.COMPLETED && task.status !== Status_Enum.COMPLETED) {
      // Notification creation will be handled by a dedicated notification service
      // This is a placeholder for future integration
      console.log(`Task ${taskId} completed - notification would be triggered`);
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
      select: { id: true, title: true, status: true, updatedAt: true },
    });
  }

  // ✅ UPDATE SUBTASK (with ownership validation)
  async updateSubTask(
    taskId: number,
    subTaskId: number,
    userId: number,
    data: { title?: string; isDone?: boolean },
  ) {
    // ✅ SINGLE QUERY FOR VALIDATION (optimized)
    const subTask = await this.prisma.subTask.findUnique({
      where: { id: subTaskId },
      include: { task: { include: { user: true } } },
    });

    if (!subTask) throw new NotFoundException('Subtask not found');
    if (subTask.taskId !== taskId) {
      throw new BadRequestException('Subtask does not belong to this task');
    }
    if (subTask.task.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this subtask');
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.isDone !== undefined) updateData.isDone = data.isDone;

    return this.prisma.subTask.update({
      where: { id: subTaskId },
      data: updateData,
    });
  }

  // ✅ GET UPCOMING TASKS FOR NOTIFICATION SCHEDULER (NEW)
  async getUpcomingTasksForNotifications() {
    const now = new Date();
    const notificationWindow = new Date(now.getTime() + 30 * 60 * 1000); // Next 30 minutes

    return this.prisma.task.findMany({
      where: {
        status: { not: Status_Enum.COMPLETED },
        deadline: {
          gte: now,
          lte: notificationWindow,
        },
        notifications: { none: { isRead: true } }, // No unread notifications
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            notificationPush: true,
            reminderMinutes: true,
          },
        },
      },
    });
  }
}