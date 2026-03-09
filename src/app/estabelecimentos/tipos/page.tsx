 'use client';
 
 import React, { useEffect, useMemo, useState } from 'react';
 import Link from 'next/link';
 import { useRouter } from 'next/navigation';
 import { Sidebar } from '@/components/Sidebar/Sidebar';
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
   Trash2,
   UtensilsCrossed,
   ShoppingBag,
   PawPrint,
   Store
 } from 'lucide-react';
 import styles from './tipos-estabelecimentos.module.css';
 import { useToast } from '@/components/Toast/ToastProvider';
 import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { useUserRole } from '@/hooks/useUserRole';

interface TipoEstabelecimento {
  id: string;
  nome: string;
  status?: 'ativo' | 'inativo';
  lojas?: number;
  descricao?: string;
}

import { supabase } from '@/lib/supabase';

export default function TiposEstabelecimentosPage() {
  const router = useRouter();
  const { error, success } = useToast();
  const [types, setTypes] = useState<TipoEstabelecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TipoEstabelecimento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

   // Role
  const { role, loading: loadingRole } = useUserRole();

  useEffect(() => {
    if (!loadingRole && (role === 'atendente' || role === 'estabelecimento')) {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  const TYPE_LABELS = {
    id: 'ID',
    nome: 'Nome',
    status: 'Status',
    lojas: 'Lojas',
    descricao: 'Descrição'
  };

  const openView = (t: TipoEstabelecimento) => {
    setSelectedType(t);
    setViewModalOpen(true);
  };

  useEffect(() => {
    const controller = new AbortController();
     const load = async () => {
       try {
         setLoading(true);
         
         const { data: { session } } = await supabase.auth.getSession();
         const token = session?.access_token;

         const res = await fetch('/api/estabelecimentos/tipos', { 
           signal: controller.signal,
           headers: token ? { Authorization: `Bearer ${token}` } : undefined
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data?.error || 'Falha ao carregar tipos de estabelecimentos');
         const enriched: TipoEstabelecimento[] = (Array.isArray(data) ? data : []).map((t: any) => ({
           id: t.id,
           nome: t.nome,
           status: 'ativo',
           lojas: 0,
           descricao: ''
         }));
         setTypes(enriched);
       } catch (e: any) {
         if (e.name !== 'AbortError') {
           error(e.message || 'Erro ao carregar tipos de estabelecimentos');
         }
       } finally {
         setLoading(false);
       }
     };
     load();
     return () => controller.abort();
   }, [error]);
 
   const filtered = useMemo(() => {
     const bySearch = (t: TipoEstabelecimento) =>
       t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (t.descricao ?? '').toLowerCase().includes(searchTerm.toLowerCase());
     const byStatus = (t: TipoEstabelecimento) => {
       if (filterStatus === 'todos') return true;
       if (filterStatus === 'ativos') return (t.status ?? 'ativo') === 'ativo';
       return (t.status ?? 'ativo') === 'inativo';
     };
     return types.filter((t) => bySearch(t) && byStatus(t));
   }, [types, searchTerm, filterStatus]);

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

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('rest')) return { icon: <UtensilsCrossed size={20} />, cls: styles.iconOrange };
    if (n.includes('farm')) return { icon: <ShoppingBag size={20} />, cls: styles.iconBlue };
    if (n.includes('pet')) return { icon: <PawPrint size={20} />, cls: styles.iconPurple };
    return { icon: <Store size={20} />, cls: styles.iconGreen };
  };
  const closeView = () => {
    setViewModalOpen(false);
    setSelectedType(null);
  };
  const openDelete = (t: TipoEstabelecimento) => {
    setSelectedType(t);
    setDeleteModalOpen(true);
  };
  const closeDelete = () => {
    if (!isDeleting) {
      setDeleteModalOpen(false);
      setSelectedType(null);
    }
  };

   const confirmDelete = async () => {
     if (!selectedType) return;
     try {
       setIsDeleting(true);
       const res = await fetch(`/api/estabelecimentos/tipos/${selectedType.id}`, { method: 'DELETE' });
       const data = await res.json();
       if (!res.ok) throw new Error(data?.error || 'Falha ao excluir tipo');
       setTypes((prev) => prev.filter((t) => t.id !== selectedType.id));
       success('Tipo excluído com sucesso!');
       setDeleteModalOpen(false);
       setSelectedType(null);
     } catch (e: any) {
       error(e.message || 'Erro ao excluir tipo');
     } finally {
       setIsDeleting(false);
     }
   };

  return (
     <div className={styles.container}>
       <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
       <main className={styles.mainContent}>
        <div className={styles.mobileOnly}>
          <MobileHeader 
            onMenuClick={() => setIsSidebarOpen(true)} 
            title="Tipos de Estabelecimentos"
            showGreeting={false}
          />
        </div>
        <div className={styles.mobileOnly} style={{ marginBottom: '1rem', marginTop: '-0.5rem', padding: '0 1rem' }}>
          <Link href="/gerenciar/estabelecimentos" className={styles.backLink} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
            <ArrowLeft size={18} />
            Voltar
          </Link>
        </div>
        <div className={styles.desktopOnly}>
          <Link href="/gerenciar/estabelecimentos" className={styles.backLink}>
            <ArrowLeft size={18} />
            Voltar para Estabelecimentos
          </Link>
        </div>
 
        <div className={styles.desktopOnly}>
          <div className={styles.pageHeader}>
            <h1 className={styles.title}>Tipos de Estabelecimentos</h1>
            <p className={styles.subtitle}>Gerencie as categorias principais de parceiros (ex: Restaurante, Farmácia, Petshop)</p>
          </div>
        </div>
 
        <div className={`${styles.toolbar} ${styles.desktopOnly}`}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="text"
              placeholder="Buscar tipos..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
 
           <div className={styles.actionButtons}>
             <button className={styles.btn + ' ' + styles.btnImport}>
               <Upload size={18} />
               Importar
             </button>
             <button className={styles.btn + ' ' + styles.btnExport}>
               <Download size={18} />
               Exportar
             </button>
             <Link href="/estabelecimentos/tipos/novo" className={styles.btn + ' ' + styles.btnNew}>
               <Plus size={18} />
               + Novo Tipo
             </Link>
           </div>
         </div>
 
        <div className={`${styles.filtersBar} ${styles.desktopOnly}`}>
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
               <List size={18} />
             </button>
             <button
               className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
               onClick={() => setViewMode('grid')}
             >
               <LayoutGrid size={18} />
             </button>
           </div>
         </div>
 
        {/* Mobile toolbar */}
        <div className={styles.mobileOnly}>
          <div className={styles.mobileSearch}>
            <Search size={18} color="#6b7280" />
            <input
              type="text"
              placeholder="Buscar tipos de estabelecimentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.mobileActions}>
            <button className={`${styles.mobileBtn} ${styles.mobileImport}`}>
              <Upload size={18} />
              Importar
            </button>
            <button className={`${styles.mobileBtn} ${styles.mobileExport}`}>
              <Download size={18} />
              Exportar
            </button>
            <Link href="/estabelecimentos/tipos/novo" className={`${styles.mobileBtn} ${styles.mobileNew}`} style={{ textDecoration: 'none' }}>
              <Plus size={18} />
              + Novo
            </Link>
          </div>
          <div className={styles.mobileTabs}>
            <button className={`${styles.mobileTab} ${filterStatus === 'todos' ? styles.mobileTabActive : ''}`} onClick={() => setFilterStatus('todos')}>Todos</button>
            <button className={`${styles.mobileTab} ${filterStatus === 'ativos' ? styles.mobileTabActive : ''}`} onClick={() => setFilterStatus('ativos')}>Ativos</button>
            <button className={`${styles.mobileTab} ${filterStatus === 'inativos' ? styles.mobileTabActive : ''}`} onClick={() => setFilterStatus('inativos')}>Inativos</button>
          </div>
        </div>

         {loading ? (
           <p>Carregando...</p>
         ) : (
          <>
          <div className={`${styles.tableContainer} ${styles.desktopOnly}`}>
             <table className={styles.table}>
               <thead>
                 <tr>
                   <th>Ícone</th>
                   <th>Nome do Tipo</th>
                   <th>Descrição</th>
                   <th>Lojas Vinculadas</th>
                   <th>Status</th>
                   <th style={{ textAlign: 'right' }}>Ações</th>
                 </tr>
               </thead>
               <tbody>
                 {filtered.map((t) => {
                   const ti = getIcon(t.nome);
                   return (
                     <tr key={t.id}>
                       <td>
                         <div className={styles.iconBadge + ' ' + ti.cls}>{ti.icon}</div>
                       </td>
                       <td>
                         <div className={styles.typeCell}>
                           <span className={styles.typeName}>{t.nome}</span>
                         </div>
                       </td>
                       <td className={styles.description}>{t.descricao || ''}</td>
                       <td>{t.lojas ?? 0}</td>
                       <td>
                         <span className={`${styles.badge} ${(t.status ?? 'ativo') === 'ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                           {(t.status ?? 'ativo') === 'ativo' ? 'Ativo' : 'Inativo'}
                         </span>
                       </td>
                       <td className={styles.actions}>
                        <button className={`${styles.actionButton} ${styles.viewButton}`} onClick={() => openView(t)}>
                           <Eye size={18} />
                         </button>
                         <button className={`${styles.actionButton} ${styles.editButton}`} onClick={() => router.push(`/estabelecimentos/tipos/${t.id}`)}>
                           <Pencil size={18} />
                         </button>
                        {role !== 'atendente' && (
                          <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={() => openDelete(t)}>
                             <Trash2 size={18} />
                           </button>
                        )}
                       </td>
                     </tr>
                   );
                 })}
                 {filtered.length === 0 && (
                   <tr>
                     <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                       Nenhum tipo encontrado.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
             <div className={styles.pagination}>
               <span className={styles.paginationInfo}>Mostrando {filtered.length} de {types.length} tipos</span>
               <div className={styles.paginationControls}>
                 <button className={styles.pageBtn}>{'<'}</button>
                 <button className={styles.pageBtn + ' ' + styles.pageBtnActive}>1</button>
                 <button className={styles.pageBtn}>2</button>
                 <button className={styles.pageBtn}>3</button>
                 <button className={styles.pageBtn}>{'>'}</button>
               </div>
             </div>
          </div>
          
          {/* Mobile list */}
          <div className={`${styles.mobileList} ${styles.mobileOnly}`}>
            {filtered.map((t) => {
              const ti = getIcon(t.nome);
              const active = (t.status ?? 'ativo') === 'ativo';
              return (
                <div key={t.id} className={styles.mobileCard}>
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.mobileCardTitle}>
                      <div className={styles.iconBadge + ' ' + ti.cls}>{ti.icon}</div>
                      <span>{t.nome}</span>
                    </div>
                    <span className={`${styles.mobileStatus} ${active ? styles.mobileStatusActive : styles.mobileStatusInactive}`}>
                      {active ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>
                  <div className={styles.mobileDesc}>{t.descricao || ''}</div>
                  <div className={styles.mobileCardActions}>
                    <button className={`${styles.actionButton} ${styles.viewButton}`} onClick={() => openView(t)}>
                      <Eye size={18} />
                    </button>
                    <button className={`${styles.actionButton} ${styles.editButton}`} onClick={() => router.push(`/estabelecimentos/tipos/${t.id}`)}>
                      <Pencil size={18} />
                    </button>
                    {role !== 'atendente' && (
                      <button className={`${styles.actionButton} ${styles.deleteButton}`} onClick={() => openDelete(t)}>
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#6b7280' }}>
                Nenhum tipo encontrado.
              </div>
            )}
          </div>
          </>
         )}
        <ViewDetailsModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Detalhes do Tipo de Estabelecimento"
          data={selectedType}
          labels={TYPE_LABELS}
        />
        {deleteModalOpen && selectedType && (
          <DeleteConfirmationModal
            isOpen={deleteModalOpen}
            onClose={closeDelete}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
            title="Confirmar Exclusão"
            description={
              <>
                Tem certeza que deseja excluir o tipo de estabelecimento <strong>{selectedType.nome}</strong>?
                <br />
                Esta ação é irreversível e afetará todos os estabelecimentos vinculados a esta categoria.
              </>
            }
          />
        )}
       </main>
     </div>
   );
 }
