import { redirect } from 'next/navigation';
import { token } from '@/lib/api';
import { requireMe } from '@/lib/session';

/** Send each role to its tool. Pilgrims and staff use the mobile app. */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(await token())) redirect(`/${locale}/login`);
  const me = await requireMe(locale);
  if (me.role.startsWith('admin_')) redirect(`/${locale}/admin`);
  redirect(`/${locale}/provider`);
}
