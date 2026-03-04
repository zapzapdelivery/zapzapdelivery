'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  Ticket, 
  MapPin, 
  History,
  Eye,
  Bell,
  Utensils,
  ChevronRight,
  User,
  Lock,
  LogOut,
  Menu
} from 'lucide-react';
import { CustomerSidebar } from '@/components/CustomerSidebar/CustomerSidebar';
import { CustomerBottomNav } from '@/components/CustomerBottomNav/CustomerBottomNav';
import { OrderTrackingModal } from '@/components/OrderTrackingModal/OrderTrackingModal';
import { supabase } from '@/lib/supabase';
import styles from './minhaconta.module.css';
import { OrderStatus, LEGACY_STATUS_MAP } from '@/types/orderStatus';

export default function CustomerDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statsData, setStatsData] = useState({
    active: 0,
    total: 0,
    addresses: 0,
    coupons: 0
  });

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/minhaconta/stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStatsData(prev => ({
          ...prev,
          addresses: data.addresses || 0,
          coupons: data.coupons || 0
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const fetchOrders = async (uid: string) => {
    const { data: ordersData, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        criado_em,
        total_pedido,
        status_pedido,
        forma_pagamento,
        estabelecimentos (
          nome_estabelecimento,
          url_cardapio
        )
      `)
      .eq('cliente_id', uid)
      .order('criado_em', { ascending: false });

    if (ordersData) {
      setOrders(ordersData);
    }
  };

  useEffect(() => {
    async function getData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        let displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente';
        
        try {
          const { data: clientData } = await supabase
            .from('clientes')
            .select('nome_cliente')
            .eq('email', user.email)
            .maybeSingle();
            
          if (clientData?.nome_cliente) {
            displayName = clientData.nome_cliente;
          }
        } catch (error) {
          console.error('Erro ao buscar dados do cliente:', error);
        }

        setUserName(displayName);
        setUserAvatar(user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + (user.email || 'John'));

        await fetchOrders(user.id);
        await fetchStats();
      }
      setLoading(false);
    }
    getData();
  }, []);

  // Polling fallback every 15 seconds
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      fetchOrders(userId);
    }, 15000);

    return () => clearInterval(interval);
  }, [userId]);

  // Update stats whenever orders change
  useEffect(() => {
    const total = orders.length;
    const active = orders.filter(o => 
      ![
        OrderStatus.ENTREGUE, 
        OrderStatus.CANCELADO_CLIENTE, 
        OrderStatus.CANCELADO_ESTABELECIMENTO,
        'Entregue', // Legacy
        'Cancelado' // Legacy
      ].includes(o.status_pedido || '')
    ).length;
    setStatsData(prev => ({ ...prev, active, total }));
  }, [orders]);

  // Realtime subscription for order updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-orders-dashboard')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `cliente_id=eq.${userId}`
        },
        (payload) => {
          console.log('Order update received:', payload);
          setOrders((currentOrders) => 
            currentOrders.map((order) => 
              order.id === payload.new.id 
                ? { ...order, ...payload.new } 
                : order
            )
          );
          
          // Also update selectedOrder if it's the one being viewed
          if (selectedOrder && selectedOrder.id === payload.new.id) {
            setSelectedOrder((prev: any) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedOrder]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (router) router.push('/paineladmin');
  };

  const stats = [
    {
      title: 'Pedidos Ativos',
      value: statsData.active.toString().padStart(2, '0'),
      icon: <Package />,
      color: 'green',
      href: '/minhaconta/pedidos'
    },
    {
      title: 'Cupons Disponíveis',
      value: statsData.coupons.toString().padStart(2, '0'),
      icon: <Ticket />,
      color: 'green',
      href: null
    },
    {
      title: 'Endereços Salvos',
      value: statsData.addresses.toString().padStart(2, '0'),
      icon: <MapPin />,
      color: 'green',
      href: '/minhaconta/enderecos'
    },
    {
      title: 'Total de Pedidos',
      value: statsData.total.toString().padStart(2, '0'),
      icon: <History />,
      color: 'green',
      href: '/minhaconta/pedidos'
    }
  ];

  const getStatusClass = (status: string) => {
    const s = status || '';
    
    // Check for standardized enums
    if (s === OrderStatus.ENTREGUE) return 'entregue';
    if (s === OrderStatus.SAIU_ENTREGA) return 'acaminho';
    if (s === OrderStatus.CANCELADO_CLIENTE || s === OrderStatus.CANCELADO_ESTABELECIMENTO) return 'cancelado';
    if (s === OrderStatus.PRONTO) return 'pronto';
    if (s === OrderStatus.PREPARACAO) return 'preparo';
    if (s === OrderStatus.CONFIRMADO) return 'confirmado';
    if (s === OrderStatus.PEDINDO) return 'pedindo';

    // Legacy mapping
    const legacyStatus = LEGACY_STATUS_MAP[s] || LEGACY_STATUS_MAP[s.toLowerCase()];
    if (legacyStatus) {
       if (legacyStatus === OrderStatus.ENTREGUE) return 'entregue';
       if (legacyStatus === OrderStatus.SAIU_ENTREGA) return 'acaminho';
       if (legacyStatus === OrderStatus.CANCELADO_ESTABELECIMENTO || legacyStatus === OrderStatus.CANCELADO_CLIENTE) return 'cancelado';
       if (legacyStatus === OrderStatus.PRONTO) return 'pronto';
       if (legacyStatus === OrderStatus.PREPARACAO) return 'preparo';
       if (legacyStatus === OrderStatus.CONFIRMADO) return 'confirmado';
       if (legacyStatus === OrderStatus.PEDINDO) return 'pedindo';
    }

    // Fallback based on string inclusion (safeguard)
    const lower = s.toLowerCase();
    if (lower.includes('entregue') || lower.includes('concluído')) return 'entregue';
    if (lower.includes('cancelado')) return 'cancelado';
    if (lower.includes('entrega') || lower.includes('caminho')) return 'acaminho';
    if (lower.includes('pronto')) return 'pronto'; 
    if (lower.includes('confirmado')) return 'confirmado';
    if (lower.includes('pedindo') || lower.includes('pendente')) return 'pedindo';
    return 'preparo';
  };

  const recentOrders = orders.slice(0, 5).map(order => {
    const date = new Date(order.criado_em);
    const formattedDate = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    return {
      id: order.numero_pedido ? `#${order.numero_pedido}` : `#${order.id.slice(0, 8)}`,
      date: formattedDate,
      establishment: order.estabelecimentos?.nome_estabelecimento || 'Estabelecimento',
      establishmentUrl: order.estabelecimentos?.url_cardapio,
      total: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_pedido || 0),
      status: order.status_pedido || 'Pendente',
      statusClass: getStatusClass(order.status_pedido),
      originalData: order
    };
  });

  const handleOpenModal = (orderData: any) => {
    setSelectedOrder(orderData);
    setIsModalOpen(true);
  };

  if (loading) return null;

  return (
    <div className={styles.container}>
      <OrderTrackingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        order={selectedOrder} 
      />
      <CustomerSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className={styles.mainContent}>
        {/* Mobile Header */}
        <header className={styles.mobileHeader}>
          <div className={styles.headerLeft}>
            <button 
              className={styles.menuBtn}
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                <img src={userAvatar} alt={userName} />
              </div>
              <div className={styles.welcomeText}>
                <span>Olá,</span>
                <h2>{userName}</h2>
              </div>
            </div>
          </div>
          <button className={styles.notificationBtn}>
            <Bell size={24} />
          </button>
        </header>

        {/* Desktop Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>
            Bem-vindo, {userName}
          </h1>
          <p className={styles.subtitle}>Área do Cliente</p>
        </header>

        <div className={styles.statsGrid}>
          {stats.map((stat, index) => {
            const content = (
              <>
                <div className={`${styles.iconWrapper} ${styles[stat.color]}`}>
                  {stat.icon}
                </div>
                <div className={styles.cardContent}>
                  <h3>{stat.title}</h3>
                  <div className={styles.cardValue}>{stat.value}</div>
                </div>
              </>
            );

            if (stat.href) {
              return (
                <Link 
                  key={index} 
                  href={stat.href} 
                  className={styles.card}
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={index} className={styles.card}>
                {content}
              </div>
            );
          })}
        </div>

        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Meus Pedidos Recentes</h2>
            <a href="/minhaconta/pedidos" className={styles.viewAll}>Ver todos</a>
          </div>

          {/* Desktop Table */}
          <div className={styles.tableContainer}>
            {recentOrders.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>NÚMERO DO PEDIDO</th>
                    <th>DATA</th>
                    <th>ESTABELECIMENTO</th>
                    <th>TOTAL</th>
                    <th>STATUS</th>
                    <th>Status do Pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className={styles.orderId}>{order.id}</td>
                    <td>{order.date}</td>
                    <td>
                      {order.establishmentUrl ? (
                        <Link 
                          href={order.establishmentUrl.startsWith('http') ? order.establishmentUrl : `/estabelecimentos/cardapio/${order.establishmentUrl}`}
                          style={{ color: '#111827', textDecoration: 'none', fontWeight: 600 }}
                        >
                          {order.establishment}
                        </Link>
                      ) : (
                        order.establishment
                      )}
                    </td>
                    <td>{order.total}</td>
                      <td>
                        <span className={`${styles.status} ${styles[order.statusClass]}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className={styles.actions}>
                        <button 
                          className={styles.actionBtn}
                          onClick={() => handleOpenModal(order.originalData)}
                        >
                          <Eye size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ padding: '1rem', color: '#6b7280' }}>Você ainda não tem pedidos.</p>
            )}
          </div>

          {/* Mobile Order Cards */}
          <div className={styles.mobileOrderList}>
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div 
                  key={order.id} 
                  className={styles.orderCard}
                  onClick={() => handleOpenModal(order.originalData)}
                >
                  <div className={styles.orderContentWrapper}>
                    <div className={styles.orderMainInfo}>
                      <div className={styles.orderIcon}>
                        <Utensils size={24} />
                      </div>
                      <div className={styles.orderText}>
                        <h4>Pedido {order.id}</h4>
                        <p>{order.total} • {order.date}</p>
                      </div>
                    </div>
                    <div className={`${styles.orderStatusBadge} ${styles[order.statusClass]}`}>
                      {order.status.toUpperCase()}
                    </div>
                  </div>
                  <button className={styles.actionBtn}>
                    <Eye size={20} />
                  </button>
                </div>
              ))
            ) : (
              <p style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>Você ainda não tem pedidos.</p>
            )}
          </div>
        </section>

        {/* Mobile Settings Section */}
        <section className={styles.settingsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Configurações</h2>
          </div>
          <div className={styles.settingsList}>
            <a href="/minhaconta/perfil" className={styles.settingsItem}>
              <div className={styles.settingsItemContent}>
                <User size={20} className={styles.settingsItemIcon} />
                <span>Meu Perfil</span>
              </div>
              <ChevronRight size={20} className={styles.settingsItemIcon} />
            </a>
            <a href="/minhaconta/enderecos" className={styles.settingsItem}>
              <div className={styles.settingsItemContent}>
                <MapPin size={20} className={styles.settingsItemIcon} />
                <span>Meus Endereços</span>
              </div>
              <ChevronRight size={20} className={styles.settingsItemIcon} />
            </a>
            <a href="/minhaconta/senha" className={styles.settingsItem}>
              <div className={styles.settingsItemContent}>
                <Lock size={20} className={styles.settingsItemIcon} />
                <span>Alterar Senha</span>
              </div>
              <ChevronRight size={20} className={styles.settingsItemIcon} />
            </a>
            <button onClick={handleLogout} className={`${styles.settingsItem} ${styles.logout}`}>
              <div className={styles.settingsItemContent}>
                <LogOut size={20} />
                <span>Sair da conta</span>
              </div>
            </button>
          </div>
        </section>

        <footer className={styles.footer}>
          © 2026 ZapZap Delivery. Todos os direitos reservados.
        </footer>
      </main>

      <CustomerBottomNav />
    </div>
  );
}
