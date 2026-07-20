import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor() {
    if (!admin.apps.length) {
      try {
        const serviceAccountPath = path.join(process.cwd(), 'busy-bee-7e457-firebase-adminsdk-fbsvc-c0e02d669f.json');
        
        admin.initializeApp({
          credential: admin.credential.cert(require(serviceAccountPath)),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Firebase Admin SDK', error);
      }
    }
  }

  async sendPushNotification(fcmToken: string, title: string, body: string, data?: any) {
    if (!fcmToken) return null;
    
    try {
      const response = await admin.messaging().send({
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: data || {},
      });
      this.logger.log(`Successfully sent message to token: ${fcmToken}`);
      return response;
    } catch (error) {
      this.logger.error('Error sending message:', error);
      // Don't throw to prevent failing the Bull job permanently if the token is invalid
      return null;
    }
  }
}
