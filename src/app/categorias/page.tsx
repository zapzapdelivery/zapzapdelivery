'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { AdminHeader } from '../../components/Header/AdminHeader';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Download,
  Upload,
  List as ListIcon,
  LayoutGrid,
  Eye,
  Store,
  GripVertical
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import styles from './categorias.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { useEstablishment } from '@/hooks/useEstablishment';
import { logAction } from '@/lib/logger';
import { useUserRole } from '@/hooks/useUserRole';
import { useStorage } from '@/hooks/useStorage';

interface Categoria {
  id: string;
  nome_categoria: string;
  descricao: string | null;
  status_categoria: string;
  ordem_exibicao: number;
  imagem_categoria_url: string | null;
  estabelecimento_id: string;
}

export default function CategoriasPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { establishmentId, establishmentName, loading: loadingEstablishment, isSuperAdmin } = useEstablishment();
  const { role, loading: loadingRole } = useUserRole();
  const { deleteFile } = useStorage();
  
  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  // State
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Categoria | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<Categoria | null>(null);

  // Increase page size to allow better reordering experience
  const pageSize = 50;

  const CATEGORY_LABELS = {
    nome_categoria: 'Nome',
    descricao: 'Descrição',
    status_categoria: 'Status',
    ordem_exibicao: 'Ordem',
    imagem_categoria_url: 'URL Imagem'
  };

  const handleView = (category: Categoria) => {
    setViewData(category);
    setViewModalOpen(true);
  };

  const isDragEnabled = !searchTerm && statusFilter === 'todos';

  const handleOnDragEnd = async (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Adjust indices for pagination
    const start = (page - 1) * pageSize;
    const realSourceIndex = start + sourceIndex;
    const realDestinationIndex = start + destinationIndex;

    // Create a new array with the reordered items
    const reorderedCategorias = Array.from(categorias);
    const [reorderedItem] = reorderedCategorias.splice(realSourceIndex, 1);
    reorderedCategorias.splice(realDestinationIndex, 0, reorderedItem);

    // Update local state immediately for UI responsiveness
    setCategorias(reorderedCategorias);

    // Persist to Backend
    try {
      const updates = reorderedCategorias.map((cat, index) => ({
        ...cat,
        ordem_exibicao: index
      }));

      const { error } = await supabase
        .from('categorias')
        .upsert(updates);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar ordem:', error);
      toastError('Erro ao salvar a nova ordem');
      // Revert local state logic could be added here if strict consistency is required
      fetchCategorias(establishmentId); // Reload from server to reset order
    }
  };

  const fetchCategorias = async (estabId: string | null) => {
    try {
      setLoading(true);
      
      // Get categories
      let query = supabase
        .from('categorias')
        .select('*');
      
      if (estabId) {
        query = query.eq('estabelecimento_id', estabId);
      }

      const { data, error } = await query.order('ordem_exibicao', { ascending: true });
      
      if (error) throw error;
      setCategorias(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toastError('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (establishmentId) {
      fetchCategorias(establishmentId);
    } else if (isSuperAdmin) {
      fetchCategorias(null);
    } else if (!loadingEstablishment) {
      setLoading(false);
    }
  }, [establishmentId, isSuperAdmin, loadingEstablishment]);

  // Filter & Pagination Logic
  const filteredCategorias = useMemo(() => {
    return categorias.filter(cat => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        cat.nome_categoria.toLowerCase().includes(searchLower) ||
        (cat.id && cat.id.toLowerCase().includes(searchLower));

      const matchesStatus = statusFilter === 'todos' || cat.status_categoria === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [categorias, searchTerm, statusFilter]);

  const paginatedCategorias = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCategorias.slice(start, start + pageSize);
  }, [filteredCategorias, page]);

  const totalPages = Math.ceil(filteredCategorias.length / pageSize);

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

  const handleDelete = (id: string) => {
    const category = categorias.find(c => c.id === id);
    if (category) {
      setItemToDelete(category);
      setDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id;

    if (!establishmentId && !isSuperAdmin) {
      toastError('Erro: Estabelecimento não identificado.');
      return;
    }

    try {
      setIsDeleting(true);

      // 1. Delete image from Storage if exists
      if (itemToDelete.imagem_categoria_url) {
        await deleteFile(itemToDelete.imagem_categoria_url, 'categories');
      }

      // 2. Delete from DB
      let query = supabase
        .from('categorias')
        .delete()
        .eq('id', id);
      
      if (establishmentId) {
        query = query.eq('estabelecimento_id', establishmentId); // Enforce ownership
      }

      const { error } = await query;

      if (error) throw error;

      await logAction({
        action: 'DELETE',
        entity: 'categorias',
        entity_id: id,
        details: { establishmentId }
      });

      setCategorias(prev => prev.filter(cat => cat.id !== id));
      success('Categoria excluída com sucesso');
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toastError('Erro ao excluir categoria');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to shorten ID
  const formatId = (id: string) => {
    return `#CAT-${id.substring(0, 3).toUpperCase()}`; // Simulating the #CAT-001 style
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.content}>
        <AdminHeader />
        
        <div className={styles.pageHeader}>
          <div>
            <Link href="/dashboard" className={styles.backLink}>← Voltar para Dashboard</Link>
            <h1 className={styles.title}>Categorias</h1>
            <p className={styles.subtitle}>Gerencie as categorias dos seus produtos</p>
          </div>
        </div>

        <div className={styles.actionsBar}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar categoria por nome ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.actionButtons}>
            <button className={styles.secondaryButton}>
              <Upload size={18} />
              <span>Importar</span>
            </button>
            <button className={styles.secondaryButton}>
              <Download size={18} />
              <span>Exportar</span>
            </button>
            <Link href="/categorias/novo" className={styles.primaryButton}>
              <Plus size={18} />
              <span>Nova Categoria</span>
            </Link>
          </div>
        </div>

        <div className={styles.filtersBar}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${statusFilter === 'todos' ? styles.activeTab : ''}`}
              onClick={() => { setStatusFilter('todos'); setPage(1); }}
            >
              Todos
            </button>
            <button 
              className={`${styles.tab} ${statusFilter === 'ativo' ? styles.activeTab : ''}`}
              onClick={() => { setStatusFilter('ativo'); setPage(1); }}
            >
              Ativas
            </button>
            <button 
              className={`${styles.tab} ${statusFilter === 'inativo' ? styles.activeTab : ''}`}
              onClick={() => { setStatusFilter('inativo'); setPage(1); }}
            >
              Inativas
            </button>
          </div>

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

        <DragDropContext onDragEnd={handleOnDragEnd}>
          {loading ? (
            <div className={styles.loading}>Carregando categorias...</div>
          ) : filteredCategorias.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>Nenhuma categoria encontrada</h3>
              <p>{searchTerm ? 'Tente buscar com outros termos' : 'Comece criando sua primeira categoria'}</p>
            </div>
          ) : view === 'list' ? (
            /* List View (Table) */
            <div className={styles.tableContainer}>
              <Droppable droppableId="categorias-list" isDropDisabled={!isDragEnabled}>
                {(provided) => (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Imagem</th>
                        <th>Nome da Categoria</th>
                        <th>Estabelecimento</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody ref={provided.innerRef} {...provided.droppableProps}>
                      {paginatedCategorias.map((categoria, index) => (
                        <Draggable 
                          key={categoria.id} 
                          draggableId={categoria.id} 
                          index={index}
                          isDragDisabled={!isDragEnabled}
                        >
                          {(provided, snapshot) => (
                            <tr 
                              ref={provided.innerRef} 
                              {...provided.draggableProps}
                              style={{
                                ...provided.draggableProps.style,
                                background: snapshot.isDragging ? '#f3f4f6' : 'transparent',
                                display: snapshot.isDragging ? 'table' : undefined // Fix for table row collapse during drag
                              }}
                            >
                              <td style={{ width: '40px' }}>
                                <div {...provided.dragHandleProps} style={{ cursor: isDragEnabled ? 'grab' : 'default', opacity: isDragEnabled ? 1 : 0.3 }}>
                                  <GripVertical size={20} color="#9ca3af" />
                                </div>
                              </td>
                              <td className={styles.imageCell}>
                                <div className={styles.categoryImage}>
                                  {categoria.imagem_categoria_url ? (
                                    <img src={categoria.imagem_categoria_url} alt={categoria.nome_categoria} />
                                  ) : (
                                    <Store className={styles.placeholderImage} size={24} />
                                  )}
                                </div>
                              </td>
                              <td className={styles.nameCell}>
                                <div className={styles.categoryName}>{categoria.nome_categoria}</div>
                              </td>
                              <td>
                                <div className={styles.establishmentCell}>
                                  <Store size={16} />
                                  <span>{establishmentName || 'Estabelecimento'}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`${styles.statusBadge} ${categoria.status_categoria === 'ativo' ? styles.activeBadge : styles.inactiveBadge}`}>
                                  <span className={styles.dot}></span>
                                  {categoria.status_categoria === 'ativo' ? 'Ativa' : 'Inativa'}
                                </span>
                              </td>
                              <td>
                                <div className={styles.actionsCell}>
                                  <button className={`${styles.actionButton} ${styles.viewButton}`} title="Visualizar" onClick={() => handleView(categoria)}>
                                    <Eye size={18} />
                                  </button>
                                  <Link 
                                    href={`/categorias/novo?id=${categoria.id}`} 
                                    className={`${styles.actionButton} ${styles.editButton}`} 
                                    title="Editar"
                                  >
                                    <Edit size={18} />
                                  </Link>
                                  {role !== 'atendente' && !loadingRole && (
                                    <button 
                                      onClick={() => handleDelete(categoria.id)} 
                                      className={`${styles.actionButton} ${styles.deleteButton}`} 
                                      title="Excluir"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  </table>
                )}
              </Droppable>
            </div>
          ) : (
          /* Grid View */
          <div className={styles.grid}>
            {paginatedCategorias.map((categoria) => (
              <div key={categoria.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{categoria.nome_categoria}</h3>
                  <div className={styles.actionsCell}>
                    <Link 
                      href={`/categorias/novo?id=${categoria.id}`}
                      className={`${styles.actionButton} ${styles.editButton}`}
                      title="Editar"
                    >
                      <Edit size={18} />
                    </Link>
                    {role !== 'atendente' && !loadingRole && (
                      <button 
                        onClick={() => handleDelete(categoria.id)}
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className={`${styles.statusBadge} ${categoria.status_categoria === 'ativo' ? styles.activeBadge : styles.inactiveBadge}`}>
                    <span className={styles.dot}></span>
                    {categoria.status_categoria === 'ativo' ? 'Ativa' : 'Inativa'}
                  </span>
                  {categoria.imagem_categoria_url && (
                    <div className={styles.categoryImage} style={{ width: 32, height: 32 }}>
                      <img src={categoria.imagem_categoria_url} alt={categoria.nome_categoria} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile List View */}
        {!loading && filteredCategorias.length > 0 && (
          <div className={styles.mobileList}>
            <Droppable droppableId="categorias-mobile-list" isDropDisabled={!isDragEnabled}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {paginatedCategorias.map((categoria, index) => (
                    <Draggable 
                      key={categoria.id} 
                      draggableId={`mobile-${categoria.id}`} 
                      index={index}
                      isDragDisabled={!isDragEnabled}
                    >
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef} 
                          {...provided.draggableProps}
                          className={styles.mobileCard}
                          style={{
                            ...provided.draggableProps.style,
                            backgroundColor: snapshot.isDragging ? '#f3f4f6' : 'white',
                            position: 'relative' // For absolute positioning of grip if needed, though we use flex
                          }}
                        >
                          <div className={styles.mobileCardHeader}>
                            <div className={styles.mobileCardInfo} style={{ display: 'flex', alignItems: 'center' }}>
                              {/* Drag Handle for Mobile */}
                              <div 
                                {...provided.dragHandleProps} 
                                style={{ 
                                  marginRight: '10px', 
                                  cursor: isDragEnabled ? 'grab' : 'default',
                                  opacity: isDragEnabled ? 1 : 0.3,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <GripVertical size={24} color="#9ca3af" />
                              </div>
                              
                              <div className={styles.categoryImage}>
                                {categoria.imagem_categoria_url ? (
                                  <img src={categoria.imagem_categoria_url} alt={categoria.nome_categoria} />
                                ) : (
                                  <Store className={styles.placeholderImage} size={24} />
                                )}
                              </div>
                              <div className={styles.mobileCardContent}>
                                <div className={styles.categoryName}>{categoria.nome_categoria}</div>
                                <div className={styles.establishmentCell} style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                                  <Store size={14} />
                                  <span>{establishmentName || 'Estabelecimento'}</span>
                                </div>
                              </div>
                            </div>
                            <span className={`${styles.statusBadge} ${categoria.status_categoria === 'ativo' ? styles.activeBadge : styles.inactiveBadge}`}>
                              {categoria.status_categoria === 'ativo' ? 'Ativa' : 'Inativa'}
                            </span>
                          </div>
                          
                          <div className={styles.mobileCardActions}>
                            <button className={styles.mobileActionButton} title="Visualizar" onClick={() => handleView(categoria)}>
                              <Eye size={20} />
                            </button>
                            <Link href={`/categorias/novo?id=${categoria.id}`} className={styles.mobileActionButton} title="Editar">
                              <Edit size={20} />
                            </Link>
                            {role !== 'atendente' && !loadingRole && (
                              <button 
                                onClick={() => handleDelete(categoria.id)}
                                className={styles.mobileActionButton} 
                                title="Excluir"
                              >
                                <Trash2 size={20} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )}
        </DragDropContext>

        {/* Pagination */}
        {!loading && filteredCategorias.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, filteredCategorias.length)} de {filteredCategorias.length} resultados
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
        title="Detalhes da Categoria"
        data={viewData}
        labels={CATEGORY_LABELS}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        title="Excluir Categoria"
        description={
          <>
            Tem certeza que deseja excluir a categoria <strong>{itemToDelete?.nome_categoria}</strong>? Esta ação não pode ser desfeita.
          </>
        }
      />
    </div>
  );
}
