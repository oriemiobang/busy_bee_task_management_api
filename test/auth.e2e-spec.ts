import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  
  // We mock PrismaService to prevent real DB inserts during e2e testing,
  // or we can test against a real test database.
  // For simplicity, we assume the test suite will run against a clean database.

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/signup (POST) - validation failure', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);
  });
});
