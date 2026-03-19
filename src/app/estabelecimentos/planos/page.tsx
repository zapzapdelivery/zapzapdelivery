'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Eye, 
  Pencil, 
  Trash2, 
  LayoutList, 
  LayoutGrid,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import styles from './planos.module.css';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { useUserRole } from '@/hooks/useUserRole';

interface Plan {
  id: string;
  nome_plano: string;
  valor_mensal: number;
  limite_pedidos: number | null;
  limite_produtos: number | null;
  limite_usuarios: number | null;
  status_plano: string;
  // Computed fields for display
  valor_anual?: number;
  comissao?: number;
}

export default function PlanosPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { role, loading: loadingRole } = useUserRole();

  useEffect(() => {
    if (!loadingRole && (role === 'atendente' || role === 'estabelecimento')) {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  useEffect(() => {
    fetchPlans();
  }, []);

  if (loadingRole) return null;

  async function fetchPlans() {
    try {
      setLoading(true);
      const response = await fetch('/api/planos');
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        // Enrich data with computed fields if missing
        const enrichedData = data.map((plan: any) => ({
          ...plan,
          valor_anual: plan.valor_anual || (plan.valor_mensal * 10), // Mock logic: 10x monthly
          comissao: plan.comissao || 0 // Mock logic: 0% if missing
        }));
        setPlans(enrichedData);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.nome_plano.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (filterStatus === 'Ativos') matchesStatus = plan.status_plano === 'ativo';
    if (filterStatus === 'Inativos') matchesStatus = plan.status_plano === 'inativo';

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleDelete = (id: string) => {
    const plan = plans.find(p => p.id === id);
    if (plan) {
      setPlanToDelete(plan);
      setDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!planToDelete) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('planos')
        .delete()
        .eq('id', planToDelete.id);

      if (error) throw error;

      setPlans(prev => prev.filter(p => p.id !== planToDelete.id));
      success('Plano excluído com sucesso');
      setDeleteModalOpen(false);
      setPlanToDelete(null);
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toastError(error.message || 'Erro ao excluir plano');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNew = () => {
    router.push('/estabelecimentos/planos/novo');
  };

  const handleEdit = (id: string) => {
    router.push(`/estabelecimentos/planos/novo?id=${id}`);
  };

  const handleBack = () => {
    router.push('/gerenciar/estabelecimento');
  };

  return (
    <div className={styles.container}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mobileOnly}> 
         <MobileHeader 
           onMenuClick={() => setIsSidebarOpen(true)} 
           title="Planos de Assinatura"
           showGreeting={false}
         />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.mobileOnly} style={{ marginBottom: '1rem', marginTop: '-0.5rem', padding: '0 1rem' }}>
          <button onClick={handleBack} className={styles.backLink} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <ArrowLeft size={18} />
            Voltar
          </button>
        </div>
        {/* Desktop Header */}
        <div className={styles.desktopOnly}>
          <button onClick={handleBack} className={styles.backLink} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
            <ArrowLeft size={18} />
            Voltar para Estabelecimentos
          </button>

          <div className={styles.pageHeader}>
            <h1 className={styles.title}>Planos de Assinatura</h1>
            <p className={styles.subtitle}>Gerencie os planos disponíveis para os estabelecimentos</p>
          </div>
        </div>


        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input 
              type="text" 
              placeholder="Buscar planos..." 
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters moved here for Mobile Layout consistency with image */}
          <div className={`${styles.filtersBar} ${styles.mobileOnly}`}>
             <div className={styles.tabs}>
              {['Ativos', 'Inativos'].map((tab) => (
                <button
                  key={tab}
                  className={`${styles.tab} ${filterStatus === tab ? styles.tabActive : ''}`}
                  onClick={() => setFilterStatus(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button className={`${styles.btn} ${styles.btnImport} ${styles.desktopActionOnly}`}>
              <Upload size={18} />
              Importar
            </button>
            <button className={`${styles.btn} ${styles.btnExport} ${styles.desktopActionOnly}`}>
              <Download size={18} />
              Exportar
            </button>
            
            {/* Mobile Icon Buttons */}
            <button className={`${styles.btn} ${styles.btnImport} ${styles.mobileOnly} ${styles.btnIconOnly}`}>
              <Download size={18} />
            </button>
            <button className={`${styles.btn} ${styles.btnExport} ${styles.mobileOnly} ${styles.btnIconOnly}`}>
              <Upload size={18} />
            </button>

            <button onClick={handleNew} className={`${styles.btn} ${styles.btnNew}`}>
              <Plus size={18} />
              <span className={styles.desktopOnly}>Novo Plano</span>
              <span className={styles.mobileOnly}>Novo</span>
            </button>
          </div>
        </div>

        {/* Desktop Filters */}
        <div className={`${styles.filtersBar} ${styles.desktopOnly}`}>
          <div className={styles.tabs}>
            {['Todos', 'Ativos', 'Inativos'].map((tab) => (
              <button
                key={tab}
                className={`${styles.tab} ${filterStatus === tab ? styles.tabActive : ''}`}
                onClick={() => setFilterStatus(tab)}
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
              <LayoutList size={20} />
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
          <p>Carregando planos...</p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className={`${styles.tableContainer} ${styles.desktopOnly}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome do Plano</th>
                    <th>Valor Mensal</th>
                    <th>Valor Anual</th>
                    <th>Limite de Pedidos</th>
                    <th>Comissão (%)</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td className={styles.planName}>{plan.nome_plano}</td>
                      <td>{formatCurrency(plan.valor_mensal)}</td>
                      <td>{formatCurrency(plan.valor_anual || 0)}</td>
                      <td>{plan.limite_pedidos ? `${plan.limite_pedidos} / mês` : 'Ilimitado'}</td>
                      <td>{plan.comissao}%</td>
                      <td>
                        <span className={`${styles.badge} ${plan.status_plano === 'ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                          {plan.status_plano || 'INATIVO'}
                        </span>
                      </td>
                      <td className={styles.actions}>
                        <button className={`${styles.actionButton} ${styles.viewButton}`} title="Visualizar">
                          <Eye size={18} />
                        </button>
                        <button 
                          className={`${styles.actionButton} ${styles.editButton}`} 
                          title="Editar"
                          onClick={() => handleEdit(plan.id)}
                        >
                          <Pencil size={18} />
                        </button>
                        {role !== 'atendente' && (
                          <button className={`${styles.actionButton} ${styles.deleteButton}`} title="Excluir" onClick={() => handleDelete(plan.id)}>
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredPlans.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                        Nenhum plano encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Exibindo {filteredPlans.length} de {filteredPlans.length} planos cadastrados
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

            {/* Mobile Card View */}
            <div className={`${styles.mobileList} ${styles.mobileOnly}`}>
               {filteredPlans.map((plan) => (
                 <div key={plan.id} className={styles.mobileCard}>
                   <div className={styles.cardHeader}>
                     <span className={styles.cardTitle}>{plan.nome_plano}</span>
                     <span className={`${styles.badge} ${plan.status_plano === 'ativo' ? styles.badgeActive : styles.badgeInactive}`}>
                        {plan.status_plano ? plan.status_plano.toUpperCase() : 'INATIVO'}
                      </span>
                   </div>
                   
                   <div className={styles.cardBody}>
                      <div className={styles.cardField}>
                        <span className={styles.cardLabel}>VALOR MENSAL</span>
                        <span className={styles.cardValue}>{formatCurrency(plan.valor_mensal)}</span>
                      </div>
                      <div className={styles.cardField}>
                        <span className={styles.cardLabel}>COMISSÃO</span>
                        <span className={styles.cardValue}>{plan.comissao}%</span>
                      </div>
                   </div>

                   <div className={styles.cardActions}>
                      <div className={styles.mobileActionWrapper}>
                        <button className={`${styles.mobileActionBtn} ${styles.actionView}`}>
                          <Eye size={20} />
                        </button>
                        <span className={styles.mobileActionLabel}>VER</span>
                      </div>

                      <div className={styles.mobileActionWrapper}>
                        <button 
                          className={`${styles.mobileActionBtn} ${styles.actionEdit}`}
                          onClick={() => handleEdit(plan.id)}
                        >
                          <Pencil size={20} />
                        </button>
                        <span className={styles.mobileActionLabel}>EDITAR</span>
                      </div>

                      {role !== 'atendente' && (
                        <div className={styles.mobileActionWrapper}>
                          <button className={`${styles.mobileActionBtn} ${styles.actionDelete}`} onClick={() => handleDelete(plan.id)}>
                            <Trash2 size={20} />
                          </button>
                          <span className={styles.mobileActionLabel}>EXCLUIR</span>
                        </div>
                      )}
                   </div>
                 </div>
               ))}
               {filteredPlans.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    Nenhum plano encontrado.
                  </div>
               )}
            </div>
          </>
        )}
      </main>
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        title="Excluir Plano"
        description={
          <>
            Tem certeza que deseja excluir o plano <strong>{planToDelete?.nome_plano}</strong>? Esta ação não pode ser desfeita.
          </>
        }
      />
    </div>
  );
}
