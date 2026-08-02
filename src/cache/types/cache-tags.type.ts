import { AuthedRequest } from './auth-req.type';

export type CacheTagsResolver = (req: AuthedRequest) => string[];
