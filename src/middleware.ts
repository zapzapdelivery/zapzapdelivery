import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const search = request.nextUrl.searchParams
  
  // Skip middleware for static assets and internal Next.js paths EARLY
  // This prevents unnecessary Supabase calls and potential HMR errors
  if (
    path.startsWith('/_next') || 
    path.startsWith('/__nextjs_original-stack-frames') ||
    path.startsWith('/static') || 
    path.includes('.') ||
    path === '/favicon.ico' ||
    // Skip all RSC/HMR prefetches to avoid aborted fetch logs in dev
    search.has('_rsc') ||
    search.has('ide_webview_request_time')
  ) {
    return NextResponse.next()
  }

  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Public paths that don't require auth (already filtered some in early exit)
    const isPublicPath = 
      path === '/paineladmin' || 
      path.startsWith('/api/') || 
      path.startsWith('/estabelecimentos/cardapio') ||
      path === '/estabelecimentos'

    if (!user && !isPublicPath) {
      // Redirect to login if not authenticated
      const url = request.nextUrl.clone()
      url.pathname = '/paineladmin'
      return NextResponse.redirect(url)
    }

    // If authenticated, check roles for specific paths
    if (user) {
      // Fetch role once if needed
      let role: string | null = null;
      const isMinhaConta = path.startsWith('/minhaconta');
      const isPainelEntregador = path.startsWith('/painelentregador');
      const isCheckout = path.startsWith('/checkout');
      const isAdminArea = !isMinhaConta && !isPainelEntregador && !isPublicPath && !isCheckout;

      if (path === '/paineladmin' || isMinhaConta || isPainelEntregador || isCheckout || isAdminArea) {
        if (user.email === 'everaldozs@gmail.com') {
          role = 'admin';
        } else {
          role = await getUserRole(supabase, user.id);
        }
      }

      // Special case for login page: redirect to appropriate dashboard
      if (path === '/paineladmin') {
        const url = request.nextUrl.clone()
        if (role === 'cliente') url.pathname = '/minhaconta'
        else if (role === 'entregador') url.pathname = '/painelentregador'
        else url.pathname = '/'
        return NextResponse.redirect(url)
      }

      // Protect /minhaconta (Customer Area)
      if (isMinhaConta) {
        if (role !== 'cliente' && role !== 'admin') {
          const url = request.nextUrl.clone()
          url.pathname = '/'
          return NextResponse.redirect(url)
        }
      }

      // Protect /painelentregador (Delivery Area)
      if (isPainelEntregador) {
        if (role !== 'entregador' && role !== 'admin') {
          const url = request.nextUrl.clone()
          url.pathname = '/'
          return NextResponse.redirect(url)
        }
      }

      // Protect Admin Area
      if (isAdminArea && path !== '/') {
         if (role === 'cliente') {
           const url = request.nextUrl.clone()
           url.pathname = '/minhaconta'
           return NextResponse.redirect(url)
         }
         if (role === 'entregador') {
           const url = request.nextUrl.clone()
           url.pathname = '/painelentregador'
           return NextResponse.redirect(url)
         }
      }
      
      // Protect root path
      if (path === '/') {
        if (role === 'cliente') {
          const url = request.nextUrl.clone()
          url.pathname = '/minhaconta'
          return NextResponse.redirect(url)
        }
        if (role === 'entregador') {
          const url = request.nextUrl.clone()
          url.pathname = '/painelentregador'
          return NextResponse.redirect(url)
        }
      }
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

// Helper to fetch user role in middleware
async function getUserRole(supabase: any, userId: string): Promise<string | null> {
  try {
    // 1. Try user_roles table
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
      
    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
    } else if (Array.isArray(rolesData) && rolesData.length > 0) {
      const roles = rolesData.map((r: any) => String(r.role || '').trim().toLowerCase());
      if (roles.includes('estabelecimento')) return 'estabelecimento';
      if (roles.includes('admin')) return 'admin';
      if (roles.includes('cliente')) return 'cliente';
      if (roles.includes('entregador')) return 'entregador';
      return roles[0] || null;
    }

    // 2. Try usuarios table (tipos_usuarios)
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select(`
          tipos_usuarios (nome_tipo_usuario)
      `)
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('Error fetching user type from usuarios:', userError);
    } else if (userData?.tipos_usuarios) {
        const typeName = String(userData.tipos_usuarios.nome_tipo_usuario || '').toLowerCase();
        if (typeName.includes('estabelecimento')) return 'estabelecimento';
        if (typeName.includes('admin')) return 'admin';
        if (typeName.includes('cliente')) return 'cliente';
        if (typeName.includes('entregador')) return 'entregador';
        return typeName;
    }
  } catch (err) {
    console.error('Unexpected error in getUserRole:', err);
  }

  return null;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
