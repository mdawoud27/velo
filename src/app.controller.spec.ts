import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('serveRoot', () => {
    it('sets Content-Type header and sends HTML', () => {
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      appController.serveRoot(res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.send).toHaveBeenCalledWith(expect.stringMatching(/<!doctype html>/i));
    });
  });
});
