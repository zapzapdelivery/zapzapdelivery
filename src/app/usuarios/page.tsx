"use client";

// Force re-compile
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Search, 
  Upload, 
  Download, 
  Plus, 
  List, 
  LayoutGrid, 
  Eye, 
  Pencil, 
  Trash, 
  ChevronLeft, 
  ChevronRight,
  Settings
} from 'lucide-react';
import styles from './usuarios.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { useUserRole } from '@/hooks/useUserRole';

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { success, error: showError } = useToast();
  
  // Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTab, setCurrentTab] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewData, setViewData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { role, loading: loadingRole } = useUserRole();


  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchUsers() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (session?.user) {
          setCurrentUserId(session.user.id);
        }

        const response = await fetch('/api/usuarios', { 
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const data = await response.json();
        
        if (response.ok && Array.isArray(data)) {
          // Mapeamento de campos do banco para a interface
          const mappedUsers = data.map((user: any) => ({
            id: user.id,
            name: user.nome || user.name || 'Sem Nome',
            email: user.email || '',
            establishment: user.estabelecimentos?.nome_estabelecimento || user.estabelecimento_nome || user.estabelecimento_id || '-',
            profile: user.tipos_usuarios?.nome_tipo_usuario || user.cargo || user.role || 'Usuário',
            status: user.status_usuario === 'ativo' ? 'active' : 'inactive',
            avatar: user.avatar_url || null,
            lastAccess: user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-'
          }));
          setUsers(mappedUsers);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Erro ao buscar usuários:', error);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchUsers();

    return () => {
      controller.abort();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const bySearch = (u: any) =>
      !term ||
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      String(u.establishment).toLowerCase().includes(term);
    const byStatus = (u: any) => {
      if (currentTab === 'Ativos') return u.status === 'active';
      if (currentTab === 'Inativos') return u.status === 'inactive';
      if (currentTab === 'Administradores') return String(u.profile) === 'Administrador';
      if (currentTab === 'Operadores') return String(u.profile) === 'Operador';
      return true;
    };
    return users.filter(u => bySearch(u) && byStatus(u));
  }, [users, searchTerm, currentTab]);

  if (loadingRole) {
    return (
      <div className={styles.container}>
        <div className={styles.mainContent}>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  const USER_LABELS = {
    name: 'Nome',
    email: 'E-mail',
    establishment: 'Estabelecimento',
    profile: 'Perfil',
    status: 'Status',
    lastAccess: 'Último Acesso'
  };

  const handleView = (user: any) => {
    setViewData(user);
    setViewModalOpen(true);
  };

  const ITEMS_PER_PAGE = 10;

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      setIsDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/usuarios/${userToDelete.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir usuário');
      }
      
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      success('Usuário excluído com sucesso');
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      console.error(err);
      showError(err.message || 'Erro ao excluir');
    } finally {
      setIsDeleting(false);
    }
  };

  const getProfileBadgeClass = (profile: string) => {
    switch (profile) {
      case 'Administrador': return styles.badgeAdmin;
      case 'Operador': return styles.badgeOperator;
      case 'Entregador': return styles.badgeDeliverer;
      default: return styles.badgeOperator;
    }
  };

  const totalPages = Math.max(1, Math.ceil((filteredUsers?.length || 0) / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = (filteredUsers || []).slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const start = (filteredUsers?.length || 0) === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const end = Math.min(safePage * ITEMS_PER_PAGE, filteredUsers?.length || 0);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const pageNumbers = (() => {
    const maxButtons = 5;
    const pages: number[] = [];
    let startPage = Math.max(1, safePage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    for (let p = startPage; p <= endPage; p++) pages.push(p);
    return pages;
  })();

  return (
    <div className={styles.container}>
      
      <main className={styles.mainContent}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={20} />
            Voltar para Dashboard
          </Link>
          <h1 className={styles.title}>Usuários</h1>
          <p className={styles.subtitle}>Gerencie as permissões e acessos ao sistema</p>
        </div>

        {/* Actions Toolbar */}
        <div className={styles.actionsToolbar}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail ou estabelecimento" 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className={styles.actionButtons}>
            {!loadingRole && role !== 'estabelecimento' && (
              <Link href="/usuarios/tipos" className={`${styles.btn} ${styles.btnTypes}`} style={{ textDecoration: 'none' }}>
                <Settings size={18} />
                Tipo de Usuários
              </Link>
            )}
            <button className={`${styles.btn} ${styles.btnImport}`}>
              <Upload size={18} />
              Importar
            </button>
            <button className={`${styles.btn} ${styles.btnExport}`}>
              <Download size={18} />
              Exportar
            </button>
            <Link href="/usuarios/novo" className={`${styles.btn} ${styles.btnNew}`} style={{ textDecoration: 'none' }}>
              <Plus size={18} />
              Novo Usuário
            </Link>
          </div>
        </div>

        {/* Filters & Toggle */}
        <div className={styles.filtersBar}>
          <div className={styles.tabs}>
            {['Todos', 'Ativos', 'Inativos', 'Administradores', 'Operadores'].map((tab) => (
              <button 
                key={tab}
                className={`${styles.tab} ${currentTab === tab ? styles.tabActive : ''}`}
                onClick={() => {
                  setCurrentTab(tab);
                  setCurrentPage(1);
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.viewToggle}>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={20} />
            </button>
            <button 
              className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Cards View */}
        <div className={styles.mobileCardsContainer}>
          {paginated.map((user) => (
            <div key={user.id} className={styles.mobileCard}>
              <div className={styles.mobileCardHeader}>
                <div className={styles.mobileCardUser}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {(user.name || '').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.mobileUserInfo}>
                    <span className={styles.userName}>{user.name}</span>
                    <span className={styles.userRole}>{user.profile}</span>
                  </div>
                </div>
                <div className={styles.mobileCardStatus}>
                  {user.status === 'active' ? (
                    <div className={`${styles.badge} ${styles.statusActive}`}>
                      Ativo
                    </div>
                  ) : (
                    <div className={`${styles.badge} ${styles.statusInactive}`}>
                      Inativo
                    </div>
                  )}
                </div>
              </div>
              
              <div className={styles.mobileCardDivider} />
              
              <div className={styles.mobileCardFooter}>
                <span className={styles.lastAccess}>Último acesso: {user.lastAccess}</span>
                <div className={styles.actions}>
                  <button className={`${styles.actionButton} ${styles.viewButton}`} onClick={() => handleView(user)}>
                            <Eye size={18} />
                          </button>
                  <Link href={`/usuarios/editar/${user.id}`} className={`${styles.actionButton} ${styles.editButton}`}>
                    <Pencil size={20} />
                  </Link>
                  {role !== 'atendente' && user.id !== currentUserId && (
                    <button 
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      onClick={() => handleDeleteClick(user)}
                    >
                      <Trash size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table Content */}

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>AVATAR</th>
                <th>NOME</th>
                <th>E-MAIL</th>
                <th>ESTABELECIMENTO</th>
                <th>PERFIL</th>
                <th>STATUS</th>
                <th>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className={styles.avatar} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {(user.name || '').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={styles.userName}>{user.name}</span>
                  </td>
                  <td>
                    <span className={styles.userEmail}>{user.email}</span>
                  </td>
                  <td>{user.establishment}</td>
                  <td>
                    <span className={`${styles.badge} ${getProfileBadgeClass(user.profile)}`}>
                      {user.profile}
                    </span>
                  </td>
                  <td>
                    {user.status === 'active' ? (
                      <div className={`${styles.badge} ${styles.statusActive}`}>
                        <div className={styles.statusDot} />
                        Ativo
                      </div>
                    ) : (
                      <div className={`${styles.badge} ${styles.statusInactive}`}>
                        <div className={styles.statusDot} />
                        Inativo
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={`${styles.actionButton} ${styles.viewButton}`} title="Visualizar" onClick={() => handleView(user)}>
                        <Eye size={18} />
                      </button>
                      <Link href={`/usuarios/editar/${user.id}`} className={`${styles.actionButton} ${styles.editButton}`} title="Editar">
                        <Pencil size={18} />
                      </Link>
                      {role !== 'atendente' && user.id !== currentUserId && (
                        <button 
                          className={`${styles.actionButton} ${styles.deleteButton}`} 
                          title="Excluir"
                          onClick={() => handleDeleteClick(user)}
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

          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Mostrando <strong>{start}-{end}</strong> de <strong>{filteredUsers?.length || 0}</strong> usuários
            </span>
            <div className={styles.paginationControls}>
              <button 
                className={styles.pageBtn}
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${safePage === p ? styles.pageBtnActive : ''}`}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </button>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <button className={styles.pageBtn} onClick={() => handlePageChange(Math.min(totalPages, safePage + 3))}>...</button>
              )}
              <button 
                className={styles.pageBtn}
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <ViewDetailsModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Detalhes do Usuário"
          data={viewData}
          labels={USER_LABELS}
        />
        <DeleteConfirmationModal
        isOpen={deleteModalOpen}
          onClose={() => !isDeleting && setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
          title="Excluir Usuário"
          description={
            <>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </>
          }
        />
      </main>
    </div>
  );
}
