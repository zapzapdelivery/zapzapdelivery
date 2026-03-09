'use client';
import React from 'react';
import { Bell, Moon, Menu, ExternalLink, ChevronDown, Check, ShoppingBag, AlertCircle, DollarSign, X, Volume2, Store } from 'lucide-react';
import styles from './Header.module.css';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotification } from '@/context/NotificationContext';
import { useRouter } from 'next/navigation';

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

import { useToast } from "@/components/Toast/ToastProvider";

export function AdminHeader({ title, subtitle, onMenuClick }: AdminHeaderProps) {
  const [userName, setUserName] = React.useState<string>('Usuário');
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  
  const toast = useToast();
  const { notifications, unreadCount, markAsRead, markAllAsRead, playNotificationSound } = useNotification();
  const router = useRouter();

  const { role, establishmentName, establishmentId } = useUserRole();
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const notificationRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimerRef = React.useRef<number | null>(null);
  const [dateTimeLabel, setDateTimeLabel] = React.useState<string>('');
  const [isOpen, setIsOpen] = React.useState<boolean>(true);
  const [statusLoading, setStatusLoading] = React.useState(false);

  React.useEffect(() => {
    if (role === 'estabelecimento' && establishmentId) {
      const fetchStatus = async () => {
        const { data } = await supabase
          .from('estabelecimentos')
          .select('is_open')
          .eq('id', establishmentId)
          .single();
        if (data) {
          setIsOpen(data.is_open ?? true);
        }
      };
      fetchStatus();
    }
  }, [role, establishmentId]);

  const toggleStatus = async () => {
    if (!establishmentId || statusLoading) return;
    try {
      setStatusLoading(true);
      const newStatus = !isOpen;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/estabelecimentos/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ isOpen: newStatus })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Error updating status:', errorData.error || res.statusText);
        toast.error(errorData.error || 'Erro ao atualizar status');
        return;
      }
      
      setIsOpen(newStatus);
      if (newStatus) {
        toast.success('Estabelecimento Aberto!');
      } else {
        toast.success('Estabelecimento Fechado!');
      }
    } catch (err) {
      toast.error('Erro ao atualizar status');
    } finally {
      setStatusLoading(false);
    }
  };

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

  const handleNotificationClick = (id: string, link: string) => {
    markAsRead(id);
    setShowNotifications(false);
    router.push(link);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={16} className="text-blue-500" />;
      case 'cancel': return <AlertCircle size={16} className="text-red-500" />;
      case 'payment': return <DollarSign size={16} className="text-green-500" />;
      default: return <Bell size={16} className="text-gray-500" />;
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    }).format(new Date(date));
  };

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const name =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            (user.email ? user.email.split('@')[0] : 'Usuário');
          setUserName(name);
          const avatar =
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null;
          setAvatarUrl(typeof avatar === 'string' ? avatar : null);
        }
      } catch (err) {
        console.error('Erro ao carregar usuário no cabeçalho:', err);
      }
    };
    loadUser();
  }, []);

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      setDateTimeLabel(`${dateStr} • ${timeStr}`);
    };
    update();
    const id = window.setInterval(update, 60000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const headerTitle = title ?? `Bem-vindo, ${userName}`;

  const computedSubtitle = subtitle ?? (dateTimeLabel || undefined);

  const initials = React.useMemo(() => {
    const trimmed = userName.trim();
    if (!trimmed) return 'US';
    const parts = trimmed.split(' ').filter(Boolean);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [userName]);

  const handleToggleMenu = () => {
    setMenuOpen((prev) => !prev);
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
      <div className={styles.leftSection}>
        {onMenuClick && (
          <button
            className={styles.menuButton}
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>
        )}
        <div className={styles.greeting}>
          <h1>{headerTitle}</h1>
          {computedSubtitle ? (
            <p className={styles.subtitle}>{computedSubtitle}</p>
          ) : null}
        </div>
      </div>

      <div className={styles.actions}>
        {role === 'estabelecimento' && (
          <button
            className={`${styles.statusButton} ${isOpen ? styles.open : styles.closed}`}
            onClick={toggleStatus}
            disabled={statusLoading}
            title={isOpen ? 'Fechar Estabelecimento' : 'Abrir Estabelecimento'}
          >
            <Store size={18} />
            <span>{statusLoading ? '...' : (isOpen ? 'Aberto' : 'Fechado')}</span>
          </button>
        )}

        {role === 'estabelecimento' && establishmentName && (
          <button
            className={styles.cardapioButton}
            onClick={handleOpenCardapio}
            title="Ver Cardápio"
          >
            <ExternalLink size={18} />
            <span>Cardápio</span>
          </button>
        )}
        
        {/* Test Sound */}
        <button
          className={styles.iconButton}
          onClick={() => playNotificationSound(1)}
          title="Testar Som"
          aria-label="Testar Som"
        >
          <Volume2 size={20} />
        </button>

        {/* Notifications */}
        <div className={styles.notificationContainer} ref={notificationRef}>
          <button 
            className={styles.iconButton} 
            aria-label="Notificações"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className={styles.notificationDropdown}>
              <div className={styles.notificationHeader}>
                <h3>Notificações</h3>
                {notifications.length > 0 && (
                  <button className={styles.markAllRead} onClick={markAllAsRead}>
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className={styles.notificationList}>
                {notifications.length === 0 ? (
                  <div className={styles.emptyState}>
                    <Bell size={32} className="text-gray-300" />
                    <p>Nenhuma notificação no momento</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''}`}
                      onClick={() => handleNotificationClick(notification.id, notification.link)}
                    >
                      <div className={styles.notificationTitle}>
                        {getNotificationIcon(notification.type)}
                        <span>{notification.title}</span>
                        {!notification.read && <span className={styles.dot} />}
                      </div>
                      <p className={styles.notificationMessage}>{notification.message}</p>
                      <span className={styles.notificationTime}>{formatTime(notification.timestamp)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className={styles.iconButton} aria-label="Alternar tema">
          <Moon size={20} />
        </button>
        <div
          className={styles.userMenu}
          ref={menuRef}
          onMouseEnter={() => {
            cancelClose();
            setMenuOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          <button
            type="button"
            className={styles.userButton}
            onClick={handleToggleMenu}
            onMouseEnter={() => setMenuOpen(true)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className={styles.avatarWrapper}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className={styles.profilePic} />
              ) : (
                <div className={styles.avatarFallback}>{initials}</div>
              )}
            </div>
            <span className={styles.userName}>{userName}</span>
            <ChevronDown size={16} className={styles.userChevron} />
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
    </header>
  );
}
