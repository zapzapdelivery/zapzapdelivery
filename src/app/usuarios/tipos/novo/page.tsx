'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../../../components/Sidebar/Sidebar';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, X } from 'lucide-react';
import styles from './novo-tipo.module.css';
import { useToast } from '../../../../components/Toast/ToastProvider';

export default function NovoTipoUsuarioPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [formData, setFormData] = useState({
    nome_tipo_usuario: '',
    descricao: ''
  });
  const [saving, setSaving] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

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

  if (loadingRole) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_tipo_usuario.trim()) {
      showError('Por favor, informe o nome do tipo de usuário.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/usuarios/tipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao criar tipo de usuário');

      success('Tipo de usuário criado com sucesso!');
      router.push('/usuarios/tipos');
    } catch (err: any) {
      console.error('Erro:', err);
      showError(err.message || 'Erro ao criar tipo de usuário');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <Sidebar />
      
      <main className={styles.mainContent}>
        <Link href="/usuarios/tipos" className={styles.backLink}>
          <ArrowLeft size={20} />
          Voltar para Tipos de Usuários
        </Link>

        <h1 className={styles.title}>Novo Tipo de Usuário</h1>

        <form onSubmit={handleSubmit} className={styles.formContainer}>
          <div className={styles.gridContainer}>
            {/* Coluna da Esquerda - Informações */}
            <div className={styles.column}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Informações do Perfil</h2>
                <p className={styles.sectionDescription}>Defina o nome identificador para este novo perfil de acesso.</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="nome_tipo_usuario" className={styles.label}>
                  Nome do Tipo de Usuário
                </label>
                <input
                  type="text"
                  id="nome_tipo_usuario"
                  name="nome_tipo_usuario"
                  value={formData.nome_tipo_usuario}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Ex: Gerente de Loja"
                  required
                />
              </div>
            </div>

            {/* Coluna da Direita - Descrição */}
            <div className={styles.column}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Descrição</h2>
                <p className={styles.sectionDescription}>Detalhe as permissões e a finalidade deste perfil no sistema.</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="descricao" className={styles.label}>
                  Descrição
                </label>
                <textarea
                  id="descricao"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  className={styles.textarea}
                  placeholder="Descreva as permissões e finalidade deste tipo de usuário..."
                />
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button 
              type="button" 
              className={styles.btnCancel}
              onClick={() => router.push('/usuarios/tipos')}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Tipo'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
