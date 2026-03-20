'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../../components/Sidebar/Sidebar';
import { AdminHeader } from '../../../components/Header/AdminHeader';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import styles from '../../pedidos/pedidos.module.css';
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2
} from 'lucide-react';

type MovementType = 'entrada' | 'saida' | 'ajuste' | 'venda';

interface StockMovement {
  id: string;
  productName: string;
  productCode: string;
  productImage: string | null;
  type: MovementType;
  quantity: number;
  minStock: number;
  reason: string;
  date: string;
  time: string;
}
export default function StockMovementsPage() {
  const router = useRouter();
  const { error: toastError, warning, success } = useToast();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'entradas' | 'saidas' | 'ajustes' | 'vendas'>('todos');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<StockMovement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [estabId, setEstabId] = useState<string | null>(null);

  const fetchStock = async (id: string) => {
    try {
      // setLoading(true); // Don't set loading on background updates to avoid flickering
      const { data: { session } } = await supabase.auth.getSession();
      // Add timestamp to prevent caching
      const res = await fetch(`/api/estoque/movimentacoes?t=${new Date().getTime()}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error('Falha ao buscar movimentações');
      }
      const movementsRows = await res.json();

      const buildReason = (type: MovementType, motivo?: string | null): string => {
        if (motivo && motivo.trim()) {
          return motivo.trim();
        }
        if (type === 'venda') {
          return 'Venda de produto';
        }
        if (type === 'saida') return 'Saída de estoque';
        if (type === 'entrada') return 'Entrada de estoque';
        return 'Ajuste de estoque';
      };

      const mapped: StockMovement[] = (movementsRows || []).map((row: any) => {
        const createdAt = row.criado_em as string | null;
        let date = '';
        let time = '';
        if (createdAt) {
          const d = new Date(createdAt);
          if (!Number.isNaN(d.getTime())) {
            date = d.toLocaleDateString('pt-BR');
            time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          }
        }

        return {
          id: String(row.id),
          productName: String(row.nome_produto || 'Produto'),
          productCode: String(row.produto_id),
          productImage: row.imagem_produto_url || null,
          type:
            ((row.tipo_movimentacao || row.tipo_movimento) as MovementType) ||
            'ajuste',
          quantity: Number(row.quantidade) || 0,
          minStock: 0,
          reason: buildReason(
            (row.tipo_movimentacao || row.tipo_movimento) as MovementType,
            row.motivo as string | null
          ),
          date,
          time
        };
      });

      setMovements(mapped);
    } catch (err) {
      console.error('Erro ao carregar estoque:', err);
      // toastError('Erro ao carregar estoque.'); // Avoid spamming toasts on background updates
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || null;
        if (!token) {
          router.push('/login');
          return;
        }

        const roleRes = await fetch('/api/me/role', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const roleData = await roleRes.json().catch(() => ({}));
        const id = (roleData?.establishment_id as string | null) ?? null;

        if (!id) {
          toastError('Estabelecimento não encontrado para este usuário.');
          return;
        }

        setEstabId(id);
        await fetchStock(id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router, toastError]);

  // Realtime subscription
  useEffect(() => {
    if (!estabId) return;

    console.log('Setting up realtime subscription for estabId:', estabId);

    const channel = supabase
      .channel(`realtime-estoque-movimentos-${estabId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'movimentacoes_estoque',
          filter: `estabelecimento_id=eq.${estabId}`
        },
        (payload) => {
          console.log('Realtime update received (movimentacoes):', payload);
          fetchStock(estabId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estoque_produtos',
          filter: `estabelecimento_id=eq.${estabId}`
        },
        (payload) => {
          console.log('Realtime update received (estoque_produtos):', payload);
          fetchStock(estabId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `estabelecimento_id=eq.${estabId}`
        },
        (payload) => {
          console.log('Realtime update received (pedidos):', payload);
          fetchStock(estabId);
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [estabId]);

  const filteredMovements = useMemo(() => {
    let rows = [...movements];

    if (activeTab !== 'todos') {
      const map = {
        todos: null,
        entradas: 'entrada',
        saidas: 'saida',
        ajustes: 'ajuste',
        vendas: 'venda'
      } as const;
      const type = map[activeTab];
      if (type) {
        rows = rows.filter((m) => m.type === type);
      }
    }

    if (searchTerm.trim()) {
      const value = searchTerm.toLowerCase();
      rows = rows.filter((m) => {
        return (
          m.productName.toLowerCase().includes(value) ||
          m.productCode.toLowerCase().includes(value) ||
          m.reason.toLowerCase().includes(value) ||
          m.id.toLowerCase().includes(value)
        );
      });
    }

    return rows;
  }, [movements, activeTab, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, currentPage]);

  const handleChangePage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const renderTypeBadge = (type: MovementType) => {
    if (type === 'entrada') {
      return (
        <span
          className={styles.statusBadge}
          style={{
            backgroundColor: '#dcfce7',
            color: '#166534'
          }}
        >
          Entrada
        </span>
      );
    }

    if (type === 'saida') {
      return (
        <span
          className={styles.statusBadge}
          style={{
            backgroundColor: '#fee2e2',
            color: '#b91c1c'
          }}
        >
          Saída
        </span>
      );
    }
    if (type === 'venda') {
      return (
        <span
          className={styles.statusBadge}
          style={{
            backgroundColor: '#fef3c7',
            color: '#92400e'
          }}
        >
          Venda
        </span>
      );
    }

    return (
      <span
        className={styles.statusBadge}
        style={{
          backgroundColor: '#e0f2fe',
          color: '#075985'
        }}
      >
        Ajuste
      </span>
    );
  };

  const formatQuantity = (qty: number) => {
    return `${qty} un`;
  };

  const handleView = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setViewModalOpen(true);
  };

  const handleEdit = (movement: StockMovement) => {
    router.push(`/estoque/movimentacoes/novo?id=${movement.id}`);
  };

  const handleDelete = async (movement: StockMovement) => {
    setMovementToDelete(movement);
    setDeleteModalOpen(true);
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.content}>
        <AdminHeader />

        <div className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <Link href="/estoque" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 14, textDecoration: 'none', marginBottom: 8 }}>
              <span>←</span>
              <span>Voltar para Estoque</span>
            </Link>
            <h1 className={styles.title}>Movimentações de Estoque</h1>
            <p className={styles.subtitle}>
              Histórico detalhado de entradas, saídas e ajustes do ZapZap Delivery.
            </p>
          </div>

          <div className={styles.actionsBar}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={18} />
              <input
                type="text"
                placeholder="Buscar por produto, motivo ou ID..."
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className={styles.actionButtons}>
              <button
                className={`${styles.btnAction} ${styles.btnNew}`}
                onClick={() => router.push('/estoque/movimentacoes/novo')}
              >
                <Plus size={18} />
                <span>Novo Lançamento</span>
              </button>
            </div>
          </div>

          <div className={styles.filtersSection}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'todos' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('todos')}
              >
                Todos
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'ajustes' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('ajustes')}
              >
                Ajustes
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'entradas' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('entradas')}
              >
                Entrada
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'saidas' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('saidas')}
              >
                Saída
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'vendas' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('vendas')}
              >
                Venda
              </button>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Qtd</th>
                  <th>Motivo</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <div className={styles.clientCell}>
                        {movement.productImage ? (
                          <img
                            src={movement.productImage}
                            alt={movement.productName}
                            className={styles.avatar}
                          />
                        ) : (
                          <div
                            className={styles.avatar}
                            style={{
                              backgroundColor: '#e5e7eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#6b7280'
                            }}
                          >
                            {movement.productName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className={styles.clientInfo}>
                          <h4>{movement.productName}</h4>
                        </div>
                      </div>
                    </td>
                    <td>{renderTypeBadge(movement.type)}</td>
                    <td className={styles.totalCell}>{formatQuantity(movement.quantity)}</td>
                    <td>{movement.reason}</td>
                    <td>
                      <div className={styles.dateTime}>
                        <h4>{movement.date || '-'}</h4>
                        <p>{movement.time}</p>
                      </div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={`${styles.btnIcon} ${styles.btnView}`}
                          title="Ver detalhes"
                          onClick={() => handleView(movement)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className={`${styles.btnIcon} ${styles.btnEdit}`}
                          title="Editar"
                          onClick={() => handleEdit(movement)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className={`${styles.btnIcon} ${styles.btnDelete}`}
                          title="Excluir"
                          onClick={() => handleDelete(movement)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.footer}>
              <span className={styles.paginationInfo}>
                {loading
                  ? 'Carregando registros de estoque...'
                  : `Mostrando ${paginatedMovements.length} de ${filteredMovements.length} registros`}
              </span>
              <div className={styles.pagination}>
                <button
                  className={`${styles.pageBtn} ${currentPage === 1 ? styles.disabled : ''}`}
                  onClick={() => handleChangePage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  {'<'}
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNumber = idx + 1;
                  return (
                    <button
                      key={pageNumber}
                      className={`${styles.pageBtn} ${
                        currentPage === pageNumber ? styles.pageActive : ''
                      }`}
                      onClick={() => handleChangePage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  className={`${styles.pageBtn} ${
                    currentPage === totalPages ? styles.disabled : ''
                  }`}
                  onClick={() => handleChangePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  {'>'}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.mobileList}>
            <div style={{ marginBottom: 12 }}>
              <button
                className={`${styles.btnAction} ${styles.btnNew}`}
                style={{ width: '100%' }}
                onClick={() => router.push('/estoque/movimentacoes/novo')}
              >
                <Plus size={18} />
                <span>Novo Lançamento</span>
              </button>
            </div>
            {paginatedMovements.map((m) => (
              <div key={m.id} className={styles.mobileCard}>
                <div className={styles.mobileHeader}>
                  <div className={styles.mobileMainRow}>
                    <h3 className={styles.mobileOrderId}>{m.productName}</h3>
                  </div>
                  <span
                    style={{
                      background: '#ecfdf5',
                      color: '#065f46',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '2px 8px'
                    }}
                  >
                    #{m.productCode}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.bodyItem}>
                    <span className={styles.mobileLabel}>Movimentação</span>
                    {renderTypeBadge(m.type)}
                  </div>
                  <div className={styles.bodyItem}>
                    <span className={styles.mobileLabel}>Quantidade</span>
                    <span className={styles.itemValue}>{formatQuantity(m.quantity)}</span>
                  </div>
                  <div className={styles.bodyItem}>
                    <span className={styles.mobileLabel}>Data</span>
                    <span className={styles.itemValue}>
                      {m.date} {m.time}
                    </span>
                  </div>
                </div>
                <div className={styles.mobileActions}>
                  <button
                    className={`${styles.btnMobile} ${styles.btnViewMobile}`}
                    title="Visualizar"
                    onClick={() => handleView(m)}
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    className={`${styles.btnMobile} ${styles.btnEditMobile}`}
                    title="Editar"
                    onClick={() => handleEdit(m)}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className={`${styles.btnMobile} ${styles.btnDeleteMobile}`}
                    title="Excluir"
                    onClick={() => handleDelete(m)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ViewDetailsModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Detalhes do Estoque"
          data={
            selectedMovement
              ? {
                  name: selectedMovement.productName,
                  tipo:
                    selectedMovement.type === 'entrada'
                      ? 'Entrada'
                      : selectedMovement.type === 'saida'
                      ? 'Saída'
                      : 'Ajuste',
                  estoqueAtual: formatQuantity(selectedMovement.quantity),
                  estoqueMinimo: `${selectedMovement.minStock} un`,
                  motivo: selectedMovement.reason,
                  data: selectedMovement.date || '-',
                  horario: selectedMovement.time || '-'
                }
              : null
          }
          labels={{
            tipo: 'Situação de Estoque',
            estoqueAtual: 'Estoque Atual',
            estoqueMinimo: 'Estoque Mínimo',
            motivo: 'Motivo',
            data: 'Data',
            horario: 'Horário'
          }}
        />

        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            if (!deleting) {
              setDeleteModalOpen(false);
              setMovementToDelete(null);
            }
          }}
          onConfirm={async () => {
            if (!movementToDelete) return;
            try {
              setDeleting(true);
              success('Exclusão de estoque ainda será integrada ao banco.');
              setDeleteModalOpen(false);
              setMovementToDelete(null);
            } catch (err) {
              console.error('Erro ao excluir estoque:', err);
              toastError('Erro ao excluir movimentação de estoque.');
            } finally {
              setDeleting(false);
            }
          }}
          isDeleting={deleting}
          title="Excluir Registro de Estoque"
          description={
            <>
              Tem certeza que deseja excluir o registro de estoque do produto{' '}
              <strong>{movementToDelete?.productName || ''}</strong>? Esta ação não pode ser
              desfeita.
            </>
          }
        />
      </main>
    </div>
  );
}
