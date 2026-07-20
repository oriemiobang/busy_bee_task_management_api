import { Body, Controller, Get, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { SignUpDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { UsersService } from './users.service';
import { Public } from './auth/public.decorator';
import { UpdateNameDto } from './dto/update_name.dto';

import { UpdatePasswordDto } from './dto/update_password.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { File as MulterFile } from 'multer';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class UsersController {


    constructor(private userService: UsersService){}


    // sign in a user
    @Public()
    @Post('/signin')
    async signin(@Body() body: SigninDto){
        return  this.userService.signin(body)

    }


    // sign up a user
    @Public()
    @Post('/signup')
  async  signup(@Body() body: SignUpDto){
        return  this.userService.signup(body);
    }



    @Post('/update-name')
    updateName(@Body() body: UpdateNameDto, @Req() req){
        const userId = req.user.id;
        return this.userService.updateName(userId, body.name);
    }

    @Patch('/update-password')
    updatePassword(
        @Body() body: UpdatePasswordDto,
        @Req() req,
    ) {
        const userId = req.user.id;

        return this.userService.updatePassword(
        userId,
        body.currentPassword,
        body.newPassword,
        );
    }

    @UseInterceptors(FileInterceptor('avatar'))
    @Post('avatar')
    addAvatar(
    @Req() req,
    @UploadedFile() file: MulterFile,
    ) {
    return this.userService.addAvatar(req.user.id, file);
    }

    @UseInterceptors(FileInterceptor('avatar'))
    @Put('avatar')
    updateAvatar(
    @Req() req,
    @UploadedFile() file: MulterFile,
    ) {
    return this.userService.updateAvatar(req.user.id, file);
    }

    // google sign in 
    @Get('google')
    @UseGuards(AuthGuard('google'))
    googleAuth(@Req() req) {
        // initiates the Google OAuth2 login flow
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(@Req() req) {
        return this.userService.googleLogin(req);
    }


@Public()
@Post('google')
async googleMobileLogin(@Body('idToken') idToken: string) {
  return this.userService.googleMobileLogin(idToken);
}

    // Register or update device FCM token for push notifications
    @Patch('fcm-token')
    updateFcmToken(@Body('fcmToken') fcmToken: string, @Req() req) {
        return this.userService.updateFcmToken(req.user.id, fcmToken);
    }

    @Post('/logout')
    async logout(@Req() req) {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            return this.userService.logout(token);
        }
        return { message: 'Logged out successfully' };
    }

    @Public()
    @Post('/forgot-password')
    async forgotPassword(@Body('email') email: string) {
        if (!email) {
            return { message: 'Email is required' };
        }
        return this.userService.forgotPassword(email);
    }

    @Public()
    @Post('/reset-password')
    async resetPassword(@Body() body: any) {
        if (!body.token || !body.newPassword) {
            return { message: 'Token and newPassword are required' };
        }
        return this.userService.resetPassword(body.token, body.newPassword);
    }

}
