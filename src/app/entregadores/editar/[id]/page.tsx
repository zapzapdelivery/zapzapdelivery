'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Store, 
  Image as ImageIcon, 
  Upload, 
  Check, 
  Loader2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Mail
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { useToast } from '@/components/Toast/ToastProvider';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import { 
  formatCEP, 
  formatCPF,
  formatPhone, 
  validateCEP,
  validateCPF 
} from '@/utils/validators';
import styles from '../../novo/novo-entregador.module.css';

export default function EditarEntregadorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { success, error: toastError } = useToast();
  const { role, establishmentId, establishmentName, loading: loadingRole } = useUserRole();

  // Refs
  const numeroInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadingCep, setLoadingCep] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [estabelecimentos, setEstabelecimentos] = useState<any[]>([]);
  
  // Password Visibility States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    veiculo: 'Moto',
    tipo_cnh: 'A',
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    complemento: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    estabelecimento_id: '',
    avatar_url: '',
    status: 'disponivel'
  });

  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    cpf: '',
    cep: ''
  });

  useEffect(() => {
    if (!loadingRole && role === 'atendente') {
      router.push('/');
    }
  }, [role, loadingRole, router]);

  useEffect(() => {
    const fetchEntregador = async () => {
      try {
        setFetching(true);
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`/api/entregadores/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (!response.ok) {
          throw new Error('Erro ao buscar dados do entregador');
        }

        const data = await response.json();
        
        setFormData({
          nome: data.nome_entregador || '',
          cpf: formatCPF(data.cpf || ''),
          telefone: formatPhone(data.telefone || ''),
          veiculo: data.veiculo || 'Moto',
          tipo_cnh: data.tipo_cnh || 'A',
          cep: formatCEP(data.cep || ''),
          endereco: data.endereco || '',
          numero: data.numero || '',
          bairro: data.bairro || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          complemento: data.complemento || '',
          email: '', // Will be filled below
          senha: '',
          confirmarSenha: '',
          estabelecimento_id: data.estabelecimento_id || '',
          avatar_url: data.imagem_entregador_url || '',
          status: data.status_entregador || 'disponivel'
        });
        setIsActive(data.status_entregador === 'disponivel');

        // Fetch email from usuarios table using the same ID
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('email')
          .eq('id', id)
          .single();
        
        if (userData) {
          setFormData(prev => ({ ...prev, email: userData.email }));
        } else {
          console.warn('User data not found in usuarios table for ID:', id);
        }

      } catch (err: any) {
        console.error(err);
        toastError(err.message || 'Erro ao carregar entregador');
        router.push('/entregadores');
      } finally {
        setFetching(false);
      }
    };

    if (!loadingRole && id) {
      fetchEntregador();
    }
  }, [id, loadingRole, router]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
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
        
        // Map API response to expected format (id, nome_estabelecimento)
        let formattedData = (data || []).map((e: any) => ({
          id: e.id,
          nome_estabelecimento: e.name || e.nome_estabelecimento
        }));

        // Se for estabelecimento e não estiver na lista, adiciona manualmente
        if (role === 'estabelecimento' && establishmentId && establishmentName) {
          const exists = formattedData.some((e: any) => e.id === establishmentId);
          if (!exists) {
            formattedData.push({ id: establishmentId, nome_estabelecimento: establishmentName });
          }
        }

        setEstabelecimentos(formattedData);
      } catch (error) {
        console.error('Erro ao buscar estabelecimentos:', error);
        setEstabelecimentos([]);
      }
    };

    if (!loadingRole) {
      fetchEstabelecimentos();
    }
  }, [role, establishmentId, establishmentName, loadingRole]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (!name) return;
    let formattedValue = value || '';

    // Autofill Logic
    if (name === 'nome' && value.toLowerCase() === 'entregador01') {
      const autofillData = {
        nome: 'Everaldo Entregador',
        cpf: formatCPF('12345678909'),
        telefone: formatPhone('65996055823'),
        email: 'everaldozsentregador@gmail.com',
        cep: formatCEP('78645000'),
        endereco: 'rua 18',
        numero: '96',
        bairro: 'Setor Sul',
        complemento: 'Kitnet03',
        cidade: 'Vila Rica',
        uf: 'MT',
        senha: '@20EndriuS26@#',
        confirmarSenha: '@20EndriuS26@#',
        status: 'disponivel',
        veiculo: 'Moto',
        tipo_cnh: 'A'
      };
      
      setFormData(prev => ({
        ...prev,
        ...autofillData
      }));
      
      // Clear errors that might have been set
      setErrors({
        email: '',
        password: '',
        confirmPassword: '',
        cpf: '',
        cep: ''
      });
      
      return;
    }

    // Apply masks
    if (name === 'telefone') formattedValue = formatPhone(value || '');
    if (name === 'email') {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setErrors(prev => ({ ...prev, email: 'E-mail inválido' }));
      } else if (!value) {
        setErrors(prev => ({ ...prev, email: '' }));
      } else {
        setErrors(prev => ({ ...prev, email: '' }));
      }
    }
    if (name === 'senha') {
      const valid = value && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
      if (value && !valid) {
        setErrors(prev => ({ ...prev, password: 'Senha fraca: use 8+ caracteres, maiúscula, minúscula, número e símbolo' }));
      } else {
        setErrors(prev => ({ ...prev, password: '' }));
      }
      
      if ((formData?.confirmarSenha || '') && value !== (formData?.confirmarSenha || '')) {
        setErrors(prev => ({ ...prev, confirmPassword: 'As senhas não conferem' }));
      } else {
        setErrors(prev => ({ ...prev, confirmPassword: '' }));
      }
    }
    if (name === 'confirmarSenha') {
      if (value !== (formData?.senha || '')) {
        setErrors(prev => ({ ...prev, confirmPassword: 'As senhas não conferem' }));
      } else {
        setErrors(prev => ({ ...prev, confirmPassword: '' }));
      }
    }
    if (name === 'cep') {
      formattedValue = formatCEP(value || '');
      // Real-time validation for CEP
      const cleanCEP = (formattedValue || '').replace(/\D/g, '');
      if (cleanCEP.length === 8) {
        setErrors(prev => ({ ...prev, cep: '' }));
      } else if (cleanCEP.length > 0) {
        setErrors(prev => ({ ...prev, cep: 'CEP incompleto' }));
      } else {
        setErrors(prev => ({ ...prev, cep: '' }));
      }
    }
    if (name === 'cpf') {
      formattedValue = formatCPF(value || '');
      // Real-time validation for CPF
      const cleanCPF = formattedValue ? formattedValue.replace(/\D/g, '') : '';
      if (cleanCPF.length === 11) {
        if (!validateCPF(cleanCPF)) {
          setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }));
        } else {
          setErrors(prev => ({ ...prev, cpf: '' }));
        }
      } else if (cleanCPF.length > 0) {
        setErrors(prev => ({ ...prev, cpf: 'CPF incompleto' }));
      } else {
        setErrors(prev => ({ ...prev, cpf: '' }));
      }
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleCepBlur = async () => {
    if (!formData.cep) return;
    const cep = String(formData.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) {
      if (cep.length > 0) setErrors(prev => ({ ...prev, cep: 'CEP inválido' }));
      return;
    }

    try {
      setLoadingCep(true);
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: data.logradouro,
          bairro: data.bairro,
          cidade: data.localidade,
          uf: data.uf
        }));
        setErrors(prev => ({ ...prev, cep: '' }));
        
        // Focar no campo número após preencher o endereço
        setTimeout(() => {
          numeroInputRef.current?.focus();
        }, 100);
      } else {
        setErrors(prev => ({ ...prev, cep: 'CEP não encontrado' }));
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
      setErrors(prev => ({ ...prev, cep: 'Erro ao buscar CEP' }));
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!formData.nome || !formData.email) {
      toastError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Se a senha for preenchida, deve ser confirmada
    if (formData.senha && formData.senha !== formData.confirmarSenha) {
      toastError('As senhas não conferem.');
      return;
    }

    if (errors?.password || errors?.email || errors?.cpf || errors?.cep) {
      toastError('Por favor, corrija os erros no formulário.');
      return;
    }

    if (!formData.cpf || !validateCPF(formData.cpf.replace(/\D/g, ''))) {
      setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }));
      toastError('CPF inválido');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/entregadores/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          ...formData,
          status: isActive ? 'disponivel' : 'inativo'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar entregador');
      }

      success('Entregador atualizado com sucesso!');
      router.push('/entregadores');
    } catch (err: any) {
      console.error('Error saving:', err);
      toastError(err.message || 'Erro ao atualizar entregador');
    } finally {
      setLoading(false);
    }
  };

  if (loadingRole || fetching) {
    return (
      <div className={styles.container}>
        <Sidebar />
        <main className={styles.mainContent}>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
            <Loader2 size={40} className="animate-spin text-blue-500" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Sidebar />
      
      <main className={styles.mainContent}>
        <Link href="/entregadores" className={styles.backLink}>
          <ArrowLeft size={16} />
          Voltar para Entregadores
        </Link>

        <div className={styles.titleSection}>
          <h1 className={styles.title}>Editar Entregador</h1>
          <p className={styles.subtitle}>Atualize as informações do profissional</p>
        </div>

        <form onSubmit={handleSave} className={styles.formGrid}>
          <div className={styles.leftColumn}>
            {/* Informações Pessoais */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <User size={20} className={styles.iconInfo} />
                <h2>Informações Pessoais</h2>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Nome Completo</label>
                <input 
                  type="text" 
                  name="nome"
                  value={formData.nome}
                  onChange={handleInputChange}
                  placeholder="Ex: João da Silva" 
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>CPF</label>
                  <div className={styles.inputWithIcon}>
                    <User size={18} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      name="cpf"
                      value={formData.cpf}
                      onChange={handleInputChange}
                      placeholder="000.000.000-00"
                      className={`${styles.input} ${styles.inputPaddingLeft} ${errors.cpf ? styles.inputError : ''}`}
                      required
                    />
                  </div>
                  {errors.cpf && (
                    <span className={styles.errorText}>
                      <AlertCircle size={14} />
                      {errors.cpf}
                    </span>
                  )}
                </div>

                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label className={styles.label}>Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    name="telefone"
                    value={formData.telefone}
                    onChange={handleInputChange}
                    placeholder="(00) 00000-0000" 
                    className={styles.input}
                    required
                  />
                </div>
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Tipo de CNH</label>
                  <select 
                    name="tipo_cnh"
                    value={formData.tipo_cnh}
                    onChange={handleInputChange}
                    className={styles.select}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="A">Categoria A (Moto)</option>
                    <option value="B">Categoria B (Carro)</option>
                    <option value="AB">Categoria AB (Moto e Carro)</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Veículo</label>
                  <select 
                    name="veiculo"
                    value={formData.veiculo}
                    onChange={handleInputChange}
                    className={styles.select}
                    required
                  >
                    <option value="">Selecione o veículo...</option>
                    <option value="Moto">Moto</option>
                    <option value="Carro">Carro</option>
                    <option value="Bicicleta">Bicicleta</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <MapPin size={20} className={styles.iconPin} />
                <h2>Endereço</h2>
              </div>

              <div className={styles.inputRowThree}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>CEP</label>
                  <div className={styles.inputWithIcon}>
                    <input 
                      type="text" 
                      name="cep"
                      value={formData.cep}
                      onChange={handleInputChange}
                      onBlur={handleCepBlur}
                      placeholder="00000-000" 
                      className={`${styles.input} ${errors.cep ? styles.inputError : ''} ${loadingCep ? styles.inputLoading : ''}`}
                      required
                    />
                    {loadingCep && <Loader2 size={16} className={`${styles.loaderIcon} animate-spin`} />}
                    {errors.cep && (
                      <span className={styles.errorText}>
                        <AlertCircle size={14} />
                        {errors.cep}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.inputGroup} style={{ flex: 2 }}>
                  <label className={styles.label}>Endereço</label>
                  <input 
                    type="text" 
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleInputChange}
                    placeholder="Rua, Avenida..." 
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.inputGroup} style={{ flex: 0.5 }}>
                  <label className={styles.label}>Número</label>
                  <input 
                    type="text" 
                    name="numero"
                    ref={numeroInputRef}
                    value={formData.numero}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>
              </div>

              <div className={styles.inputRowUF}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Bairro</label>
                  <input 
                    type="text" 
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Cidade</label>
                  <input 
                    type="text" 
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.inputGroup} style={{ flex: 0.3 }}>
                  <label className={styles.label}>UF</label>
                  <input 
                    type="text" 
                    name="uf"
                    value={formData.uf}
                    onChange={handleInputChange}
                    placeholder="UF" 
                    className={styles.input}
                    maxLength={2}
                    required
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Complemento</label>
                <input 
                  type="text" 
                  name="complemento"
                  value={formData.complemento}
                  onChange={handleInputChange}
                  placeholder="Apto, Bloco, Referência..." 
                  className={styles.input}
                />
              </div>
            </div>

            {/* Login Session */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Lock size={20} className={styles.iconLock} />
                <h2>Sessão de Login</h2>
              </div>
              
              <div className={styles.inputGroup}>
                <label className={styles.label}>E-mail de Login</label>
                <div className={styles.inputWithIcon}>
                  <Mail size={18} className={styles.inputIcon} />
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="exemplo@email.com"
                    className={`${styles.input} ${styles.inputPaddingLeft} ${errors.email ? styles.inputError : ''}`}
                    required
                  />
                </div>
                {errors.email && <span className={styles.errorText}>{errors.email}</span>}
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Nova Senha (deixe em branco para manter)</label>
                  <div className={styles.inputWithIcon}>
                    <Lock size={18} className={styles.inputIcon} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      name="senha"
                      value={formData.senha}
                      onChange={handleInputChange}
                      placeholder="Mínimo 8 caracteres"
                      className={`${styles.input} ${styles.inputPaddingLeft} ${styles.inputPaddingRight} ${errors.password ? styles.inputError : ''}`}
                    />
                    <button 
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Confirmar Nova Senha</label>
                  <div className={styles.inputWithIcon}>
                    <Lock size={18} className={styles.inputIcon} />
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      name="confirmarSenha"
                      value={formData.confirmarSenha}
                      onChange={handleInputChange}
                      placeholder="Repita a nova senha"
                      className={`${styles.input} ${styles.inputPaddingLeft} ${styles.inputPaddingRight} ${errors.confirmPassword ? styles.inputError : ''}`}
                    />
                    <button 
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.rightColumn}>
            {/* Status */}
            <div className={`${styles.card} ${styles.statusCard}`}>
              <div className={styles.statusInfo}>
                <h3>Status do Entregador</h3>
                <p>Habilitar acesso ao sistema</p>
              </div>
              <label className={styles.toggle}>
                <input 
                  type="checkbox" 
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            {/* Estabelecimento Base */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <Store size={20} className={styles.iconStore} />
                <h2>Estabelecimento Base</h2>
              </div>
              <div className={styles.inputGroup}>
                <select 
                  name="estabelecimento_id"
                  value={formData.estabelecimento_id}
                  onChange={handleInputChange}
                  className={styles.select}
                  disabled={role === 'estabelecimento' && !!establishmentId}
                  required
                >
                  <option value="">Selecione a loja...</option>
                  {Array.isArray(estabelecimentos) && estabelecimentos.map(est => (
                    <option key={est.id} value={est.id}>{est.nome_estabelecimento}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Foto de Perfil */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <ImageIcon size={20} className={styles.iconImage} />
                <h2>Foto de Perfil</h2>
              </div>
              <ImageUpload
                bucket="avatars"
                folder="entregadores"
                value={formData.avatar_url}
                onChange={(url) => setFormData(prev => ({ ...prev, avatar_url: url }))}
                label="Foto do Entregador"
                helpText="JPG, PNG até 2MB"
              />
            </div>

            {/* Ações */}
            <div className={styles.footerActions}>
              <button 
                type="button" 
                onClick={() => router.push('/entregadores')}
                className={styles.btnCancel}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading || !!errors.cpf || !!errors.cep || !!errors.email || !!errors.password || !!errors.confirmPassword}
                className={styles.btnSave}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
