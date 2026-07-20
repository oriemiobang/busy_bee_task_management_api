import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SignUpDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { PrismaService } from 'src/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes } from 'crypto';
import { supabase } from 'src/supabase/supabase.client';
import { OAuth2Client } from 'google-auth-library';
import { MailService } from './mail.service';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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
    

    constructor(
      private prisma: PrismaService, 
      private jwtService: JwtService,
      private mailService: MailService
    ){}

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
            data: {
              name: payload.name,
              email: payload.email,
              password: payload.password,
              auth_provider: payload.auth_provider

            },
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



// google sign in 
googleLogin(req){
  if(!req.user){
    return 'No user from google'
  }
  return {
    message: 'User information from google',
    user: req.user
  }
}



async googleMobileLogin(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new UnauthorizedException('Invalid Google token');
  }

  const { email, name, picture } = payload;

  if (!email) {
    throw new UnauthorizedException('Google account does not have an email');
  }

  let user = await this.prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await this.prisma.user.create({
      data: {
        email,
        name: name ?? '',
        profile_image_url: picture,
        auth_provider: 'GOOGLE',
        password: '', // no password for google users
      },
    });
  }

  const accessToken = await this.jwtService.signAsync({
    id: user.id,
    email: user.email,
    name: user.name,
    imageUrl: user.profile_image_url,
  });

  return {
    accessToken,
    user,
  };
}


async updateFcmToken(userId: number, fcmToken: string) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { fcmToken },
    select: { id: true },
  });
}

async logout(token: string) {
  const decoded = this.jwtService.decode(token) as any;
  if (decoded && decoded.exp) {
    const expiresAt = new Date(decoded.exp * 1000);
    // Add token to blacklist
    await this.prisma.blacklistedToken.create({
      data: {
        token,
        expiresAt,
      },
    });
  }
  return { message: 'Logged out successfully' };
}

async forgotPassword(email: string) {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Return success to prevent email enumeration attacks
    return { message: 'If that email is registered, a password reset link has been sent.' };
  }

  // Generate 32-byte hex token
  const resetToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

  // Save token to DB
  await this.prisma.passwordResetToken.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt,
    },
  });

  // Send email
  await this.mailService.sendPasswordResetEmail(user.email, resetToken);

  return { message: 'If that email is registered, a password reset link has been sent.' };
}

async resetPassword(token: string, newPassword: string) {
  const resetRecord = await this.prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetRecord || resetRecord.expiresAt < new Date()) {
    throw new BadRequestException('Invalid or expired password reset token');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await this.prisma.user.update({
    where: { id: resetRecord.userId },
    data: { password: hashedPassword },
  });

  // Delete the used token (and any other expired tokens for cleanup)
  await this.prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { id: resetRecord.id },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });

  return { message: 'Password has been successfully reset' };
}

}
