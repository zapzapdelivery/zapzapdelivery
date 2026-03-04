'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { AdminHeader } from '../../components/Header/AdminHeader';
import { 
  Search, 
  Download, 
  Upload, 
  Plus, 
  List, 
  LayoutGrid, 
  MoreHorizontal, 
  Eye, 
  Pencil, 
  Trash2, 
  ArrowLeft,
  Bike,
  Car,
  ChevronLeft,
  ChevronRight,
  Edit2
} from 'lucide-react';
import styles from './entregadores.module.css';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Entregador {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  veiculo: string;
  status: string;
  avatar_url?: string;
  criado_em: string;
  tipo_cnh?: string;
}

export default function EntregadoresPage() {
  const router = useRouter();
  const { role, loading: loadingRole } = useUserRole();
  const { success, error: toastError } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal States
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedEntregador, setSelectedEntregador] = useState<Entregador | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entregadorToDelete, setEntregadorToDelete] = useState<Entregador | null>(null);
  const [deleting, setDeleting] = useState(false);

  const LABELS = {
    nome: 'Nome',
    cpf: 'CPF',
    telefone: 'Telefone',
    veiculo: 'Veículo',
    tipo_cnh: 'Tipo CNH',
    cep: 'CEP',
    endereco: 'Endereço',
    numero: 'Número',
    bairro: 'Bairro',
    cidade: 'Cidade',
    uf: 'UF',
    complemento: 'Complemento',
    status: 'Status',
    criado_em: 'Cadastrado em'
  };

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  const fetchEntregadores = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/entregadores', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar entregadores');
      }
      
      if (Array.isArray(data)) {
        setEntregadores(data);
      } else {
        setEntregadores([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingRole) {
      fetchEntregadores();
    }
  }, [loadingRole]);

  if (loadingRole) {
    return null;
  }

  const getStatusBadge = (status: string | undefined | null) => {
    const normalizedStatus = (status || '').toLowerCase();
    switch (normalizedStatus) {
      case 'disponivel':
      case 'ativo':
        return (
          <span className={`${styles.statusBadge} ${styles.statusDisponivel}`}>
            <span className={styles.statusDot} />
            Disponível
          </span>
        );
      case 'em_entrega':
      case 'em_rota':
        return (
          <span className={`${styles.statusBadge} ${styles.statusEmEntrega}`}>
            <span className={styles.statusDot} />
            Em Rota
          </span>
        );
      case 'inativo':
        return (
          <span className={`${styles.statusBadge} ${styles.statusInativo}`}>
            <span className={styles.statusDot} />
            Inativo
          </span>
        );
      default:
        return (
          <span className={`${styles.statusBadge} ${styles.statusInativo}`}>
            <span className={styles.statusDot} />
            {status}
          </span>
        );
    }
  };

  const getVeiculoIcon = (veiculo: string) => {
    const v = veiculo.toLowerCase();
    if (v.includes('carro') || v.includes('auto')) {
      return <Car size={16} />;
    }
    return <Bike size={16} />;
  };

  const handleView = (entregador: Entregador) => {
    setSelectedEntregador({
      ...entregador,
      criado_em: entregador.criado_em ? format(new Date(entregador.criado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'
    });
    setViewModalOpen(true);
  };

  const handleDelete = (entregador: Entregador) => {
    setEntregadorToDelete(entregador);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!entregadorToDelete) return;

    try {
      setDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/entregadores/${entregadorToDelete.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir entregador');
      }

      success('Entregador excluído com sucesso');
      fetchEntregadores();
      setDeleteModalOpen(false);
      setEntregadorToDelete(null);
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Erro ao excluir entregador');
    } finally {
      setDeleting(false);
    }
  };

  const filteredEntregadores = (entregadores || []).filter(ent => {
    if (!ent) return false;
    const matchesSearch = 
      (ent.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ent.telefone || '').includes(searchTerm) ||
      (ent.veiculo || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'Todos') return matchesSearch;
    const status = (ent.status || '').toLowerCase();
    if (activeTab === 'Ativos') return matchesSearch && (status === 'ativo' || status === 'disponivel');
    if (activeTab === 'Inativos') return matchesSearch && status === 'inativo';
    if (activeTab === 'Em Rota') return matchesSearch && (status === 'em_entrega' || status === 'em_rota');
    return matchesSearch;
  });

  const totalPages = Math.ceil((filteredEntregadores?.length || 0) / itemsPerPage);
  const paginatedEntregadores = (filteredEntregadores || []).slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.content}>
        <AdminHeader />
        
        <div className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <Link href="/" className={styles.backLink}>
              <ArrowLeft size={16} />
              Voltar para Dashboard
            </Link>
            <h1 className={styles.title}>Entregadores</h1>
            <p className={styles.subtitle}>Gerencie sua frota de entrega</p>
          </div>

          <div className={styles.actionsBar}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={20} />
              <input 
                type="text" 
                placeholder="Buscar entregadores..." 
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className={styles.actionButtons}>
              <button className={`${styles.btn} ${styles.btnImport}`}>
                <Download size={18} />
                Importar
              </button>
              <button className={`${styles.btn} ${styles.btnExport}`}>
                <Upload size={18} />
                Exportar
              </button>
              <Link href="/entregadores/novo" className={`${styles.btn} ${styles.btnNew}`} style={{ textDecoration: 'none' }}>
                <Plus size={18} />
                Novo Entregador
              </Link>
            </div>
          </div>

          <div className={styles.filtersBar}>
            <div className={styles.tabs}>
              {['Todos', 'Ativos', 'Inativos', 'Em Rota'].map((tab) => (
                <button
                  key={tab}
                  className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab)}
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

          <div className={`${styles.tableContainer} ${styles.desktopOnly}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ENTREGADOR</th>
                  <th>CPF</th>
                  <th>TELEFONE</th>
                  <th>VEÍCULO</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                      Carregando entregadores...
                    </td>
                  </tr>
                ) : (paginatedEntregadores?.length || 0) === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                      Nenhum entregador encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedEntregadores.map((entregador) => (
                    <tr key={entregador.id}>
                      <td>
                        <div className={styles.entregadorInfo}>
                          <img 
                            src={entregador.avatar_url || 'https://via.placeholder.com/40'} 
                            alt={entregador.nome} 
                            className={styles.avatar} 
                          />
                          <div className={styles.nameContainer}>
                            <span className={styles.entregadorName}>{entregador.nome}</span>
                            <span className={styles.entregadorId}>ID: {(entregador.id || '').slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td>{entregador.cpf}</td>
                      <td>{entregador.telefone}</td>
                      <td>
                        <div className={styles.veiculoCell}>
                          {getVeiculoIcon(entregador.veiculo)}
                          {entregador.veiculo}
                        </div>
                      </td>
                      <td>{getStatusBadge(entregador.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actions}>
                          <button 
                            className={`${styles.actionBtn} ${styles.btnView}`} 
                            title="Visualizar"
                            onClick={() => handleView(entregador)}
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            className={`${styles.actionBtn} ${styles.btnEdit}`} 
                            title="Editar"
                            onClick={() => router.push(`/entregadores/editar/${entregador.id}`)}
                          >
                            <Pencil size={18} />
                          </button>
                          <button 
                            className={`${styles.actionBtn} ${styles.btnDelete}`} 
                            title="Excluir"
                            onClick={() => handleDelete(entregador)}
                          >
                            <Trash2 size={18} />
                          </button>
                          <button className={styles.actionBtn}>
                            <MoreHorizontal size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            <div className={styles.pagination}>
              <div className={styles.paginationInfo}>
                Mostrando {(filteredEntregadores?.length || 0) > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
                {Math.min(currentPage * itemsPerPage, filteredEntregadores?.length || 0)} de {filteredEntregadores?.length || 0} entregadores
              </div>
              <div className={styles.paginationButtons}>
                <button 
                  className={styles.pageBtn} 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Anterior
                </button>
                <button 
                  className={styles.pageBtn}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className={styles.mobileOnly}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '1rem' }}>
                Carregando entregadores...
              </div>
            ) : (paginatedEntregadores?.length || 0) === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '1rem' }}>
                Nenhum entregador encontrado.
              </div>
            ) : (
              <div className={styles.mobileCardsContainer}>
                {paginatedEntregadores.map((entregador) => (
                  <div key={entregador.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardUser}>
                        <img 
                          src={entregador.avatar_url || 'https://via.placeholder.com/56'} 
                          alt={entregador.nome} 
                          className={styles.cardAvatar} 
                        />
                        <div className={styles.cardInfo}>
                          <h3>{entregador.nome}</h3>
                          <div className={styles.cardVehicle}>
                            {getVeiculoIcon(entregador.veiculo)}
                            {entregador.veiculo} • {entregador.tipo_cnh || 'Sem CNH'}
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>CPF:</span>
                            <span className={styles.infoValue}>{entregador.cpf}</span>
                          </div>
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Telefone:</span>
                            <span className={styles.infoValue}>{entregador.telefone}</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(entregador.status)}
                    </div>
                    
                    <div className={styles.cardActions}>
                      <button 
                        className={styles.cardActionBtn}
                        onClick={() => handleView(entregador)}
                      >
                        <Eye size={20} />
                      </button>
                      <button 
                        className={`${styles.cardActionBtn} ${styles.cardActionBtnEdit}`}
                        onClick={() => router.push(`/entregadores/editar/${entregador.id}`)}
                      >
                        <Pencil size={20} />
                      </button>
                      <button 
                        className={`${styles.cardActionBtn} ${styles.cardActionBtnDelete}`}
                        onClick={() => handleDelete(entregador)}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}

                <div className={styles.pagination} style={{ borderRadius: '1rem', borderTop: 'none', padding: '1rem 0' }}>
                  <div className={styles.paginationButtons} style={{ width: '100%', justifyContent: 'space-between', gap: '1rem' }}>
                    <button 
                      className={styles.pageBtn} 
                      style={{ flex: 1 }}
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      Anterior
                    </button>
                    <button 
                      className={styles.pageBtn}
                      style={{ flex: 1 }}
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <ViewDetailsModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Detalhes do Entregador"
          data={selectedEntregador}
          labels={LABELS}
        />

        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          isDeleting={deleting}
          title="Excluir Entregador"
          description={
            <>
              Tem certeza que deseja excluir o entregador <strong>{entregadorToDelete?.nome}</strong>? 
              Esta ação não poderá ser desfeita.
            </>
          }
        />
      </main>
    </div>
  );
}
