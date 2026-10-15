import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@rafeeq/shared'],
  // Provider documents (up to 5 MB) are sent through server actions.
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};

export default withNextIntl(nextConfig);
