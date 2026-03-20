'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Check, 
  X
} from 'lucide-react';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { useUserRole } from '@/hooks/useUserRole';
import styles from '../../novo/novo-produto.module.css';

interface Category {
  id: string;
  nome_categoria: string;
}

interface GrupoAdicional {
  id: string;
  nome: string;
  tipo_selecao: 'unico' | 'multiplo';
  obrigatorio: boolean;
  min_opcoes: number;
  max_opcoes: number;
  ordem_exibicao: number;
  categoria_id?: string | null;
}

export default function EditarProdutoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { role, loading: loadingRole } = useUserRole();
  const isEditing = true;

  const { success, error: toastError, warning } = useToast();

  // Form States
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [permiteObservacao, setPermiteObservacao] = useState(true);
  const [permiteVendaSemEstoque, setPermiteVendaSemEstoque] = useState(false);
  const [status, setStatus] = useState(true); // true = ativo
  const [imagemUrl, setImagemUrl] = useState('');
  // const [categoriaId, setCategoriaId] = useState(''); // Deprecated
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [estabelecimentoId, setEstabelecimentoId] = useState('');
  
  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [establishmentName, setEstablishmentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grupos, setGrupos] = useState<GrupoAdicional[]>([]);
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);
  const [maxOverride, setMaxOverride] = useState<Record<string, string>>({});
  const [ordemGrupo, setOrdemGrupo] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || null;
        if (!token) {
          router.push('/login');
          return;
        }

        const roleRes = await fetch('/api/me/role', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const roleData = await roleRes.json().catch(() => ({}));
        const estabId = (roleData?.establishment_id as string | null) ?? null;

        if (!estabId) {
          toastError('Estabelecimento não encontrado para este usuário.');
          return;
        }

        setEstabelecimentoId(estabId);
        setEstablishmentName(roleData?.establishment_name || '');

        // Fetch Categories
        const { data: cats } = await supabase
          .from('categorias')
          .select('id, nome_categoria')
          .eq('estabelecimento_id', estabId)
          .eq('status_categoria', 'ativo') // Only active categories
          .order('nome_categoria');
        
        setCategories(cats || []);

        // Fetch product details
        if (id) {
          const { data: prod, error: prodError } = await supabase
            .from('produtos')
            .select('*')
            .eq('id', id)
            .single();

          if (prodError) throw prodError;

          if (prod) {
            setNome(prod.nome_produto);
            setDescricao(prod.descricao || '');
            setValor(prod.valor_base.toString().replace('.', ','));
            setPermiteObservacao(prod.permite_observacao);
            setPermiteVendaSemEstoque(prod.permite_venda_sem_estoque === true);
            setStatus(prod.status_produto === 'ativo');
            setImagemUrl(prod.imagem_produto_url || '');
            // setCategoriaId(prod.categoria_id || ''); // Deprecated
            
            // Fetch categories (N:N)
            const { data: prodCats } = await supabase
                .from('produtos_categorias')
                .select('categoria_id')
                .eq('produto_id', id);

            if (prodCats && prodCats.length > 0) {
                setSelectedCategoryIds(prodCats.map((pc: any) => pc.categoria_id));
            } else if (prod.categoria_id) {
                // Fallback for legacy data
                setSelectedCategoryIds([prod.categoria_id]);
            }
          }
        }

        const { data: gRows } = await supabase
          .from('grupos_adicionais')
          .select('id, nome, tipo_selecao, obrigatorio, min_opcoes, max_opcoes, ordem_exibicao, categoria_id')
          .eq('estabelecimento_id', estabId)
          .order('ordem_exibicao');
        setGrupos(gRows || []);

        if (id) {
          const { data: rels } = await supabase
            .from('produtos_grupos_adicionais')
            .select('grupo_id, max_opcoes, ordem_exibicao')
            .eq('produto_id', id);
          const sel = (rels || []).map((r: any) => String(r.grupo_id));
          setSelectedGrupos(sel);
          const maxMap: Record<string, string> = {};
          const ordMap: Record<string, string> = {};
          (rels || []).forEach((r: any) => {
            maxMap[String(r.grupo_id)] = r.max_opcoes != null ? String(r.max_opcoes) : '';
            ordMap[String(r.grupo_id)] = r.ordem_exibicao != null ? String(r.ordem_exibicao) : '';
          });
          setMaxOverride(maxMap);
          setOrdemGrupo(ordMap);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        toastError('Erro ao carregar dados iniciais.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, toastError, id]);

  const handleSave = async () => {
    // Validation
    if (!nome.trim()) {
      warning('Por favor, informe o nome do produto.');
      return;
    }
    if (!valor || parseFloat(valor.replace(',', '.')) < 0) {
      warning('Por favor, informe um valor válido.');
      return;
    }
    if (selectedCategoryIds.length === 0) {
      warning('Por favor, selecione pelo menos uma categoria.');
      return;
    }

    try {
      setSaving(true);

      const valorNumerico = parseFloat(valor.replace(',', '.'));
      const payload = {
        estabelecimento_id: estabelecimentoId,
        categoria_id: selectedCategoryIds[0], // Primary for compatibility
        nome_produto: nome,
        descricao: descricao,
        valor_base: valorNumerico,
        permite_observacao: permiteObservacao,
        permite_venda_sem_estoque: permiteVendaSemEstoque,
        status_produto: status ? 'ativo' : 'inativo',
        imagem_produto_url: imagemUrl || null,
        atualizado_em: new Date().toISOString()
      };

      const { error } = await supabase
        .from('produtos')
        .update(payload)
        .eq('id', id);
      
      if (error) throw error;

      // Update Categories N:N
      await supabase.from('produtos_categorias').delete().eq('produto_id', id);
      if (selectedCategoryIds.length > 0) {
          const catRows = selectedCategoryIds.map(cid => ({ produto_id: id, categoria_id: cid }));
          const { error: catErr } = await supabase.from('produtos_categorias').insert(catRows);
          if (catErr) console.warn('Erro ao salvar categorias (tabela pode não existir):', catErr);
      }

      await supabase.from('produtos_grupos_adicionais').delete().eq('produto_id', id);
      if (selectedGrupos.length > 0) {
        const rows = selectedGrupos.map((gid, idx) => ({
          produto_id: id,
          grupo_id: gid,
          max_opcoes: maxOverride[gid] ? Number(maxOverride[gid]) : null,
          ordem_exibicao: ordemGrupo[gid] ? Number(ordemGrupo[gid]) : idx + 1
        }));
        const { error: relErr } = await supabase.from('produtos_grupos_adicionais').insert(rows);
        if (relErr) throw relErr;
      }
      success('Produto atualizado com sucesso!');

      router.push('/produtos');

    } catch (err: any) {
      console.error('Error saving product:', err);
      toastError('Erro ao salvar produto: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow only numbers and comma/dot
    if (/^[\d.,]*$/.test(val)) {
        setValor(val);
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

  return (
    <div className={styles.container}>
      <main className={styles.content}>
        <AdminHeader />
        
        <div className={styles.mainColumn}>
          <div className={styles.header}>
            <Link href="/produtos" className={styles.backLink}>
              ← Voltar para Produtos
            </Link>
            <h1 className={styles.title}>Editar Produto</h1>
            <p className={styles.subtitle}>Atualize as informações do produto abaixo.</p>
          </div>
            
            {/* Status do Produto */}
          <div className={styles.card}>
            <div className={styles.switchContainer}>
                  <div className={styles.switchLabel}>
                    <span className={styles.switchTitle}>Status do Produto</span>
                  </div>
                  <label className={styles.switch}>
                      <input 
                          type="checkbox" 
                          checked={status}
                          onChange={(e) => setStatus(e.target.checked)}
                      />
                      <span className={styles.slider}></span>
                  </label>
              </div>

              <div className={styles.switchContainer} style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>Venda sem Estoque</span>
                  <span className={styles.switchDescription}>Permitir a venda deste produto mesmo quando o estoque for zero ou negativo</span>
                </div>
                <label className={styles.switch}>
                  <input 
                    type="checkbox" 
                    checked={permiteVendaSemEstoque}
                    onChange={(e) => setPermiteVendaSemEstoque(e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Mídia</h2>
              
              <ImageUpload
                bucket="products"
                folder="produtos"
                value={imagemUrl}
                onChange={setImagemUrl}
              />
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Informações do Produto</h2>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome do Produto</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="Ex: X-Burger Especial"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Descrição</label>
                <textarea 
                  className={styles.textarea} 
                  placeholder="Descreva os ingredientes e detalhes do produto..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Valor Base (R$)</label>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>R$</span>
                    <input 
                      type="text" 
                      className={styles.input} 
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="0,00"
                      value={valor}
                      onChange={handlePriceChange}
                    />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Estabelecimento</label>
                <div className={styles.select} style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }}>
                    {establishmentName || 'Carregando...'}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Categorias</label>
                <div className={styles.categoriesGrid}>
                  {categories.map(cat => (
                    <label key={cat.id} className={styles.categoryItem}>
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(cat.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSelectedCategoryIds(prev =>
                            isChecked ? [...prev, cat.id] : prev.filter(id => id !== cat.id)
                          );
                        }}
                      />
                      <span className={styles.categoryLabel}>{cat.nome_categoria}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.switchContainer}>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>Permite Observação</span>
                  <span className={styles.switchDescription}>O cliente pode adicionar notas ao pedido</span>
                </div>
                <label className={`${styles.switch} ${styles.blueToggle}`}>
                  <input 
                    type="checkbox" 
                    checked={permiteObservacao}
                    onChange={(e) => setPermiteObservacao(e.target.checked)}
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

            </div>
            
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Adicionais (Grupos)</h2>
              <div className={styles.formGroup}>
                {!selectedCategoryIds.length ? (
                  <div
                    className={styles.select}
                    style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
                  >
                    Selecione pelo menos uma categoria para ver os grupos
                  </div>
                ) : (
                  (() => {
                    const gruposFiltrados = grupos.filter(
                      (g) => g.categoria_id && selectedCategoryIds.includes(String(g.categoria_id)),
                    );
                    if (gruposFiltrados.length === 0) {
                      return (
                        <div
                          className={styles.select}
                          style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
                        >
                          Nenhum grupo encontrado para esta categoria
                        </div>
                      );
                    }
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        {gruposFiltrados.map((g) => {
                          const checked = selectedGrupos.includes(g.id);
                          const resolvedMax = maxOverride[g.id]
                            ? Number(maxOverride[g.id])
                            : g.max_opcoes;
                          return (
                            <div
                              key={g.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '20px 1fr 100px 100px',
                                gap: '0.5rem',
                                alignItems: 'center',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setSelectedGrupos((prev) =>
                                    on
                                      ? [...prev, g.id]
                                      : prev.filter((x) => x !== g.id),
                                  );
                                }}
                              />
                              <div>
                                <div style={{ fontWeight: 600 }}>{g.nome}</div>
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    color: '#6b7280',
                                  }}
                                >
                                  {g.obrigatorio ? 'Obrigatório • ' : ''}
                                  {g.tipo_selecao === 'unico'
                                    ? 'Escolha 1'
                                    : `Escolha até ${resolvedMax}`}
                                </div>
                              </div>
                              <input
                                type="number"
                                placeholder="Max"
                                className={styles.input}
                                value={maxOverride[g.id] || ''}
                                onChange={(e) =>
                                  setMaxOverride((prev) => ({
                                    ...prev,
                                    [g.id]: e.target.value,
                                  }))
                                }
                                disabled={!checked}
                              />
                              <input
                                type="number"
                                placeholder="Ordem"
                                className={styles.input}
                                value={ordemGrupo[g.id] || ''}
                                onChange={(e) =>
                                  setOrdemGrupo((prev) => ({
                                    ...prev,
                                    [g.id]: e.target.value,
                                  }))
                                }
                                disabled={!checked}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
          </div>

          <div className={styles.footer}>
            <button 
              className={`${styles.button} ${styles.cancelButton}`}
              onClick={() => router.back()}
            >
              <X size={18} />
              Cancelar
            </button>
            <button 
              className={`${styles.button} ${styles.saveButton}`}
              onClick={handleSave}
              disabled={saving}
            >
              <Check size={18} />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
