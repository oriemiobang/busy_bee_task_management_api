import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Auth_Provider } from 'src/enum/auth_provider.enum';

export class SignUpDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsEnum(Auth_Provider)
  auth_provider: Auth_Provider;

  @IsOptional()
  @IsString()
  profile_image_url?: 'gs://dha-anywaa-challange.appspot.com/blank_profile.png';
}
