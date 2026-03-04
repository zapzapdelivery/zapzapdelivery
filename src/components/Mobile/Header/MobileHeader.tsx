import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Moon, MessageSquare, Menu, ExternalLink, ChevronDown } from 'lucide-react';
import styles from './MobileHeader.module.css';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';

interface MobileHeaderProps {
  onMenuClick?: () => void;
  userName?: string;
  avatarUrl?: string;
  title?: string;
  subtitle?: string;
  showGreeting?: boolean;
}

export function MobileHeader({ 
  onMenuClick, 
  userName: propUserName,
  avatarUrl: propAvatarUrl,
  title,
  subtitle,
  showGreeting = true
}: MobileHeaderProps) {
  const [userName, setUserName] = useState<string>(propUserName || 'Usuário');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(propAvatarUrl || null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { role, establishmentName } = useUserRole();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const toCardapioSlug = (val: string) => {
    return val
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  const handleOpenCardapio = () => {
    if (establishmentName) {
      const slug = toCardapioSlug(establishmentName);
      window.open(`/estabelecimentos/cardapio/${slug}`, '_blank');
    }
  };

  useEffect(() => {
    if (propUserName) setUserName(propUserName);
    if (propAvatarUrl) setAvatarUrl(propAvatarUrl);

    if (!propUserName || !propAvatarUrl) {
      const loadUser = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            if (!propUserName) {
              const name =
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.email?.split('@')[0] ||
                'Usuário';
              setUserName(name);
            }
            if (!propAvatarUrl) {
              const avatar =
                user.user_metadata?.avatar_url ||
                user.user_metadata?.picture ||
                null;
              setAvatarUrl(typeof avatar === 'string' ? avatar : null);
            }
          }
        } catch {
          // silent
        }
      };
      loadUser();
    }
  }, [propUserName, propAvatarUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const initials = useMemo(() => {
    const trimmed = userName.trim();
    if (!trimmed) return 'US';
    const parts = trimmed.split(' ').filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [userName]);

  const handleToggleMenu = () => {
    setMenuOpen(prev => !prev);
  };
  const scheduleClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false);
      closeTimerRef.current = null;
    }, 250);
  };
  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleProfile = () => {
    window.location.href = '/estabelecimentos/perfil';
  };

  const handleHelp = () => {
    window.location.href = '/configuracoes';
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.location.href = '/paineladmin';
      }
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <div className={styles.leftGroup}>
          <button 
            className={styles.menuButton} 
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu size={24} color="white" />
          </button>
          
          <div className={styles.logoArea}>
            <div className={styles.logoIcon}>
              <MessageSquare size={20} fill="white" />
            </div>
            <div>
              <div className={styles.logoText}>ZapZap</div>
              <div className={styles.roleText}>Operacional</div>
            </div>
          </div>
        </div>
        
        <div className={styles.actions}>
          {role === 'estabelecimento' && (
            <button 
              className={styles.cardapioButton} 
              onClick={handleOpenCardapio}
            >
              <ExternalLink size={20} />
            </button>
          )}
          <button className={styles.iconButton}>
            <Moon size={20} />
          </button>
          <button className={styles.iconButton}>
            <Bell size={20} />
          </button>
          <div
            className={styles.userMenu}
            ref={menuRef}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              className={styles.userButton}
              onClick={handleToggleMenu}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className={styles.avatar}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} />
                ) : (
                  <div className={styles.avatarFallback}>{initials}</div>
                )}
              </div>
            </button>
            {menuOpen && (
              <div
                className={styles.userDropdown}
                role="menu"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  className={styles.userDropdownItem}
                  onClick={handleProfile}
                  role="menuitem"
                >
                  Meu Perfil
                </button>
                <button
                  type="button"
                  className={styles.userDropdownItem}
                  onClick={handleHelp}
                  role="menuitem"
                >
                  Ajuda
                </button>
                <button
                  type="button"
                  className={styles.userDropdownItemLogout}
                  onClick={handleLogout}
                  role="menuitem"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(showGreeting || title) && (
        <div className={styles.greeting}>
          <h1>{title || `Olá, ${userName}! 👋`}</h1>
          <p className={styles.subtitle}>{subtitle || (showGreeting ? "Resumo operacional de hoje." : "")}</p>
        </div>
      )}
    </header>
  );
}
