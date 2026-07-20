import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from 'src/prisma.service';
import { mockPrismaService } from 'src/prisma.mock';
import { BadRequestException } from '@nestjs/common';
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

  describe('getUserNotifications', () => {
    it('should return user notifications', async () => {
      const mockNotifications = [{ id: 1, title: 'Notif 1', userId: 1 }];
      prisma.notification.findMany.mockResolvedValueOnce(mockNotifications);

      const result = await service.getUserNotifications(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('markAsRead', () => {
    it('should throw BadRequestException if notification not found', async () => {
      prisma.notification.findFirst.mockResolvedValueOnce(null);

      await expect(service.markAsRead(999, 1)).rejects.toThrow(BadRequestException);
    });

    it('should mark notification as read', async () => {
      prisma.notification.findFirst.mockResolvedValueOnce({ id: 1, userId: 1 });
      prisma.notification.update.mockResolvedValueOnce({ id: 1, isRead: true });

      const result = await service.markAsRead(1, 1);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isRead: true },
      });
      expect(result).toEqual({ id: 1, isRead: true });
    });
  });
});
