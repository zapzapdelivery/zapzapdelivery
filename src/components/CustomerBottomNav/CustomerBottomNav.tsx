'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  ShoppingBag, 
  User, 
  Settings 
} from 'lucide-react';
import styles from './CustomerBottomNav.module.css';

export const CustomerBottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Início', icon: <Home />, href: '/minhaconta' },
    { label: 'Pedidos', icon: <ShoppingBag />, href: '/minhaconta/pedidos' },
    { label: 'Perfil', icon: <User />, href: '/minhaconta/perfil' },
    { label: 'Ajustes', icon: <Settings />, href: '/minhaconta/ajustes' },
  ];

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`.trim()}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
