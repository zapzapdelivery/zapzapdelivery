'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Search, Upload, Download, Plus, 
  Eye, Pencil, Trash, List, LayoutGrid
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/components/Toast/ToastProvider';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import styles from './parceiros.module.css';

type Status = 'ativo' | 'inativo';

interface Partner {
  id: string;
  nome: string;
  contato: string;
  email: string;
  status: Status;
  logoColor: string;
}

export default function ParceirosPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  
  const { role, loading: loadingRole } = useUserRole();

  useEffect(() => {
    if (!loadingRole && (role === 'estabelecimento' || role === 'atendente')) {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  if (loadingRole) {
    return (
      <div className={styles.container}>
        <Sidebar />
        <div className={styles.mainContent}>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  const PARTNER_LABELS = {
    id: 'ID',
    nome: 'Nome',
    email: 'E-mail',
    contato: 'Contato',
    status: 'Status',
    logoColor: 'Cor Logo'
  };

  const handleView = (p: Partner) => {
    setSelected(p);
    setViewModalOpen(true);
  };

  useEffect(() => {
    if (loadingRole) return; // Wait for role check
    
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const res = await fetch('/api/parceiros', { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao carregar parceiros');
        const list: Partner[] = (Array.isArray(data) ? data : []).map((t: any) => {
          const statusValue: Status = (t?.status === 'ativo' || t?.status === true) ? 'ativo' : 'inativo';
          const nome: string = t?.nome ?? 'Parceiro';
          const email: string = t?.email ?? '';
          const contato: string = t?.telefone ?? '';
          const logoColor: string = '#C9B889';
          return {
            id: t?.id ?? crypto.randomUUID(),
            nome,
            email,
            contato,
            status: statusValue,
            logoColor
          } as Partner;
        });
        setPartners(list);
        setPage(1);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setErrorMsg(e.message || 'Erro ao carregar parceiros');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [loadingRole]);

  const filtered = useMemo(() => {
    let items = partners;
    if (tab === 'ativos') items = items.filter(i => i.status === 'ativo');
    if (tab === 'inativos') items = items.filter(i => i.status === 'inativo');
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => 
        i.nome.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.contato.toLowerCase().includes(q)
      );
    }
    return items;
  }, [search, tab, partners]);

  if (loadingRole) return null;

  const confirmDelete = async () => {
    if (!selected?.id) return;
    setRemovingId(selected.id);
    try {
      const res = await fetch(`/api/parceiros?id=${selected.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao excluir parceiro');
      setPartners((prev) => prev.filter((pp) => pp.id !== selected.id));
      setDeleteModalOpen(false);
      success('Parceiro excluído com sucesso');
    } catch (e: any) {
      error(e.message || 'Erro ao excluir parceiro');
    } finally {
      setRemovingId(null);
    }
  };

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const paginated = filtered.slice(startIdx, startIdx + pageSize);

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <Link href="/paineladmin" className={styles.backLink}>
            <ArrowLeft size={18} />
            Voltar para Dashboard
          </Link>
        </div>
        <div className={styles.mobileOnly}>
          <Link href="/paineladmin" className={styles.backLink}>
            <ArrowLeft size={18} />
            Voltar para Dashboard
          </Link>
        </div>

        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Parceiros</h1>
          <p className={styles.subtitle}>Gerencie os parceiros estratégicos do sistema</p>
        </div>

        {errorMsg && (
          <div className={styles.errorBar}>
            {errorMsg}
          </div>
        )}

        <div className={styles.toolbar}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Buscar parceiros..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className={styles.actionButtons}>
            <button className={`${styles.btn} ${styles.btnImport}`}>
              <Upload size={18} />
              Importar
            </button>
            <button className={`${styles.btn} ${styles.btnExport}`}>
              <Download size={18} />
              Exportar
            </button>
            {!loadingRole && role !== 'estabelecimento' && (
              <button
                className={`${styles.btn} ${styles.btnNew}`}
                onClick={() => router.push('/parceiros/novo')}
              >
                <Plus size={18} />
                Novo Parceiro
              </button>
            )}
          </div>
        </div>

        <div className={styles.filtersBar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'todos' ? styles.tabActive : ''}`}
              onClick={() => {
                setTab('todos');
                setPage(1);
              }}
            >
              Todos
            </button>
            <button
              className={`${styles.tab} ${tab === 'ativos' ? styles.tabActive : ''}`}
              onClick={() => {
                setTab('ativos');
                setPage(1);
              }}
            >
              Ativos
            </button>
            <button
              className={`${styles.tab} ${tab === 'inativos' ? styles.tabActive : ''}`}
              onClick={() => {
                setTab('inativos');
                setPage(1);
              }}
            >
              Inativos
            </button>
          </div>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('list')}
              aria-label="Listar"
            >
              <List size={18} />
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`}
              onClick={() => setView('grid')}
              aria-label="Grade"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        <div className={styles.mobileOnly}>
          <div className={styles.mobileList}>
            {loading && <div className={styles.loading}>Carregando...</div>}
            {!loading && paginated.length === 0 && <div className={styles.empty}>Nenhum parceiro encontrado</div>}
            {!loading && paginated.map((p) => (
              <div className={styles.mobileCard} key={p.id}>
                <div className={styles.mobileCardHeader}>
                  <span className={styles.mobileAvatar} style={{ backgroundColor: p.logoColor }} />
                  <div className={styles.mobileInfo}>
                    <span className={styles.mobileName}>{p.nome}</span>
                    <span className={styles.mobileEmail}>{p.email}</span>
                  </div>
                  <div className={styles.mobileStatus}>
                    <span className={`${styles.badge} ${p.status === 'ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                      {p.status === 'ativo' ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>
                </div>
                <div className={styles.mobileCardDivider} />
                <div className={styles.mobileCardFooter}>
                  <div className={styles.mobileActionCol}>
                    <button
                      className={`${styles.actionButton} ${styles.viewButton}`}
                      aria-label="Ver parceiro"
                      onClick={() => handleView(p)}
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                  <div className={styles.mobileActionCol}>
                    <button
                      className={`${styles.actionButton} ${styles.editButton}`}
                      aria-label="Editar parceiro"
                      onClick={() => router.push(`/parceiros/novo?id=${p.id}`)}
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                  {role !== 'atendente' && (
                    <div className={styles.mobileActionCol}>
                      <button
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        aria-label="Excluir parceiro"
                        onClick={() => {
                          setSelected(p);
                          setDeleteModalOpen(true);
                        }}
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {view === 'list' && (
          <div className={styles.desktopOnly}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Logo</th>
                    <th>Nome do Parceiro</th>
                    <th>Contato Principal</th>
                    <th>E-mail</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className={styles.loadingCell}>Carregando...</td>
                    </tr>
                  )}
                  {!loading && paginated.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.emptyCell}>Nenhum parceiro encontrado</td>
                    </tr>
                  )}
                  {!loading && paginated.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className={styles.logo} style={{ backgroundColor: p.logoColor }}></span>
                      </td>
                      <td className={styles.partnerName}>{p.nome}</td>
                      <td className={styles.partnerContact}>{p.contato}</td>
                      <td className={styles.partnerEmail}>{p.email}</td>
                      <td>
                        <span className={`${styles.badge} ${p.status === 'ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                          {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.actionButton} ${styles.viewButton}`}
                            onClick={() => handleView(p)}
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            className={`${styles.actionButton} ${styles.editButton}`}
                            onClick={() => router.push(`/parceiros/novo?id=${p.id}`)}
                          >
                            <Pencil size={18} />
                          </button>
                          {role !== 'atendente' && (
                            <button
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              onClick={() => {
                                setSelected(p);
                                setDeleteModalOpen(true);
                              }}
                            >
                              <Trash size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className={styles.desktopOnly}>
          <div className={styles.paginationRow}>
            <span className={styles.paginationInfo}>
              Mostrando {paginated.length} de {total} parceiros
            </span>
            <div className={styles.pagination}>
              {[...Array(totalPages)].map((_, idx) => {
                const n = idx + 1;
                return (
                  <button
                    key={n}
                    className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ''}`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <ViewDetailsModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Detalhes do Parceiro"
          data={selected}
          labels={PARTNER_LABELS}
        />
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => !removingId && setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          isDeleting={!!removingId}
          title="Excluir Parceiro"
          description={
            <>
              Tem certeza que deseja excluir <strong>{selected?.nome}</strong>? Esta ação não pode ser desfeita.
            </>
          }
        />
      </main>
    </div>
  );
}
