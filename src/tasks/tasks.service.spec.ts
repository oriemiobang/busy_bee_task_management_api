import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from 'src/prisma.service';
import { mockPrismaService } from 'src/prisma.mock';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecurrenceService } from './recurrence.service';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;

  const mockRecurrenceService = {
    generateOccurrencesForTask: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RecurrenceService, useValue: mockRecurrenceService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getAllTask', () => {
    it('should return tasks for the user', async () => {
      const mockTasks = [{ id: 1, title: 'Task 1', subtasks: [] }];
      prisma.task.findMany.mockResolvedValueOnce(mockTasks);

      const result = await service.getAllTask(1);
      expect(result).toEqual(mockTasks);
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: {
          subtasks: true,
          user: { select: { email: true, id: true, name: true } },
        },
        orderBy: [{ start_time: 'asc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('addTask', () => {
    it('should create a task', async () => {
      const mockTask = { id: 1, title: 'New Task', recurrenceType: 'ONCE' };
      prisma.task.create.mockResolvedValueOnce(mockTask);

      const dto = {
        title: 'New Task',
        description: 'Desc',
        startTime: new Date().toISOString(),
      };

      const result = await service.addTask(dto as any, 1);
      expect(prisma.task.create).toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });
  });

  describe('deleteTask', () => {
    it('should throw NotFoundException if task does not exist or does not belong to user', async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteTask(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete task successfully', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 1, userId: 1 });
      prisma.task.delete.mockResolvedValueOnce({ id: 1 });

      const result = await service.deleteTask(1, 1);
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ message: 'Task deleted successfully' });
    });
  });
});
