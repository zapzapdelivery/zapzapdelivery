import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// Initialize admin client specifically for auth checks requiring bypass
// Note: We use process.env directly here to ensure it works in API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey ?? supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface AuthContext {
  user: any;
  establishmentId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  error?: string;
  status?: number;
}

/**
 * Helper function to authenticate user and retrieve establishment context
 * Can be used in any API route to enforce RBAC
 */
export async function getAuthContext(request: Request | NextRequest): Promise<AuthContext> {
  try {
    // 1. Get Token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return { user: null, establishmentId: null, role: null, isSuperAdmin: false, error: 'Authorization header missing', status: 401 };
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return { user: null, establishmentId: null, role: null, isSuperAdmin: false, error: 'Invalid token', status: 401 };
    }

    // 2. Check Super Admin
    const isSuperAdmin = user.email === 'everaldozs@gmail.com';
    
    // 3. Get Establishment ID and Role
    // We try to find the user in public.usuarios to get their establishment_id and internal ID
    // We check both auth_user_id (standard) and id (legacy/migration support)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('id, estabelecimento_id')
      .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle();

    if (userError) {
      console.error('Error fetching user context:', userError);
      // Don't block super admin on DB error, but block others
      if (!isSuperAdmin) {
        return { user, establishmentId: null, role: null, isSuperAdmin, error: 'Database error fetching user context', status: 500 };
      }
    }

    const establishmentId = userData?.estabelecimento_id || null;
    let role = null;

    if (userData?.id) {
       const { data: roleData } = await supabaseAdmin
         .from('user_roles')
         .select('role')
         .eq('user_id', userData.id)
         .maybeSingle();
       
       if (roleData) {
         role = roleData.role;
       }
    }

    return {
      user,
      establishmentId,
      role,
      isSuperAdmin
    };
  } catch (err) {
    console.error('Unexpected auth error:', err);
    return { user: null, establishmentId: null, role: null, isSuperAdmin: false, error: 'Internal Server Error', status: 500 };
  }
}
