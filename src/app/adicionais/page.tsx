'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { supabase } from '@/lib/supabase';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Layers,
  List as ListIcon,
  LayoutGrid,
  ListChecks,
  X,
} from 'lucide-react';
import styles from './adicionais.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { useEstablishment } from '@/hooks/useEstablishment';
import { useUserRole } from '@/hooks/useUserRole';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';

interface GrupoAdicional {
  id: string;
  nome: string;
  tipo_selecao: 'unico' | 'multiplo';
  obrigatorio: boolean;
  min_opcoes: number;
  max_opcoes: number;
  ordem_exibicao: number;
  estabelecimento_id: string;
  categoria_id?: string | null;
}

interface Category {
  id: string;
  nome_categoria: string;
}

interface AdicionalItem {
  id: string;
  grupo_id: string;
  nome: string;
  preco: number;
  ativo: boolean;
  ordem_exibicao: number;
  controla_estoque?: boolean | null;
  estoque_atual?: number | null;
}

export default function AdicionaisPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { role, loading: loadingRole } = useUserRole();
  const { establishmentId, establishmentName, loading: loadingEstablishment, isSuperAdmin } = useEstablishment();

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  const [grupos, setGrupos] = useState<GrupoAdicional[]>([]);
  const [itens, setItens] = useState<AdicionalItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const pageSize = 8;
  const [page, setPage] = useState(1);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [grupoToDelete, setGrupoToDelete] = useState<GrupoAdicional | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editItemsModalOpen, setEditItemsModalOpen] = useState(false);
  const [groupForItemsEdit, setGroupForItemsEdit] = useState<GrupoAdicional | null>(null);

  const GRUPO_LABELS = {
    nome: 'Nome do grupo',
    tipo_selecao: 'Tipo de seleção',
    obrigatorio: 'Obrigatório',
    min_opcoes: 'Mínimo de opções',
    max_opcoes: 'Máximo de opções',
    ordem_exibicao: 'Ordem de exibição',
  };

  const fetchData = async (estabId: string | null) => {
    try {
      setLoading(true);
      let qGrupos = supabase.from('grupos_adicionais').select('*').order('ordem_exibicao');
      if (estabId) qGrupos = qGrupos.eq('estabelecimento_id', estabId);
      const { data: gRows, error: gErr } = await qGrupos;
      if (gErr) throw gErr;
      const groups = (gRows || []) as GrupoAdicional[];
      setGrupos(groups);

      let qCats = supabase
        .from('categorias')
        .select('id, nome_categoria')
        .eq('status_categoria', 'ativo');
      if (estabId) {
        qCats = qCats.eq('estabelecimento_id', estabId);
      }
      const { data: catRows, error: catErr } = await qCats;
      if (catErr) throw catErr;
      setCategories((catRows || []) as Category[]);

      if (groups.length > 0) {
        const ids = groups.map(g => g.id);
        const { data: iRows, error: iErr } = await supabase
          .from('adicionais')
          .select('*')
          .in('grupo_id', ids)
          .order('ordem_exibicao');
        if (iErr) throw iErr;
        setItens((iRows || []) as AdicionalItem[]);
      } else {
        setItens([]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar adicionais:', err);
      toastError('Erro ao carregar adicionais');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (establishmentId) {
      fetchData(establishmentId);
    } else if (isSuperAdmin) {
      fetchData(null);
    } else if (!loadingEstablishment) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishmentId, isSuperAdmin, loadingEstablishment]);

  const filteredGroups = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return grupos.filter(g => {
      const groupMatch =
        g.nome.toLowerCase().includes(s) ||
        (g.tipo_selecao === 'unico' ? 'unico' : 'multiplo').includes(s);
      if (groupMatch) return true;
      const itemsOfGroup = itens.filter(i => i.grupo_id === g.id);
      return itemsOfGroup.some(i => i.nome.toLowerCase().includes(s));
    });
  }, [grupos, itens, searchTerm]);

  const start = (page - 1) * pageSize;
  const paginatedGroups = filteredGroups.slice(start, start + pageSize);
  const totalPages = Math.ceil(filteredGroups.length / pageSize) || 1;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getCategoryName = (g: GrupoAdicional) => {
    if (!g.categoria_id) return '—';
    const cat = categories.find(
      (c) => String(c.id) === String(g.categoria_id),
    );
    return cat?.nome_categoria || '—';
  };

  const [dragState, setDragState] = useState<{ groupId: string; fromIndex: number; itemId: string } | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const handleDragStart = (groupId: string, fromIndex: number, itemId: string) => {
    if (isSavingOrder) return;
    setDragState({ groupId, fromIndex, itemId });
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    if (isSavingOrder) return;
    if (dragState && dragState.groupId === groupId) {
      e.preventDefault();
    }
  };

  const handleDrop = async (groupId: string, toIndex: number) => {
    if (!dragState || dragState.groupId !== groupId) return;
    const groupItems = itens
      .filter((i) => i.grupo_id === groupId)
      .sort((a, b) => (a.ordem_exibicao ?? 0) - (b.ordem_exibicao ?? 0));

    const fromIndex = dragState.fromIndex;
    const moved = groupItems.splice(fromIndex, 1)[0];
    groupItems.splice(toIndex, 0, moved);

    const updates = groupItems.map((it, idx) => ({
      id: it.id,
      ordem_exibicao: idx,
    }));

    try {
      setIsSavingOrder(true);
      await Promise.all(
        updates.map((u) =>
          supabase.from('adicionais').update({ ordem_exibicao: u.ordem_exibicao }).eq('id', u.id),
        ),
      );
      setItens((prev) =>
        prev.map((it) => {
          const u = updates.find((x) => x.id === it.id);
          if (u) return { ...it, ordem_exibicao: u.ordem_exibicao };
          return it;
        }),
      );
      success('Ordem dos itens atualizada');
    } catch (err) {
      console.error('Erro ao salvar nova ordem dos itens:', err);
      toastError('Erro ao salvar nova ordem dos itens');
    } finally {
      setIsSavingOrder(false);
      setDragState(null);
    }
  };

  const renderRules = (g: GrupoAdicional) => {
    const tipo = g.tipo_selecao === 'unico' ? 'Escolha única' : 'Múltipla';
    const obrig = g.obrigatorio ? 'Obrigatório' : 'Opcional';
    const range =
      g.tipo_selecao === 'multiplo'
        ? `• Min ${g.min_opcoes} • Max ${g.max_opcoes}`
        : '';
    return `${tipo} • ${obrig} ${range}`.trim();
  };

  const handleView = (g: GrupoAdicional) => {
    const groupItems = itens.filter(i => i.grupo_id === g.id);
    const data: any = {
      ...g,
      tipo_selecao: g.tipo_selecao === 'unico' ? 'Escolha única' : 'Múltipla escolha',
      obrigatorio: g.obrigatorio ? 'Sim' : 'Não',
      itens: groupItems
        .map(i => `${i.nome} (${formatCurrency(i.preco)})${i.ativo ? '' : ' - Inativo'}`)
        .join(', '),
    };
    setViewData(data);
    setViewModalOpen(true);
  };

  const handleDeleteClick = (g: GrupoAdicional) => {
    setGrupoToDelete(g);
    setDeleteModalOpen(true);
  };

  const handleEditItems = (g: GrupoAdicional) => {
    setGroupForItemsEdit(g);
    setEditItemsModalOpen(true);
  };

  const closeEditItemsModal = () => {
    setEditItemsModalOpen(false);
    setGroupForItemsEdit(null);
  };

  const confirmDelete = async () => {
    if (!grupoToDelete) return;

    if (!establishmentId && !isSuperAdmin) {
      toastError('Erro: Estabelecimento não identificado.');
      return;
    }

    try {
      setIsDeleting(true);

      const groupId = grupoToDelete.id;

      const { error: itensError } = await supabase
        .from('adicionais')
        .delete()
        .eq('grupo_id', groupId);

      if (itensError) throw itensError;

      let delGrupo = supabase.from('grupos_adicionais').delete().eq('id', groupId);
      if (establishmentId) {
        delGrupo = delGrupo.eq('estabelecimento_id', establishmentId);
      }
      const { error: grupoError } = await delGrupo;
      if (grupoError) throw grupoError;

      setGrupos(prev => prev.filter(g => g.id !== groupId));
      setItens(prev => prev.filter(i => i.grupo_id !== groupId));
      success('Grupo de adicionais excluído com sucesso');
      setDeleteModalOpen(false);
      setGrupoToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir grupo de adicionais:', err);
      toastError('Erro ao excluir grupo de adicionais');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loadingRole) {
    return (
      <div className={styles.container}>
        <Sidebar />
        <div className={styles.content}>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.content}>
        <AdminHeader />

        <div className={styles.pageHeader}>
          <div>
            <Link href="/" className={styles.backLink}>← Voltar para Dashboard</Link>
            <h1 className={styles.title}>Adicionais</h1>
            <p className={styles.subtitle}>Gerencie grupos e itens de adicionais</p>
          </div>
        </div>

        <div className={styles.actionsBar}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por grupo ou item..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <div className={styles.actionButtons}>
            <Link href="/adicionais/novo-grupo" className={`${styles.primaryButton} ${styles.newGroupButton}`}>
              <Plus size={18} />
              <span>Novo Grupo</span>
            </Link>
            <Link href="/adicionais/novo-item" className={styles.primaryButton}>
              <Plus size={18} />
              <span>Novo Adicional</span>
            </Link>
          </div>
        </div>

        <div className={styles.filtersBar}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.toggleButton} ${view === 'list' ? styles.activeToggle : ''}`}
              onClick={() => setView('list')}
            >
              <ListIcon size={18} />
            </button>
            <button
              className={`${styles.toggleButton} ${view === 'grid' ? styles.activeToggle : ''}`}
              onClick={() => setView('grid')}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}>Carregando adicionais...</div>
        ) : filteredGroups.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>Nenhum adicional encontrado</h3>
            <p>{searchTerm ? 'Tente outros termos de busca' : 'Crie seu primeiro grupo de adicionais'}</p>
          </div>
        ) : view === 'list' ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Categorias</th>
                  <th>Ordem</th>
                  <th>Itens</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGroups.map((g) => {
                  const items = itens.filter(i => i.grupo_id === g.id);
                  return (
                    <tr key={g.id}>
                      <td className={styles.nameCell}>
                        <div className={styles.groupName}><Layers size={16} /> {g.nome}</div>
                        <div className={styles.groupId}>#{String(g.id).slice(0, 8).toUpperCase()}</div>
                      </td>
                      <td>{getCategoryName(g)}</td>
                      <td>{g.ordem_exibicao}</td>
                      <td onDragOver={(e) => handleDragOver(e, g.id)}>
                        {items.length === 0 ? (
                          <span className={styles.emptyBadge}>Sem itens</span>
                        ) : (
                          <div className={styles.itemsList}>
                            {items
                              .slice()
                              .sort((a, b) => (a.ordem_exibicao ?? 0) - (b.ordem_exibicao ?? 0))
                              .map((i, idx) => (
                                <span
                                  key={i.id}
                                  className={`${styles.itemBadge} ${styles.draggableBadge} ${
                                    dragState?.itemId === i.id ? styles.dragging : ''
                                  }`}
                                  draggable={!isSavingOrder}
                                  onDragStart={() => handleDragStart(g.id, idx, i.id)}
                                  onDrop={() => handleDrop(g.id, idx)}
                                  title="Arraste para reordenar"
                                >
                                  {i.nome} • {formatCurrency(i.preco)} {i.ativo ? '' : '• Inativo'}
                                </span>
                              ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button
                            className={`${styles.actionButton} ${styles.viewButton}`}
                            title="Visualizar"
                            onClick={() => handleView(g)}
                          >
                            <Eye size={18} />
                          </button>
                          <Link href={`/adicionais/novo-grupo?id=${g.id}`} className={`${styles.actionButton} ${styles.editButton}`} title="Editar Grupo">
                            <Edit size={18} />
                          </Link>
                          <button
                            className={`${styles.actionButton} ${styles.editItemsButton}`}
                            title="Editar Adicionais"
                            onClick={() => handleEditItems(g)}
                          >
                            <ListChecks size={18} />
                          </button>
                          <Link href={`/adicionais/novo-item?grupo_id=${g.id}`} className={`${styles.actionButton}`} title="Novo Item">
                            <Plus size={18} />
                          </Link>
                          {role !== 'atendente' && !loadingRole && (
                            <button
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              title="Excluir Grupo"
                              onClick={() => handleDeleteClick(g)}
                            >
                            <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.grid}>
            {paginatedGroups.map((g) => {
              const items = itens.filter(i => i.grupo_id === g.id);
              return (
                <div key={g.id} className={styles.card}>
                  <div className={styles.cardBody}>
                    <h3 className={styles.cardTitle}>{g.nome}</h3>
                    <div className={styles.cardCategory}>{getCategoryName(g)}</div>
                    <div className={styles.cardItems}>
                      {items.length === 0 ? (
                        <span className={styles.emptyBadge}>Sem itens</span>
                      ) : (
                        items.map(i => (
                          <span key={i.id} className={styles.itemBadge}>
                            {i.nome} • {formatCurrency(i.preco)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className={`${styles.actionsCell} ${styles.cardActions}`}>
                    <button
                      className={`${styles.actionButton} ${styles.viewButton}`}
                      title="Visualizar"
                      onClick={() => handleView(g)}
                    >
                      <Eye size={18} />
                    </button>
                    <Link
                      href={`/adicionais/novo-grupo?id=${g.id}`}
                      className={`${styles.actionButton} ${styles.editButton}`}
                      title="Editar Grupo"
                    >
                      <Edit size={18} />
                    </Link>
                    <button
                      className={`${styles.actionButton} ${styles.editItemsButton}`}
                      title="Editar Adicionais"
                      onClick={() => handleEditItems(g)}
                    >
                      <ListChecks size={18} />
                    </button>
                    {role !== 'atendente' && !loadingRole && (
                      <button
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        title="Excluir Grupo"
                        onClick={() => handleDeleteClick(g)}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {editItemsModalOpen && groupForItemsEdit && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <div>
                  <div className={styles.modalTitle}>Editar adicionais</div>
                  <div className={styles.modalSubtitle}>{groupForItemsEdit.nome}</div>
                </div>
                <button
                  className={styles.modalClose}
                  onClick={closeEditItemsModal}
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
              <div className={styles.modalBody}>
                {itens
                  .filter((i) => i.grupo_id === groupForItemsEdit.id)
                  .sort((a, b) => (a.ordem_exibicao ?? 0) - (b.ordem_exibicao ?? 0))
                  .map((i) => (
                    <div key={i.id} className={styles.modalItemRow}>
                      <div>
                        <div className={styles.modalItemName}>{i.nome}</div>
                        <div className={styles.modalItemPrice}>
                          {formatCurrency(i.preco)} {i.ativo ? '' : '• Inativo'}
                        </div>
                      </div>
                      <Link
                        href={`/adicionais/novo-item?id=${i.id}`}
                        className={`${styles.actionButton} ${styles.editButton}`}
                        title="Editar adicional"
                      >
                        <Edit size={16} />
                      </Link>
                    </div>
                  ))}
                {itens.filter((i) => i.grupo_id === groupForItemsEdit.id).length === 0 && (
                  <div className={styles.modalEmpty}>Este grupo ainda não possui adicionais.</div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <Link
                  href={`/adicionais/novo-item?grupo_id=${groupForItemsEdit.id}`}
                  className={styles.secondaryButton}
                  title="Novo adicional"
                >
                  <Plus size={16} />
                  <span>Novo adicional</span>
                </Link>
                <button
                  className={styles.secondaryGhostButton}
                  type="button"
                  onClick={closeEditItemsModal}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && filteredGroups.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              Mostrando {start + 1} a {Math.min(start + pageSize, filteredGroups.length)} de {filteredGroups.length} resultados
            </div>
            <div className={styles.paginationControls}>
              <button
                className={styles.pageButton}
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`${styles.pageButton} ${page === p ? styles.activePage : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className={styles.pageButton}
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
      <ViewDetailsModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Detalhes do Grupo de Adicionais"
        data={viewData}
        labels={GRUPO_LABELS}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        title="Excluir Grupo de Adicionais"
        description={
          <>
            Tem certeza que deseja excluir o grupo <strong>{grupoToDelete?.nome}</strong> e todos os seus itens? Esta ação não pode ser desfeita.
          </>
        }
      />
    </div>
  );
}
