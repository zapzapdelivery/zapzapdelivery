'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { AdminHeader } from '../../components/Header/AdminHeader';
import styles from './clientes.module.css';
import { Search, Upload, Download, Plus, LayoutList, LayoutGrid, Eye, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/Toast/ToastProvider';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';

import { ViewDetailsModal } from '@/components/Modal/ViewDetailsModal';
import { DeleteConfirmationModal } from '@/components/Modal/DeleteConfirmationModal';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  status: 'Ativo' | 'Inativo' | 'Bloqueado';
  avatar_url: string | null;
  lastOrder: string | null;
  role?: string;
  criado_em?: string;
  // Add other potential fields for full view
  [key: string]: any;
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentTab, setCurrentTab] = useState<'Todos' | 'Ativos' | 'Inativos' | 'Bloqueados'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { success, error: toastError } = useToast();

  // Modal States
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/clientes', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      if (Array.isArray(data)) {
        setClients(data);
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toastError('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // Filter by Tab
      if (currentTab === 'Ativos' && client.status !== 'Ativo') return false;
      if (currentTab === 'Inativos' && client.status !== 'Inativo') return false;
      if (currentTab === 'Bloqueados' && client.status !== 'Bloqueado') return false;
      
      // Filter by Search
      const term = searchTerm.toLowerCase();
      return (
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        client.cpf.toLowerCase().includes(term) ||
        client.phone.includes(term)
      );
    });
  }, [clients, currentTab, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatLastOrder = (dateString: string | null) => {
    if (!dateString) return 'Novo Cliente';
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Ultimo pedido: Hoje, ${format(date, 'HH:mm')}`;
    }
    return `Ultimo pedido: ${format(date, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const handleView = async (client: Client) => {
    // Initial state with loading message
    const initialData = {
        ...client,
        addresses: 'Carregando endereços...',
        lastOrder: client.lastOrder ? client.lastOrder : 'Nenhum pedido'
    };
    setSelectedClient(initialData);
    setViewModalOpen(true);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`/api/clientes/${client.id}/enderecos`, {
             headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (!response.ok) {
            throw new Error('Failed to fetch addresses');
        }

        const addresses = await response.json();

        let addressesContent: React.ReactNode = 'Nenhum endereço cadastrado';

        if (addresses && addresses.length > 0) {
            addressesContent = (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
                    {addresses.map((addr: any, index: number) => (
                        <div key={addr.id || index} style={{ 
                            padding: '0.5rem', 
                            backgroundColor: '#f3f4f6', 
                            borderRadius: '0.375rem',
                            border: '1px solid #e5e7eb',
                            fontSize: '0.875rem',
                            color: '#374151'
                        }}>
                            <div style={{ fontWeight: 600 }}>{addr.endereco}, {addr.numero}</div>
                            <div>{addr.bairro}{addr.cep ? ` - CEP: ${addr.cep}` : ''}</div>
                            {(addr.cidade || addr.uf) && (
                                <div>{addr.cidade}{addr.cidade && addr.uf ? ' - ' : ''}{addr.uf}</div>
                            )}
                            {addr.complemento && <div>{addr.complemento}</div>}
                        </div>
                    ))}
                </div>
            );
        }

        // Update state only if we're still looking at the same client
        setSelectedClient(prev => prev && prev.id === client.id ? ({
            ...prev,
            addresses: addressesContent
        }) : prev);

    } catch (err) {
        console.error('Unexpected error fetching addresses:', err);
        setSelectedClient(prev => prev && prev.id === client.id ? ({
            ...prev,
            addresses: 'Erro ao carregar endereços'
        }) : prev);
    }
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    
    try {
        setDeleting(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(`/api/clientes/${clientToDelete.id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${session?.access_token}`
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Erro ao excluir cliente');
        }
        
        success('Cliente excluído com sucesso');
        setClients(clients.filter(c => c.id !== clientToDelete.id));
        setDeleteModalOpen(false);
        setClientToDelete(null);
    } catch (err: any) {
        console.error('Erro ao excluir:', err);
        toastError(err.message);
    } finally {
        setDeleting(false);
    }
  };

  const viewLabels = {
    id: 'ID',
    name: 'Nome Completo',
    email: 'E-mail',
    phone: 'Telefone',
    cpf: 'CPF',
    status: 'Status',
    lastOrder: 'Último Pedido',
    criado_em: 'Data de Cadastro',
    addresses: 'Endereços Cadastrados'
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.content}>
        <AdminHeader />
        
        <main className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <Link href="/" className={styles.backLink} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', textDecoration: 'none', marginBottom: '1rem', fontSize: '0.875rem' }}>
              ← Voltar para Dashboard
            </Link>
            <h1 className={styles.title}>Clientes</h1>
            <p className={styles.subtitle}>Gerencie os clientes do seu delivery</p>
          </div>

          <div className={styles.actionsBar}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={20} />
              <input
                type="text"
                placeholder="Buscar cliente por nome, e-mail ou CPF/CNPJ"
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
              <Link href="/clientes/novo" className={`${styles.btn} ${styles.btnNew}`} style={{ textDecoration: 'none' }}>
                <Plus size={18} />
                Novo Cliente
              </Link>
            </div>
          </div>

          <div className={styles.filtersBar}>
            <div className={styles.tabs}>
              {(['Todos', 'Ativos', 'Inativos', 'Bloqueados'] as const).map(tab => (
                <button
                  key={tab}
                  className={`${styles.tab} ${currentTab === tab ? styles.tabActive : ''}`}
                  onClick={() => setCurrentTab(tab)}
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
                <LayoutGrid size={20} />
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Carregando clientes...</div>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Avatar</th>
                      <th>Nome do Cliente</th>
                      <th>CPF/CNPJ</th>
                      <th>E-mail</th>
                      <th>Telefone</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClients.length > 0 ? (
                      paginatedClients.map((client) => (
                        <tr key={client.id}>
                          <td>
                            {client.avatar_url ? (
                              <img src={client.avatar_url} alt={client.name} className={styles.avatar} />
                            ) : (
                              <div className={styles.avatar}>{getInitials(client.name)}</div>
                            )}
                          </td>
                          <td>
                            <div className={styles.clientInfo}>
                              <span className={styles.clientName}>{client.name}</span>
                              <span className={styles.clientSub}>{formatLastOrder(client.lastOrder)}</span>
                            </div>
                          </td>
                          <td>{client.cpf}</td>
                          <td>{client.email}</td>
                          <td>{client.phone}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${
                              client.status === 'Ativo' ? styles.statusActive :
                              client.status === 'Bloqueado' ? styles.statusBlocked :
                              styles.statusInactive
                            }`}>
                              {client.status}
                            </span>
                          </td>
                          <td>
                            <div className={styles.actions}>
                              <button className={`${styles.actionBtn} ${styles.btnView}`} title="Visualizar" onClick={() => handleView(client)}>
                                <Eye size={18} />
                              </button>
                              <Link href={`/clientes/editar/${client.id}`} className={`${styles.actionBtn} ${styles.btnEdit}`} title="Editar">
                                <Edit2 size={18} />
                              </Link>
                              <button className={`${styles.actionBtn} ${styles.btnDelete}`} title="Excluir" onClick={() => handleDelete(client)}>
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                          Nenhum cliente encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile List View */}
              <div className={styles.mobileList}>
                {paginatedClients.length === 0 ? (
                  <div className={styles.emptyState}>
                    Nenhum cliente encontrado.
                  </div>
                ) : (
                  paginatedClients.map((client) => (
                    <div key={client.id} className={styles.mobileCard}>
                      <div className={styles.cardHeader}>
                        <div className={styles.cardInfo}>
                          <div className={styles.cardAvatar}>
                            {client.avatar_url ? (
                              <img src={client.avatar_url} alt={client.name} />
                            ) : (
                              <div className={styles.avatarPlaceholder}>{getInitials(client.name)}</div>
                            )}
                          </div>
                          <div className={styles.cardText}>
                            <div className={styles.cardTitle}>{client.name}</div>
                            <div className={styles.cardSubtitle}>
                              {client.phone !== '-' ? client.phone : client.email}
                            </div>
                            <div className={styles.cardSubtitle} style={{ marginTop: '2px', fontSize: '0.75rem' }}>
                                {formatLastOrder(client.lastOrder)}
                            </div>
                          </div>
                        </div>
                        <span className={`${styles.statusBadge} ${
                          client.status === 'Ativo' ? styles.statusActive :
                          client.status === 'Bloqueado' ? styles.statusBlocked :
                          styles.statusInactive
                        }`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
                          {client.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className={styles.cardActions}>
                        <div className={styles.cardActionItem}>
                            <button className={styles.cardActionBtn} title="Visualizar" onClick={() => handleView(client)}>
                                <Eye size={20} className={styles.iconBlue} />
                                <span>Ver</span>
                            </button>
                        </div>
                        <div className={styles.cardActionItem}>
                            <Link href={`/clientes/editar/${client.id}`} className={styles.cardActionBtn} title="Editar" style={{ textDecoration: 'none' }}>
                                <Edit2 size={20} className={styles.iconOrange} />
                                <span>Editar</span>
                            </Link>
                        </div>
                        <div className={styles.cardActionItem}>
                            <button className={styles.cardActionBtn} title="Excluir" onClick={() => handleDelete(client)}>
                                <Trash2 size={20} className={styles.iconRed} />
                                <span>Excluir</span>
                            </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.pagination}>
                <span>
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredClients.length)} de {filteredClients.length} resultados
                </span>
                <div className={styles.paginationButtons}>
                  <button 
                    className={styles.pageBtn}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Anterior
                  </button>
                  <button 
                    className={styles.pageBtn}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <ViewDetailsModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Detalhes do Cliente"
        data={selectedClient}
        labels={viewLabels}
      />
      
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Cliente"
        description={`Tem certeza que deseja excluir o cliente ${clientToDelete?.name}? Esta ação não pode ser desfeita.`}
        isDeleting={deleting}
      />
    </div>
  );
}
