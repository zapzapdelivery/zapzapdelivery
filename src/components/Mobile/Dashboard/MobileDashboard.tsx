import React from 'react';
import { ShoppingCart, DollarSign, Clock, Truck, MessageCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import styles from './MobileDashboard.module.css';

interface MobileDashboardProps {
  stats: {
    pedidosHoje: number;
    faturamentoDia: number;
    produtosAtivos: number;
    estoqueBaixo: number;
    emAndamento: number;
  };
  weeklyData: Array<{ name: string; value: number }>;
  orders: Array<{
    id: string;
    client: string;
    initials: string;
    value: string;
    time: string;
    status: string;
  }>;
}

export function MobileDashboard({ stats, weeklyData, orders }: MobileDashboardProps) {
  const [showChart, setShowChart] = React.useState(false);

  React.useEffect(() => {
    const checkChart = () => setShowChart(window.innerWidth <= 768);
    checkChart();
    window.addEventListener('resize', checkChart);
    return () => window.removeEventListener('resize', checkChart);
  }, []);

  return (
    <div className={styles.container}>
      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconBox} ${styles.greenIcon}`}>
              <ShoppingCart size={18} />
            </div>
            <span className={`${styles.badge} ${styles.greenBadge}`}>+0%</span>
          </div>
          <h3 className={styles.cardValue}>{stats.pedidosHoje}</h3>
          <p className={styles.cardLabel}>Pedidos Hoje</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconBox} ${styles.blueIcon}`}>
              <DollarSign size={18} />
            </div>
          </div>
          <h3 className={styles.cardValue}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(stats.faturamentoDia)}
          </h3>
          <p className={styles.cardLabel}>Faturamento</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconBox} ${styles.orangeIcon}`}>
              <Clock size={18} />
            </div>
            <span className={`${styles.badge} ${styles.redBadge}`}>-</span>
          </div>
          <h3 className={styles.cardValue}>{stats.produtosAtivos}</h3>
          <p className={styles.cardLabel}>Produtos Ativos</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconBox} ${styles.purpleIcon}`}>
              <Truck size={18} />
            </div>
          </div>
          <h3 className={styles.cardValue}>{stats.emAndamento}</h3>
          <p className={styles.cardLabel}>Em Andamento</p>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Semanal</h3>
            <p className={styles.subtitle}>Faturamento últimos 7 dias</p>
          </div>
          <span className={styles.chartValue}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.faturamentoDia)}
          </span>
        </div>
        <div style={{ height: '100px', width: '100%' }}>
          {showChart && weeklyData.length > 0 && !weeklyData.every(d => d.value === 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === 'Sex' ? '#0f4c3a' : '#86efac'} 
                    />
                  ))}
                </Bar>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#9ca3af'}}
                  interval={0}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '0.8rem' }}>
              Sem dados suficientes
            </div>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className={styles.sectionLabel}>
        <h3 className={styles.sectionTitle}>Últimos Pedidos</h3>
        <span className={styles.countBadge}>{orders.length} pedidos</span>
      </div>

      {orders.length > 0 ? (
        orders.map((order) => (
          <div key={order.id} className={styles.orderCard}>
            <div className={styles.orderHeader}>
              <span className={styles.orderId}>{order.id}</span>
              <span className={styles.orderTime}>{order.time}</span>
            </div>
            <div className={styles.customerInfo}>
              <span className={styles.customerName}>{order.client}</span>
              <div className={styles.orderDetails}>
                <span className={styles.statusBadge}>{order.status}</span>
                <span className={styles.dotSeparator}>•</span>
                <span className={styles.orderValue}>{order.value}</span>
              </div>
            </div>
            <div className={styles.orderActions}>
              <button className={`${styles.actionButton} ${styles.secondaryButton}`}>
                Visualizar
              </button>
              <button className={`${styles.actionButton} ${styles.primaryButton}`}>
                <MessageCircle size={18} />
                WhatsApp
              </button>
            </div>
          </div>
        ))
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          Nenhum pedido recente
        </div>
      )}

    </div>
  );
}
