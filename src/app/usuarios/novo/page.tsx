"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { supabase } from '@/lib/supabase';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { ArrowLeft, Mail, Phone, Check, Fingerprint, Eye, EyeOff, Lock } from 'lucide-react';
import styles from './novo-usuario.module.css';
import { useToast } from '@/components/Toast/ToastProvider';
import { useEstablishment } from '@/hooks/useEstablishment';
import { useUserRole } from '@/hooks/useUserRole';
import { ImageUpload } from '@/components/Upload/ImageUpload';

export default function NovoUsuarioPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success, error: showError } = useToast();
  const { establishmentId: currentEstabId } = useEstablishment();
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    active: true,
    profile: '',
    establishment: '',
    partner: '',
    password: '',
    confirmPassword: '',
    avatar_url: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [userTypes, setUserTypes] = useState<any[]>([]);
  const { role, loading: loadingRole } = useUserRole();

  React.useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  React.useEffect(() => {
    async function fetchUserTypes() {
      try {
        const response = await fetch('/api/usuarios/tipos');
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setUserTypes(data);
        }
      } catch (error) {
        console.error('Erro ao buscar tipos de usuário:', error);
      }
    }
    fetchUserTypes();
  }, []);

  React.useEffect(() => {
    async function fetchEstablishments() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch('/api/estabelecimentos', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar estabelecimentos');
        }

        const data = await response.json();
        
        // Map API response to expected format
        const formattedData = (data || []).map((e: any) => ({
          id: e.id,
          nome_estabelecimento: e.name || e.nome_estabelecimento
        }));

        setEstablishments(formattedData);
      } catch (error) {
        console.error('Erro ao buscar estabelecimentos:', error);
      }
    }
    fetchEstablishments();
  }, []);

  React.useEffect(() => {
    async function fetchPartners() {
      try {
        const response = await fetch('/api/parceiros');
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          setPartners(data);
        }
      } catch (error) {
        console.error('Erro ao buscar parceiros:', error);
      }
    }
    fetchPartners();
  }, []);

  React.useEffect(() => {
    if (role === 'estabelecimento' && currentEstabId) {
      setFormData(prev => ({ ...prev, establishment: currentEstabId }));
    }
  }, [role, currentEstabId]);

  const filteredUserTypes = React.useMemo(() => {
    if (role === 'estabelecimento') {
      const restricted = ['administrador', 'admin_plataforma', 'estabelecimento', 'parceiro', 'proprietario'];
      return userTypes.filter(t => !restricted.includes(t.nome_tipo_usuario?.toLowerCase()));
    }
    return userTypes;
  }, [userTypes, role]);

  const filteredEstablishments = React.useMemo(() => {
    if (role === 'estabelecimento' && currentEstabId) {
      return establishments.filter(e => e.id === currentEstabId);
    }
    return establishments;
  }, [establishments, role, currentEstabId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    // Mask: (00) 00000-0000
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 9) {
      value = `${value.slice(0, 9)}-${value.slice(9)}`;
    }
    
    setFormData(prev => ({
      ...prev,
      phone: value
    }));
  };

  const handleToggle = () => {
    setFormData(prev => ({
      ...prev,
      active: !prev.active
    }));
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone) {
      showError('Por favor, preencha os campos obrigatórios (Nome, E-mail, Telefone).');
      return;
    }

    if (formData.password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!passwordRegex.test(formData.password)) {
        showError('A senha deve conter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e símbolo.');
        return;
      }
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      showError('As senhas não conferem.');
      return;
    }

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }

      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar usuário');
      }

      success('Usuário criado com sucesso!');
      router.push('/usuarios');
    } catch (err: any) {
      console.error('Erro:', err);
      showError(err.message || 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mobileOnly}>
        <MobileHeader 
          onMenuClick={() => setIsSidebarOpen(true)} 
          title="Novo Usuário"
          subtitle="Cadastre um novo membro"
          showGreeting={false}
        />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <Link href="/usuarios" className={styles.backLink}>
            <ArrowLeft size={16} />
            Voltar para Usuários
          </Link>
          <h1 className={styles.pageTitle}>Novo Usuário</h1>
        </div>

        <div className={styles.mobileOnly} style={{ marginBottom: '1rem', marginTop: '-0.5rem' }}>
          <Link href="/usuarios" className={styles.backLink} style={{ marginBottom: '0' }}>
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </div>

        <div className={styles.formGrid}>
          {/* Left Column - Personal Info */}
          <div className={styles.leftColumn}>
            <h2 className={styles.sectionTitle}>Informações Pessoais</h2>
            <span className={styles.sectionSubtitle}>
              Preencha os dados básicos de identificação.
            </span>

            <div className={styles.formGroup}>
              <label className={styles.label}>Avatar do Usuário</label>
              <div style={{ marginBottom: '1rem' }}>
                <ImageUpload
                  bucket="avatars"
                  folder="usuarios"
                  value={formData.avatar_url}
                  onChange={(url) => setFormData(prev => ({ ...prev, avatar_url: url }))}
                  helpText="Recomendado: 400x400px, máx 2MB"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Nome Completo</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Digite o nome completo do usuário"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>E-mail Corporativo</label>
              <div className={styles.inputWrapper}>
                <Mail className={styles.inputIcon} size={20} />
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  placeholder="usuario@zapzap.com"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Telefone / WhatsApp</label>
              <div className={styles.inputWrapper}>
                <Phone className={styles.inputIcon} size={20} />
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h2 className={styles.sectionTitle}>Dados de Login</h2>
              <span className={styles.sectionSubtitle}>
                Defina a senha de acesso (opcional).
              </span>

              <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
                <label className={styles.label}>Senha</label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={20} />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={styles.eyeIcon}
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                  Requisitos: Mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.
                </span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Confirmar Senha</label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={20} />
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={styles.eyeIcon}
                    aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Settings */}
          <div className={styles.rightColumn}>
            <div className={styles.toggleCard}>
              <div>
                <span className={styles.toggleLabel}>Status do Usuário</span>
                <span className={styles.toggleSubLabel}>Habilitar acesso ao sistema</span>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={formData.active}
                  onChange={handleToggle}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <h2 className={styles.sectionTitle}>Configurações de Acesso</h2>

            <div className={styles.formGroup}>
              <label className={styles.label}>Perfil de Acesso</label>
              <select 
                name="profile"
                value={formData.profile}
                onChange={handleInputChange}
                className={styles.select}
              >
                <option value="">Selecione um perfil</option>
                {filteredUserTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.nome_tipo_usuario}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Estabelecimento</label>
              <select 
                name="establishment"
                value={formData.establishment}
                onChange={handleInputChange}
                className={styles.select}
                disabled={role === 'estabelecimento'}
              >
                <option value="">Selecione a unidade</option>
                {filteredEstablishments.map((estab) => (
                  <option key={estab.id} value={estab.id}>
                    {estab.nome_estabelecimento}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Parceiro</label>
              <select 
                name="partner"
                value={formData.partner}
                onChange={handleInputChange}
                className={styles.select}
              >
                <option value="">Vincular a um parceiro</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.btnCancel}
            onClick={() => router.push('/usuarios')}
          >
            Cancelar
          </button>
          <button className={styles.btnSave} onClick={handleSubmit} disabled={saving}>
            <Check size={20} />
            {saving ? 'Salvando...' : 'Salvar Usuário'}
          </button>
        </div>
      </main>
    </div>
  );
}
