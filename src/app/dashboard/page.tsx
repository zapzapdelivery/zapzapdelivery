"use client";

import React from 'react';
import { AdminHeader } from '../../components/Header/AdminHeader';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { useSidebar } from '@/context/SidebarContext';
import styles from './page.module.css';
import { 
  ShoppingCart, 
  DollarSign, 
  AlertTriangle, 
  Truck,
  MoreVertical,
  ClipboardList,
  Package
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { OrderStatus, LEGACY_STATUS_MAP } from '@/types/orderStatus';

// Mobile Components
import { MobileHeader } from '../../components/Mobile/Header/MobileHeader';
import { MobileDashboard } from '../../components/Mobile/Dashboard/MobileDashboard';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1f2937', padding: '0.5rem', borderRadius: '8px', color: 'white', fontSize: '0.8rem' }}>
        <p>{`${label} : R$ ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { openSidebar } = useSidebar();
  const [showDesktopCharts, setShowDesktopCharts] = React.useState(false);
  const [userName, setUserName] = React.useState<string>('Usuário');
  const router = useRouter();
  const [authenticated, setAuthenticated] = React.useState<boolean | null>(null);
  const { role, establishmentId, loading: loadingRole } = useUserRole();

  // State for dynamic data
  const [orders, setOrders] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState({
    pedidosHoje: 0,
    faturamentoDia: 0,
    produtosAtivos: 0,
    estoqueBaixo: 0,
    emAndamento: 0
  });
  const [weeklyData, setWeeklyData] = React.useState<any[]>([]);
  const [pieData, setPieData] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (loadingRole) {
      return;
    }

    const estabIdForRealtime = role === 'admin' ? null : establishmentId;

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Usuário';
        setUserName(name);
        setAuthenticated(true);

        try {
            // 1. Definir estabelecimento conforme papel do usuário
            // Admin enxerga o somatório de todos os estabelecimentos
            const estabId = role === 'admin' ? null : establishmentId;

            // 2. Stats: Products (active and out of stock)
            let queryProdActive = supabase.from('produtos').select('*', { count: 'exact', head: true }).eq('status_produto', 'ativo');
            if (estabId) queryProdActive = queryProdActive.eq('estabelecimento_id', estabId);
            const { count: prodActiveCount } = await queryProdActive;

            let queryLowStock = supabase.from('estoque_produtos').select('*', { count: 'exact', head: true }).lt('estoque_atual', 6);
            if (estabId) queryLowStock = queryLowStock.eq('estabelecimento_id', estabId);
            const { count: lowStockCount } = await queryLowStock;

            // 3. Stats & Charts Data
            // Fetch orders for the last 7 days to populate charts and stats
            const today = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            let queryOrders = supabase
                .from('pedidos')
                .select('id, criado_em, total_pedido, status_pedido, cliente_id')
                .gte('criado_em', sevenDaysAgo.toISOString());
            
            if (estabId) queryOrders = queryOrders.eq('estabelecimento_id', estabId);
            
            const { data: ordersData, error: ordersError } = await queryOrders;

            let pedidosHoje = 0;
            let faturamentoDia = 0;
            let emAndamento = 0;
            let weeklyMap = new Map<string, number>();
            let statusMap = new Map<string, number>();

            // Initialize weekly map with last 7 days
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
                const key = dayName.charAt(0).toUpperCase() + dayName.slice(1).replace('.', '');
                weeklyMap.set(key, 0);
            }

            if (ordersData) {
                ordersData.forEach((order: any) => {
                    const orderDate = new Date(order.criado_em);
                    const orderValue = Number(
                      order.total_pedido ??
                      order.valor_total ??
                      order.total ??
                      0
                    );
                    
                    // Stats for today
                    if (orderDate >= startOfDay) {
                        pedidosHoje++;
                        faturamentoDia += orderValue;
                        
                        // Pie Chart (Status today)
                        let status = order.status_pedido || order.status || 'Pendente';
                        // Normalize status
                        if (LEGACY_STATUS_MAP[status]) {
                            status = LEGACY_STATUS_MAP[status];
                        }
                        statusMap.set(status, (statusMap.get(status) || 0) + 1);
                    }

                    // Weekly Chart (Revenue last 7 days)
                    const dayName = orderDate.toLocaleDateString('pt-BR', { weekday: 'short' });
                    const key = dayName.charAt(0).toUpperCase() + dayName.slice(1).replace('.', '');
                    if (weeklyMap.has(key)) {
                        weeklyMap.set(key, (weeklyMap.get(key) || 0) + orderValue);
                    }
                });
            }

            let queryOngoing = supabase
              .from('pedidos')
              .select('*', { count: 'exact', head: true })
              .in('status_pedido', [
                OrderStatus.PEDINDO, 
                OrderStatus.CONFIRMADO, 
                OrderStatus.PREPARACAO, 
                OrderStatus.PRONTO, 
                OrderStatus.SAIU_ENTREGA
              ]);
            if (estabId) {
              queryOngoing = queryOngoing.eq('estabelecimento_id', estabId);
            }
            const { count: ongoingCount } = await queryOngoing;
            emAndamento = ongoingCount || 0;

            // Update stats
            setStats({
                pedidosHoje,
                faturamentoDia,
                produtosAtivos: prodActiveCount || 0,
                estoqueBaixo: lowStockCount || 0,
                emAndamento
            });

            // Format Weekly Data
            const newWeeklyData = Array.from(weeklyMap.entries()).map(([name, value]) => ({ name, value }));
            setWeeklyData(newWeeklyData);

            // Format Pie Data
            const colors: Record<string, string> = {
                [OrderStatus.ENTREGUE]: '#10b981',
                [OrderStatus.SAIU_ENTREGA]: '#3b82f6',
                [OrderStatus.PREPARACAO]: '#f59e0b',
                [OrderStatus.PEDINDO]: '#ef4444',
                [OrderStatus.CONFIRMADO]: '#3b82f6',
                [OrderStatus.PRONTO]: '#10b981',
                [OrderStatus.CANCELADO_CLIENTE]: '#6b7280',
                [OrderStatus.CANCELADO_ESTABELECIMENTO]: '#6b7280',
                'Cancelado': '#6b7280', // Legacy generic
            };
            const newPieData = Array.from(statusMap.entries()).map(([name, value]) => ({
                name,
                value,
                color: colors[name] || '#6366f1'
            }));
            setPieData(newPieData);

            // 4. Recent Orders (Top 5)
            let queryRecent = supabase
                .from('pedidos')
                .select(`
                    id,
                    numero_pedido,
                    criado_em,
                    total_pedido,
                    status_pedido,
                    clientes (
                        nome_cliente,
                        imagem_cliente_url
                    )
                `)
                .order('criado_em', { ascending: false })
                .limit(5);
            
            if (estabId) queryRecent = queryRecent.eq('estabelecimento_id', estabId);
            
            const { data: recentData } = await queryRecent;
            
            if (recentData && recentData.length > 0) {
                setOrders(recentData.map((o: any) => {
                    const cliente = Array.isArray(o.clientes) ? o.clientes[0] : o.clientes;
                    const clientName = cliente?.nome_cliente || 'Cliente Desconhecido';
                    const initials = clientName
                        .split(' ')
                        .slice(0, 2)
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase();

                    return {
                        id: o.numero_pedido ? `#${o.numero_pedido}` : `#${o.id.substring(0, 5)}`,
                        client: clientName,
                        initials: initials || '?',
                        value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.total_pedido || 0),
                        time: new Date(o.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        status: o.status_pedido || 'Pendente'
                    };
                }));
            } else {
                setOrders([]);
            }

        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        }
      } else {
        setAuthenticated(false);
      }
    };

    fetchData();

    const handleResize = () => {
      setShowDesktopCharts(window.innerWidth > 768);
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    const channel = supabase
      .channel('dashboard-pedidos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: estabIdForRealtime
            ? `estabelecimento_id=eq.${estabIdForRealtime}`
            : undefined
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const stockChannel = supabase
      .channel('dashboard-estoque-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estoque_produtos',
          filter: estabIdForRealtime
            ? `estabelecimento_id=eq.${estabIdForRealtime}`
            : undefined
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('resize', handleResize);
      supabase.removeChannel(channel);
      supabase.removeChannel(stockChannel);
    };
  }, [loadingRole, role, establishmentId]);

  if (authenticated === false) {
    router.push('/paineladmin');
    return null;
  }

  return (
    <div className={styles.container}>
      
      <div className={styles.wrapper}>
        {/* Mobile Header */}
        <div className={styles.mobileOnly}>
          <MobileHeader 
            onMenuClick={openSidebar} 
            userName={userName}
            subtitle="Resumo operacional de hoje."
          />
        </div>

        <main className={styles.content}>
          {/* Desktop Header */}
          <div className={styles.desktopOnly}>
            <AdminHeader title={`Bem-vindo, ${userName}`} />
          </div>

          {/* Mobile Dashboard Content */}
          <div className={styles.mobileOnly}>
            <MobileDashboard stats={stats} weeklyData={weeklyData} orders={orders} />
          </div>

          {/* Desktop Dashboard Content */}
          <div className={styles.desktopOnly}>
            <div className={styles.dashboardGrid}>
              {/* Card 1: Pedidos Hoje */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconBox} ${styles.blueIcon}`}>
                    <ShoppingCart size={20} />
                  </div>
                  <span className={styles.badgeGreen}>+0%</span>
                </div>
                <div>
                  <p className={styles.cardLabel}>Pedidos Hoje</p>
                  <h3 className={styles.cardValue}>{stats.pedidosHoje}</h3>
                </div>
              </div>

              {/* Card 2: Faturamento Dia */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconBox} ${styles.greenIcon}`}>
                    <DollarSign size={20} />
                  </div>
                  <span className={styles.badgeGreen}>+0%</span>
                </div>
                <div>
                  <p className={styles.cardLabel}>Faturamento Dia</p>
                  <h3 className={styles.cardValue}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faturamentoDia)}</h3>
                </div>
              </div>

              {/* Card 3: Produtos Ativos */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconBox} ${styles.orangeIcon}`}>
                    <ClipboardList size={20} />
                  </div>
                  <span>-</span>
                </div>
                <div>
                  <p className={styles.cardLabel}>Produtos Ativos</p>
                  <h3 className={styles.cardValue}>{stats.produtosAtivos}</h3>
                </div>
              </div>

              {/* Card 4: Estoque Baixo */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconBox} ${styles.redIcon}`}>
                    <AlertTriangle size={20} />
                  </div>
                  <span className={styles.badgeRed}>0</span>
                </div>
                <div>
                  <p className={styles.cardLabel}>Estoque Baixo</p>
                  <h3 className={styles.cardValue}>{stats.estoqueBaixo}</h3>
                </div>
              </div>

              {/* Card 5: Em Andamento */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={`${styles.iconBox} ${styles.purpleIcon}`}>
                    <Truck size={20} />
                  </div>
                  <span>-</span>
                </div>
                <div>
                  <p className={styles.cardLabel}>Em Andamento</p>
                  <h3 className={styles.cardValue}>{stats.emAndamento}</h3>
                </div>
              </div>
            </div>

            <div className={styles.chartsGrid}>
              {/* Revenue Chart */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <h3>Faturamento Diário</h3>
                    <p className={styles.subtitle}>Últimos 7 dias</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ fontSize: '1.5rem', color: '#10b981' }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faturamentoDia)}
                        <span className={styles.badgeGreen} style={{ fontSize: '0.75rem', verticalAlign: 'middle' }}>+0%</span>
                    </h3>
                  </div>
                </div>
                <div className={styles.chartContainer}>
                  {weeklyData.every(d => d.value === 0) ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                        Sem dados
                    </div>
                  ) : (
                    showDesktopCharts && (
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData}>
                            <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={({ x, y, payload }) => (
                                <text x={x} y={y + 20} textAnchor="middle" fill={payload.value === 'Sex' ? '#10b981' : '#9ca3af'} fontSize={12}>
                                {payload.value}
                                </text>
                            )}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {weeklyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'Sex' ? '#10b981' : '#e5e7eb'} />
                            ))}
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    )
                  )}
                </div>
              </div>

              {/* Status Chart */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <div>
                    <h3>Status dos Pedidos</h3>
                    <p className={styles.subtitle}>Visão geral do dia</p>
                  </div>
                </div>
                <div className={styles.chartContainer} style={{ position: 'relative' }}>
                  {pieData.length === 0 || pieData.every(d => d.value === 0) ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
                      Sem dados
                    </div>
                  ) : (
                    <>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{stats.pedidosHoje}</h3>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total</span>
                      </div>
                      {showDesktopCharts && (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </>
                  )}
                </div>
                <div className={styles.legendGrid}>
                  {pieData.map((item) => (
                    <div key={item.name} className={styles.legendItem}>
                      <div className={styles.legendDot} style={{ backgroundColor: item.color }} />
                      <span>{item.name} ({item.value}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
