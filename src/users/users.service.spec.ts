import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from './mail.service';
import { mockPrismaService } from 'src/prisma.mock';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let jwtService: any;

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockMailService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should throw BadRequestException if user already exists', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 1,
        email: 'test@test.com',
      });

      await expect(
        service.signup({
          name: 'Test',
          email: 'test@test.com',
          password: 'pass',
          auth_provider: 'email',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user and return accessToken', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 1,
        email: 'test@test.com',
        name: 'Test',
        profile_image_url: 'img.jpg',
      });
      jwtService.signAsync.mockResolvedValueOnce('fake-jwt-token');

      const result = await service.signup({
        name: 'Test',
        email: 'test@test.com',
        password: 'pass',
        auth_provider: 'email',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('fake-jwt-token');
      expect(result.id).toBe(1);
    });
  });

  describe('signin', () => {
    it('should throw BadRequestException for invalid email', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.signin({ email: 'test@test.com', password: 'pass' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid password', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 1,
        email: 'test@test.com',
        password: 'hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.signin({ email: 'test@test.com', password: 'wrong-pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return accessToken on successful login', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 1,
        email: 'test@test.com',
        password: 'hashed-password',
        name: 'Test',
        profile_image_url: '',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      jwtService.signAsync.mockResolvedValueOnce('fake-jwt-token');

      const result = await service.signin({
        email: 'test@test.com',
        password: 'correct-pass',
      });

      expect(result.accessToken).toBe('fake-jwt-token');
    });
  });
});
