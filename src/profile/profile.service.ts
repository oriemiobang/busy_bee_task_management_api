import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        profile_image_url: true,
      },
    });

    if (!profile) throw new NotFoundException('User not found');
    return profile;
  }

  async updateAvatar(userId: number, imageUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        profile_image_url: imageUrl,
      },
      select: {
        id: true,
        name: true,
        email: true,
        profile_image_url: true,
      },
    });
  }
}
