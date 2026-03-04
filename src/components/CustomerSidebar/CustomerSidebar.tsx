'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home,
  ShoppingBag, 
  User, 
  MapPin, 
  Lock, 
  LogOut 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './CustomerSidebar.module.css';

interface CustomerSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const CustomerSidebar = ({ isOpen, onClose }: CustomerSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/paineladmin');
  };

  const navItems = [
    {
      label: 'Início',
      icon: <Home />,
      href: '/minhaconta',
    },
    {
      label: 'Meus Pedidos',
      icon: <ShoppingBag />,
      href: '/minhaconta/pedidos',
    },
    {
      label: 'Meu Perfil',
      icon: <User />,
      href: '/minhaconta/perfil',
    },
    {
      label: 'Meus Endereços',
      icon: <MapPin />,
      href: '/minhaconta/enderecos',
    },
    {
      label: 'Alterar Senha',
      icon: <Lock />,
      href: '/minhaconta/senha',
    },
  ];

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} />
      )}
      
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`.trim()}>
        <div className={styles.logo}>ZapZap Delivery</div>
        
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                prefetch={false}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`.trim()}
                onClick={onClose}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut />
          Sair
        </button>
      </aside>
    </>
  );
};
