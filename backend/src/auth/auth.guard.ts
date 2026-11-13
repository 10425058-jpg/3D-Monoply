import { CanActivate, createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common';
import { unauthorized } from '../common/errors';
import { AuthService } from './auth.service';

/** Requires "Authorization: Bearer <accessToken>" and stores the user id on the request. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: unknown = req.headers?.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) throw unauthorized();
    req.userId = this.auth.verifyAccessToken(header.slice('Bearer '.length).trim()).userId;
    return true;
  }
}

/** The authenticated user's id. Never trust a userId sent in a request body. */
export const UserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  return context.switchToHttp().getRequest().userId;
});
