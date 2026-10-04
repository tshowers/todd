import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

import { AuthService } from '../../services/auth.service';

/**
 * /login starts TODD's hosted login (Google, Apple, phone or email), the same
 * page every TODD product uses, and returns to ?returnUrl afterwards. The
 * route never renders.
 */
export const hostedSignInGuard: CanActivateFn = ( route ) => {
  if ( typeof window === 'undefined' ) return false;
  inject( AuthService ).startHostedSignIn( route.queryParamMap.get( 'returnUrl' ) || '/' );
  return false;
};
