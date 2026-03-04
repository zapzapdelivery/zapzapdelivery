'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { ArrowLeft, Info, Settings2, FileText } from 'lucide-react';
import styles from '../novo/novo-tipo-estabelecimento.module.css';
import { useToast } from '@/components/Toast/ToastProvider';

export default function EditarTipoEstabelecimentoPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || '');
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    ativo: true,
    descricao: ''
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!id) {
        showError('ID inválido');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/estabelecimentos/tipos/${id}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao carregar tipo');
        setFormData(prev => ({ ...prev, nome: data?.nome || '' }));
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          showError(err?.message || 'Erro ao carregar tipo');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [id, showError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleActive = () => {
    setFormData(prev => ({ ...prev, ativo: !prev.ativo }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      showError('Por favor, informe o nome do tipo.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/estabelecimentos/tipos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formData.nome })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao atualizar tipo');
      success('Tipo atualizado com sucesso!');
      router.push('/estabelecimentos/tipos');
    } catch (err: any) {
      showError(err?.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Sidebar />
        <main className={styles.mainContent}>
          <p>Carregando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <Link href="/estabelecimentos/tipos" className={styles.backLink}>
            <ArrowLeft size={18} />
            Voltar para Tipos de Estabelecimentos
          </Link>
          <h1 className={styles.title}>Editar Tipo de Estabelecimento</h1>
          <form onSubmit={handleSubmit} className={styles.formContainer}>
            <div className={styles.gridContainer}>
              <div className={styles.column}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <Info className={styles.sectionIcon} size={24} />
                    <h2 className={styles.sectionTitle}>Informações Básicas</h2>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="nome" className={styles.label}>Nome</label>
                    <input
                      id="nome"
                      name="nome"
                      type="text"
                      className={styles.input}
                      placeholder="Ex: Restaurante, Pizzaria, Farmácia"
                      value={formData.nome}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
              <div className={styles.column}>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <Settings2 className={styles.sectionIcon} size={24} />
                    <h2 className={styles.sectionTitle}>Configurações</h2>
                  </div>
                  <div className={styles.statusContainer}>
                    <div className={styles.statusInfo}>
                      <span className={styles.statusLabel}>Ativo</span>
                      <span className={styles.statusDesc}>Define se este tipo está visível para seleção</span>
                    </div>
                    <label className={styles.switch}>
                      <input 
                        type="checkbox" 
                        name="ativo"
                        checked={formData.ativo}
                        onChange={handleToggleActive}
                      />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <FileText className={styles.sectionIcon} size={24} />
                    <h2 className={styles.sectionTitle}>Descrição</h2>
                  </div>
                  <div className={styles.formGroup}>
                    <textarea
                      name="descricao"
                      className={styles.textarea}
                      placeholder="Descreva brevemente as características deste tipo de estabelecimento..."
                      value={formData.descricao}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.footer}>
              <button 
                type="button" 
                className={styles.btnCancel}
                onClick={() => router.push('/estabelecimentos/tipos')}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.mobileOnly}>
          <form onSubmit={handleSubmit} className={styles.mobileContainer}>
            <Link href="/estabelecimentos/tipos" className={styles.mobileBackLink}>
              <ArrowLeft size={18} />
              Voltar para Tipos de Estabelecimentos
            </Link>
            <h1 className={styles.mobileTitle}>Editar Tipo de Estabelecimento</h1>
            <div className={styles.mobileStatusCard}>
              <div className={styles.mobileStatusText}>
                <span className={styles.statusLabel}>Ativo</span>
                <span className={styles.statusDesc}>Habilitar ou desabilitar este tipo</span>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  name="ativo"
                  checked={formData.ativo}
                  onChange={handleToggleActive}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
            <label className={styles.label}>Nome</label>
            <input
              name="nome"
              type="text"
              className={styles.input}
              placeholder="Ex: Restaurante, Farmácia..."
              value={formData.nome}
              onChange={handleChange}
            />
            <label className={styles.label}>Descrição</label>
            <textarea
              name="descricao"
              className={styles.textarea}
              placeholder="Descreva brevemente este tipo de estabelecimento..."
              value={formData.descricao}
              onChange={handleChange}
            />
            <div className={styles.mobileActions}>
              <button 
                type="button" 
                className={styles.btnCancel}
                onClick={() => router.push('/estabelecimentos/tipos')}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
