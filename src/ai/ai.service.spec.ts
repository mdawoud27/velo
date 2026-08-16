import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

function makeConfig(apiKey = 'fake-groq-key') {
  return {
    getOrThrow: jest.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService;
}

describe('AiService', () => {
  let service: AiService;
  let config: ConfigService;

  beforeEach(() => {
    config = makeConfig();
    service = new AiService(config);
  });

  describe('suggest', () => {
    it('parses and returns JSON suggestion from Groq', async () => {
      const mockResult = { title: 'New Task', priority: 'HIGH' };
      (service as any).groq = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(mockResult) } }],
            }),
          },
        },
      };

      const result = await service.suggest({ context: 'Build user auth' });

      expect(result).toEqual(mockResult);
    });

    it('throws BadGatewayException when Groq API throws an error', async () => {
      (service as any).groq = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('Groq timeout')),
          },
        },
      };

      await expect(service.suggest({ context: 'Test' })).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when Groq returns empty content', async () => {
      (service as any).groq = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: '' } }],
            }),
          },
        },
      };

      await expect(service.suggest({ context: 'Test' })).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when Groq returns unparseable JSON', async () => {
      (service as any).groq = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Not valid json' } }],
            }),
          },
        },
      };

      await expect(service.suggest({ context: 'Test' })).rejects.toThrow(BadGatewayException);
    });
  });
});
