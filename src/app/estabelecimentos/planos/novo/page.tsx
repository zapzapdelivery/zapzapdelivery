'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Settings2, ToggleLeft, Info } from 'lucide-react';
import styles from './novo-plano.module.css';
import { useToast } from '@/components/Toast/ToastProvider';

export default function NovoPlanoPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const { success, error: showError } = useToast();
  
  // Form State
  const [formData, setFormData] = useState({
    nome_plano: '',
    valor_mensal: '',
    limite_pedidos: '',
    limite_produtos: '',
    limite_usuarios: '',
    status_plano: true // true = ativo, false = inativo
  });

  useEffect(() => {
    const loadRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setLoadingRole(false);
          return;
        }
        const res = await fetch('/api/me/role', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await res.json();
        const r = data?.role ?? null;
        if (r === 'atendente') {
          router.push('/');
          return;
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRole(false);
      }
    };
    loadRole();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const toOptionalInt = (v: string) => {
    const trimmed = (v ?? '').trim().toLowerCase();
    if (!trimmed || trimmed === 'ilimitado') return null;
    const n = parseInt(trimmed, 10);
    return Number.isNaN(n) ? null : n;
  };

  const handleBack = () => {
    router.push('/estabelecimentos/planos');
  };

  if (loadingRole) return null;

  const handleSubmit = async () => {
    if (!formData.nome_plano) {
      showError('Por favor, informe o nome do plano.');
      return;
    }

    setLoading(true);

    try {
      // Prepare payload
      const payload = {
        nome_plano: formData.nome_plano,
        valor_mensal: parseFloat(formData.valor_mensal.replace('R$', '').replace(',', '.').trim()) || 0,
        limite_pedidos: toOptionalInt(formData.limite_pedidos),
        limite_produtos: toOptionalInt(formData.limite_produtos),
        limite_usuarios: toOptionalInt(formData.limite_usuarios),
        status_plano: formData.status_plano ? 'ativo' : 'inativo'
      };

      const response = await fetch('/api/planos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        success('Plano criado com sucesso!');
        router.push('/estabelecimentos/planos');
      } else {
        const errorData = await response.json();
        showError(`Erro ao salvar plano: ${errorData.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('Error saving plan:', err);
      showError('Erro ao processar requisição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className={styles.main}>
        {/* Desktop layout */}
        <div className={`${styles.container} ${styles.desktopOnly}`}>
          <div className={styles.header}>
            <div className={styles.titleContainer}>
              <h1 className={styles.title}>Novo Plano</h1>
              <p className={styles.subtitle}>Configure as características e limites do seu plano de assinatura</p>
            </div>
            <Link href="/estabelecimentos/planos" className={styles.backButton}>
              <ArrowLeft size={18} />
              Voltar para Planos
            </Link>
          </div>

          <div className={styles.contentGrid}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Settings2 className={styles.sectionIcon} size={24} />
                <h2 className={styles.sectionTitle}>Regras e Limites</h2>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nome do Plano</label>
                <input 
                  type="text" 
                  name="nome_plano"
                  className={styles.input} 
                  placeholder="Ex: Plano Premium"
                  value={formData.nome_plano}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.formRow}>
                <div>
                  <label className={styles.label}>Valor Mensal (R$)</label>
                  <input 
                    type="text" 
                    name="valor_mensal"
                    className={styles.input} 
                    placeholder="R$ 0,00"
                    value={formData.valor_mensal}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className={styles.label}>Limite de Pedidos</label>
                  <input 
                    type="number" 
                    name="limite_pedidos"
                    className={styles.input} 
                    placeholder="Ex: 1000"
                    value={formData.limite_pedidos}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div>
                  <label className={styles.label}>Limite de Produtos</label>
                  <input 
                    type="number" 
                    name="limite_produtos"
                    className={styles.input} 
                    placeholder="Ex: 500"
                    value={formData.limite_produtos}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className={styles.label}>Limite de Usuários</label>
                  <input 
                    type="number" 
                    name="limite_usuarios"
                    className={styles.input} 
                    placeholder="Ex: 5"
                    value={formData.limite_usuarios}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <ToggleLeft className={styles.sectionIcon} size={24} />
                  <h2 className={styles.sectionTitle}>Status</h2>
                </div>

                <div className={styles.statusContainer}>
                  <div className={styles.statusInfo}>
                    <span className={styles.statusLabel}>Status do Plano</span>
                    <span className={styles.statusDesc}>Define se o plano está visível para contratação</span>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      name="status_plano"
                      checked={formData.status_plano}
                      onChange={handleChange}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div className={styles.infoBox}>
                  <Info className={styles.infoIcon} size={18} />
                  <span className={styles.infoText}>
                    Planos <strong>Inativos</strong> não poderão ser selecionados por novos estabelecimentos, 
                    mas continuam vigentes para quem já os utiliza.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stickyFooter}>
        <Link href="/estabelecimentos/planos" className={styles.btnCancel}>
          Cancelar
        </Link>
        <button 
          className={styles.btnSave}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Salvar Plano'}
        </button>
      </div>
        </div>

        {/* Mobile layout */}
        <div className={styles.mobileOnly}>
          <div className={styles.mobileContainer}>
            <div className={styles.mobileTopBar}>
              <Link href="/estabelecimentos/planos" className={styles.mobileBackLink}>
                <ArrowLeft size={18} />
                Voltar para Planos
              </Link>
            </div>
            <h1 className={styles.mobileTitle}>Novo Plano</h1>

            <div className={styles.mobileStatusCard}>
              <div className={styles.mobileStatusText}>
                <span className={styles.mobileStatusTitle}>Status do Plano</span>
                <span className={styles.mobileStatusDesc}>Ativar ou desativar este plano para novos assinantes</span>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  name="status_plano"
                  checked={formData.status_plano}
                  onChange={handleChange}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div>
              <div className={styles.mobileSectionTitle}>Informações do Plano</div>
              <label className={styles.label}>Nome do Plano</label>
              <input 
                type="text"
                name="nome_plano"
                className={styles.input}
                placeholder="Ex: Plano Premium"
                value={formData.nome_plano}
                onChange={handleChange}
              />
              <label className={styles.label}>Valor Mensal (R$)</label>
              <input 
                type="text"
                name="valor_mensal"
                className={styles.input}
                placeholder="0,00"
                value={formData.valor_mensal}
                onChange={handleChange}
              />
            </div>

            <div>
              <div className={styles.mobileSectionTitle}>Limites Operacionais</div>
              <label className={styles.label}>Limite de Pedidos/Mês</label>
              <input 
                type="text"
                name="limite_pedidos"
                className={styles.input}
                placeholder="Ilimitado ou o valor numérico"
                value={formData.limite_pedidos}
                onChange={handleChange}
              />
              <label className={styles.label}>Limite de Produtos no Cardápio</label>
              <input 
                type="number"
                name="limite_produtos"
                className={styles.input}
                placeholder="Ex: 50"
                value={formData.limite_produtos}
                onChange={handleChange}
              />
              <label className={styles.label}>Limite de Usuários</label>
              <input 
                type="number"
                name="limite_usuarios"
                className={styles.input}
                placeholder="Ex: 3"
                value={formData.limite_usuarios}
                onChange={handleChange}
              />
            </div>

            <hr className={styles.mobileDivider} />

            <div className={styles.mobileActions}>
              <button 
                className={styles.btnCancel}
                onClick={() => router.push('/estabelecimentos/planos')}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                className={styles.btnSave}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Salvar Plano'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
