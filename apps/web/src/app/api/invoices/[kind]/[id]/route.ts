import { apiRaw } from '@/lib/api';

/** Streams the sample PDF invoice from the API with the session token (never exposed to the browser). */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!['booking', 'order'].includes(kind) || !/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const res = await apiRaw(`/${kind === 'booking' ? 'bookings' : 'orders'}/${id}/invoice.pdf`);
  if (!res.ok) return new Response('Not found', { status: res.status });
  return new Response(res.body, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="rafeeq-${id.slice(0, 8)}.pdf"` },
  });
}
