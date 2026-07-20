import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from 'src/prisma.service';
import { mockPrismaService } from 'src/prisma.mock';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  const mockFirebaseService = {
    sendNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FirebaseService, useValue: mockFirebaseService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('GetNotifications', () => {
    it('should return user notifications', async () => {
      const mockNotifications = [{ id: 1, title: 'Notif 1', userId: 1 }];
      prisma.notification.findMany.mockResolvedValueOnce(mockNotifications);

      const result = await service.GetNotifications(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('ReadNotification', () => {
    it('should throw NotFoundException if notification not found', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce(null);

      await expect(service.ReadNotification(999, true, 1)).rejects.toThrow(NotFoundException);
    });

    it('should mark notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce({ id: 1, userId: 1 });
      prisma.notification.update.mockResolvedValueOnce({ id: 1, isRead: true });

      const result = await service.ReadNotification(1, true, 1);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRead: true },
        select: { title: true, description: true, isRead: true },
      });
      expect(result).toEqual({ id: 1, isRead: true });
    });
  });
});
