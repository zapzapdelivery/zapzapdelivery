'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  MapPin, 
  Home, 
  Briefcase, 
  Palmtree, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowLeft,
  PlusCircle,
  X,
  AlertCircle
} from 'lucide-react';
import { CustomerSidebar } from '@/components/CustomerSidebar/CustomerSidebar';
import { Loading } from '@/components/Loading/Loading';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { formatCEP } from '@/utils/validators';
import styles from './enderecos.module.css';

interface Endereco {
  id: string;
  cliente_id: string;
  estabelecimento_id: string | null;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  uf: string;
  criado_em: string;
  // Campos virtuais
  tipo_label: string;
  ponto_referencia: string;
  is_principal: boolean;
}

export default function EnderecosPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEndereco, setEditingEndereco] = useState<Endereco | null>(null);
  const [modalFormData, setModalFormData] = useState({
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    complemento: '',
    ponto_referencia: '',
    cidade: '',
    uf: '',
    tipo_label: 'Casa'
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; addressId: string | null }>({
    isOpen: false,
    addressId: null
  });

  useEffect(() => {
    async function loadEnderecos() {
      try {
        setLoading(true);
        console.log('Iniciando carregamento de endereços via API');
        
        // Obter sessão para garantir que está logado
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) {
          const { data: { user: userRetry } } = await supabase.auth.getUser();
          if (!userRetry) {
            router.push('/login');
            return;
          }
        }

        // Chamar nossa nova API que ignora RLS
        const token = authSession?.access_token;
        
        if (!token) {
          throw new Error('Token de autenticação não encontrado');
        }

        const response = await fetch('/api/minhaconta/enderecos', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar endereços');
        }

        const rawAddresses = data.addresses || [];
        const confirmedClientId = data.clientId;

        console.log('Dados retornados pela API:', data);

        if (confirmedClientId) {
          setClienteId(confirmedClientId);
        }

        const processedAddresses: Endereco[] = rawAddresses.map((addr: any, index: number) => {
          let complemento = addr.complemento || '';
          let pontoRef = '';
          
          if (complemento.includes(' - Ref: ')) {
            const parts = complemento.split(' - Ref: ');
            complemento = parts[0];
            pontoRef = parts[1];
          } else if (complemento.startsWith('Ref: ')) {
            pontoRef = complemento.replace('Ref: ', '');
            complemento = '';
          }

          const labels = ['Casa', 'Trabalho', 'Outro'];
          const label = labels[index % labels.length];

          return {
            ...addr,
            complemento,
            ponto_referencia: pontoRef,
            tipo_label: label,
            is_principal: index === 0
          };
        });

        console.log('Endereços processados:', processedAddresses.length);
        setEnderecos(processedAddresses);
      } catch (err: any) {
        console.error('Erro fatal ao carregar endereços:', err);
        showError(err.message || 'Erro ao carregar endereços');
      } finally {
        setLoading(false);
      }
    }

    loadEnderecos();
  }, [router, showError]);

  const handleOpenModal = (endereco?: Endereco) => {
    if (endereco) {
      setEditingEndereco(endereco);
      setModalFormData({
        cep: endereco.cep,
        endereco: endereco.endereco,
        numero: endereco.numero,
        bairro: endereco.bairro,
        complemento: endereco.complemento,
        ponto_referencia: endereco.ponto_referencia,
        cidade: endereco.cidade,
        uf: endereco.uf,
        tipo_label: endereco.tipo_label
      });
    } else {
      setEditingEndereco(null);
      setModalFormData({
        cep: '',
        endereco: '',
        numero: '',
        bairro: '',
        complemento: '',
        ponto_referencia: '',
        cidade: '',
        uf: '',
        tipo_label: 'Casa'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEndereco(null);
  };

  const handleFetchCEP = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setModalFormData(prev => ({
            ...prev,
            endereco: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            uf: data.uf
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar CEP:', err);
      }
    }
  };

  const handleSaveEndereco = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) throw new Error('Usuário não autenticado');

      const fullComplemento = modalFormData.ponto_referencia 
        ? `${modalFormData.complemento}${modalFormData.complemento ? ' - ' : ''}Ref: ${modalFormData.ponto_referencia}`
        : modalFormData.complemento;

      const payload = {
        cep: modalFormData.cep,
        endereco: modalFormData.endereco,
        numero: modalFormData.numero,
        bairro: modalFormData.bairro,
        complemento: fullComplemento,
        cidade: modalFormData.cidade,
        uf: modalFormData.uf
      };

      console.log('Salvando endereço via API:', payload);

      let response;
      if (editingEndereco) {
        response = await fetch('/api/minhaconta/enderecos', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ id: editingEndereco.id, ...payload })
        });
      } else {
        response = await fetch('/api/minhaconta/enderecos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar endereço');
      }

      success(editingEndereco ? 'Endereço atualizado!' : 'Endereço cadastrado!');
      handleCloseModal();
      
      // Recarregar a página para atualizar a lista
      window.location.reload();
    } catch (err: any) {
      console.error('Erro ao salvar endereço:', err);
      showError('Erro ao salvar endereço: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmation({ isOpen: true, addressId: id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.addressId) return;
    const id = deleteConfirmation.addressId;
    setDeleteConfirmation({ isOpen: false, addressId: null });

    try {
      console.log('Excluindo endereço via API:', id);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) throw new Error('Usuário não autenticado');

      const response = await fetch(`/api/minhaconta/enderecos?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir endereço');
      }

      success('Endereço excluído com sucesso!');
      setEnderecos(prev => prev.filter(addr => addr.id !== id));
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      showError('Erro ao excluir endereço: ' + (err.message || ''));
    }
  };

  const getIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'casa': return <Home size={20} className={styles.iconType} />;
      case 'trabalho': return <Briefcase size={20} className={styles.iconType} />;
      case 'casa de praia': return <Palmtree size={20} className={styles.iconType} />;
      default: return <MapPin size={20} className={styles.iconType} />;
    }
  };

  if (loading) {
    return <Loading message="Carregando minha conta..." fullScreen />;
  }

  return (
    <div className={styles.container}>
      <CustomerSidebar />
      
      <main className={styles.mainContent}>
        <Link href="/minhaconta" className={styles.backButton}>
          <ArrowLeft size={18} />
          Voltar para Dashboard
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>Meus Endereços</h1>
          <button className={styles.btnAddAddress} onClick={() => handleOpenModal()}>
            <MapPin size={18} />
            + Novo Endereço
          </button>
        </header>

        <div className={styles.addressGrid}>
          {enderecos.map((addr) => (
            <div key={addr.id} className={styles.addressCard}>
              <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                  <div className={styles.addressType}>
                    {getIcon(addr.tipo_label)}
                    {addr.tipo_label}
                  </div>
                  {addr.is_principal && (
                    <span className={styles.badgePrincipal}>Principal</span>
                  )}
                </div>

                <div className={styles.addressDetails}>
                  <p>{addr.endereco}, {addr.numero}</p>
                  {addr.complemento && <p>{addr.complemento}</p>}
                  {addr.ponto_referencia && <p>{addr.ponto_referencia}</p>}
                  <p>{addr.bairro}</p>
                  <p>{addr.cidade} - {addr.uf}</p>
                  <p className={styles.cep}>CEP: {addr.cep}</p>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button className={`${styles.btnAction} ${styles.btnEdit}`} onClick={() => handleOpenModal(addr)}>
                  <Edit3 size={16} />
                  Editar
                </button>
                <button className={`${styles.btnAction} ${styles.btnDelete}`} onClick={() => handleDelete(addr.id)}>
                  <Trash2 size={16} />
                  Excluir
                </button>
              </div>
            </div>
          ))}

          <div className={styles.emptyCard} onClick={() => handleOpenModal()}>
            <PlusCircle size={40} className={styles.emptyIcon} />
            <p>Adicionar outro endereço</p>
            <span>Clique para cadastrar um novo local</span>
          </div>
        </div>

        {/* Modal Novo/Editar Endereço */}
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>{editingEndereco ? 'Editar Endereço' : 'Novo Endereço'}</h2>
                <button className={styles.btnCloseModal} onClick={handleCloseModal}>
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSaveEndereco}>
                <div className={styles.modalBody}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>CEP</label>
                      <input 
                        type="text" 
                        value={modalFormData.cep}
                        onChange={(e) => {
                          const val = formatCEP(e.target.value);
                          setModalFormData(prev => ({ ...prev, cep: val }));
                          if (val.length === 9) handleFetchCEP(val);
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Tipo</label>
                      <select 
                        value={modalFormData.tipo_label}
                        onChange={(e) => setModalFormData(prev => ({ ...prev, tipo_label: e.target.value }))}
                      >
                        <option value="Casa">Casa</option>
                        <option value="Trabalho">Trabalho</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Endereço</label>
                    <input 
                      type="text" 
                      value={modalFormData.endereco}
                      onChange={(e) => setModalFormData(prev => ({ ...prev, endereco: e.target.value }))}
                      placeholder="Ex: Rua das Flores"
                      required
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Número</label>
                      <input 
                        type="text" 
                        value={modalFormData.numero}
                        onChange={(e) => setModalFormData(prev => ({ ...prev, numero: e.target.value }))}
                        placeholder="Ex: 123"
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Bairro</label>
                      <input 
                        type="text" 
                        value={modalFormData.bairro}
                        onChange={(e) => setModalFormData(prev => ({ ...prev, bairro: e.target.value }))}
                        placeholder="Ex: Centro"
                        required
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Complemento (Apto, Bloco, etc)</label>
                    <input 
                      type="text" 
                      value={modalFormData.complemento}
                      onChange={(e) => setModalFormData(prev => ({ ...prev, complemento: e.target.value }))}
                      placeholder="Ex: Apto 101"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Ponto de Referência</label>
                    <input 
                      type="text" 
                      value={modalFormData.ponto_referencia}
                      onChange={(e) => setModalFormData(prev => ({ ...prev, ponto_referencia: e.target.value }))}
                      placeholder="Ex: Próximo à padaria"
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Cidade</label>
                      <input 
                        type="text" 
                        value={modalFormData.cidade}
                        onChange={(e) => setModalFormData(prev => ({ ...prev, cidade: e.target.value }))}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>UF</label>
                      <input 
                        type="text" 
                        value={modalFormData.uf}
                        onChange={(e) => setModalFormData(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))}
                        maxLength={2}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnCancel} onClick={handleCloseModal}>
                    Cancelar
                  </button>
                  <button type="submit" className={styles.btnSaveModal} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Endereço'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {deleteConfirmation.isOpen && (
          <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
            <div className={styles.modalContent} style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                backgroundColor: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto'
              }}>
                <AlertCircle size={32} color="#ef4444" />
              </div>
              
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                color: '#1f2937',
                marginBottom: '0.5rem'
              }}>
                Excluir Endereço
              </h3>
              
              <p style={{ 
                color: '#4b5563', 
                marginBottom: '1.5rem'
              }}>
                Tem certeza que deseja excluir este endereço? Esta ação não pode ser desfeita.
              </p>

              <div className={styles.modalFooter} style={{ justifyContent: 'center', gap: '1rem' }}>
                <button 
                  className={styles.btnCancel} 
                  onClick={() => setDeleteConfirmation({ isOpen: false, addressId: null })}
                >
                  Cancelar
                </button>
                <button 
                  className={styles.btnDelete} 
                  style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                  onClick={confirmDelete}
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
