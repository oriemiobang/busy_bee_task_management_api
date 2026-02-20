import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SignUpDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { supabase } from 'src/supabase/supabase.client';

// Define MulterFile type
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}


@Injectable()
export class UsersService {
    private bucket = process.env.SUPABASE_BUCKET!;

    constructor(private prisma: PrismaService, private jwtService: JwtService){}

   async signup(payload: SignUpDto): Promise<{id: number; email: string}>{

    const existingUser = await this.prisma.user.findFirst({
        where: {
            email: payload.email
        }
    })

    if(existingUser){
        throw new BadRequestException("User with this email already Exist");

    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);
    payload.password = hashedPassword;
        return  await this.prisma.user.create({
            data: payload,
            select: {
                id: true,
                email: true,
                name: true,
                profile_image_url: true
            }

        });
    }

   async  signin(signinDto: SigninDto): Promise<{accessToken: string}>{

    const user  = await this.prisma.user.findFirst({
        where: {
            email: signinDto.email
        }
    })

    if(!user){
        throw new BadRequestException("Invalid email")
    }

    const isPasswordValid = await bcrypt.compare(signinDto.password, user.password);
    if(!isPasswordValid){
        throw new UnauthorizedException("Invalid Password");
    }

    const token  = await this.jwtService.signAsync({
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.profile_image_url
    })

    return {accessToken: token}
        
    }

    async updateName(userId: number, name:string){
        const user = await this.prisma.user.findUnique({
            where: {
               id: userId
            }
        });

        if(!user){
            throw new NotFoundException("User not found")
        }

        return await this.prisma.user.update({
            where : {
                id: userId
            },
            data: {
                name
            },
            select: {
                id: true,
                email: true,
                profile_image_url: true,
                name: true
            }
        })

    }



async updatePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      password: true, 
    },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  //  Check current password
  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.password,
  );

  if (!isPasswordCorrect) {
    throw new BadRequestException('Current password is incorrect');
  }

  //  Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  //  Update password
  return this.prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
    select: {
      id: true,
      email: true,
    },
  });
}



async validateUser(email: string, password: string) {
  const user = await this.prisma.user.findUnique({
    where: { email },
  });

  if (!user) return null;

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return null;

  return user;
}




private async uploadAvatar(file: MulterFile, userId: number) {
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  const fileExt = file.originalname.split('.').pop();
  const fileName = `avatars/${userId}/${randomUUID()}.${fileExt}`;

  const { error } = await supabase.storage
    .from(this.bucket)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new BadRequestException(error.message);
  }

  const { data } = supabase.storage
    .from(this.bucket)
    .getPublicUrl(fileName);

  return {
    path: fileName,
    publicUrl: data.publicUrl,
  };
}

private async deleteAvatarByUrl(url?: string) {
  if (!url) return;

  // Extract path from public URL
  const path = url.split(`/storage/v1/object/public/${this.bucket}/`)[1];
  if (!path) return;

  await supabase.storage.from(this.bucket).remove([path]);
}

async addAvatar(
  userId: number,
  file: MulterFile,
) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  if (user.profile_image_url) {
    throw new BadRequestException('Avatar already exists. Use update instead.');
  }

  const { publicUrl } = await this.uploadAvatar(file, userId);

  return this.prisma.user.update({
    where: { id: userId },
    data: {
      profile_image_url: publicUrl,
    },
    select: {
      id: true,
      email: true,
      name: true,
      profile_image_url: true,
    },
  });
}


async updateAvatar(
  userId: number,
  file: MulterFile,
) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // 1️ Delete old avatar
  await this.deleteAvatarByUrl(user.profile_image_url ?? undefined);

  // 2️ Upload new avatar
  const { publicUrl } = await this.uploadAvatar(file, userId);

  // 3️ Update DB
  return this.prisma.user.update({
    where: { id: userId },
    data: {
      profile_image_url: publicUrl,
    },
    select: {
      id: true,
      email: true,
      name: true,
      profile_image_url: true,
    },
  });
}


}
