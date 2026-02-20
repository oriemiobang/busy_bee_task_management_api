import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from 'src/users/auth/jwt-auth.guard';


@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {

    constructor(private profileService: ProfileService) {}

    @Get('/me')
    getProfile(
        @Req() req
    ){
        return this.profileService.getProfile(req.user.id);
    }



}
