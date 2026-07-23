import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { UploadedFile } from 'src/users/types';
import {
  CloudinaryCredentials,
  CloudinaryDestroyResponse,
  CloudinaryErrorResponse,
  CloudinaryUploadResponse,
  CloudinaryUploadResult,
} from './interfaces';

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {}

  async upload(file: UploadedFile, folder: string): Promise<CloudinaryUploadResult> {
    if (!file?.buffer) {
      throw new BadRequestException('Avatar file is required.');
    }

    const credentials = this.getCredentials();
    const timestamp = this.timestamp();
    const signedParams = { folder, timestamp };
    const formData = new FormData();

    this.appendSignedParams(formData, signedParams, credentials);
    formData.append('file', this.toDataUri(file));

    const response = await fetch(this.endpoint(credentials.cloudName, 'auto', 'upload'), {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });
    const payload = await this.readJson(response);

    if (!response.ok) {
      throw new BadGatewayException(this.providerErrorMessage('Cloudinary upload failed', payload));
    }

    return this.toUploadResult(payload);
  }

  async deleteByUrl(url: string): Promise<boolean> {
    const publicId = this.extractPublicId(url);
    if (!publicId) return false;

    await this.delete(publicId);
    return true;
  }

  async delete(publicId: string): Promise<void> {
    const credentials = this.getCredentials();
    const timestamp = this.timestamp();
    const signedParams = { public_id: publicId, timestamp };
    const formData = new FormData();

    this.appendSignedParams(formData, signedParams, credentials);

    const response = await fetch(this.endpoint(credentials.cloudName, 'image', 'destroy'), {
      method: 'POST',
      body: formData,
    });
    const payload = await this.readJson(response);

    if (!response.ok) {
      throw new BadGatewayException(this.providerErrorMessage('Cloudinary delete failed', payload));
    }

    const result = this.toDestroyResult(payload);
    if (result !== 'ok' && result !== 'not found') {
      throw new BadGatewayException(`Cloudinary delete failed: ${result}`);
    }
  }

  extractPublicId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('cloudinary.com')) return null;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex === -1) return null;

      let publicIdParts = parts.slice(uploadIndex + 1);
      if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
        publicIdParts = publicIdParts.slice(1);
      }

      const filename = publicIdParts.pop();
      if (!filename) return null;

      const basename = filename.replace(/\.[^/.]+$/, '');
      return [...publicIdParts, basename].join('/');
    } catch {
      return null;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    folder: string,
  ): Promise<CloudinaryUploadResult> {
    if (!buffer?.length) {
      throw new BadRequestException('Upload buffer is empty.');
    }

    const credentials = this.getCredentials();
    const timestamp = this.timestamp();
    const signedParams = { folder, timestamp };
    const formData = new FormData();

    this.appendSignedParams(formData, signedParams, credentials);

    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
    formData.append('file', dataUri);

    const response = await fetch(this.endpoint(credentials.cloudName, 'auto', 'upload'), {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(30_000), // larger files need more time
    });

    const payload = await this.readJson(response);

    if (!response.ok) {
      throw new BadGatewayException(
        this.providerErrorMessage('Cloudinary buffer upload failed', payload),
      );
    }

    return this.toUploadResult(payload); // returns { publicId, secureUrl, resourceType }
  }

  private appendSignedParams(
    formData: FormData,
    params: Record<string, string>,
    credentials: CloudinaryCredentials,
  ): void {
    for (const [key, value] of Object.entries(params)) {
      formData.append(key, value);
    }
    formData.append('api_key', credentials.apiKey);
    formData.append('signature', this.sign(params, credentials.apiSecret));
  }

  private endpoint(cloudName: string, resourceType: string, action: string): string {
    return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/${action}`;
  }

  private getCredentials(): CloudinaryCredentials {
    const cloudName = this.firstConfig('CLOUDINARY_NAME', 'CLOUDINARY_CLOUD_NAME');
    const apiKey = this.firstConfig('CLOUDINARY_KEY', 'CLOUDINARY_API_KEY');
    const apiSecret = this.firstConfig('CLOUDINARY_SECRET', 'CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException('Cloudinary is not configured.');
    }

    return { cloudName, apiKey, apiSecret };
  }

  private firstConfig(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.config.get<string>(key)?.trim();
      if (value) return value;
    }
    return undefined;
  }

  private sign(params: Record<string, string>, apiSecret: string): string {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }

  private timestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  private toDataUri(file: UploadedFile): string {
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }

  private toUploadResult(payload: unknown): CloudinaryUploadResult {
    if (!this.isRecord(payload)) {
      throw new BadGatewayException('Cloudinary upload returned an invalid response.');
    }

    const response = payload as CloudinaryUploadResponse;
    if (
      typeof response.public_id !== 'string' ||
      typeof response.secure_url !== 'string' ||
      typeof response.resource_type !== 'string'
    ) {
      throw new BadGatewayException('Cloudinary upload returned an invalid response.');
    }

    return {
      publicId: response.public_id,
      secureUrl: response.secure_url,
      resourceType: response.resource_type,
    };
  }

  private toDestroyResult(payload: unknown): string {
    if (!this.isRecord(payload)) return 'invalid response';

    const response = payload as CloudinaryDestroyResponse;
    return typeof response.result === 'string' ? response.result : 'invalid response';
  }

  private providerErrorMessage(prefix: string, payload: unknown): string {
    if (!this.isRecord(payload)) return prefix;

    const response = payload as CloudinaryErrorResponse;
    const message = response.error?.message;
    return typeof message === 'string' ? `${prefix}: ${message}` : prefix;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
