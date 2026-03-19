import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ role: null }, { status: 200 });
    }
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !auth?.user) {
      return NextResponse.json({ role: null }, { status: 200 });
    }
    const userId = auth.user.id;
    const email = String(auth.user.email || '').toLowerCase();
    if (email === 'everaldozs@gmail.com' || email === 'everaldozszap@gmail.com') {
      return NextResponse.json(
        { role: 'admin', establishment_id: null, establishment_name: null },
        { status: 200 }
      );
    }
    // console.log('[API/me/role] User identified:', userId);

    // 1. Check user_roles table (primary source for system roles)
    const { data: rolesData, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
      
    if (rolesError) {
      // Quietly handle role error
    }

    let role: string | null = null;
    if (Array.isArray(rolesData) && rolesData.length > 0) {
      const roles = rolesData.map((r: any) => String(r.role || '').trim().toLowerCase());
      if (roles.includes('estabelecimento')) role = 'estabelecimento';
      else role = roles[0] || null;
    }

    // 2. Fetch user data for establishment_id and fallback role
    const { data: userData, error: userError } = await supabaseAdmin
        .from('usuarios')
        .select(`
            estabelecimento_id, 
            tipo_usuario_id, 
            tipos_usuarios!inner(nome_tipo_usuario),
            estabelecimentos (
                nome_estabelecimento
            )
        `)
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle to avoid error if not found

    const establishment_id = userData?.estabelecimento_id || null;
    // @ts-ignore
    const establishment_name = userData?.estabelecimentos?.nome_estabelecimento || null;

    // 3. If no role found in user_roles, use fallback from tipos_usuarios
    if (!role && userData && userData.tipos_usuarios) {
        // @ts-ignore
        const typeName = String(userData.tipos_usuarios.nome_tipo_usuario || '').toLowerCase();
        
        // Use the type name as the role by default
        role = typeName;
        
        if (typeName.includes('estabelecimento')) {
          role = 'estabelecimento';
        }
    } else if (!role && userError && userError.code !== 'PGRST116') {
         // Quietly handle user error
    }

    // console.log('[API/me/role] Final Role:', role, 'Estab:', establishment_id);
    return NextResponse.json({ role, establishment_id, establishment_name }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
