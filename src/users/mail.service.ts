import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    // In a real app, this would point to a frontend route like /reset-password?token=123
    const resetLink = `${process.env.API_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
    
    try {
      await this.transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'Busy Bee'}" <${process.env.SMTP_FROM || 'noreply@busybee.com'}>`,
        to,
        subject: 'Password Reset Request',
        html: `
          <p>You requested a password reset.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}">Reset Password</a>
          <p>If you did not request this, please ignore this email.</p>
          <br/>
          <p>For mobile testing, here is your token to copy/paste: <b>${token}</b></p>
        `,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      // Don't throw here to avoid exposing SMTP errors to the client, but log it.
    }
  }
}
