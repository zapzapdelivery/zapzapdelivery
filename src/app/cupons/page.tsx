'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUserRole } from '@/hooks/useUserRole';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { supabase } from '@/lib/supabase';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import styles from '../clientes/clientes.module.css';

type CouponStatus = 'ativo' | 'inativo' | 'expirado';
type CouponType = 'percentual' | 'fixo';

type CouponTab = 'Todos' | 'Ativos' | 'Inativos' | 'Expirados';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number | null;
  establishment: string;
  validFrom: string | null;
  validTo: string | null;
  status: CouponStatus;
}

export default function CuponsPage() {
  const router = useRouter();
  const { role, loading: loadingRole } = useUserRole();
  const { error: toastError } = useToast();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTab, setCurrentTab] = useState<CouponTab>('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  useEffect(() => {
    if (loadingRole) return;
    loadCoupons();
  }, [loadingRole]);

  const loadCoupons = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      const res = await fetch('/api/cupons', {
        cache: 'no-store',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao carregar cupons');
      }

      if (Array.isArray(data)) {
        const normalized: Coupon[] = data.map((coupon: any) => ({
          id: coupon.id,
          code: coupon.code || '',
          description: coupon.description ?? null,
          type: coupon.type === 'fixo' ? 'fixo' : 'percentual',
          value: typeof coupon.value === 'number' ? coupon.value : null,
          establishment: coupon.establishment || '',
          validFrom: coupon.validFrom || null,
          validTo: coupon.validTo || null,
          status:
            coupon.status === 'inativo' || coupon.status === 'expirado'
              ? coupon.status
              : 'ativo',
        }));

        setCoupons(normalized);
      } else {
        setCoupons([]);
      }
    } catch (err) {
      console.error('Erro ao carregar cupons:', err);
      toastError('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  };

  const filteredCoupons = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return coupons.filter((coupon) => {
      if (currentTab === 'Ativos' && coupon.status !== 'ativo') return false;
      if (currentTab === 'Inativos' && coupon.status !== 'inativo') return false;
      if (currentTab === 'Expirados' && coupon.status !== 'expirado') return false;

      if (!term) return true;

      return (
        coupon.code.toLowerCase().includes(term) ||
        (coupon.description && coupon.description.toLowerCase().includes(term)) ||
        coupon.establishment.toLowerCase().includes(term)
      );
    });
  }, [coupons, currentTab, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / itemsPerPage));
  const paginatedCoupons = filteredCoupons.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatValidity = (validFrom: string | null, validTo: string | null) => {
    if (!validFrom && !validTo) return '-';

    try {
      const formatLocal = (dateStr: string) => {
        // Parse YYYY-MM-DD manually to avoid timezone issues
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return format(date, 'dd/MM/yyyy', { locale: ptBR });
      };

      const fromText = validFrom ? formatLocal(validFrom) : null;
      const toText = validTo ? formatLocal(validTo) : null;

      if (fromText && toText) return `${fromText} - ${toText}`;
      if (toText) return `Até ${toText}`;
      if (fromText) return `A partir de ${fromText}`;
    } catch {
      return '-';
    }

    return '-';
  };

  const handleChangeTab = (tab: CouponTab) => {
    setCurrentTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleView = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setViewModalOpen(true);
  };

  const handleEdit = (coupon: Coupon) => {
    router.push(`/cupons/novo?id=${coupon.id}`);
  };

  const handleDelete = (coupon: Coupon) => {
    setCouponToDelete(coupon);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!couponToDelete) return;

    try {
      setDeleting(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      const res = await fetch(`/api/cupons/${couponToDelete.id}`, {
        method: 'DELETE',
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao excluir cupom');
      }

      setCoupons((prev) => prev.filter((c) => c.id !== couponToDelete.id));
    } catch (err) {
      console.error('Erro ao excluir cupom:', err);
      toastError('Erro ao excluir cupom');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setCouponToDelete(null);
    }
  };

  const getStatusLabel = (status: CouponStatus) => {
    if (status === 'ativo') return 'ATIVO';
    if (status === 'inativo') return 'INATIVO';
    return 'EXPIRADO';
  };

  const getStatusClass = (status: CouponStatus) => {
    if (status === 'ativo') return styles.statusActive;
    if (status === 'inativo') return styles.statusInactive;
    return styles.statusBlocked;
  };

  const getTypeAndValueText = (coupon: Coupon) => {
    if (coupon.type === 'percentual') {
      if (coupon.value !== null) {
        return `Porcentagem - ${coupon.value}% OFF`;
      }
      return 'Porcentagem';
    }

    if (coupon.value !== null) {
      return `Valor Fixo - ${formatCurrency(coupon.value)}`;
    }

    return 'Valor Fixo';
  };

  const formatEndDate = (validTo: string | null) => {
    if (!validTo) return '-';
    try {
      return format(new Date(validTo), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.content}>
        <AdminHeader />

        <main className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <Link
              href="/"
              className={styles.backLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#6b7280',
                textDecoration: 'none',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              ← Voltar para Dashboard
            </Link>
            <h1 className={styles.title}>Cupons</h1>
            <p className={styles.subtitle}>Gerencie os cupons de desconto</p>
          </div>

          <div className={styles.actionsBar}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={20} />
              <input
                type="text"
                placeholder="Buscar por código, descrição ou estabelecimento"
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            <div className={styles.actionButtons}>
              <button
                className={`${styles.btn} ${styles.btnNew}`}
                onClick={() => router.push('/cupons/novo')}
              >
                <Plus size={18} />
                Novo Cupom
              </button>
            </div>
          </div>

          <div className={styles.filtersBar}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${
                  currentTab === 'Todos' ? styles.tabActive : ''
                }`}
                onClick={() => handleChangeTab('Todos')}
              >
                Todos
              </button>
              <button
                className={`${styles.tab} ${
                  currentTab === 'Ativos' ? styles.tabActive : ''
                }`}
                onClick={() => handleChangeTab('Ativos')}
              >
                Ativos
              </button>
              <button
                className={`${styles.tab} ${
                  currentTab === 'Inativos' ? styles.tabActive : ''
                }`}
                onClick={() => handleChangeTab('Inativos')}
              >
                Inativos
              </button>
              <button
                className={`${styles.tab} ${
                  currentTab === 'Expirados' ? styles.tabActive : ''
                }`}
                onClick={() => handleChangeTab('Expirados')}
              >
                Expirados
              </button>
            </div>
          </div>

          <div className={styles.tableContainer}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                Carregando cupons...
              </div>
            ) : paginatedCoupons.length === 0 ? (
              <div className={styles.emptyState}>Nenhum cupom encontrado.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>NOME DO CUPOM</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Estabelecimento</th>
                    <th>Validade</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCoupons.map((coupon) => (
                    <tr key={coupon.id}>
                      <td>{coupon.code || '-'}</td>
                      <td>{coupon.description || '-'}</td>
                      <td>
                        {coupon.type === 'percentual' ? 'Percentual' : 'Valor Fixo'}
                      </td>
                      <td>
                        {coupon.type === 'percentual'
                          ? coupon.value !== null
                            ? `${coupon.value}%`
                            : '-'
                          : formatCurrency(coupon.value)}
                      </td>
                      <td>{coupon.establishment || '-'}</td>
                      <td>{formatValidity(coupon.validFrom, coupon.validTo)}</td>
                      <td>
                        <span className={styles.statusBadge}>
                          {getStatusLabel(coupon.status)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.actionBtn} ${styles.btnView}`}
                            title="Visualizar"
                            type="button"
                            onClick={() => handleView(coupon)}
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.btnEdit}`}
                            title="Editar"
                            type="button"
                            onClick={() => handleEdit(coupon)}
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.btnDelete}`}
                            title="Excluir"
                            type="button"
                            onClick={() => handleDelete(coupon)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile List View */}
          <div className={styles.mobileList}>
            {loading ? (
              <div className={styles.emptyState}>Carregando cupons...</div>
            ) : paginatedCoupons.length === 0 ? (
              <div className={styles.emptyState}>Nenhum cupom encontrado.</div>
            ) : (
              paginatedCoupons.map((coupon) => (
                <div key={coupon.id} className={styles.mobileCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardText}>
                      <div className={styles.cardTitle}>{coupon.code || '-'}</div>
                      <div className={styles.cardSubtitle}>
                        {getTypeAndValueText(coupon)}
                      </div>
                      <div className={styles.cardSubtitle}>
                        {coupon.establishment || 'Todos os estabelecimentos'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#9ca3af',
                          textTransform: 'uppercase',
                          marginBottom: '0.1rem',
                        }}
                      >
                        Validade
                      </div>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        {formatEndDate(coupon.validTo)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '0.75rem',
                    }}
                  >
                    <span
                      className={`${styles.statusBadge} ${getStatusClass(coupon.status)}`}
                    >
                      {getStatusLabel(coupon.status)}
                    </span>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionBtn}
                        type="button"
                        title="Visualizar"
                        onClick={() => handleView(coupon)}
                      >
                        <Eye size={18} className={styles.iconBlue} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        type="button"
                        title="Editar"
                        onClick={() => handleEdit(coupon)}
                      >
                        <Pencil size={18} className={styles.iconOrange} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        type="button"
                        title="Excluir"
                        onClick={() => handleDelete(coupon)}
                      >
                        <Trash2 size={18} className={styles.iconRed} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {!loading && filteredCoupons.length > 0 && (
            <div className={styles.pagination}>
              <span>
                Mostrando{' '}
                {filteredCoupons.length === 0
                  ? 0
                  : (currentPage - 1) * itemsPerPage + 1}{' '}
                a{' '}
                {Math.min(currentPage * itemsPerPage, filteredCoupons.length)} de{' '}
                {filteredCoupons.length} resultados
              </span>
              <div className={styles.paginationButtons}>
                <button
                  className={styles.pageBtn}
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <button
                  className={styles.pageBtn}
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      <ViewDetailsModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Detalhes do Cupom"
        data={
          selectedCoupon
            ? {
                codigo: selectedCoupon.code || '-',
                descricao: selectedCoupon.description || '-',
                tipo: selectedCoupon.type === 'percentual' ? 'Percentual' : 'Valor Fixo',
                valor:
                  selectedCoupon.type === 'percentual'
                    ? selectedCoupon.value !== null
                      ? `${selectedCoupon.value}%`
                      : '-'
                    : formatCurrency(selectedCoupon.value),
                estabelecimento: selectedCoupon.establishment || '-',
                validade: formatValidity(
                  selectedCoupon.validFrom,
                  selectedCoupon.validTo,
                ),
                status: getStatusLabel(selectedCoupon.status),
              }
            : null
        }
        labels={{
          codigo: 'Nome do Cupom',
          descricao: 'Descrição',
          tipo: 'Tipo de Desconto',
          valor: 'Valor',
          estabelecimento: 'Estabelecimento',
          validade: 'Validade',
          status: 'Status',
        }}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setCouponToDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        isDeleting={deleting}
        title="Excluir Cupom"
        description={
          <>
            Tem certeza que deseja excluir o cupom{' '}
            <strong>{couponToDelete?.code || ''}</strong>? Esta ação não pode ser
            desfeita.
          </>
        }
      />
    </div>
  );
}
