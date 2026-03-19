'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Settings2, Info, FileText } from 'lucide-react';
import styles from './novo-tipo-estabelecimento.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { useUserRole } from '@/hooks/useUserRole';

export default function NovoTipoEstabelecimentoPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    ativo: true,
    descricao: ''
  });

  const { role, loading: loadingRole } = useUserRole();

  useEffect(() => {
    if (!loadingRole && (role === 'atendente' || role === 'estabelecimento')) {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  if (loadingRole) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleActive = () => {
    setFormData(prev => ({ ...prev, ativo: !prev.ativo }));
  };

  const handleBack = () => {
    router.push('/estabelecimentos/tipos');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      showError('Por favor, informe o nome do tipo.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/estabelecimentos/tipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formData.nome, descricao: formData.descricao, ativo: formData.ativo })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao criar tipo de estabelecimento');
      }
      success('Tipo criado com sucesso!');
      router.push('/estabelecimentos/tipos');
    } catch (err: any) {
      showError(err?.message || 'Erro ao salvar tipo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <Link href="/estabelecimentos/tipos" className={styles.backLink}>
            <ArrowLeft size={18} />
            Voltar para Tipos de Estabelecimentos
          </Link>
          <h1 className={styles.title}>Novo Tipo de Estabelecimento</h1>
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
            <Link href="/estabelecimentos/tipos" className={styles.btnCancel}>
              Cancelar
            </Link>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Tipo'}
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
            <h1 className={styles.mobileTitle}>Novo Tipo de Estabelecimento</h1>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Settings2 className={styles.sectionIcon} size={20} />
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
                <Info className={styles.sectionIcon} size={20} />
                <h2 className={styles.sectionTitle}>Informações Básicas</h2>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome</label>
                <input
                  name="nome"
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Restaurante, Pizzaria, Farmácia"
                  value={formData.nome}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FileText className={styles.sectionIcon} size={20} />
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

            <div className={styles.mobileStickyFooter}>
              <button 
                type="button" 
                className={styles.btnCancel}
                onClick={() => router.push('/estabelecimentos/tipos')}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Tipo'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
