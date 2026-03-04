"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import styles from './painelentregador.module.css';
import { OrderStatus } from '@/types/orderStatus';
import { 
  LayoutDashboard, 
  Truck, 
  Wallet, 
  User, 
  Bike, 
  MapPin, 
  LogOut, 
  Bell, 
  MessageCircle, 
  Store, 
  Navigation,
  Trophy,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
  Ban
} from 'lucide-react';

export default function PainelEntregador() {
  const router = useRouter();
  const { role, loading } = useUserRole();
  const [userName, setUserName] = useState('Usuário');
  const [isOnline, setIsOnline] = useState(true);
  const [stats, setStats] = useState({
    entregasHoje: 12,
    faturamentoTotal: 345.00,
    taxaAceitacao: 98,
    avaliacaoMedia: 4.9
  });
  const [currentDelivery, setCurrentDelivery] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Function to handle delivery status update
  const handleUpdateStatus = async (deliveryId: string, newStatus: string) => {
    try {
      // Aqui faríamos o update no Supabase
      // const { error } = await supabase.from('pedidos').update({ status_pedido: newStatus }).eq('id', deliveryId);
      
      // Atualização local para feedback imediato
      setCurrentDelivery((prev: any) => prev ? { ...prev, status_pedido: newStatus } : null);
      setNotification({ type: 'success', message: `Status da entrega #${deliveryId} atualizado para: ${newStatus}` });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setNotification({ type: 'error', message: 'Erro ao atualizar status' });
    }
  };

  // Function to handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/paineladmin');
  };

  useEffect(() => {
    if (!loading && role !== 'entregador' && role !== 'admin') {
      router.push('/paineladmin');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function fetchEntregadorData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserName(user.user_metadata?.nome || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Entregador');

      // Aqui buscaríamos dados reais do Supabase
      // 1. Buscar estatísticas do entregador
      // 2. Buscar entrega atual (status 'Em Entrega' ou 'Pedido Pronto' atribuída a ele)
      // 3. Buscar histórico de entregas

      // Mock de dados para demonstração inicial conforme imagem
      setCurrentDelivery({
        id: '4921',
        status_pedido: OrderStatus.SAIU_ENTREGA,
        retirada: {
          local: 'Burger King - Centro',
          endereco: 'Rua Augusta, 1500'
        },
        entrega: {
          cliente: 'Ana Souza',
          endereco: 'Av. Paulista, 200 - Apt 42'
        }
      });

      setHistory([
        { id: 1, data: 'Hoje, 14:30', local: "McDonald's", distancia: '3.2 km', valor: 12.50, status_pedido: OrderStatus.ENTREGUE },
        { id: 2, data: 'Hoje, 11:15', local: "Subway", distancia: '1.8 km', valor: 9.00, status_pedido: OrderStatus.ENTREGUE },
        { id: 3, data: 'Ontem, 19:45', local: "Pizza Hut", distancia: '4.5 km', valor: 15.00, status_pedido: OrderStatus.CANCELADO_CLIENTE }
      ]);
    }

    if (!loading && role) {
      fetchEntregadorData();
    }
  }, [loading, role]);

  if (loading) return <div>Carregando...</div>;

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}><Bike size={24} /></div>
          <div className={styles.logoText}>
            <h1>ZapZap</h1>
            <span>ENTREGADOR</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${styles.navItemActive}`}>
            <LayoutDashboard size={20} /> Início
          </button>
          <button className={styles.navItem}>
            <Truck size={20} /> Minhas Entregas
          </button>
          <button className={styles.navItem}>
            <Wallet size={20} /> Carteira
          </button>
          <button className={styles.navItem}>
            <User size={20} /> Perfil
          </button>
          <button className={styles.navItem}>
            <Bike size={20} /> Meus Veículos
          </button>
          <button className={styles.navItem}>
            <MapPin size={20} /> Meus Endereços
          </button>
        </nav>

        <button className={styles.logout} onClick={handleLogout}>
          <LogOut size={20} /> Sair
        </button>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.welcome}>
            <h2>Olá, {userName}! 🛵</h2>
            <p>Vamos fazer ótimas entregas hoje.</p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.statusToggle}>
              <span className={styles.statusLabel}>Status:</span>
              <label className={styles.switch}>
                <input type="checkbox" checked={isOnline} onChange={() => setIsOnline(!isOnline)} />
                <span className={styles.slider}></span>
              </label>
              <span className={styles.statusBadge}>{isOnline ? 'Disponível' : 'Offline'}</span>
            </div>
            <button className={styles.btnIcon}><Bell size={20} /></button>
            <div className={styles.userAvatar}>
              <img src="https://ui-avatars.com/api/?name=Carlos&background=065f46&color=fff" alt="User" style={{borderRadius: '50%', width: '40px'}} />
            </div>
          </div>
        </header>

        {notification && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 1000,
            padding: '16px 24px',
            borderRadius: '12px',
            backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444',
            color: '#fff',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'slideIn 0.3s ease-out'
          }}>
            <style jsx>{`
              @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}</style>
            {notification.type === 'success' ? <CheckCircle2 size={24} /> : <Ban size={24} />}
            <span style={{ fontWeight: 600 }}>{notification.message}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.blueIcon}`}><Package size={20} /></div>
            <div className={styles.statTrend}>+2</div>
            <div className={styles.statValue}>{stats.entregasHoje}</div>
            <div className={styles.statLabel}>Entregas Hoje</div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.greenIcon}`}><Wallet size={20} /></div>
            <div className={`${styles.statTrend} ${styles.trendPositive}`}>+15%</div>
            <div className={styles.statValue}>R$ {stats.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className={styles.statLabel}>Faturamento Total</div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.purpleIcon}`}><Trophy size={20} /></div>
            <div className={styles.statValue}>{stats.taxaAceitacao}%</div>
            <div className={styles.statLabel}>Taxa de Aceitação</div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.orangeIcon}`}><User size={20} /></div>
            <div className={styles.statValue}>{stats.avaliacaoMedia}</div>
            <div className={styles.statLabel}>Avaliação Média</div>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className={styles.dashboardGrid}>
          {/* Current Delivery */}
          {currentDelivery ? (
            <section className={styles.currentDeliveryCard}>
              <div className={styles.cardHeader}>
                <h3><Navigation size={18} /> Entrega Atual</h3>
                <span className={styles.deliveryStatus}>#{currentDelivery.id} • {currentDelivery.status_pedido}</span>
              </div>
              <div className={styles.deliveryContent}>
                <div className={styles.mapPlaceholder}>
                  <div style={{textAlign: 'center'}}>
                    <Bike size={48} color="#10b981" />
                    <p>Mapa Interativo</p>
                  </div>
                </div>
                <div className={styles.deliveryInfo}>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}><Store size={18} /></div>
                    <div className={styles.infoText}>
                      <h4>RETIRADA</h4>
                      <p>{currentDelivery.retirada.local}</p>
                      <span>{currentDelivery.retirada.endereco}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon} style={{color: '#10b981'}}><User size={18} /></div>
                    <div className={styles.infoText}>
                      <h4>ENTREGA</h4>
                      <p>{currentDelivery.entrega.cliente}</p>
                      <span>{currentDelivery.entrega.endereco}</span>
                    </div>
                  </div>
                  <div className={styles.deliveryActions}>
                    <button className={styles.btnDetails}>Detalhes</button>
                    <button className={styles.btnChat}>
                      <MessageCircle size={18} /> Chat
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className={styles.currentDeliveryCard}>
              <div className={styles.cardHeader}>
                <h3><Navigation size={18} /> Entrega Atual</h3>
              </div>
              <div className={styles.deliveryContent} style={{ justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <p style={{ color: '#64748b' }}>Nenhuma entrega em andamento no momento.</p>
              </div>
            </section>
          )}

          {/* Right Panel */}
          <aside className={styles.rightPanel}>
            <div className={styles.quickActionsCard}>
              <h3>Ações Rápidas</h3>
              <p>Gerencie suas preferências</p>
              <div className={styles.actionButtons}>
                <button className={styles.actionBtn}>
                  <Bike size={20} />
                  Atualizar Veículo
                </button>
                <button className={styles.actionBtn}>
                  <User size={20} />
                  Editar Perfil
                </button>
              </div>
            </div>

            <div className={styles.recentActivityCard}>
              <h3>Atividade Recente</h3>
              <div className={styles.activityList}>
                {history.map(item => (
                  <div key={item.id} className={styles.activityItem}>
                    <div className={styles.activityIcon}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div className={styles.activityContent}>
                      <div className={styles.activityHeader}>
                        <span className={styles.activityTitle}>{item.local}</span>
                        <span className={styles.activityTime}>{item.data}</span>
                      </div>
                      <div className={styles.activityDetails}>
                        <span>{item.distancia}</span>
                        <span>R$ {item.valor.toFixed(2)}</span>
                      </div>
                      <div className={styles.activityStatus}>{item.status_pedido}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
