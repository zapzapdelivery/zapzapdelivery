"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { menuCacheService } from '@/services/menuCacheService';
import { 
  LayoutDashboard, 
  Store, 
  Shapes, 
  Package, 
  Warehouse, 
  ClipboardList, 
  Users, 
  Truck, 
  UserCog, 
  Ticket, 
  BarChart3, 
  Settings,
  MessageSquare,
  LogOut,
  X
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface MenuItem {
  icon: any;
  label: string;
  href: string;
  subItems?: { label: string; href: string }[];
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ClipboardList, label: 'Pedidos', href: '/pedidos' },
  { icon: Store, label: 'Estabelecimentos', href: '/gerenciar/estabelecimentos' },
  { icon: Package, label: 'Produtos', href: '/produtos' },
  { icon: Shapes, label: 'Categorias', href: '/categorias' },
  { icon: Warehouse, label: 'Estoque', href: '/estoque/movimentacoes' },
  { icon: Users, label: 'Clientes', href: '/clientes' },
  { icon: Truck, label: 'Entregadores', href: '/entregadores' },
  { icon: Ticket, label: 'Cupons', href: '/cupons' },
  { icon: BarChart3, label: 'Relatórios', href: '/relatorios' },
  { 
    icon: Settings, 
    label: 'Configurações', 
    href: '/configuracoes',
    subItems: [
      { label: 'Taxa de Entregas', href: '/configuracoes/taxa-entrega' },
      { label: 'Mercado Pago', href: '/configuracoes/mercado-pago' },
      { label: 'Horários', href: '/configuracoes/horarios' }
    ]
  },
  { icon: Users, label: 'Parceiros', href: '/parceiros' },
  { icon: UserCog, label: 'Usuários', href: '/usuarios' },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);
  const [userName, setUserName] = React.useState<string>('Usuário');
  const [initials, setInitials] = React.useState<string>('US');
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadMenuData = async () => {
      try {
        setIsLoadingRole(true);
        
        // 1. Tentar obter dados do cache primeiro
        const cachedData = menuCacheService.getFromCache();
        if (cachedData) {
          setRole(cachedData.role);
          setUserEmail(cachedData.userEmail);
          setUserName(cachedData.userName);
          setInitials(cachedData.initials);
          setIsLoadingRole(false);
          return;
        }
        
        // 2. Se não há cache válido, buscar dados da sessão e API
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token || null;
        const user = sessionRes.data.session?.user || null;
        
        if (user) {
          setUserEmail(user.email || null);
          const name =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            (user.email ? user.email.split('@')[0] : 'Usuário');
          setUserName(name);
          const initialsCalc = String(name)
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0]?.toUpperCase() || '')
            .join('') || 'US';
          setInitials(initialsCalc);
        }
        
        if (!token) {
          setRole(null);
          setIsLoadingRole(false);
          return;
        }
        
        // 3. Buscar role da API e salvar no cache
        try {
          const res = await fetch('/api/me/role', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
            next: { revalidate: 0 }
          });
          
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          const data = await res.json();
          const normalized = typeof data?.role === 'string' ? data.role.trim().toLowerCase() : null;
          setRole(normalized);
          
          // Salvar dados no cache para uso futuro
          // Usar os valores atuais do estado que foram definidos anteriormente
          menuCacheService.saveToCache({
            role: normalized,
            userEmail: user?.email || null,
            userName: userName,
            initials: initials
          });
          
        } catch (apiError) {
          console.warn('Erro ao buscar role da API:', apiError);
          setRole(null);
        }
        
      } catch (error) {
        console.warn('Erro geral no carregamento do menu:', error);
        setRole(null);
      } finally {
        setIsLoadingRole(false);
      }
    };
    
    loadMenuData();
  }, []);

  const visibleItems = React.useMemo(() => {
    let items: MenuItem[] = [];

    if (isLoadingRole) {
      items = [];
    } else if (!userEmail) {
      items = [];
    } else if (userEmail === 'everaldozs@gmail.com') {
      items = menuItems;
    } else if (!role) {
      items = [];
    } else if (role === 'estabelecimento' || role === 'parceiro') {
      items = menuItems.filter((m) => !['Estabelecimentos', 'Parceiros'].includes(m.label));
    } else if (role === 'atendente') {
      const restricted = ['Estabelecimentos', 'Estoque', 'Entregadores', 'Cupons', 'Relatórios', 'Configurações', 'Parceiros', 'Usuários'];
      items = menuItems.filter((m) => !restricted.includes(m.label));
    } else if (role === 'cliente' || role === 'entregador') {
      const allowed = ['Dashboard', 'Pedidos', 'Usuários']; 
      if (role === 'entregador') allowed.push('Entregadores');
      items = menuItems.filter((m) => allowed.includes(m.label));
    } else {
      items = menuItems;
    }
    
    return items;
  }, [role, userEmail, isLoadingRole]);

  // Initialize expanded menu based on current path
  React.useEffect(() => {
    if (visibleItems.length > 0) {
      const activeItem = visibleItems.find(item => 
        item.subItems && (pathname.startsWith(item.href) || item.subItems.some(sub => pathname === sub.href))
      );
      if (activeItem) {
        setExpandedMenu(activeItem.label);
      } else {
        // Se a rota atual não pertence a nenhum submenu, fecha qualquer menu expandido
        setExpandedMenu(null);
      }
    }
  }, [pathname, visibleItems]);

  const handleMenuClick = (e: React.MouseEvent, item: MenuItem) => {
    if (item.subItems) {
      e.preventDefault();
      setExpandedMenu(prev => prev === item.label ? null : item.label);
    } else {
      setExpandedMenu(null);
      if (onClose && window.innerWidth < 768) {
        onClose();
      }
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      router.push('/paineladmin');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`.trim()}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`.trim()}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <MessageSquare size={20} color="white" fill="white" />
            </div>
            <div className={styles.logoText}>
              <h1>ZapZap Delivery</h1>
              <span>Painel Administrativo</span>
            </div>
          </div>
          
          <button 
            className={styles.closeButton} 
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          {isLoadingRole && (
            <div className={styles.navLoading}>
              <div className={styles.navLoadingSpinner} />
              <span>Carregando menus...</span>
            </div>
          )}
          {visibleItems.map((item) => (
            <React.Fragment key={item.label}>
              {item.subItems ? (
                <div 
                  onClick={(e) => handleMenuClick(e, item)}
                  className={`${styles.navItem} ${(pathname.startsWith(item.href) || expandedMenu === item.label) ? styles.navItemActive : ''}`.trim()}
                  style={{ cursor: 'pointer' }}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </div>
              ) : (
                <Link 
                  href={item.href}
                  onClick={(e) => handleMenuClick(e, item)}
                  prefetch={false}
                  className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`.trim()}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )}
              {item.subItems && expandedMenu === item.label && (
                <div className={styles.subnav}>
                  {item.subItems.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      prefetch={false}
                      className={`${styles.subNavItem} ${pathname === sub.href ? styles.subNavItemActive : ''}`.trim()}
                    >
                      <span>{sub.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>

        <div className={styles.userProfile}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <h3>{userName}</h3>
            <button onClick={handleLogout} className={styles.logoutButton}>
              <LogOut size={14} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
