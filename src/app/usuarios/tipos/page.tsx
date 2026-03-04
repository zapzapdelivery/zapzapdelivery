'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../../components/Sidebar/Sidebar';
import { 
  ArrowLeft, 
  Plus, 
  Pencil, 
  Trash,
  Search,
  Upload,
  Download,
  List,
  LayoutGrid,
  Eye,
  ChevronLeft,
  ChevronRight,
  Shield,
  Bike,
  UserX,
  User,
  X,
  AlertTriangle
} from 'lucide-react';
import styles from './tipos.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { useUserRole } from '@/hooks/useUserRole';

interface UserType {
  id: string;
  nome_tipo_usuario: string;
  descricao: string;
  criado_em: string;
  // Mock fields for UI match
  status?: 'ativo' | 'inativo';
  qtd_usuarios?: number;
}

export default function TiposUsuariosPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [types, setTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Role
  const { role, loading: loadingRole } = useUserRole();

  useEffect(() => {
    if (!loadingRole && (role === 'atendente' || role === 'estabelecimento')) {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  if (loadingRole) {
    return (
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div style={{ flex: 1, padding: '20px', display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
          Carregando...
        </div>
      </div>
    );
  }

  // Modal States
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const USER_TYPE_LABELS = {
    id: 'ID',
    nome_tipo_usuario: 'Nome',
    descricao: 'Descrição',
    criado_em: 'Criado em',
    status: 'Status',
    qtd_usuarios: 'Usuários'
  };

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchTypes = async () => {
      try {
        const response = await fetch('/api/usuarios/tipos', { signal });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Erro ao carregar tipos de usuários');
        
        const enrichedData = data.map((item: any) => ({
          ...item,
          status: 'ativo', 
          qtd_usuarios: Math.floor(Math.random() * 50) 
        }));

        setTypes(enrichedData);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Erro:', error);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchTypes();

    return () => {
      controller.abort();
    };
  }, []);

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

  const handleView = (type: UserType) => {
    setSelectedType(type);
    setViewModalOpen(true);
  };

  const handleEdit = (type: UserType) => {
    router.push(`/usuarios/tipos/${type.id}`);
  };

  const handleDelete = (type: UserType) => {
    setSelectedType(type);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedType) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/usuarios/tipos/${selectedType.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir');
      }
      
      // Remove from state immediately for better UX
      setTypes(prev => prev.filter(t => t.id !== selectedType.id));
      setDeleteModalOpen(false);
      setSelectedType(null);
      success('Tipo de usuário excluído com sucesso.');
    } catch (error: any) {
      toastError(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const filteredTypes = types.filter(type => {
    const matchesSearch = type.nome_tipo_usuario.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          type.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'todos' ? true : 
                          filterStatus === 'ativos' ? type.status === 'ativo' : 
                          type.status === 'inativo';
    return matchesSearch && matchesFilter;
  });

  // Helper to get icon based on type name
  const getTypeIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('admin') || lowerName.includes('gerente')) {
      return { icon: <Shield size={24} />, bgClass: styles.iconBgPurple };
    }
    if (lowerName.includes('entregador') || lowerName.includes('motoboy')) {
      return { icon: <Bike size={24} />, bgClass: styles.iconBgBlue };
    }
    if (lowerName.includes('suporte') || lowerName.includes('inativo')) {
      return { icon: <UserX size={24} />, bgClass: styles.iconBgGray };
    }
    return { icon: <User size={24} />, bgClass: styles.iconBgGray };
  };

  if (loadingRole) return null;

  return (
    <div className={styles.container}>
      <Sidebar />
      
      <main className={styles.mainContent}>
        <Link href="/usuarios" className={styles.backLink}>
          <ArrowLeft size={18} />
          Voltar para Dashboard
        </Link>

        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Tipos de Usuários</h1>
          <p className={styles.subtitle}>Gerencie os perfis e níveis de acesso do sistema</p>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input 
              type="text" 
              placeholder="Buscar tipo de usuário..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
            <Link href="/usuarios/tipos/novo" className={`${styles.btn} ${styles.btnNew}`}>
              <Plus size={18} />
              Novo
            </Link>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <div className={styles.filtersBar}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${filterStatus === 'todos' ? styles.tabActive : ''}`}
              onClick={() => setFilterStatus('todos')}
            >
              Todos
            </button>
            <button 
              className={`${styles.tab} ${filterStatus === 'ativos' ? styles.tabActive : ''}`}
              onClick={() => setFilterStatus('ativos')}
            >
              Ativos
            </button>
            <button 
              className={`${styles.tab} ${filterStatus === 'inativos' ? styles.tabActive : ''}`}
              onClick={() => setFilterStatus('inativos')}
            >
              Inativos
            </button>
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
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome do Perfil</th>
                    <th>Descrição das Permissões</th>
                    <th>Qtd. de Usuários</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTypes.map((type) => (
                    <tr key={type.id}>
                      <td className={styles.typeName}>{type.nome_tipo_usuario}</td>
                      <td>
                        <div className={styles.description} title={type.descricao}>
                          {type.descricao || '-'}
                        </div>
                      </td>
                      <td>
                        <span className={styles.userCount}>
                          {type.qtd_usuarios !== undefined ? type.qtd_usuarios.toString().padStart(2, '0') : '00'}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${type.status === 'ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                          {type.status || 'Ativo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button 
                            className={`${styles.actionButton} ${styles.viewButton}`} 
                            title="Visualizar"
                            onClick={() => handleView(type)}
                          >
                            <Eye size={20} />
                          </button>
                          <button 
                            className={`${styles.actionButton} ${styles.editButton}`} 
                            title="Editar"
                            onClick={() => handleEdit(type)}
                          >
                            <Pencil size={18} />
                          </button>
                          {role !== 'atendente' && (
                            <button 
                              className={`${styles.actionButton} ${styles.deleteButton}`} 
                              title="Excluir"
                              onClick={() => handleDelete(type)}
                            >
                              <Trash size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTypes.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                        Nenhum tipo de usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Mostrando <b>{filteredTypes.length}</b> de <b>{filteredTypes.length}</b> tipos de perfis
                </span>
                <div className={styles.paginationControls}>
                  <button className={styles.pageBtn} disabled>
                    <ChevronLeft size={18} />
                  </button>
                  <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>1</button>
                  <button className={styles.pageBtn} disabled>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className={styles.mobileCardsContainer}>
              {filteredTypes.map((type) => {
                const { icon, bgClass } = getTypeIcon(type.nome_tipo_usuario);
                return (
                  <div key={type.id} className={styles.mobileCard}>
                    <div className={styles.mobileCardHeader}>
                      <div className={`${styles.typeIcon} ${bgClass}`}>
                        {icon}
                      </div>
                      
                      <div className={styles.mobileCardContent}>
                        <div className={styles.mobileCardTitleRow}>
                          <span className={styles.mobileTypeName}>{type.nome_tipo_usuario}</span>
                          <span className={`${styles.badge} ${type.status === 'ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                            {type.status || 'Ativo'}
                          </span>
                        </div>
                        
                        <p className={styles.mobileCardDescription}>
                          {type.descricao || 'Sem descrição'}
                        </p>
                      </div>
                    </div>
                    
                    <div className={styles.mobileCardActions}>
                      <button 
                        className={`${styles.mobileActionBtn} ${styles.mobileActionBtnView}`}
                        onClick={() => handleView(type)}
                      >
                        <Eye size={16} />
                        VER
                      </button>
                      <button 
                        className={`${styles.mobileActionBtn} ${styles.mobileActionBtnEdit}`}
                        onClick={() => handleEdit(type)}
                      >
                        <Pencil size={16} />
                        EDITAR
                      </button>
                      {role !== 'atendente' && (
                        <button 
                          className={`${styles.mobileActionBtn} ${styles.mobileActionBtnDelete}`}
                          onClick={() => handleDelete(type)}
                        >
                          <Trash size={16} />
                          EXCLUIR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredTypes.length === 0 && (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                  Nenhum tipo de usuário encontrado.
                </p>
              )}
            </div>
          </>
        )}
        <ViewDetailsModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Detalhes do Tipo de Usuário"
          data={selectedType}
          labels={USER_TYPE_LABELS}
        />

        {/* Delete Modal */}
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => !isDeleting && setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          isDeleting={isDeleting}
          title="Excluir Tipo de Usuário"
          description={
            <>
              Tem certeza que deseja excluir o tipo de usuário <strong>{selectedType?.nome_tipo_usuario}</strong>?
              <br />
              <span className={styles.warningText}>
                Esta ação não poderá ser desfeita e pode afetar usuários vinculados a este perfil.
              </span>
            </>
          }
        />
      </main>
    </div>
  );
}
