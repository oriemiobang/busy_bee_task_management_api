import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { NotificationsDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {

    constructor(private Prisma: PrismaService){}


   async AddNotification(payload: NotificationsDto, userId: number){
        return await this.Prisma.notification.create({
            data: {
                title: payload.title,
                description: payload.description,
                isRead: payload.isRead ?? false,
                user:{connect: {id: userId}} 
            },
            select: {
                title: true,
                description: true,
            }
        })

    }

    async ReadNotification(notificationId: number, readValue: boolean){
        const notification =  await this.Prisma.notification.findUnique({
            where: {id: notificationId}
        })

        if(!notification){
            throw new NotFoundException("Notification Not Found!")
        }

        return this.Prisma.notification.update({
            where: {
                id: notificationId
            },
            data: {
                isRead: readValue
            },
            select: {
                title: true,
                description: true,
                isRead: true
            }
        })
    }



  async  GetNotifications(userId: number){
        const notifications= await this.Prisma.notification.findMany({
            where: {id: userId},
            orderBy: {
            createdAt: 'desc', 
    },
        })

        if(!notifications.length){
            throw new NotFoundException("No Notification Found!")
        }

        return  notifications;

    }


   async DeleteNotification(notificationId: number){
        const notification = await this.Prisma.notification.findUnique({
            where:{ id:notificationId}
        });

        if(!notification){
            throw new NotFoundException('Notification Not Found!')
        }

        await this.Prisma.notification.delete({
            where: {
                id: notificationId
            }
        });

        return "Notification Deleted Succesffully!"
        
    }

    // notification.scheduler.ts



}
