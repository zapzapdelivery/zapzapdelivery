'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Link as LinkIcon,
  Check,
  Store
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { useEstablishment } from '@/hooks/useEstablishment';
import { useUserRole } from '@/hooks/useUserRole';
import { logAction } from '@/lib/logger';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import styles from './novo-categoria.module.css';

function NovaCategoriaContent() {
  const router = useRouter();
  const { role, loading: loadingRole } = useUserRole();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const isEditing = !!id;

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  const { success, error: toastError, warning } = useToast();
  const { establishmentId: hookEstabId, establishmentName: hookEstabName, loading: loadingEstab } = useEstablishment();

  // Form States
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState(true); // true = ativo (Habilitar visualização)
  const [imagemUrl, setImagemUrl] = useState('');
  const [ordemExibicao, setOrdemExibicao] = useState(0);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingEstab) return;
    
    if (!hookEstabId) {
       setLoading(false);
       return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // If editing, fetch category details
        if (id) {
          const { data: cat, error: catError } = await supabase
            .from('categorias')
            .select('*')
            .eq('id', id)
            .eq('estabelecimento_id', hookEstabId) // Enforce ownership
            .single();

          if (catError) throw catError;

          if (cat) {
            setNome(cat.nome_categoria);
            setDescricao(cat.descricao || '');
            setStatus(cat.status_categoria === 'ativo');
            setImagemUrl(cat.imagem_categoria_url || '');
            setOrdemExibicao(cat.ordem_exibicao || 0);
          }
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        toastError('Erro ao carregar dados iniciais.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, toastError, hookEstabId, loadingEstab]);

  const handleSave = async () => {
    // Validation
    if (!nome.trim()) {
      warning('Por favor, informe o nome da categoria.');
      return;
    }

    if (!hookEstabId) {
      toastError('Erro: Estabelecimento não identificado.');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        estabelecimento_id: hookEstabId,
        nome_categoria: nome,
        descricao: descricao,
        status_categoria: status ? 'ativo' : 'inativo',
        imagem_categoria_url: imagemUrl || null,
        ordem_exibicao: ordemExibicao, 
      };

      if (isEditing) {
        const { error } = await supabase
          .from('categorias')
          .update(payload)
          .eq('id', id)
          .eq('estabelecimento_id', hookEstabId); // Enforce ownership
        
        if (error) throw error;
        
        await logAction({
          action: 'UPDATE',
          entity: 'categorias',
          entity_id: id,
          details: payload
        });

        success('Categoria atualizada com sucesso!');
      } else {
        const { data: newCat, error } = await supabase
          .from('categorias')
          .insert(payload)
          .select()
          .single();
        
        if (error) throw error;

        await logAction({
          action: 'CREATE',
          entity: 'categorias',
          entity_id: newCat?.id,
          details: payload
        });

        success('Categoria criada com sucesso!');
      }

      router.push('/categorias');

    } catch (err: any) {
      console.error('Error saving category:', err);
      toastError('Erro ao salvar categoria: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingRole) {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
                    Carregando...
                </div>
            </div>
        </div>
    );
  }

  if (role === 'atendente') return null;

  return (
    <div className={styles.container}>
      <main className={styles.content}>
        <AdminHeader />
        
        <div className={styles.mainColumn}>
          <div className={styles.header}>
            <Link href="/categorias" className={styles.backLink}>
              ← Voltar para Categorias
            </Link>
            <h1 className={styles.title}>{isEditing ? 'Editar Categoria' : 'Nova Categoria'}</h1>
          </div>

          <div className={styles.card}>
              <div className={styles.switchContainer}>
                <div className={styles.switchLabel}>
                    Status da Categoria
                    <span className={styles.switchDescription}>Ative ou desative esta categoria no app</span>
                </div>
                <label className={`${styles.switch} ${styles.greenToggle}`}>
                    <input 
                        type="checkbox" 
                        checked={status}
                        onChange={(e) => setStatus(e.target.checked)}
                    />
                    <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            {/* Media Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Mídia</h2>
              
              <ImageUpload
                label="ÍCONE DA CATEGORIA"
                bucket="categories"
                folder="categorias"
                value={imagemUrl}
                onChange={setImagemUrl}
                helpText="Recomendado: 500x500px, máx 2MB"
              />

              <div style={{ marginTop: '1rem' }}>
                <span className={styles.dividerText}>Ou insira a URL manualmente</span>
                <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                  <input 
                    type="text" 
                    className={styles.input} 
                    style={{ paddingRight: '2.5rem' }}
                    placeholder="https://exemplo.com/imagem.png"
                    value={imagemUrl}
                    onChange={(e) => setImagemUrl(e.target.value)}
                  />
                  <LinkIcon size={16} style={{ position: 'absolute', right: '1rem', top: '0.75rem', color: '#6b7280' }} />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Informações Básicas</h2>
              <p className={styles.cardSubtitle}>Preencha os dados principais da categoria.</p>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Nome da Categoria <span className={styles.required}>*</span>
                </label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="Ex: Hambúrgueres Artesanais"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Descrição</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="Descreva brevemente esta categoria para ajudar seus clientes..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={250}
                />
                <span className={styles.charCount}>{descricao.length}/250 caracteres</span>
              </div>

              <h2 className={styles.cardTitle} style={{ marginTop: '2rem' }}>Configurações</h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estabelecimento</label>
                <div className={styles.readOnlyField}>
                  <Store size={18} className={styles.fieldIcon} />
                  <span>{hookEstabName || 'Carregando...'}</span>
                </div>
              </div>

              <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                <label className={styles.label}>Ordem de Exibição</label>
                <input 
                  type="number" 
                  className={styles.input} 
                  value={ordemExibicao}
                  onChange={(e) => setOrdemExibicao(parseInt(e.target.value) || 0)}
                  min="0"
                />
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                  Define a ordem em que a categoria aparece no app (menor número aparece primeiro).
                </span>
              </div>
            </div>

          <div className={styles.footer}>
            <Link href="/categorias" className={styles.cancelButton}>
              Cancelar
            </Link>
            <button 
              className={styles.saveButton}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvando...' : (
                  <>
                      <Check size={18} />
                      {isEditing ? 'Salvar Alterações' : 'Criar Categoria'}
                  </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NovaCategoriaPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <NovaCategoriaContent />
    </Suspense>
  );
}
