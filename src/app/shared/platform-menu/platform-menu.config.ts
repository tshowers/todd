import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Ask TODD's part of the universal menu: what you can do in Ask TODD. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'todd',
  name: 'Ask TODD',
  logo: 'assets/find/entities/todd/logo-icon.png',
  items: [
    { label: 'Ask TODD', icon: 'chat', route: '/', keywords: 'question answer' },
  ],
  secondaryItems: [
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
  ],
  signInRoute: '/login',
};
