import crypto from 'node:crypto';
import { BRAND_CONFIG } from '@autodey/shared';
import { env } from '../config/env.js';

export interface SignedUploadParams {
  uploadUrl: string;
  provider: 'mock' | 'cloudinary';
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  transformation: string;
  watermarkText: string;
}

export interface MediaAdapter {
  createSignedUpload(folder?: string): SignedUploadParams;
}

export class MockMediaAdapter implements MediaAdapter {
  createSignedUpload(folder = 'autodey/listings'): SignedUploadParams {
    const timestamp = Math.floor(Date.now() / 1000);
    return {
      uploadUrl: `${env.API_URL}/api/v1/media/mock-upload`,
      provider: 'mock',
      timestamp,
      signature: crypto.createHash('sha256').update(`mock:${folder}:${timestamp}`).digest('hex'),
      apiKey: 'mock-cloudinary-key',
      cloudName: 'autodey-local',
      folder,
      transformation: 'f_auto,q_auto:good,w_1280,c_limit',
      watermarkText: BRAND_CONFIG.name,
    };
  }
}

export class CloudinaryMediaAdapter implements MediaAdapter {
  createSignedUpload(folder = 'autodey/listings'): SignedUploadParams {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return new MockMediaAdapter().createSignedUpload(folder);
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const transformation = `f_auto,q_auto:good,w_1280,c_limit/l_text:Poppins_28_bold:${encodeURIComponent(
      BRAND_CONFIG.name,
    )},co_rgb:ffffff,o_60,g_south_east,x_16,y_16`;
    const toSign = `folder=${folder}&timestamp=${timestamp}&transformation=${transformation}${env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      provider: 'cloudinary',
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      folder,
      transformation,
      watermarkText: BRAND_CONFIG.name,
    };
  }
}

export const mediaAdapter: MediaAdapter =
  env.MEDIA_PROVIDER === 'cloudinary' ? new CloudinaryMediaAdapter() : new MockMediaAdapter();

