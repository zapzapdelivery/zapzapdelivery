
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Check, 
  X, 
  User, 
  ImageIcon, 
  Settings,
  Lock,
  Eye,
  EyeOff,
  MapPin
} from 'lucide-react';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { usePrompt } from '@/hooks/usePrompt';
import { UnsavedChangesModal } from '@/components/Modal/UnsavedChangesModal';
import { validateCPF, formatCPF, formatCEP, validateCEP, validateEmail } from '@/utils/validators';
import styles from './novo-cliente.module.css';

interface Establishment {
  id: string;
  nome_estabelecimento: string;
}

export default function NovoClientePage() {
  const router = useRouter();
  const { success, error: toastError, warning } = useToast();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Form States
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(true); // true = ativo
  const [imagemUrl, setImagemUrl] = useState('');
  const [estabelecimentoId, setEstabelecimentoId] = useState('');

  // Password States
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  // Data States
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Address States
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [pontoReferencia, setPontoReferencia] = useState('');
  const [tipoEndereco, setTipoEndereco] = useState('casa');
  const [loadingCep, setLoadingCep] = useState(false);

  // Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isDirty, setIsDirty] = useState(false);

  // Refs
  const numeroRef = useRef<HTMLInputElement>(null);

  // Script de preenchimento automático para testes
  useEffect(() => {
    if (nome.toLowerCase() === 'clienteteste') {
      setNome('Everaldo Cliente');
      setCpf('123.456.789-09');
      setTelefone('(65) 99605-5823');
      setEmail('everaldozscliente@gmail.com');
      setCep('78645-000');
      setLogradouro('rua 18');
      setNumero('96');
      setBairro('Setor Sul');
      setComplemento('Kitnet03');
      setCidade('Vila Rica');
      setUf('MT');
      setPontoReferencia('Kitnet 03');
      setTipoEndereco('casa');
      setSenha('@20EndriuS26@#');
      setConfirmarSenha('@20EndriuS26@#');
      
      // Limpa erros de validação que possam ter surgido
      setErrors({});
    }
  }, [nome]);

  // Monitor for any changes in the form
  useEffect(() => {
    if (nome || cpf || telefone || email || imagemUrl || senha || cep || logradouro || numero || complemento || bairro || cidade || uf || pontoReferencia) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [nome, cpf, telefone, email, imagemUrl, senha, cep, logradouro, numero, complemento, bairro, cidade, uf, pontoReferencia]);

  const { showPrompt, confirmNavigation, cancelNavigation } = usePrompt(isDirty && !saving);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }

        // Fetch role and establishment from API (bypass RLS)
        const roleRes = await fetch('/api/me/role', {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const roleData = await roleRes.json();
        const role = roleData.role;
        const establishmentIdFromApi = roleData.establishment_id;
        const establishmentNameFromApi = roleData.establishment_name;

        const isSuper = role === 'admin'; 
        setIsSuperAdmin(isSuper);

        if (establishmentIdFromApi) {
            setEstabelecimentoId(establishmentIdFromApi);
        }

        if (isSuper) {
             const response = await fetch('/api/estabelecimentos', {
                headers: { Authorization: `Bearer ${session.access_token}` }
             });
             const data = await response.json();
             
             if (response.ok) {
                const formattedData = (data || []).map((e: any) => ({
                    id: e.id,
                    nome_estabelecimento: e.name || e.nome_estabelecimento
                }));
                setEstablishments(formattedData);
             }
        } else if (establishmentIdFromApi) {
             if (establishmentNameFromApi) {
                setEstablishments([{ id: establishmentIdFromApi, nome_estabelecimento: establishmentNameFromApi }]);
             } else {
                 // Fallback fetch just in case name is missing from API
                 const { data: estab } = await supabase
                .from('estabelecimentos')
                .select('id, nome_estabelecimento')
                .eq('id', establishmentIdFromApi)
                .single();
                if (estab) {
                    setEstablishments([estab]);
                }
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
  }, [router, toastError]);

  // Masks & Validation
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    
    if (formatted.length >= 14) {
        if (!validateCPF(formatted)) {
            setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }));
        } else {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.cpf;
                return newErrors;
            });
        }
    } else {
        // Remove error while typing if length < 14 (incomplete)
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.cpf;
            return newErrors;
        });
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCEP(e.target.value);
      setCep(formatted);
      
      // Clear error on change
      setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.cep;
          return newErrors;
      });
      
      if (formatted.replace(/\D/g, '').length === 8) {
          fetchAddress(formatted);
      }
  };

  const fetchAddress = async (cepValue: string) => {
      try {
          setLoadingCep(true);
          const cleanCep = cepValue.replace(/\D/g, '');
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          const data = await response.json();
          
          if (data.erro) {
              setErrors(prev => ({ ...prev, cep: 'CEP inválido' }));
              setLogradouro('');
              setBairro('');
              setCidade('');
              setUf('');
              return;
          }
          
          setLogradouro(data.logradouro);
          setBairro(data.bairro);
          setCidade(data.localidade);
          setUf(data.uf);
          
          // Focus number
          numeroRef.current?.focus();
          
      } catch (err) {
          console.error('Error fetching CEP:', err);
          setErrors(prev => ({ ...prev, cep: 'Erro ao buscar CEP' }));
      } finally {
          setLoadingCep(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Basic validation
      const newErrors: { [key: string]: string } = {};
      if (!nome) newErrors.nome = 'Nome é obrigatório';
      if (!email) newErrors.email = 'E-mail é obrigatório';
      if (email && !validateEmail(email)) newErrors.email = 'E-mail inválido';
      if (!senha) newErrors.senha = 'Senha é obrigatória';
      if (senha && senha.length < 6) newErrors.senha = 'A senha deve ter pelo menos 6 caracteres';
      if (senha !== confirmarSenha) newErrors.confirmarSenha = 'As senhas não coincidem';
      if (isSuperAdmin && !estabelecimentoId) newErrors.estabelecimentoId = 'Selecione um estabelecimento';
      
      if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          toastError('Por favor, corrija os erros no formulário.');
          return;
      }

      try {
          setSaving(true);
          const { data: { session } } = await supabase.auth.getSession();
          
          const payload = {
              estabelecimento_id: estabelecimentoId,
              nome_cliente: nome,
              email,
              cpf,
              telefone,
              status_cliente: status ? 'ativo' : 'inativo',
              imagem_cliente_url: imagemUrl,
              senha,
              // Address fields
              cep,
              endereco: logradouro,
              numero,
              complemento,
              bairro,
              cidade,
              uf,
              ponto_referencia: pontoReferencia,
              tipo_endereco: tipoEndereco
          };

          const response = await fetch('/api/clientes', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (!response.ok) {
              throw new Error(data.error || 'Erro ao cadastrar cliente');
          }

          success('Cliente cadastrado com sucesso!');
          router.push('/clientes');
          
      } catch (err: any) {
          console.error('Error saving client:', err);
          toastError(err.message || 'Erro ao cadastrar cliente');
      } finally {
          setSaving(false);
      }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <p>Carregando dados...</p>
      </div>
    );
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      if (value && !validateEmail(value)) {
          setErrors(prev => ({ ...prev, email: 'E-mail inválido' }));
      } else {
          setErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors.email;
              return newErrors;
          });
      }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    setTelefone(value);
  };

  return (
    <div className={styles.container}>
      <UnsavedChangesModal 
        isOpen={showPrompt}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
      />

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mobileOnly}>
        <MobileHeader 
          onMenuClick={() => setIsSidebarOpen(true)} 
          title="Novo Cliente"
          subtitle="Cadastre um novo cliente"
          showGreeting={false}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.desktopOnly}>
          <AdminHeader />
          
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <Link href="/clientes" className={styles.backButton}>
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className={styles.title}>Novo Cliente</h1>
                <p className={styles.subtitle}>Cadastre um novo cliente no sistema</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.mobileOnly} style={{ marginBottom: '1rem', marginTop: '-0.5rem' }}>
          <Link href="/clientes" className={styles.backButton} style={{ marginBottom: '0' }}>
            <ArrowLeft size={20} />
            <span>Voltar</span>
          </Link>
        </div>

        <div className={styles.formGrid}>
          {/* Main Column */}
          <div className={styles.mainColumn}>
            {/* Identification Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <User size={20} className={styles.cardIcon} />
                Identificação
              </h2>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome Completo</label>
                <input 
                  type="text" 
                  className={`${styles.input} ${errors.nome ? styles.inputError : ''}`} 
                  placeholder="Ex: João da Silva"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (errors.nome) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.nome;
                        return newErrors;
                      });
                    }
                  }}
                />
                {errors.nome && <div className={styles.errorText}>{errors.nome}</div>}
              </div>

              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>CPF</label>
                  <input 
                    type="text" 
                    className={`${styles.input} ${errors.cpf ? styles.inputError : ''}`}
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    maxLength={14}
                  />
                  {errors.cpf && <div className={styles.errorText}>{errors.cpf}</div>}
                </div>
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>Telefone</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="(00) 00000-0000"
                    value={telefone}
                    onChange={handlePhoneChange}
                    maxLength={15}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>E-mail</label>
                <input 
                  type="email" 
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  placeholder="cliente@email.com"
                  value={email}
                  onChange={handleEmailChange}
                />
                {errors.email && <div className={styles.errorText}>{errors.email}</div>}
              </div>
            </div>

            {/* Endereço */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <MapPin size={20} className={styles.cardIcon} />
                Endereço
              </h2>

              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.col}`} style={{ flex: '0 0 140px' }}>
                  <label className={styles.label}>CEP</label>
                  <input 
                    type="text" 
                    className={`${styles.input} ${errors.cep ? styles.inputError : ''}`}
                    placeholder="00000-000"
                    value={cep}
                    onChange={handleCepChange}
                    maxLength={9}
                  />
                  {errors.cep && <div className={styles.errorText}>{errors.cep}</div>}
                </div>
                <div className={`${styles.formGroup} ${styles.col}`} style={{ flex: 1 }}>
                  <label className={styles.label}>Logradouro</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Rua, Avenida, etc."
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.col}`} style={{ flex: '0 0 100px' }}>
                  <label className={styles.label}>Número</label>
                  <input 
                    ref={numeroRef}
                    type="text" 
                    className={styles.input} 
                    placeholder="123"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>Bairro</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Bairro"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>Complemento</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Apto, Bloco, etc."
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>Cidade</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.col}`} style={{ flex: '0 0 80px' }}>
                  <label className={styles.label}>UF</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="UF"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className={styles.row}>
                 <div className={`${styles.formGroup} ${styles.col}`}>
                    <label className={styles.label}>Ponto de Referência</label>
                    <input 
                        type="text" 
                        className={styles.input} 
                        placeholder="Próximo a..."
                        value={pontoReferencia}
                        onChange={(e) => setPontoReferencia(e.target.value)}
                    />
                 </div>
                 <div className={`${styles.formGroup} ${styles.col}`}>
                    <label className={styles.label}>Tipo de Endereço</label>
                    <select 
                        className={styles.select}
                        value={tipoEndereco}
                        onChange={(e) => setTipoEndereco(e.target.value)}
                    >
                        <option value="casa">Casa</option>
                        <option value="trabalho">Trabalho</option>
                        <option value="outro">Outro</option>
                    </select>
                 </div>
              </div>
            </div>

            {/* Acesso ao Sistema */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <Lock size={20} className={styles.cardIcon} />
                Acesso ao Sistema
              </h2>
              
              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>Senha</label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} size={20} />
                    <input 
                      type={showSenha ? "text" : "password"} 
                      className={`${styles.input} ${styles.inputWithIcon} ${errors.senha ? styles.inputError : ''}`} 
                      placeholder="••••••••"
                      value={senha}
                      onChange={(e) => {
                        setSenha(e.target.value);
                        if (errors.senha) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.senha;
                            return newErrors;
                          });
                        }
                      }}
                    />
                    <button 
                      type="button"
                      className={styles.eyeIcon}
                      onClick={() => setShowSenha(!showSenha)}
                      aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.senha && <div className={styles.errorText}>{errors.senha}</div>}
                </div>
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>Confirmar Senha</label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} size={20} />
                    <input 
                      type={showConfirmarSenha ? "text" : "password"} 
                      className={`${styles.input} ${styles.inputWithIcon} ${errors.confirmarSenha ? styles.inputError : ''}`} 
                      placeholder="••••••••"
                      value={confirmarSenha}
                      onChange={(e) => {
                        setConfirmarSenha(e.target.value);
                        if (errors.confirmarSenha) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.confirmarSenha;
                            return newErrors;
                          });
                        }
                      }}
                    />
                    <button 
                      type="button"
                      className={styles.eyeIcon}
                      onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                      aria-label={showConfirmarSenha ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmarSenha && <div className={styles.errorText}>{errors.confirmarSenha}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className={styles.sideColumn}>
            {/* Status Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Status do Cliente</h2>
              <div className={styles.switchContainer}>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>Ativar ou inativar cliente</span>
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
            </div>

            {/* Media Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <ImageIcon size={20} className={styles.cardIcon} />
                Mídia
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <ImageUpload 
                    value={imagemUrl} 
                    onChange={setImagemUrl} 
                    bucket="avatars"
                    folder="clientes"
                    showUrlInput={false}
                    className={styles.circularUpload}
                />
              </div>
              <div className={styles.formGroup} style={{ display: imagemUrl ? 'none' : 'block' }}>
                <label className={styles.label}>URL da Imagem</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="https://..."
                  value={imagemUrl}
                  onChange={(e) => setImagemUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Configurações Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <Settings size={20} className={styles.cardIcon} />
                Configurações
              </h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>Estabelecimento</label>
                <select 
                    className={`${styles.select} ${errors.estabelecimentoId ? styles.inputError : ''}`}
                    value={estabelecimentoId}
                    onChange={(e) => {
                      setEstabelecimentoId(e.target.value);
                      if (errors.estabelecimentoId) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.estabelecimentoId;
                          return newErrors;
                        });
                      }
                    }}
                    disabled={!isSuperAdmin}
                >
                    <option value="">Selecione um local</option>
                    {establishments.map(estab => (
                        <option key={estab.id} value={estab.id}>
                            {estab.nome_estabelecimento}
                        </option>
                    ))}
                </select>
                {errors.estabelecimentoId && <div className={styles.errorText}>{errors.estabelecimentoId}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button 
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={() => router.push('/clientes')}
          >
            <X size={18} />
            Cancelar
          </button>
          <button 
            className={`${styles.button} ${styles.saveButton}`}
            onClick={handleSubmit}
            disabled={saving}
          >
            <Check size={18} />
            {saving ? 'Salvando...' : 'Salvar Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
