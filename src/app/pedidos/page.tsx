"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Search, 
  Upload, 
  Download, 
  Plus, 
  Eye, 
  Pencil, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  LayoutList, 
  LayoutGrid, 
  CreditCard, 
  Banknote, 
  Smartphone,
  Clock,
  CheckCircle2,
  Package,
  Truck,
  XCircle,
  AlertTriangle,
  ShoppingBag,
  MoreVertical
} from 'lucide-react';
import { AdminHeader } from '../../components/Header/AdminHeader';
import { OrderDetailsModal } from '../../components/Modal/OrderDetailsModal';
import { OrderDetailsMobile } from '../../components/Modal/OrderDetailsMobile';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { useSidebar } from '@/context/SidebarContext';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './pedidos.module.css';
import { canEditOrderByRole } from '@/utils/permissions';
import { useToast } from '@/components/Toast/ToastProvider';
import { OrderStatus, ORDER_STATUS_LABEL, ORDER_STATUS_SLUG, LEGACY_STATUS_MAP } from '@/types/orderStatus';
import { KanbanSkeleton } from '@/components/Skeleton/KanbanSkeleton';

// Data from OrderStatus enum
const STATUS_OPTIONS = [
  { id: OrderStatus.PEDINDO, label: ORDER_STATUS_LABEL[OrderStatus.PEDINDO], slug: ORDER_STATUS_SLUG[OrderStatus.PEDINDO], color: 'status_pedindo', icon: <ShoppingBag size={16} /> },
  { id: OrderStatus.CONFIRMADO, label: ORDER_STATUS_LABEL[OrderStatus.CONFIRMADO], slug: ORDER_STATUS_SLUG[OrderStatus.CONFIRMADO], color: 'status_confirmado', icon: <CheckCircle2 size={16} /> },
  { id: OrderStatus.PREPARACAO, label: ORDER_STATUS_LABEL[OrderStatus.PREPARACAO], slug: ORDER_STATUS_SLUG[OrderStatus.PREPARACAO], color: 'status_preparacao', icon: <Clock size={16} /> },
  { id: OrderStatus.PRONTO, label: ORDER_STATUS_LABEL[OrderStatus.PRONTO], slug: ORDER_STATUS_SLUG[OrderStatus.PRONTO], color: 'status_pronto', icon: <Package size={16} /> },
  { id: OrderStatus.SAIU_ENTREGA, label: ORDER_STATUS_LABEL[OrderStatus.SAIU_ENTREGA], slug: ORDER_STATUS_SLUG[OrderStatus.SAIU_ENTREGA], color: 'status_entrega', icon: <Truck size={16} /> },
  { id: OrderStatus.ENTREGUE, label: ORDER_STATUS_LABEL[OrderStatus.ENTREGUE], slug: ORDER_STATUS_SLUG[OrderStatus.ENTREGUE], color: 'status_entregue', icon: <CheckCircle2 size={16} /> },
  { id: OrderStatus.CANCELADO_CLIENTE, label: ORDER_STATUS_LABEL[OrderStatus.CANCELADO_CLIENTE], slug: ORDER_STATUS_SLUG[OrderStatus.CANCELADO_CLIENTE], color: 'status_cancelado_cliente', icon: <XCircle size={16} /> },
  { id: OrderStatus.CANCELADO_ESTABELECIMENTO, label: ORDER_STATUS_LABEL[OrderStatus.CANCELADO_ESTABELECIMENTO], slug: ORDER_STATUS_SLUG[OrderStatus.CANCELADO_ESTABELECIMENTO], color: 'status_cancelado_loja', icon: <AlertTriangle size={16} /> }
];

// Mock Data removed


export default function PedidosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Todos');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const { openSidebar } = useSidebar();
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [dateFilter, setDateFilter] = useState('0'); // Default: Hoje (0 dias)
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchInFlightRef = useRef(false);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const { role } = useUserRole();
  const { error: showError, success: showSuccess } = useToast();

  const fetchOrders = async (opts?: { silent?: boolean }) => {
    try {
      if (fetchInFlightRef.current) return;
      fetchInFlightRef.current = true;
      if (!opts?.silent) setLoading(true);
      // Buscar via API com token (contorna RLS no cliente)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setOrdersData([]);
        if (!opts?.silent) setLoading(false);
        return;
      }
      
      let url = `/api/pedidos?days=${dateFilter}`;
      if (searchTerm) {
        url = `/api/pedidos?search=${encodeURIComponent(searchTerm)}`;
      }

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store'
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody?.error || `HTTP ${resp.status}`);
      }
      const apiData = await resp.json();

      const rows = Array.isArray(apiData) ? apiData : [];
      const formattedOrders = rows.map(order => {
        // Format items string
        const itensString = order?.itens_pedidos
          ?.map((item: any) => `${item.quantidade}x ${item.produtos?.nome_produto || 'Item'}`)
          .join(', ') || 'Sem itens';

        // Format payment
        const paymentMap: Record<string, string> = {
          'pix': 'PIX',
          'cartao': 'Cartão',
          'dinheiro': 'Dinheiro'
        };

        // Normalizar status para garantir compatibilidade com versões antigas ou inconsistências
        let normalizedStatus = order.status_pedido || OrderStatus.PEDINDO;
        
        // Mapeamento de legado caso o banco ainda tenha valores antigos
        if (LEGACY_STATUS_MAP[normalizedStatus]) {
            normalizedStatus = LEGACY_STATUS_MAP[normalizedStatus];
        } else if (!Object.values(OrderStatus).includes(normalizedStatus as OrderStatus)) {
             // Fallback for completely unknown status
             // normalizedStatus = OrderStatus.PEDINDO; // Or keep as is if we want to debug
        }

        const clienteRel = Array.isArray(order.clientes) ? order.clientes?.[0] : order.clientes;
        const nomeCliente = clienteRel?.nome_cliente || 'Cliente não identificado';
        const avatarCliente = clienteRel?.imagem_cliente_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeCliente || 'C')}&background=random&color=fff`;

        const entregadorRel = Array.isArray(order.entregadores) ? order.entregadores?.[0] : order.entregadores;
        const nomeEntregador = entregadorRel?.nome_entregador || null;

        return {
          id: `#${order.numero_pedido}`,
          real_id: order.id, // Keep real ID for updates
          cliente: {
            nome: nomeCliente,
            avatar: avatarCliente
          },
          entregadorNome: nomeEntregador,
          itens: itensString,
          data: order.criado_em ? format(new Date(order.criado_em), 'dd MMM, yyyy', { locale: ptBR }) : '-',
          hora: order.criado_em ? format(new Date(order.criado_em), 'HH:mm') : '-',
          tempo: order.criado_em ? formatDistanceToNow(new Date(order.criado_em), { locale: ptBR, addSuffix: true }) : '-',
          pagamento: paymentMap[order.forma_pagamento] || order.forma_pagamento,
          pagamentoTipo: order.forma_pagamento,
          total: `R$ ${order.total_pedido?.toFixed(2).replace('.', ',') || '0,00'}`,
          status: normalizedStatus,
          original: order
        };
      });

      setOrdersData(formattedOrders);
    } catch (error: any) {
      const msg = error?.message || error?.error_description || JSON.stringify(error || {});
      console.error('Error fetching orders:', { message: msg, raw: error });
    } finally {
      fetchInFlightRef.current = false;
      if (!opts?.silent) setLoading(false);
    }
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 500);
    return () => clearTimeout(timer);
  }, [dateFilter, searchTerm]);

  useEffect(() => {
    const intervalMs = viewMode === 'kanban' ? 2000 : 6000;

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchOrders({ silent: true });
    };

    const interval = setInterval(tick, intervalMs);

    const onFocus = () => tick();
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') tick();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [viewMode, dateFilter, searchTerm]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    if (process.env.NODE_ENV !== 'production') {
      try {
        const ok = (require('@/utils/permissions') as any).__devTestPermissions?.();
        if (!ok) console.warn('Falha no teste de permissões');
      } catch {}
    }
    
    // Realtime subscription (melhor esforço; ignora erros de permissão)
    let channel: any = null;
    try {
      channel = supabase
        .channel('pedidos_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
          fetchOrders();
        })
        .subscribe((status: any) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            fetchOrders({ silent: true });
          }
        });
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('resize', onResize);
    };
  }, [dateFilter, searchTerm]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const currentOrder = ordersData.find(o => o.real_id === orderId);
    if (!currentOrder) return;

    const previousStatus = currentOrder.status;
    const isCancelled = currentOrder.status === OrderStatus.CANCELADO_CLIENTE || currentOrder.status === OrderStatus.CANCELADO_ESTABELECIMENTO;
    
    // Se o pedido estiver cancelado, apenas admin ou estabelecimento pode alterar
    if (isCancelled && role !== 'admin' && role !== 'estabelecimento') {
      showError('Apenas administradores e estabelecimentos podem alterar o status de pedidos cancelados.');
      return;
    }
    if (previousStatus === newStatus) return;

    // Optimistic update
    setOrdersData(prev => prev.map(order => 
      order.real_id === orderId ? { ...order, status: newStatus } : order
    ));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada');
      }
      const resp = await fetch('/api/pedidos/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: orderId, status: newStatus })
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${resp.status}`);
      }
    } catch (error: any) {
      console.error('Error updating status:', error?.message || error);
      showError(error?.message || 'Erro ao atualizar status do pedido.');
      fetchOrders(); // Revert/Refresh on error
    }
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const openCancelModal = (order: any) => {
    if (!canEditOrderByRole(role)) {
      showError('Você não tem permissão para cancelar pedidos.');
      return;
    }
    setOrderToCancel(order);
    setCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    if (isCancelling) return;
    setCancelModalOpen(false);
    setOrderToCancel(null);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel?.real_id) return;
    try {
      setIsCancelling(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showError('Sessão expirada.');
        return;
      }

      const orderId = orderToCancel.real_id as string;
      const resp = await fetch('/api/pedidos/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: orderId,
          status: OrderStatus.CANCELADO_ESTABELECIMENTO
        })
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${resp.status}`);
      }

      setOrdersData(prev => prev.map(order =>
        order.real_id === orderId
          ? { ...order, status: OrderStatus.CANCELADO_ESTABELECIMENTO }
          : order
      ));

      showSuccess('Pedido cancelado com sucesso.');
      setCancelModalOpen(false);
      setOrderToCancel(null);
    } catch (e: any) {
      console.error('Erro ao cancelar pedido:', e);
      showError(e?.message || 'Erro ao cancelar pedido.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDragStart = (orderId: string) => {
    setDraggedOrderId(orderId);
  };

  const handleDragOver = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    setDragOverColumn(statusId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (draggedOrderId) {
      handleStatusChange(draggedOrderId, statusId);
    }
    setDraggedOrderId(null);
    setDragOverColumn(null);
  };

  const getStatusClass = (status: string, isBadge: boolean = false) => {
    const statusOption = STATUS_OPTIONS.find(s => s.id === status);
    const slug = statusOption ? statusOption.slug : 'pedindo';
    const prefix = isBadge ? 'badge_' : 'status_';
    return styles[`${prefix}${slug}`] || '';
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(s => s.id === status)?.label || status;
  };

  const getStatusIconClass = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.id === status);
    const slug = statusOption ? statusOption.slug : 'pedindo';
    return styles[`icon_${slug}`] || '';
  };

  const getPaymentIcon = (tipo: string) => {
    switch (tipo) {
      case 'cartao': return <CreditCard size={18} className={styles.paymentIcon} />;
      case 'pix': return <Smartphone size={18} className={styles.paymentIcon} />;
      case 'dinheiro': return <Banknote size={18} className={styles.paymentIcon} />;
      default: return <CreditCard size={18} className={styles.paymentIcon} />;
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredOrders = ordersData
    .filter(order => {
      const matchesSearch = order.cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      if (!sortConfig) return 0;
      
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle nested client name for sorting
      if (sortConfig.key === 'cliente') {
        aValue = a.cliente.nome;
        bValue = b.cliente.nome;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const getOrdersByStatus = (status: string) => {
    return filteredOrders.filter(order => order.status === status);
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <AdminHeader onMenuClick={openSidebar} />
        
        <main className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <Link href="/dashboard" className={styles.backLink}>← Voltar para Dashboard</Link>
            <h1 className={styles.title}>Fluxo de Pedidos</h1>
          </div>

          <div className={styles.actionsBar}>
            <div className={styles.searchWrapper}>
              <Search size={20} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Buscar pedidos..." 
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value === '') {
                    setDateFilter('0');
                  }
                }}
              />
            </div>

            <div className={styles.filterWrapper}>
              <select 
                className={styles.filterSelect}
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ marginRight: '1rem' }}
              >
                <option value="0">Hoje</option>
                <option value="1">1 dia</option>
                <option value="3">3 dias</option>
                <option value="5">5 dias</option>
                <option value="10">10 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
              </select>

              <select 
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Todos">Todos os Status</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.actionButtons}>
              <div className={styles.viewToggle}>
                <button 
                  className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Vista em Lista"
                >
                  <LayoutList size={20} />
                </button>
                <button 
                  className={`${styles.toggleBtn} ${viewMode === 'kanban' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('kanban')}
                  title="Vista Kanban"
                >
                  <LayoutGrid size={20} />
                </button>
              </div>
              <button className={`${styles.btnAction} ${styles.btnImport}`}>
                <Upload size={18} /> Importar
              </button>
              <button className={`${styles.btnAction} ${styles.btnExport}`}>
                <Download size={18} /> Exportar
              </button>
              <button 
                className={`${styles.btnAction} ${styles.btnNew}`}
                onClick={() => router.push('/pedidos/novo')}
              >
                <Plus size={18} /> Novo Pedido
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            {STATUS_OPTIONS.map(status => (
              <div key={status.id} className={`${styles.statCard} ${styles[`stat_${status.slug}`]}`}>
                <div className={styles.statInfo}>
                  <h3>{status.label}</h3>
                  <div className={styles.statValue}>{getOrdersByStatus(status.id).length}</div>
                </div>
                <div className={`${styles.statIcon} ${getStatusIconClass(status.id)}`}>
                  {status.icon}
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <KanbanSkeleton />
          ) : viewMode === 'kanban' ? (
            <div className={styles.kanbanBoard}>
              {STATUS_OPTIONS.map(status => {
                const orders = getOrdersByStatus(status.id);
                const isOver = dragOverColumn === status.id;
                return (
                  <div 
                    key={status.id} 
                    className={`${styles.kanbanColumn} ${isOver ? styles.columnDragOver : ''}`}
                    onDragOver={(e) => handleDragOver(e, status.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, status.id)}
                  >
                    <div className={`${styles.columnHeader} ${styles[`header_${status.slug}`]}`}>
                      <h2 className={styles.columnTitle}>{status.label}</h2>
                      <span className={styles.columnCount}>{orders.length}</span>
                    </div>
                    <div className={styles.columnContent}>
                      {orders.length === 0 ? (
                        <div className={styles.emptyColumn}>Nenhum pedido aqui</div>
                      ) : (
                        orders.map(order => {
                          const isCancelled = order.status === 'Cancelado Pelo Cliente' || order.status === 'Cancelado Pelo Estabelecimento';
                          const canMove = !isCancelled || role === 'admin' || role === 'estabelecimento';
                          
                          return (
                          <div 
                            key={order.real_id} 
                            className={`${styles.kanbanCard} ${getStatusClass(order.status)} ${draggedOrderId === order.real_id ? styles.cardDragging : ''}`}
                            draggable={canMove}
                            onDragStart={() => canMove && handleDragStart(order.real_id)}
                            onDoubleClick={() => handleViewOrder(order)}
                            style={{ opacity: !canMove ? 0.8 : 1, cursor: !canMove ? 'not-allowed' : 'grab' }}
                          >
                            <div className={styles.cardTop}>
                              <span className={styles.orderNumber}>{order.id}</span>
                              <span className={styles.orderTime}><Clock size={12} /> {order.data}</span>
                            </div>
                          <div className={styles.cardMain}>
                              <select 
                                className={styles.statusSelector}
                                value={order.status}
                                onChange={(e) => handleStatusChange(order.real_id, e.target.value)}
                                onDragStart={(e) => e.stopPropagation()}
                                draggable="false"
                                disabled={!canMove}
                              >
                                {STATUS_OPTIONS.map(opt => (
                                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                              </select>
                              <div className={styles.clientInfoMain}>
                                <img src={order.cliente.avatar} alt={order.cliente.nome} className={styles.cardAvatar} />
                                <span className={styles.cardName}>{order.cliente.nome}</span>
                              </div>
                            </div>
                            <div className={styles.cardBottom}>
                              <div className={styles.cardBottomTop}>
                                <span className={styles.cardPrice}>{order.total}</span>
                                <div className={styles.cardActions} onDragStart={(e) => e.stopPropagation()} draggable="false">
                                  <button 
                                    className={styles.actionIconButton} 
                                    onDragStart={(e) => e.stopPropagation()} 
                                    draggable="false"
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  <button 
                                    className={`${styles.actionIconButton} ${styles.actionIconButtonView}`} 
                                    onDragStart={(e) => e.stopPropagation()} 
                                    draggable="false"
                                    onClick={() => handleViewOrder(order)}
                                  >
                                    <Eye size={16} />
                                  </button>
                                  <button 
                                    className={`${styles.actionIconButton} ${styles.actionIconButtonDelete}`} 
                                    onDragStart={(e) => e.stopPropagation()} 
                                    draggable="false"
                                    onClick={() => openCancelModal(order)}
                                    title="Cancelar pedido"
                                    style={{ opacity: canEditOrderByRole(role) ? 1 : 0.4, cursor: canEditOrderByRole(role) ? 'pointer' : 'not-allowed' }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                              {order.entregadorNome ? (
                                <div className={styles.cardDelivererRow}>
                                  <span className={styles.cardDelivererName}>{order.entregadorNome}</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                      ID PEDIDO {sortConfig?.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('cliente')} style={{ cursor: 'pointer' }}>
                      CLIENTE {sortConfig?.key === 'cliente' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('data')} style={{ cursor: 'pointer' }}>
                      DATA / HORA {sortConfig?.key === 'data' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>PAGAMENTO</th>
                    <th onClick={() => handleSort('total')} style={{ cursor: 'pointer' }}>
                      TOTAL {sortConfig?.key === 'total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                      STATUS {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const isCancelled = order.status === 'Cancelado Pelo Cliente' || order.status === 'Cancelado Pelo Estabelecimento';
                    const canEdit = canEditOrderByRole(role) && (!isCancelled || role === 'admin' || role === 'estabelecimento');
                    
                    return (
                    <tr 
                      key={order.real_id}
                      onDoubleClick={() => handleViewOrder(order)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className={styles.orderId}>{order.id}</td>
                      <td>
                        <div className={styles.clientCell}>
                          <img src={order.cliente.avatar} alt={order.cliente.nome} className={styles.avatar} />
                          <div className={styles.clientInfo}>
                            <h4>{order.cliente.nome}</h4>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.dateTime}>
                          <h4>{order.data}</h4>
                          <p>{order.hora}</p>
                        </div>
                      </td>
                      <td>
                        <div className={styles.paymentCell}>
                          {getPaymentIcon(order.pagamentoTipo)}
                          {order.pagamento}
                        </div>
                      </td>
                      <td className={styles.totalCell}>{order.total}</td>
                      <td>
                        <select 
                          className={`${styles.statusBadge} ${getStatusClass(order.status, true)} ${styles.tableStatusSelect}`}
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.real_id, e.target.value)}
                          disabled={!canEdit}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button 
                            className={`${styles.btnIcon} ${styles.btnView}`} 
                            title="Visualizar"
                            onClick={() => handleViewOrder(order)}
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            className={`${styles.btnIcon} ${styles.btnDelete}`} 
                            title="Cancelar pedido"
                            onClick={() => openCancelModal(order)}
                            disabled={!canEditOrderByRole(role)}
                            style={{ opacity: canEditOrderByRole(role) ? 1 : 0.5, cursor: canEditOrderByRole(role) ? 'pointer' : 'not-allowed' }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className={styles.footer}>
                <div className={styles.paginationInfo}>
                Exibindo {filteredOrders.length} de {ordersData.length} pedidos
              </div>
                <div className={styles.pagination}>
                  <button className={`${styles.pageBtn} ${styles.disabled}`}>
                    <ChevronLeft size={18} />
                  </button>
                  <button className={`${styles.pageBtn} ${styles.pageActive}`}>1</button>
                  <button className={`${styles.pageBtn} ${styles.disabled}`}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={styles.mobileList}>
            {filteredOrders.map((order) => (
              <div key={order.real_id} className={styles.mobileCard}>
                <div className={styles.mobileHeader}>
                  <span className={styles.mobileLabel}>Pedido</span>
                  <span className={`${styles.statusBadge} ${getStatusClass(order.status, true)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                
                <div className={styles.mobileMainRow}>
                  <h3 className={styles.mobileOrderId}>{order.id}</h3>
                  <span className={styles.mobilePrice}>{order.total}</span>
                </div>

                <div className={styles.mobileClientRow}>
                  <img src={order.cliente.avatar} alt={order.cliente.nome} className={styles.cardAvatar} />
                  <div className={styles.mobileClientText}>
                    <h4>{order.cliente.nome}</h4>
                    <div className={styles.mobileTime}>
                      <Clock size={14} />
                      <span>{order.tempo}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.mobileActions}>
                  <button 
                    className={`${styles.btnMobile} ${styles.btnViewMobile}`} 
                    title="Visualizar"
                    onClick={() => handleViewOrder(order)}
                  >
                    <Eye size={18} />
                  </button>
                  <button 
                    className={`${styles.btnMobile} ${styles.btnDeleteMobile}`} 
                    title="Cancelar pedido"
                    onClick={() => openCancelModal(order)}
                    disabled={!canEditOrderByRole(role)}
                    style={{ opacity: canEditOrderByRole(role) ? 1 : 0.5, cursor: canEditOrderByRole(role) ? 'pointer' : 'not-allowed' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>

        {isMobileView ? (
          <OrderDetailsMobile
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            order={selectedOrder}
            onCancel={(orderId: string) => {
              setOrdersData(prev => prev.map(order =>
                order.real_id === orderId
                  ? { ...order, status: OrderStatus.CANCELADO_ESTABELECIMENTO }
                  : order
              ));
              showSuccess('Pedido cancelado com sucesso.');
            }}
          />
        ) : (
          <OrderDetailsModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            order={selectedOrder}
            onCancel={(orderId: string) => {
              setOrdersData(prev => prev.map(order =>
                order.real_id === orderId
                  ? { ...order, status: 'Cancelado Pelo Estabelecimento' }
                  : order
              ));
              showSuccess('Pedido cancelado com sucesso.');
            }}
          />
        )}

        <DeleteConfirmationModal
          isOpen={cancelModalOpen && !!orderToCancel}
          onClose={closeCancelModal}
          onConfirm={confirmCancelOrder}
          isDeleting={isCancelling}
          title="Cancelar Pedido"
          description={
            <>
              Tem certeza que deseja cancelar o pedido <strong>{orderToCancel?.id}</strong>?<br />
              O status será definido como <strong>Cancelado Pelo Estabelecimento</strong>.
            </>
          }
        />
      </div>
    </div>
  );
}
