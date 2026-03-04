import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthContext } from '@/lib/server-auth';

type AuthUser = {
  id: string;
  email?: string | null;
};

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { role } = await getAuthContext(request);
    if (role === 'atendente' || role === 'estabelecimento') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data?.users ?? []) as AuthUser[];
    const summary = users.map((u: AuthUser) => ({ id: u.id, email: u.email ?? null }));

    return NextResponse.json({ ok: true, count: users.length, users: summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
