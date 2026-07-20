export const mockPrismaService = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  subTask: {
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  },
  taskOccurrence: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)),
};
