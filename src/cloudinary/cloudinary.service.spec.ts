import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';

function makeConfig(configMap: Record<string, string> = {}) {
  return {
    get: jest.fn().mockImplementation((key: string) => configMap[key]),
  } as unknown as ConfigService;
}

describe('CloudinaryService', () => {
  const defaultConfig = {
    CLOUDINARY_NAME: 'test-cloud',
    CLOUDINARY_KEY: 'test-key',
    CLOUDINARY_SECRET: 'test-secret',
  };

  describe('extractPublicId', () => {
    let service: CloudinaryService;

    beforeEach(() => {
      service = new CloudinaryService(makeConfig(defaultConfig));
    });

    it('extracts publicId from a valid Cloudinary URL with version tag', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1234567890/avatars/user-123.jpg';
      expect(service.extractPublicId(url)).toBe('avatars/user-123');
    });

    it('extracts publicId from a valid Cloudinary URL without version tag', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/folder/subfolder/file.png';
      expect(service.extractPublicId(url)).toBe('folder/subfolder/file');
    });

    it('returns null for non-Cloudinary hostname', () => {
      const url = 'https://example.com/upload/v1/test.jpg';
      expect(service.extractPublicId(url)).toBeNull();
    });

    it('returns null if URL has no "upload" path segment', () => {
      const url = 'https://res.cloudinary.com/demo/image/fetch/test.jpg';
      expect(service.extractPublicId(url)).toBeNull();
    });

    it('returns null for invalid URL string', () => {
      expect(service.extractPublicId('not-a-url')).toBeNull();
    });
  });

  describe('getCredentials', () => {
    it('throws InternalServerErrorException if Cloudinary credentials are not configured', () => {
      const service = new CloudinaryService(makeConfig({}));
      expect(() => (service as any).getCredentials()).toThrow(InternalServerErrorException);
    });

    it('returns credentials when correctly configured', () => {
      const service = new CloudinaryService(makeConfig(defaultConfig));
      const creds = (service as any).getCredentials();
      expect(creds).toEqual({
        cloudName: 'test-cloud',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
    });
  });

  describe('upload', () => {
    it('throws BadRequestException if file or file.buffer is missing', async () => {
      const service = new CloudinaryService(makeConfig(defaultConfig));
      await expect(service.upload(null as any, 'avatars')).rejects.toThrow(BadRequestException);
      await expect(service.upload({ buffer: null } as any, 'avatars')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uploads file buffer and returns upload result', async () => {
      const service = new CloudinaryService(makeConfig(defaultConfig));

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          public_id: 'avatars/pic1',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/avatars/pic1.jpg',
          resource_type: 'image',
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const fakeFile = {
        buffer: Buffer.from('fake image content'),
        mimetype: 'image/jpeg',
      } as any;

      const result = await service.upload(fakeFile, 'avatars');

      expect(result).toEqual({
        publicId: 'avatars/pic1',
        secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v1/avatars/pic1.jpg',
        resourceType: 'image',
      });
    });

    it('throws BadGatewayException when Cloudinary returns non-ok status', async () => {
      const service = new CloudinaryService(makeConfig(defaultConfig));

      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: { message: 'Invalid API Key' },
        }),
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const fakeFile = {
        buffer: Buffer.from('fake image content'),
        mimetype: 'image/jpeg',
      } as any;

      await expect(service.upload(fakeFile, 'avatars')).rejects.toThrow(BadGatewayException);
    });
  });

  describe('deleteByUrl', () => {
    it('returns false immediately if URL publicId cannot be extracted', async () => {
      const service = new CloudinaryService(makeConfig(defaultConfig));
      const result = await service.deleteByUrl('invalid-url');
      expect(result).toBe(false);
    });

    it('deletes publicId and returns true for valid URL', async () => {
      const service = new CloudinaryService(makeConfig(defaultConfig));
      jest.spyOn(service, 'delete').mockResolvedValueOnce();

      const result = await service.deleteByUrl(
        'https://res.cloudinary.com/demo/image/upload/v1234/folder/test.jpg',
      );

      expect(service.delete).toHaveBeenCalledWith('folder/test');
      expect(result).toBe(true);
    });
  });
});
