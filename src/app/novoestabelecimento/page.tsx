"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  MapPin, 
  Settings, 
  Phone, 
  Lock, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  Eye,
  EyeOff,
  Upload
} from 'lucide-react';
import styles from './wizard.module.css';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import { useToast } from '@/components/Toast/ToastProvider';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/Loading/Loading';

// --- Masks ---
const unmask = (val: string) => val.replace(/\D/g, '');

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

const toCardapioSlug = (val: string) => {
  return val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const steps = [
  { number: 1, title: 'Identificação', icon: Building2 },
  { number: 2, title: 'Endereço', icon: MapPin },
  { number: 3, title: 'Configurações', icon: Settings },
  { number: 4, title: 'Contato', icon: Phone },
  { number: 5, title: 'Login', icon: Lock }
];

export default function NovoEstabelecimentoPage() {
  const router = useRouter();
  const { success, error } = useToast();
  
  // State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<'cpf' | 'cnpj'>('cnpj');
  
  // Form Data
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
    isActive: true,
    // WhatsApp connection fields (kept empty as requested to exclude UI, but maintained in state for compatibility if needed)
    baseUrl: '',
    instance: '',
    apiKey: ''
  });

  // UI States
  const [cepError, setCepError] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showLoginPasswordConfirm, setShowLoginPasswordConfirm] = useState(false);

  // Dropdown Data
  const [plans, setPlans] = useState<any[]>([]);
  const [estabTypes, setEstabTypes] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [defaultUserTypeId, setDefaultUserTypeId] = useState('');
  const [locationLocked, setLocationLocked] = useState(false);

  // Refs
  const numberInputRef = useRef<HTMLInputElement>(null);

  // Load Dropdown Data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { 'Authorization': `Bearer ${session?.access_token || ''}` };

        const [plansRes, typesRes, partnersRes, userTypesRes] = await Promise.all([
          fetch('/api/planos', { headers }),
          fetch('/api/estabelecimentos/tipos', { headers }),
          fetch('/api/parceiros', { headers }),
          fetch('/api/usuarios/tipos', { headers })
        ]);

        const plansData = await plansRes.json();
        const typesData = await typesRes.json();
        const partnersData = await partnersRes.json();
        const userTypesData = await userTypesRes.json();

        if (Array.isArray(plansData)) {
            setPlans(plansData.map((p: any) => ({
                id: p.id,
                nome_plano: p.nome_plano,
                status_plano: p.status_plano,
                valor_mensal: p.valor_mensal,
                limite_pedidos: p.limite_pedidos,
                limite_produtos: p.limite_produtos,
                limite_usuarios: p.limite_usuarios
            })));
        }
        
        if (Array.isArray(typesData)) {
            setEstabTypes(typesData);
        }

        if (Array.isArray(partnersData)) {
            setPartners(partnersData.map((p: any) => ({
                id: p.id,
                nome: p.nome,
                status: p.status,
            })));
        }

        // Set defaults
        const savedCity = localStorage.getItem('user_city');
        const savedUF = localStorage.getItem('user_uf');

        if (savedCity && savedUF) {
            setLocationLocked(true);
        }

        setFormData(prev => {
            const updates: any = {};
            
            if (savedCity && savedUF) {
                updates.city = savedCity;
                updates.state = savedUF;
            }

            if (Array.isArray(plansData) && plansData.length > 0) {
                const active = plansData.find((p: any) => p.status_plano === 'ativo') || plansData[0];
                updates.planId = active.id;
            }
            if (Array.isArray(typesData) && typesData.length > 0) {
                updates.tipo_estabelecimento_id = typesData[0].id;
            }
            if (Array.isArray(partnersData) && partnersData.length > 0) {
                const defaultPartner = partnersData.find((p: any) => p.nome === 'Parceiro Padrão');
                if (defaultPartner) {
                    updates.partner = defaultPartner.id;
                }
            }
            return { ...prev, ...updates };
        });

        if (Array.isArray(userTypesData)) {
            const estabType = userTypesData.find((t: any) => t.nome_tipo_usuario?.toLowerCase() === 'estabelecimento');
            if (estabType) {
                setDefaultUserTypeId(estabType.id);
            }
        }

      } catch (err) {
        console.error('Error loading initial data', err);
        error('Erro ao carregar dados iniciais');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Auto-fill for testing
  const autoFillForm = () => {
    const suffix = Math.floor(Math.random() * 10000);
    const randomType = estabTypes.length > 0 ? estabTypes[Math.floor(Math.random() * estabTypes.length)].id : '';
    const randomPlan = plans.length > 0 ? plans[Math.floor(Math.random() * plans.length)].id : '';
    
    const newName = `Estabelecimento Teste ${suffix}`;
    const slug = toCardapioSlug(newName);
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const prodBase = (process.env.NEXT_PUBLIC_PRODUCTION_BASE_URL as string) || (typeof window !== 'undefined' ? window.location.origin : '');
    const base = isLocal ? 'http://localhost:3000' : prodBase || 'http://lurldeproducao';
    const url = slug ? `${base}/estabelecimentos/cardapio/${slug}` : '';

    setFormData(prev => ({
      ...prev,
      name: newName,
      legalName: `Razão Social Teste ${suffix} LTDA`,
      document: docType === 'cpf' ? '123.456.789-00' : '12.345.678/0001-90',
      tipo_estabelecimento_id: randomType,
      url_cardapio: url,
      
      cep: '78557-000',
      address: 'Rua dos Testes',
      number: `${Math.floor(Math.random() * 1000)}`,
      complement: 'Sala 1',
      neighborhood: 'Bairro Teste',
      city: locationLocked ? prev.city : 'Vila Rica',
      state: locationLocked ? prev.state : 'MT',
      
      planId: randomPlan,
      
      phone: '(66) 99999-9999',
      email: `teste${suffix}@email.com`,
      whatsappMain: '(66) 99999-9999',
      whatsappKitchen: '(66) 99999-8888',
      attendantName: 'João Teste',
      attendantWhatsapp: '(66) 99999-7777',
      
      loginEmail: `admin${suffix}@teste.com`,
      loginPassword: 'Teste@123',
      loginPasswordConfirm: 'Teste@123'
    }));
    
    success('Dados de teste gerados com sucesso!');
  };

  // Handlers
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'name' && value.toLowerCase() === 'estabelecimento01') {
      autoFillForm();
      return;
    }

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
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const prodBase = (process.env.NEXT_PUBLIC_PRODUCTION_BASE_URL as string) || (typeof window !== 'undefined' ? window.location.origin : '');
      const base = isLocal ? 'http://localhost:3000' : prodBase || 'http://lurldeproducao';
      const url = slug ? `${base}/estabelecimentos/cardapio/${slug}` : '';
      setFormData(prev => ({ ...prev, url_cardapio: url }));
    }
  };

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
          
          if (numberInputRef.current) {
            numberInputRef.current.focus();
          }
        }
      } catch (err) {
        setCepError('Erro ao buscar CEP');
      } finally {
        setLoadingCep(false);
      }
    } else if (cep.length > 0) {
      setCepError('CEP incompleto');
    }
  };

  const validateStep = (currentStep: number) => {
    switch (currentStep) {
      case 1: // Identificação
        if (!formData.name) return 'Nome Fantasia é obrigatório';
        if (!formData.document) return 'CPF/CNPJ é obrigatório';
        if (!formData.tipo_estabelecimento_id) return 'Categoria é obrigatória';
        return null;
      case 2: // Endereço
        if (!formData.cep) return 'CEP é obrigatório';
        if (!formData.address) return 'Endereço é obrigatório';
        if (!formData.number) return 'Número é obrigatório';
        if (!formData.neighborhood) return 'Bairro é obrigatório';
        if (!formData.city) return 'Cidade é obrigatória';
        if (!formData.state) return 'Estado é obrigatório';
        return null;
      case 3: // Configurações
        if (!formData.planId) return 'Plano é obrigatório';
        return null;
      case 4: // Contato
        if (!formData.phone) return 'Telefone é obrigatório';
        if (!formData.email) return 'E-mail é obrigatório';
        return null;
      case 5: // Login
        if (!formData.loginEmail) return 'E-mail de login é obrigatório';
        if (!formData.loginPassword) return 'Senha é obrigatória';
        if (!formData.loginPasswordConfirm) return 'Confirmação de senha é obrigatória';
        if (formData.loginPassword !== formData.loginPasswordConfirm) return 'Senhas não conferem';
        
        const valid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(formData.loginPassword);
        if (!valid) return 'Senha deve ter 8+ caracteres, maiúscula, minúscula, número e símbolo.';
        
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const errorMsg = validateStep(step);
    if (errorMsg) {
      error(errorMsg);
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSave = async () => {
    const errorMsg = validateStep(step);
    if (errorMsg) {
      error(errorMsg);
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
        isActive: formData.isActive,
      };

      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
      };

      // 1. Create Establishment
      const res = await fetch('/api/estabelecimentos', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao criar estabelecimento');
      }

      // 2. Create User
      const userPayload = {
        name: formData.name,
        email: formData.loginEmail,
        phone: unmask(formData.phone),
        active: formData.isActive,
        profile: defaultUserTypeId,
        establishment: data?.id,
        partner: formData.partner,
        password: formData.loginPassword,
        confirmPassword: formData.loginPasswordConfirm
      };

      const userRes = await fetch('/api/usuarios', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(userPayload),
      });
      const userData = await userRes.json();
      if (!userRes.ok) {
        // If user creation fails, we might want to warn the user but the establishment was created
        // Ideally we would rollback, but for now just show error
        throw new Error(userData?.error || 'Estabelecimento criado, mas falha ao criar usuário');
      }
      
      success('Estabelecimento cadastrado com sucesso!');
      router.push('/'); // Redirect to home or login?
    } catch (e: any) {
      error(e.message || 'Erro ao salvar estabelecimento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Carregando..." fullScreen />;
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className={styles.formGrid}>
            <div className={styles.logoSection}>
              <div style={{ textAlign: 'center' }}>
                <label className={styles.label} style={{ display: 'block', marginBottom: '0.5rem' }}>LOGO</label>
                <ImageUpload 
                  value={formData.logoUrl}
                  onChange={(url) => setFormData(prev => ({ ...prev, logoUrl: url }))}
                  bucket="establishments"
                  allowAnonymous
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>TIPO DE DOCUMENTO <span className="text-red-500">*</span></label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  type="button"
                  className={`${styles.button} ${docType === 'cnpj' ? styles.buttonPrimary : styles.buttonSecondary}`}
                  onClick={() => {
                    setDocType('cnpj');
                    setFormData(prev => ({ ...prev, document: '' }));
                  }}
                  style={{ flex: 1 }}
                >
                  CNPJ
                </button>
                <button 
                  type="button"
                  className={`${styles.button} ${docType === 'cpf' ? styles.buttonPrimary : styles.buttonSecondary}`}
                  onClick={() => {
                    setDocType('cpf');
                    setFormData(prev => ({ ...prev, document: '' }));
                  }}
                  style={{ flex: 1 }}
                >
                  CPF
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>DOCUMENTO <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="document"
                value={formData.document}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder={docType === 'cpf' ? "000.000.000-00" : "00.000.000/0000-00"} 
                maxLength={docType === 'cpf' ? 14 : 18}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>NOME FANTASIA <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="Ex: Pizzaria do João" 
              />
            </div>

            <div className={styles.formGroup}>
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

            <div className={styles.formGroup}>
              <label className={styles.label}>CATEGORIA <span className="text-red-500">*</span></label>
              <select 
                name="tipo_estabelecimento_id"
                value={formData.tipo_estabelecimento_id}
                onChange={handleInputChange}
                className={styles.select}
              >
                <option value="">Selecione...</option>
                {estabTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>LINK DO CARDÁPIO (Automático)</label>
              <input 
                type="text" 
                name="url_cardapio"
                value={formData.url_cardapio}
                readOnly
                className={`${styles.input} ${styles.readOnly}`}
                style={{ backgroundColor: '#f3f4f6' }}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>CEP <span className="text-red-500">*</span></label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  name="cep"
                  value={formData.cep}
                  onChange={handleInputChange}
                  onBlur={handleCepBlur}
                  className={`${styles.input} ${cepError ? styles.inputError : ''}`}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {loadingCep && (
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                    <Loader2 className="animate-spin text-green-500" size={16} />
                  </div>
                )}
              </div>
              {cepError && <span className={styles.error}>{cepError}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>ENDEREÇO <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="Rua, Avenida..." 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>NÚMERO <span className="text-red-500">*</span></label>
              <input 
                ref={numberInputRef}
                type="text" 
                name="number"
                value={formData.number}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="123" 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>COMPLEMENTO</label>
              <input 
                type="text" 
                name="complement"
                value={formData.complement}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="Apto, Sala, Bloco..." 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>BAIRRO <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="Bairro" 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>CIDADE <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                readOnly={locationLocked}
                className={`${styles.input} ${locationLocked ? styles.readOnly : ''}`}
                style={locationLocked ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                placeholder="Cidade" 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>ESTADO <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                readOnly={locationLocked}
                className={`${styles.input} ${locationLocked ? styles.readOnly : ''}`}
                style={locationLocked ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {}}
                placeholder="UF" 
                maxLength={2}
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
            <div className={styles.fullWidth}>
              <h3 className="text-2xl font-bold text-center mb-8 text-gray-800">Escolha o plano ideal para você</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((p) => {
                  const isSelected = formData.planId === p.id;
                  const valor = p.valor_mensal 
                    ? `R$ ${Number(p.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                    : 'Grátis';
                  
                  return (
                    <div 
                      key={p.id}
                      onClick={() => setFormData(prev => ({ ...prev, planId: p.id }))}
                      className={`
                        relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer border-2 flex flex-col
                        ${isSelected 
                          ? 'border-purple-500 shadow-2xl scale-105 ring-4 ring-purple-100 z-10' 
                          : 'border-gray-100 shadow-lg hover:shadow-xl hover:-translate-y-1 bg-white'
                        }
                      `}
                    >
                      {/* Header with Gradient */}
                      <div className={`
                        p-6 text-center text-white relative overflow-hidden
                        ${isSelected 
                          ? 'bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500' 
                          : 'bg-gradient-to-br from-gray-700 to-gray-800'
                        }
                      `}>
                        <h3 className="text-2xl font-bold tracking-tight mb-1">{p.nome_plano}</h3>
                        <div className="mt-4 mb-2">
                          <span className="text-4xl font-extrabold">{valor}</span>
                          <span className="text-sm font-medium opacity-80">/mês</span>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="p-6 bg-white flex-grow flex flex-col justify-between">
                        <ul className="space-y-4 mb-8">
                           <li className="flex items-center text-gray-600">
                             <div className={`p-1 rounded-full mr-3 ${isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                               <Check size={14} strokeWidth={3} />
                             </div>
                             <span className="text-sm font-medium">
                               {p.limite_pedidos ? `${p.limite_pedidos} Pedidos/mês` : 'Pedidos Ilimitados'}
                             </span>
                           </li>
                           <li className="flex items-center text-gray-600">
                             <div className={`p-1 rounded-full mr-3 ${isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                               <Check size={14} strokeWidth={3} />
                             </div>
                             <span className="text-sm font-medium">
                               {p.limite_produtos ? `${p.limite_produtos} Produtos` : 'Produtos Ilimitados'}
                             </span>
                           </li>
                           <li className="flex items-center text-gray-600">
                             <div className={`p-1 rounded-full mr-3 ${isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                               <Check size={14} strokeWidth={3} />
                             </div>
                             <span className="text-sm font-medium">
                               {p.limite_usuarios ? `${p.limite_usuarios} Usuários` : 'Usuários Ilimitados'}
                             </span>
                           </li>
                           <li className="flex items-center text-gray-600">
                             <div className={`p-1 rounded-full mr-3 ${isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                               <Check size={14} strokeWidth={3} />
                             </div>
                             <span className="text-sm font-medium">Suporte 24/7</span>
                           </li>
                        </ul>

                        <button 
                          type="button"
                          className={`
                            w-full py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wide transition-all shadow-md
                            ${isSelected 
                              ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:shadow-lg hover:brightness-110' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                            }
                          `}
                        >
                          {isSelected ? 'Selecionado' : 'Escolher Plano'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Partner selection hidden - forced to Default Partner */}

          </div>
        );
      case 4:
        return (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>TELEFONE PRINCIPAL <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="(00) 00000-0000" 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>E-MAIL DE CONTATO <span className="text-red-500">*</span></label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="contato@empresa.com" 
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>NOME DO ATENDENTE</label>
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
              <label className={styles.label}>WHATSAPP DO ATENDENTE</label>
              <input 
                type="text" 
                name="attendantWhatsapp"
                value={formData.attendantWhatsapp}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="(00) 00000-0000" 
              />
            </div>
          </div>
        );
      case 5:
        return (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>E-MAIL DE LOGIN <span className="text-red-500">*</span></label>
              <input 
                type="email" 
                name="loginEmail"
                value={formData.loginEmail}
                onChange={handleInputChange}
                className={styles.input} 
                placeholder="login@empresa.com" 
              />
              <span className={styles.helperText}>Este e-mail será usado para acessar o painel.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>SENHA <span className="text-red-500">*</span></label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showLoginPassword ? "text" : "password"}
                  name="loginPassword"
                  value={formData.loginPassword}
                  onChange={handleInputChange}
                  className={styles.input} 
                  placeholder="********" 
                />
                <button 
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>CONFIRMAR SENHA <span className="text-red-500">*</span></label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showLoginPasswordConfirm ? "text" : "password"}
                  name="loginPasswordConfirm"
                  value={formData.loginPasswordConfirm}
                  onChange={handleInputChange}
                  className={styles.input} 
                  placeholder="********" 
                />
                <button 
                  type="button"
                  onClick={() => setShowLoginPasswordConfirm(!showLoginPasswordConfirm)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
                >
                  {showLoginPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className="mb-6 flex justify-center">
        <Link href="/" className="flex items-center gap-1 sm:gap-2 text-gray-800 font-bold text-xl no-underline hover:text-green-600 transition-colors">
          <span className="text-black tracking-tight font-extrabold text-2xl">ZAPZAP<span className="text-green-500">DELIVERY</span></span>
        </Link>
      </div>
      
      <div className={styles.title}>Novo Estabelecimento</div>
      
      {/* Stepper */}
      <div className={styles.stepper}>
        {steps.map((s, index) => (
          <React.Fragment key={s.number}>
            <div className={`${styles.step} ${step >= s.number ? styles.stepCompleted : ''} ${step === s.number ? styles.stepActive : ''}`}>
              {step > s.number ? <Check size={16} /> : s.number}
            </div>
            {index < steps.length - 1 && (
              <div className={`${styles.stepLine} ${step > s.number ? styles.stepLineActive : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className={styles.formCard}>
        <div className={styles.stepTitle}>
          {steps[step - 1].title}
        </div>
        
        {renderStepContent()}

      </div>

      <div className={styles.actions}>
        {step > 1 ? (
          <button type="button" onClick={handleBack} className={`${styles.button} ${styles.buttonSecondary}`}>
            <ChevronLeft size={16} className="mr-1" />
            Voltar
          </button>
        ) : (
          <Link href="/" className={`${styles.button} ${styles.buttonSecondary}`}>
            Cancelar
          </Link>
        )}

        {step < steps.length ? (
          <button type="button" onClick={handleNext} className={`${styles.button} ${styles.buttonPrimary}`}>
            Próximo
            <ChevronRight size={16} className="ml-1" />
          </button>
        ) : (
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving}
            className={`${styles.button} ${styles.buttonPrimary} ${saving ? styles.buttonDisabled : ''}`}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Salvando...
              </>
            ) : (
              <>
                <Check size={16} className="mr-1" />
                Concluir Cadastro
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
