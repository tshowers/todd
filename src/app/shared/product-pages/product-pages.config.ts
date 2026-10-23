import { ProductPagesConfig } from '@taliferro/ui/platform/product-pages.model';

/** Ask TODD's Help and About pages (the shared template). */
export const PRODUCT_PAGES_CONFIG: ProductPagesConfig = {
  key: 'ask-todd',
  logo: 'assets/ask-todd-logo.png',
  logoFill: true,
  openRoute: '/',
  // Ask TODD's header (with the Menu) is hidden on Help and About.
  ownMenu: true,
};
