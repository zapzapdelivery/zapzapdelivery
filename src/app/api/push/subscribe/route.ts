import { NextResponse } from 'next/server';
import { getAuthContext, supabaseAdmin } from '@/lib/server-auth';

type SubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    if (!ctx.role || (ctx.role !== 'entregador' && ctx.role !== 'admin')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const subscription = (body?.subscription || {}) as SubscriptionJson;

    const endpoint = String(subscription?.endpoint || '').trim();
    const p256dh = String(subscription?.keys?.p256dh || '').trim();
    const auth = String(subscription?.keys?.auth || '').trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Subscription inválida' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent');
    const now = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: ctx.user.id,
          estabelecimento_id: ctx.establishmentId,
          role: ctx.role,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          updated_at: now
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}

