'use client';

import React, { useState, useRef, ChangeEvent, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { AdminHeader } from '@/components/Header/AdminHeader';
import styles from '../novo/novo-estabelecimento.module.css';
import { 
  ArrowLeft, 
  Building2, 
  Phone, 
  MapPin, 
  Image as ImageIcon, 
  Settings, 
  Bot, 
  Upload,
  Check,
  Loader2,
  Lock,
  LogOut
} from 'lucide-react';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/Toast/ToastProvider';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { Loading } from '@/components/Loading/Loading';

function PerfilEstabelecimentoContent() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [docType, setDocType] = useState<'cpf' | 'cnpj'>('cnpj');
  const [isActive, setIsActive] = useState(true);
  const { success, error } = useToast();
  const { role, establishmentId, loading: loadingRole } = useUserRole();
  
  const [title] = useState('Meu Perfil');
  const [subtitle] = useState('Visualize e edite os dados do seu estabelecimento');

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    document: '',
    email: '',
    loginEmail: '',
    loginPassword: '',
    loginPasswordConfirm: '',
    phone: '',
    whatsappMain: '',
    whatsappKitchen: '',
    cep: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    logoUrl: '',
    url_cardapio: '',
    partner: '',
    planId: '',
    tipo_estabelecimento_id: '',
    attendantName: '',
    attendantWhatsapp: '',
    baseUrl: '',
    instance: '',
    apiKey: ''
  });

  const [initialData, setInitialData] = useState<typeof formData>(formData);

  const [cepError, setCepError] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showLoginPasswordConfirm, setShowLoginPasswordConfirm] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const numberInputRef = useRef<HTMLInputElement>(null);

  const unmask = (val: string) => val.replace(/\\D/g, '');
  const maskCPF = (val: string) => {
    return val
      .replace(/\\D/g, '')
      .replace(/(\\d{3})(\\d)/, '$1.$2')
      .replace(/(\\d{3})(\\d)/, '$1.$2')
      .replace(/(\\d{3})(\\d{1,2})/, '$1-$2')
      .replace(/(-\\d{2})\\d+?$/, '$1');
  };
  const maskCNPJ = (val: string) => {
    return val
      .replace(/\\D/g, '')
      .replace(/(\\d{2})(\\d)/, '$1.$2')
      .replace(/(\\d{3})(\\d)/, '$1.$2')
      .replace(/(\\d{3})(\\d)/, '$1/$2')
      .replace(/(\\d{4})(\\d)/, '$1-$2')
      .replace(/(-\\d{2})\\d+?$/, '$1');
  };
  const maskPhone = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };
  const maskCEP = (val: string) => {
    return val
      .replace(/\\D/g, '')
      .replace(/(\\d{5})(\\d)/, '$1-$2')
      .replace(/(-\\d{3})\\d+?$/, '$1');
  };

  const toCardapioSlug = (val: string) => {
    return val
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  useEffect(() => {
    setFormData(prev => {
      if (prev.loginPasswordConfirm === prev.loginPassword) return prev;
      return { ...prev, loginPasswordConfirm: prev.loginPassword };
    });
  }, [formData.loginPassword]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'document') {
      newValue = docType === 'cpf' ? maskCPF(value) : maskCNPJ(value);
    } else if (['phone', 'whatsappMain', 'whatsappKitchen', 'attendantWhatsapp'].includes(name)) {
      newValue = maskPhone(value);
    } else if (name === 'cep') {
      newValue = maskCEP(value);
      if (cepError) setCepError('');
    }

    setFormData(prev => ({ ...prev, [name]: newValue }));
    if (name === 'name') {
      const slug = toCardapioSlug(newValue);
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const prodBase =
        (process.env.NEXT_PUBLIC_PRODUCTION_BASE_URL as string) ||
        (typeof window !== 'undefined' ? window.location.origin : '');
      const base = isLocal ? 'http://localhost:3000' : prodBase || 'http://lurldeproducao';
      const url = slug ? `${base}/estabelecimentos/cardapio/${slug}` : '';
      setFormData(prev => ({ ...prev, url_cardapio: url }));
    }
  };

  type PlanItem = { id: string; nome_plano: string; status_plano?: string };
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [estabTypes, setEstabTypes] = useState<{ id: string; nome: string }[]>([]);
  const [typesLoading, setTypesLoading] = useState<boolean>(false);
  const [typesError, setTypesError] = useState<string | null>(null);
  type PartnerItem = { id: string; nome: string; status?: string };
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [partnersLoading, setPartnersLoading] = useState<boolean>(false);
  const [partnersError, setPartnersError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setPlansLoading(true);
        setPlansError(null);
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/planos', {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`
          }
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Falha ao carregar planos');
        }
        const list: PlanItem[] = Array.isArray(data)
          ? data.map((p: any) => ({
              id: p.id,
              nome_plano: p.nome_plano,
              status_plano: p.status_plano,
            }))
          : [];
        setPlans(list);
      } catch (err: any) {
        setPlansError(err?.message || 'Erro ao carregar planos');
      } finally {
        setPlansLoading(false);
      }
    };
    loadPlans();
  }, []);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        setTypesLoading(true);
        setTypesError(null);
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/estabelecimentos/tipos`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao carregar tipos de estabelecimentos');
        const list: { id: string; nome: string }[] = Array.isArray(data) ? data : [];
        setEstabTypes(list);
      } catch (err: any) {
        setTypesError(err?.message || 'Erro ao carregar tipos de estabelecimentos');
      } finally {
        setTypesLoading(false);
      }
    };
    loadTypes();
  }, []);

  useEffect(() => {
    const loadPartners = async () => {
      try {
        setPartnersLoading(true);
        setPartnersError(null);
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/parceiros', {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao carregar parceiros');
        const list: PartnerItem[] = Array.isArray(data)
          ? data.map((p: any) => ({
              id: p.id,
              nome: p.nome,
              status: p.status,
            }))
          : [];
        setPartners(list);
      } catch (err: any) {
        setPartnersError(err?.message || 'Erro ao carregar parceiros');
      } finally {
        setPartnersLoading(false);
      }
    };
    loadPartners();
  }, []);

  useEffect(() => {
    if (loadingRole) return;
    if (role !== 'estabelecimento' || !establishmentId) {
      error('Acesso negado: apenas estabelecimentos podem editar seus dados.');
      router.push('/');
      return;
    }
    const loadById = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const authHeaders = { 'Authorization': `Bearer ${session?.access_token || ''}` };
        const res = await fetch(`/api/estabelecimentos/${establishmentId}`, { headers: authHeaders });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Falha ao carregar estabelecimento');
        const loginEmail = session?.user?.email || '';
        const docTypeDetected: 'cpf' | 'cnpj' = (String(data.document || '').length > 11) ? 'cnpj' : 'cpf';
        setDocType(docTypeDetected);
        setIsActive(!!data.isActive);
        const filled = {
          name: data.name || '',
          legalName: data.legalName || '',
          document: docTypeDetected === 'cpf' ? maskCPF(String(data.document || '')) : maskCNPJ(String(data.document || '')),
          email: data.email || '',
          loginEmail,
          loginPassword: '',
          loginPasswordConfirm: '',
          phone: maskPhone(String(data.phone || '')),
          whatsappMain: maskPhone(String(data.whatsappMain || '')),
          whatsappKitchen: maskPhone(String(data.whatsappKitchen || '')),
          cep: maskCEP(String(data.cep || '')),
          address: data.address || '',
          number: String(data.number || ''),
          complement: data.complement || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || '',
          logoUrl: data.logoUrl || '',
          url_cardapio: data.url_cardapio || '',
          partner: data.partner || '',
          planId: data.planId || '',
          tipo_estabelecimento_id: data.tipo_estabelecimento_id || '',
          attendantName: data.attendantName || '',
          attendantWhatsapp: maskPhone(String(data.attendantWhatsapp || '')),
          baseUrl: data.baseUrl || '',
          instance: data.instance || '',
          apiKey: data.apiKey || ''
        };
        setFormData(filled);
        setInitialData(filled);
        if (data.logoUrl) setLogoPreview(data.logoUrl);
      } catch (err: any) {
        error(err?.message || 'Erro ao carregar estabelecimento');
      }
    };
    loadById();
  }, [loadingRole, role, establishmentId, error, router]);

  const handleCepBlur = async () => {
    const cep = unmask(formData.cep);
    if (cep.length === 8) {
      setLoadingCep(true);
      setCepError('');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) {
          setCepError('CEP não encontrado');
        } else {
          setFormData(prev => ({
            ...prev,
            address: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
          }));
          if (numberInputRef.current) numberInputRef.current.focus();
        }
      } catch {
        setCepError('Erro ao buscar CEP');
      } finally {
        setLoadingCep(false);
      }
    } else if (cep.length > 0) {
      setCepError('CEP incompleto');
    }
  };

  const handleSave = async () => {
    const required = ['name', 'legalName', 'document', 'cep'];
    const missing = required.some((k) => String((formData as any)[k] || '').trim().length === 0);
    if (missing) {
      error('Por favor, preencha os campos obrigatórios.');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: formData.name,
        legalName: formData.legalName,
        document: unmask(formData.document),
        docType,
        email: formData.email,
        phone: unmask(formData.phone),
        whatsappMain: unmask(formData.whatsappMain),
        whatsappKitchen: unmask(formData.whatsappKitchen),
        attendantName: formData.attendantName,
        attendantWhatsapp: unmask(formData.attendantWhatsapp),
        baseUrl: formData.baseUrl,
        instance: formData.instance,
        apiKey: formData.apiKey,
        cep: unmask(formData.cep),
        address: formData.address,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        logoUrl: formData.logoUrl,
        url_cardapio: formData.url_cardapio,
        partner: formData.partner,
        planId: formData.planId,
        tipo_estabelecimento_id: formData.tipo_estabelecimento_id,
        isActive,
      };

      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      };

      const res = await fetch(`/api/estabelecimentos/${establishmentId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao atualizar estabelecimento');
      }

      success('Alterações salvas com sucesso!');
      setInitialData(formData);
      router.push('/paineladmin');
    } catch (e: any) {
      error(e.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialData);
    setShowLoginPassword(false);
    setShowLoginPasswordConfirm(false);
    setShowApiKey(false);
    setCepError('');
    if (logoPreview !== initialData.logoUrl) setLogoPreview(initialData.logoUrl || null);
    success('Cancelamento realizado com sucesso!');
    router.push('/paineladmin');
  };

  if (loadingRole) {
    return <Loading message="Carregando perfil..." fullScreen />;
  }

  return (
    <div className={styles.container}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mobileOnly}> 
        <MobileHeader 
          onMenuClick={() => setIsSidebarOpen(true)} 
          title={title}
          subtitle={subtitle}
          showGreeting={false}
        />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.desktopOnly} style={{ marginBottom: '1rem' }}>
          <AdminHeader title={title} subtitle={subtitle} />
        </div>

        <div className={styles.mobileOnly} style={{ marginBottom: '1rem', marginTop: '-0.5rem' }}>
          <Link href="/paineladmin" className={styles.backLink} style={{ marginBottom: '0' }}>
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </div>

        <form className={styles.formGrid} onSubmit={(e) => e.preventDefault()}>
          <div className={styles.leftColumn}>
            <div className={`${styles.sectionCard} ${styles.cardIdentification}`}>
              <div className={styles.sectionHeader}>
                <Building2 className={styles.sectionIcon} size={24} />
                <span className={styles.sectionTitle}>Identificação</span>
              </div>
              <div className={styles.toggleGroup}>
                <button 
                  type="button"
                  className={`${styles.toggleOption} ${docType === 'cnpj' ? styles.toggleOptionActive : ''}`.trim()}
                  onClick={() => {
                    setDocType('cnpj');
                    setFormData(prev => ({ ...prev, document: '' }));
                  }}
                >
                  CNPJ
                </button>
                <button 
                  type="button"
                  className={`${styles.toggleOption} ${docType === 'cpf' ? styles.toggleOptionActive : ''}`.trim()}
                  onClick={() => {
                    setDocType('cpf');
                    setFormData(prev => ({ ...prev, document: '' }));
                  }}
                >
                  CPF
                </button>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>NOME FANTASIA</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="Ex: Pizzaria do João" 
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>RAZÃO SOCIAL</label>
                  <input 
                    type="text" 
                    name="legalName"
                    value={formData.legalName}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="João da Silva LTDA" 
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>DOCUMENTO ({docType.toUpperCase()})</label>
                  <input 
                    type="text" 
                    name="document"
                    value={formData.document}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder={docType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'} 
                    maxLength={docType === 'cpf' ? 14 : 18}
                  />
                </div>
              </div>
            </div>

            <div className={`${styles.sectionCard} ${styles.cardConfig}`}>
              <div className={styles.sectionHeader}>
                <Settings className={styles.sectionIcon} size={24} />
                <span className={styles.sectionTitle}>Configurações</span>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>PARCEIRO</label>
                  <select 
                    name="partner"
                    value={formData.partner}
                    onChange={handleInputChange}
                    className={styles.select}
                  >
                    {partnersLoading && <option value=''>Carregando...</option>}
                    {partnersError && <option value=''>{partnersError}</option>}
                    {!partnersLoading && !partnersError && partners.length === 0 && (
                      <option value=''>Nenhum parceiro disponível</option>
                    )}
                    {!partnersLoading && !partnersError && (
                      <>
                        <option value=''>Selecione</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}{p.status === 'inativo' ? ' (Inativo)' : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>PLANO</label>
                  <select 
                    name="planId"
                    value={formData.planId}
                    onChange={handleInputChange}
                    className={styles.select}
                  >
                    {plansLoading && <option value=''>Carregando...</option>}
                    {plansError && <option value=''>Erro ao carregar planos</option>}
                    {!plansLoading && !plansError && plans.length === 0 && (
                      <option value=''>Nenhum plano disponível</option>
                    )}
                    {!plansLoading && !plansError && plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome_plano}
                        {p.status_plano === 'inativo' ? ' (Inativo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>TIPO DE ESTABELECIMENTO</label>
                  <select 
                    name="tipo_estabelecimento_id"
                    value={formData.tipo_estabelecimento_id}
                    onChange={handleInputChange}
                    className={styles.select}
                  >
                    {typesLoading && <option value=''>Carregando...</option>}
                    {typesError && <option value=''>Erro ao carregar tipos</option>}
                    {!typesLoading && !typesError && estabTypes.length === 0 && (
                      <option value=''>Nenhum tipo disponível</option>
                    )}
                    {!typesLoading && !typesError && estabTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>URL CARDÁPIO</label>
                  <input
                    type="text"
                    name="url_cardapio"
                    value={formData.url_cardapio}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="https://exemplo.com/cardapio"
                  />
                </div>
              </div>
            </div>

            <div className={`${styles.sectionCard} ${styles.cardContact}`}>
              <div className={styles.sectionHeader}>
                <Phone className={styles.sectionIcon} size={24} />
                <span className={styles.sectionTitle}>Contato</span>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>E-MAIL</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="contato@exemplo.com" 
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>TELEFONE</label>
                  <input 
                    type="text" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="(00) 0000-0000" 
                    maxLength={15}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>WHATSAPP PRINC.</label>
                  <input 
                    type="text" 
                    name="whatsappMain"
                    value={formData.whatsappMain}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="(00) 90000-0000" 
                    maxLength={15}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>WHATSAPP COZINHA</label>
                  <input 
                    type="text" 
                    name="whatsappKitchen"
                    value={formData.whatsappKitchen}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="(00) 90000-0000" 
                    maxLength={15}
                  />
                </div>
              </div>
            </div>

            <div className={`${styles.sectionCard} ${styles.cardAddress}`}>
              <div className={styles.sectionHeader}>
                <MapPin className={styles.sectionIcon} size={24} />
                <span className={styles.sectionTitle}>Endereço</span>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ maxWidth: '200px' }}>
                  <label className={styles.label}>CEP</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      name="cep"
                      value={formData.cep}
                      onChange={handleInputChange}
                      onBlur={handleCepBlur}
                      className={`${styles.input} ${cepError ? styles.inputError : ''}`.trim()} 
                      placeholder="00000-000" 
                      maxLength={9}
                    />
                    {loadingCep && (
                      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                        <Loader2 className="animate-spin" size={16} color="#10b981" />
                      </div>
                    )}
                  </div>
                  {cepError && <span className={styles.errorMessage}>{cepError}</span>}
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 3 }}>
                  <label className={styles.label}>ENDEREÇO</label>
                  <input 
                    type="text" 
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="Rua das Flores" 
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Nº</label>
                  <input 
                    type="text" 
                    name="number"
                    value={formData.number}
                    onChange={handleInputChange}
                    ref={numberInputRef}
                    className={styles.input} 
                    placeholder="123" 
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>COMPLEMENTO</label>
                  <input 
                    type="text" 
                    name="complement"
                    value={formData.complement}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="Apto 101, Bloco B" 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>BAIRRO</label>
                  <input 
                    type="text" 
                    name="neighborhood"
                    value={formData.neighborhood}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="Centro" 
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 2 }}>
                  <label className={styles.label}>CIDADE</label>
                  <input 
                    type="text" 
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="São Paulo" 
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>UF</label>
                  <select 
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className={styles.select}
                  >
                    <option value=''>UF</option>
                    <option value='SP'>SP</option>
                    <option value='RJ'>RJ</option>
                    <option value='MG'>MG</option>
                    <option value='ES'>ES</option>
                    <option value='PR'>PR</option>
                    <option value='SC'>SC</option>
                    <option value='RS'>RS</option>
                    <option value='BA'>BA</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.rightColumn}>
            <div className={`${styles.sectionCard} ${styles.cardStatus}`}>
              <div className={styles.statusRow}>
                <div className={styles.statusInfo}>
                  <span className={styles.statusLabel}>Status do Estabelecimento</span>
                  <span className={styles.statusSub}>Ativo / Inativo</span>
                </div>
                <div 
                  className={`${styles.switch} ${isActive ? styles.switchActive : ''}`.trim()} 
                  onClick={() => setIsActive(!isActive)}
                >
                  <div className={styles.switchCircle} />
                </div>
              </div>
            </div>

            <div className={`${styles.sectionCard} ${styles.cardLogin}`}>
              <div className={styles.sectionHeader}>
                <Lock className={styles.sectionIcon} size={24} />
                <span className={styles.sectionTitle}>Dados de Login</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>E-MAIL DE LOGIN</label>
                <input
                  type="email"
                  name="loginEmail"
                  value={formData.loginEmail}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="login@exemplo.com"
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>SENHA</label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} size={20} />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      name="loginPassword"
                      value={formData.loginPassword}
                      onChange={handleInputChange}
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(s => !s)}
                      className={styles.eyeIcon}
                      aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>CONFIRMAR SENHA</label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} size={20} />
                    <input
                      type={showLoginPasswordConfirm ? 'text' : 'password'}
                      name="loginPasswordConfirm"
                      value={formData.loginPasswordConfirm}
                      onChange={handleInputChange}
                      className={`${styles.input} ${styles.inputWithIcon}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPasswordConfirm(s => !s)}
                      className={styles.eyeIcon}
                      aria-label={showLoginPasswordConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                      tabIndex={-1}
                    >
                      {showLoginPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={`${styles.sectionCard} ${styles.cardMedia}`}>
              <div className={styles.sectionHeader}>
                <ImageIcon className={styles.sectionIcon} size={24} />
                <span className={styles.sectionTitle}>Mídia</span>
              </div>
              <div className={styles.formGroup}>
                <ImageUpload
                  label="LOGO DO ESTABELECIMENTO"
                  bucket="establishments"
                  folder="estabelecimentos"
                  value={formData.logoUrl}
                  onChange={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                  helpText="Dimensão máxima: 300x300px | Máximo: 2MB"
                  allowAnonymous
                />
              </div>
            </div>

            <div className={`${styles.sectionCard} ${styles.cardAi}`}>
              <div className={styles.sectionHeader}>
                <Bot className={styles.sectionIcon} size={24} />
                <span className={styles.sectionTitle}>Integração IA</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>NOME ATENDENTE</label>
                <input 
                  type="text" 
                  name="attendantName"
                  value={formData.attendantName}
                  onChange={handleInputChange}
                  className={styles.input} 
                  placeholder="Ex: Maria" 
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>WHATSAPP ATENDENTE</label>
                <input 
                  type="text" 
                  name="attendantWhatsapp"
                  value={formData.attendantWhatsapp}
                  onChange={handleInputChange}
                  className={styles.input} 
                  placeholder="(00) 90000-0000" 
                  maxLength={15}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>BASE URL</label>
                <input 
                  type="text" 
                  name="baseUrl"
                  value={formData.baseUrl}
                  onChange={handleInputChange}
                  className={styles.input} 
                  placeholder="https://api..." 
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>INSTÂNCIA</label>
                  <input 
                    type="text" 
                    name="instance"
                    value={formData.instance}
                    onChange={handleInputChange}
                    className={styles.input} 
                    placeholder="inst_01" 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>API KEY</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showApiKey ? 'text' : 'password'}
                      name="apiKey"
                      value={formData.apiKey}
                      onChange={handleInputChange}
                      className={styles.input} 
                      placeholder="••••" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(s => !s)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      aria-label={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className={styles.footer}>
          <button 
            className={styles.btnCancel}
            onClick={handleCancel}
          >
            Cancelar
          </button>
          <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Salvando...
              </>
            ) : (
              <>
                Salvar Alterações
                <Check size={18} />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function PerfilEstabelecimentoPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PerfilEstabelecimentoContent />
    </Suspense>
  );
}
