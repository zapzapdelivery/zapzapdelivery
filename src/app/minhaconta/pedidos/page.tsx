'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, 
  Eye,
  Utensils,
  ChevronLeft,
  Menu,
  CheckCircle,
  XCircle,
  QrCode
} from 'lucide-react';
import { CustomerSidebar } from '@/components/CustomerSidebar/CustomerSidebar';
import { OrderTrackingModal } from '@/components/OrderTrackingModal/OrderTrackingModal';
import { PixModal } from '@/components/PixModal/PixModal';
import { Loading } from '@/components/Loading/Loading';
import { supabase } from '@/lib/supabase';
import styles from './pedidos.module.css';
import { OrderStatus, LEGACY_STATUS_MAP } from '@/types/orderStatus';

function CustomerOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get('status');
  const paymentOrder = searchParams.get('pedido');

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // PIX Modal States
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);

  const handleOpenPix = async (orderData: any) => {
    setPixLoading(true);
    setPixError(null);
    setPixData(null);
    setPixOrderId(orderData.id);
    setPixModalOpen(true);
    
    try {
        const res = await fetch(`/api/pedidos/${orderData.id}/pix`);
        const data = await res.json();
        
        if (res.ok) {
            setPixData({ ...data, orderId: orderData.id }); // Add orderId to pixData
        } else {
            setPixError(data.error || 'Erro ao carregar dados do PIX');
        }
    } catch (err) {
        console.error(err);
        setPixError('Erro de conexão ao buscar PIX');
    } finally {
        setPixLoading(false);
    }
  };

  const onPaymentConfirmed = () => {
    if (userId) {
      fetchOrders(userId); // Refresh orders list
    }
    // Don't close modal immediately so user sees success message
    // setPixModalOpen(false); 
  };

  const fetchOrders = async (uid: string) => {
    let { data: ordersData, error } = await supabase
      .from('pedidos')
      .select(`
          id,
          numero_pedido,
          criado_em,
          total_pedido,
          status_pedido,
          forma_pagamento,
          estabelecimento_id,
          entregador_id,
          observacao_cliente,
          estabelecimentos (
            nome_estabelecimento,
            url_cardapio
          )
        `)
      .eq('cliente_id', uid)
      .order('criado_em', { ascending: false });

    // Fallback: Try fetching without relation if it fails (e.g. RLS on estabelecimentos)
    if (error) {
      console.warn('Failed to fetch orders with establishment details. Retrying without relation...', error);
      const retry = await supabase
        .from('pedidos')
        .select(`
            id,
            numero_pedido,
            criado_em,
            total_pedido,
            status_pedido,
            forma_pagamento,
            estabelecimento_id,
            entregador_id,
            observacao_cliente
          `)
        .eq('cliente_id', uid)
        .order('criado_em', { ascending: false });
        
      ordersData = retry.data as any;
      error = retry.error;
    }

    if (ordersData) {
      console.log('Orders data:', ordersData);
      setOrders(ordersData);
    }
    
    if (error) {
      console.error('Error fetching orders:', JSON.stringify(error, null, 2));
      // Fallback for simple error logging
      if (Object.keys(error).length === 0) {
          console.error('Error object is empty. Full error:', error);
      }
    }
  };

  useEffect(() => {
    async function getData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/paineladmin'); // Redirect if not logged in
        return;
      }
      setUserId(user.id);

      await fetchOrders(user.id);
      setLoading(false);
    }
    getData();
  }, [router]);

  // Polling fallback every 15 seconds
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      fetchOrders(userId);
    }, 15000);

    return () => clearInterval(interval);
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-orders-history')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `cliente_id=eq.${userId}`
        },
        (payload) => {
          setOrders((currentOrders) => 
            currentOrders.map((order) => 
              order.id === payload.new.id 
                ? { ...order, ...payload.new } 
                : order
            )
          );
          
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

  // Handle auto-open PIX modal from URL param
  useEffect(() => {
    const openPix = searchParams.get('open_pix');
    const orderNumber = searchParams.get('pedido');

    if (openPix === 'true' && orderNumber && orders.length > 0 && !pixModalOpen) {
      const targetOrder = orders.find(o => String(o.numero_pedido) === String(orderNumber));
      if (targetOrder) {
         handleOpenPix(targetOrder);
         
         // Remove o parâmetro para não reabrir ao fechar o modal
         const newParams = new URLSearchParams(searchParams.toString());
         newParams.delete('open_pix');
         router.replace(`/minhaconta/pedidos?${newParams.toString()}`, { scroll: false });
      }
    }
  }, [orders, searchParams, pixModalOpen, router]);

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
    }

    // Legacy checks fallback
    const lower = s.toLowerCase();
    if (lower.includes('entregue') || lower.includes('concluído')) return 'entregue';
    if (lower.includes('cancelado')) return 'cancelado';
    if (lower.includes('entrega') || lower.includes('caminho')) return 'acaminho';
    if (lower.includes('pronto')) return 'pronto';
    
    return 'preparo'; // Default for Pedindo, Confirmado, Preparação, Pronto
  };

  const formattedOrders = orders.map(order => {
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

  if (loading) return <Loading message="Carregando minha conta..." fullScreen />;

  return (
    <div className={styles.container}>
      <OrderTrackingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        order={selectedOrder} 
      />
      <PixModal 
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pixData={pixData}
        loading={pixLoading}
        error={pixError}
        onPaymentConfirmed={onPaymentConfirmed}
        orderId={pixOrderId}
      />
      <CustomerSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <Package size={28} />
              Meus Pedidos
            </h1>
            <p className={styles.subtitle}>Histórico completo de pedidos</p>
          </div>
          <button onClick={() => router.push('/minhaconta')} className={styles.backBtn}>
            <ChevronLeft size={20} />
            Voltar
          </button>
        </header>

        {/* Banners de Status de Pagamento */}
        {paymentStatus === 'success' && (
          <div className={styles.paymentSuccessBanner} style={{ 
            backgroundColor: '#dcfce7', 
            color: '#166534', 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            marginBottom: '1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            border: '1px solid #bbf7d0'
          }}>
            <CheckCircle size={24} />
            <div>
              <strong style={{ display: 'block' }}>Pagamento Confirmado!</strong>
              <span style={{ fontSize: '0.9rem' }}>Seu pedido #{paymentOrder} foi pago com sucesso e já está sendo processado.</span>
            </div>
          </div>
        )}

        {paymentStatus === 'failure' && (
          <div className={styles.paymentErrorBanner} style={{ 
            backgroundColor: '#fee2e2', 
            color: '#991b1b', 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            marginBottom: '1.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            border: '1px solid #fecaca'
          }}>
            <XCircle size={24} />
            <div>
              <strong style={{ display: 'block' }}>Pagamento Não Concluído</strong>
              <span style={{ fontSize: '0.9rem' }}>O pagamento do pedido #{paymentOrder} não foi finalizado. Tente novamente ou entre em contato com o estabelecimento.</span>
            </div>
          </div>
        )}



        {/* Desktop Table */}
        <div className={styles.tableContainer}>
          {formattedOrders.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>NÚMERO DO PEDIDO</th>
                  <th>DATA</th>
                  <th>ESTABELECIMENTO</th>
                  <th>TOTAL</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {formattedOrders.map((order) => (
                  <tr key={order.id}>
                    <td className={styles.orderId}>{order.id}</td>
                    <td>{order.date}</td>
                    <td>
                      {order.establishmentUrl ? (
                        <Link 
                          href={order.establishmentUrl.startsWith('http') ? order.establishmentUrl : `/estabelecimentos/cardapio/${order.establishmentUrl}`}
                          className={styles.establishmentLink}
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
                      {order.originalData.forma_pagamento === 'pix' && 
                       (order.status === 'Pendente' || 
                        order.status === 'Aguardando Pagamento' || 
                        order.status === 'Pedindo' ||
                        (order.status === 'Cancelado Pelo Estabelecimento' && order.originalData.observacao_cliente?.includes('Cancelado por falta de pagamento'))
                       ) && (
                          <button 
                              className={styles.actionBtn}
                              onClick={() => handleOpenPix(order.originalData)}
                              title="Ver Código PIX"
                              style={{ color: '#2563eb', marginRight: '0.5rem' }}
                          >
                              <QrCode size={18} />
                          </button>
                      )}
                      <button 
                        className={styles.actionBtn}
                        onClick={() => handleOpenModal(order.originalData)}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              Você ainda não fez nenhum pedido.
            </p>
          )}
        </div>

        {/* Mobile Order Cards */}
        <div className={styles.mobileOrderList}>
          {formattedOrders.length > 0 ? (
            formattedOrders.map((order) => (
              <div 
                key={order.id} 
                className={styles.orderCard}
                onClick={() => handleOpenModal(order.originalData)}
              >
                <div className={styles.orderMainInfo}>
                  <div className={styles.orderIcon}>
                    <Utensils size={24} />
                  </div>
                  <div className={styles.orderText}>
                    <h4>Pedido {order.id}</h4>
                    <p>{order.total} • {order.date}</p>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                       {order.establishmentUrl ? (
                         <Link 
                           href={order.establishmentUrl.startsWith('http') ? order.establishmentUrl : `/estabelecimentos/cardapio/${order.establishmentUrl}`}
                           className={styles.establishmentLinkMobile}
                           onClick={(e) => e.stopPropagation()}
                         >
                           {order.establishment}
                         </Link>
                       ) : (
                         order.establishment
                       )}
                     </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <div className={`${styles.orderStatusBadge} ${styles[order.statusClass]}`}>
                    {order.status.toUpperCase()}
                  </div>
                  {order.originalData.forma_pagamento === 'pix' && 
                   (order.status === 'Pendente' || 
                    order.status === 'Aguardando Pagamento' || 
                    order.status === 'Pedindo' ||
                    (order.status === 'Cancelado Pelo Estabelecimento' && order.originalData.observacao_cliente?.includes('Cancelado por falta de pagamento'))
                   ) && (
                      <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenPix(order.originalData); }}
                          style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '8px',
                              padding: '0.4rem 0.8rem',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              cursor: 'pointer',
                              zIndex: 10
                          }}
                      >
                          <QrCode size={14} />
                          Ver PIX
                      </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              Você ainda não fez nenhum pedido.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CustomerOrdersPage() {
  return (
    <Suspense fallback={<Loading message="Carregando minha conta..." fullScreen />}>
      <CustomerOrdersContent />
    </Suspense>
  );
}
