'use client';
import React, { ChangeEvent, useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, User, FileText, Mail, Phone, MapPin, Percent, Image as ImageIcon, Upload, Check } from 'lucide-react';
import styles from './novo-parceiro.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { useUserRole } from '@/hooks/useUserRole';

import { ImageUpload } from '@/components/Upload/ImageUpload';

type DocType = 'cpf' | 'cnpj';

function NovoParceiroContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error } = useToast();
  
  const { role, loading: loadingRole } = useUserRole();

  // Verificar permissão
  useEffect(() => {
    if (!loadingRole && (role === 'estabelecimento' || role === 'atendente')) {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  if (loadingRole) {
    return (
      <div className={styles.container}>
        <Sidebar />
        <div className={styles.mainContent}>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
            Carregando...
          </div>
        </div>
      </div>
    );
  }

  const numberInputRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState<DocType>('cpf');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepError, setCepError] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    documento: '',
    email: '',
    telefone: '',
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    complemento: '',
    comissao: '',
    logoUrl: ''
  });

  const maskCPF = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskCNPJ = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const maskCEP = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue = value;
    if (name === 'documento') {
      newValue = docType === 'cpf' ? maskCPF(value) : maskCNPJ(value);
    } else if (name === 'telefone') {
      newValue = maskPhone(value);
    } else if (name === 'cep') {
      newValue = maskCEP(value);
      if (cepError) setCepError('');
      const digits = newValue.replace(/\D/g, '');
      if (digits.length === 8) {
        fetch(`https://viacep.com.br/ws/${digits}/json/`)
          .then(r => r.json())
          .then(data => {
            if (data?.erro) {
              setCepError('Cep Invalido');
            } else {
              setFormData(prev => ({
                ...prev,
                endereco: data?.logradouro || prev.endereco,
                bairro: data?.bairro || prev.bairro,
                cidade: data?.localidade || prev.cidade,
                uf: data?.uf || prev.uf,
              }));
              setCepError('');
              numberInputRef.current?.focus();
            }
          })
          .catch(() => setCepError('Cep Invalido'));
      }
    } else if (name === 'comissao') {
      newValue = value.replace(/[^0-9.,]/g, '');
    }
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const validate = () => {
    if (!formData.nome.trim()) {
      error('Informe o nome do parceiro');
      return false;
    }
    if (!formData.email.trim()) {
      error('Informe o e-mail do parceiro');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...formData,
        status: isActive ? 'ativo' : 'inativo'
      };

      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/parceiros?id=${editingId}` : '/api/parceiros';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar parceiro');
      }

      if (editingId) {
        success('Parceiro atualizado com sucesso!');
      } else {
        success('Parceiro criado com sucesso!');
      }
      router.push('/parceiros');
    } catch (err: any) {
      error(err?.message || 'Erro ao salvar parceiro');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    setEditingId(id);
    const load = async () => {
      try {
        const res = await fetch(`/api/parceiros?id=${id}`);
        const data = await res.json();
        if (!res.ok) return;
        const active = data?.status === 'ativo' || data?.status === true;
        setIsActive(active);
        setFormData(prev => ({
          ...prev,
          nome: data?.nome ?? prev.nome,
          email: data?.email ?? prev.email,
          telefone: data?.telefone ? maskPhone(String(data.telefone)) : prev.telefone,
          logoUrl: data?.logo_url ?? prev.logoUrl
        }));
      } catch (_) {
      }
    };
    load();
  }, [searchParams]);

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <Link href="/parceiros" className={styles.backLink}>
            <ArrowLeft size={18} />
            Voltar para Parceiros
          </Link>
        </div>
        <div className={styles.mobileOnly}>
          <Link href="/parceiros" className={styles.backLink}>
            <ArrowLeft size={18} />
            Voltar para Parceiros
          </Link>
        </div>

        <h1 className={styles.pageTitle}>{editingId ? 'Editar Parceiro' : 'Novo Parceiro'}</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.leftCol}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <User size={20} className={styles.sectionIcon} />
                  <span className={styles.sectionTitle}>Identificação</span>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nome do Parceiro</label>
                    <input
                      name="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Nome Fantasia ou Nome Completo"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.segmented}>
                    <button
                      type="button"
                      className={`${styles.segmentBtn} ${docType === 'cpf' ? styles.segmentActive : ''}`}
                      onClick={() => setDocType('cpf')}
                    >
                      CPF
                    </button>
                    <button
                      type="button"
                      className={`${styles.segmentBtn} ${docType === 'cnpj' ? styles.segmentActive : ''}`}
                      onClick={() => setDocType('cnpj')}
                    >
                      CNPJ
                    </button>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Documento ({docType.toUpperCase()})</label>
                    <input
                      name="documento"
                      value={formData.documento}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder={docType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <Mail size={20} className={styles.sectionIcon} />
                  <span className={styles.sectionTitle}>Contato</span>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>E-mail</label>
                    <input
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="exemplo@email.com"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Telefone</label>
                    <input
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <MapPin size={20} className={styles.sectionIcon} />
                  <span className={styles.sectionTitle}>Endereço</span>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>CEP</label>
                    <input
                      name="cep"
                      value={formData.cep}
                      onChange={handleInputChange}
                      className={`${styles.input} ${cepError ? styles.inputError : ''}`}
                      placeholder="00000-000"
                    />
                    {cepError ? (
                      <span className={styles.errorMessage}>{cepError}</span>
                    ) : null}
                  </div>
                  <div className={styles.formGroup} style={{ flex: 2 }}>
                    <label className={styles.label}>Endereço</label>
                    <input
                      name="endereco"
                      value={formData.endereco}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Rua, Avenida, Praça..."
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Número</label>
                    <input
                      name="numero"
                      value={formData.numero}
                      onChange={handleInputChange}
                      className={styles.input}
                      ref={numberInputRef}
                      placeholder="123"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Bairro</label>
                    <input
                      name="bairro"
                      value={formData.bairro}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Seu bairro"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Cidade</label>
                    <input
                      name="cidade"
                      value={formData.cidade}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Sua cidade"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>UF</label>
                    <select
                      name="uf"
                      value={formData.uf}
                      onChange={handleInputChange}
                      className={styles.select}
                    >
                      <option value="">UF</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
                        .map(sigla => <option key={sigla} value={sigla}>{sigla}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup} style={{ flex: 2 }}>
                    <label className={styles.label}>Complemento</label>
                    <input
                      name="complemento"
                      value={formData.complemento}
                      onChange={handleInputChange}
                      className={styles.input}
                      placeholder="Apto, Bloco, Fundos..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.rightCol}>
              <div className={styles.sectionCard}>
                <div className={styles.sideHeader}>
                  <span className={styles.sideTitle}>Status do Parceiro</span>
                  <div className={`${styles.switch} ${isActive ? styles.switchActive : ''}`} onClick={() => setIsActive(!isActive)}>
                    <div className={styles.switchCircle} />
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                  Ative ou desative o parceiro para vendas
                </div>
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <ImageIcon size={20} className={styles.sectionIcon} />
                  <span className={styles.sectionTitle}>Mídia</span>
                </div>
                
                <div style={{ padding: '0 1rem' }}>
                  <ImageUpload
                    label="LOGO DO PARCEIRO"
                    bucket="partners"
                    folder="parceiros"
                    value={formData.logoUrl}
                    onChange={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                    helpText="Recomendado: 500x500px"
                  />
                </div>

                <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                  <label className={styles.label}>Ou URL da Imagem</label>
                  <input
                    name="logoUrl"
                    value={formData.logoUrl}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <Percent size={20} className={styles.sectionIcon} />
                  <span className={styles.sectionTitle}>Financeiro</span>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Percentual de Comissão (%)</label>
                    <div className={styles.inputGroup}>
                      <input
                        name="comissao"
                        value={formData.comissao}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="0,00"
                      />
                      <span className={styles.inputSuffix}>%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="submit"
              className={styles.btnSave}
              disabled={saving}
            >
              <Check size={18} />
              {saving ? 'Salvando...' : 'Salvar Parceiro'}
            </button>
            <Link href="/parceiros" className={styles.btnCancel}>
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function NovoParceiroPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <NovoParceiroContent />
    </Suspense>
  );
}
