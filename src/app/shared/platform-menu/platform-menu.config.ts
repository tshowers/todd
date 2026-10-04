import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Ask TODD's part of the universal menu: what you can do in Ask TODD. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'ask-todd',
  name: 'Ask TODD',
  items: [
    { label: 'Ask TODD', icon: 'chat', route: '/', keywords: 'question answer home' },
    { label: 'Awards', icon: 'award', route: '/awards', keywords: 'badges achievements' },
  ],
  secondaryItems: [
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
  ],
  // /login hands off to TODD's hosted login (hostedSignInGuard).
  signInRoute: '/login',
};
