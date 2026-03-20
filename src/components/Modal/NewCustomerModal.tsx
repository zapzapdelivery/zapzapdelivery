import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2
} from 'lucide-react';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { validateCPF, formatCPF, formatCEP, validateEmail } from '@/utils/validators';
import styles from './NewCustomerModal.module.css';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: any) => void;
  establishmentId: string;
}

export function NewCustomerModal({ isOpen, onClose, onSuccess, establishmentId }: NewCustomerModalProps) {
  const { success, error: toastError } = useToast();
  
  // Form States
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(true); // true = ativo
  const [imagemUrl, setImagemUrl] = useState('');
  
  // Password States
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

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

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const numeroRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNome('');
      setCpf('');
      setTelefone('');
      setEmail('');
      setStatus(true);
      setImagemUrl('');
      setSenha('');
      setConfirmarSenha('');
      setCep('');
      setLogradouro('');
      setNumero('');
      setComplemento('');
      setBairro('');
      setCidade('');
      setUf('');
      setPontoReferencia('');
      setTipoEndereco('casa');
      setErrors({});
    }
  }, [isOpen]);

  // Test script
  useEffect(() => {
    if (nome.toLowerCase() === 'clienteteste') {
      setNome('Cliente Modal Teste');
      setCpf('123.456.789-09');
      setTelefone('(65) 99605-5823');
      setEmail(`cliente.modal.${Date.now()}@teste.com`);
      setCep('78645-000');
      setLogradouro('Rua Teste');
      setNumero('123');
      setBairro('Centro');
      setCidade('Cidade Teste');
      setUf('MT');
      setSenha('123456');
      setConfirmarSenha('123456');
      setErrors({});
    }
  }, [nome]);

  // Handlers
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    if (formatted.length >= 14 && !validateCPF(formatted)) {
      setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.cpf;
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

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value);
    setCep(formatted);
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
        return;
      }
      
      setLogradouro(data.logradouro);
      setBairro(data.bairro);
      setCidade(data.localidade);
      setUf(data.uf);
      numeroRef.current?.focus();
      
    } catch (err) {
      console.error('Error fetching CEP:', err);
      setErrors(prev => ({ ...prev, cep: 'Erro ao buscar CEP' }));
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    const newErrors: { [key: string]: string } = {};
    if (!nome) newErrors.nome = 'Nome é obrigatório';
    if (!email) newErrors.email = 'E-mail é obrigatório';
    if (email && !validateEmail(email)) newErrors.email = 'E-mail inválido';
    if (!senha) newErrors.senha = 'Senha é obrigatória';
    if (senha && senha.length < 6) newErrors.senha = 'Mínimo 6 caracteres';
    if (senha !== confirmarSenha) newErrors.confirmarSenha = 'Senhas não conferem';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toastError('Verifique os erros no formulário');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        estabelecimento_id: establishmentId,
        nome_cliente: nome,
        email,
        cpf,
        telefone,
        status_cliente: status ? 'ativo' : 'inativo',
        imagem_cliente_url: imagemUrl,
        senha,
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
        // Tratamento específico para CPF duplicado
        if (data.error && data.error.includes('Já existe um cliente cadastrado com este CPF')) {
          setErrors(prev => ({ ...prev, cpf: 'Este CPF já está em uso.' }));
          toastError('Este CPF já está em uso.');
          return;
        }

        // Tratamento específico para Telefone duplicado
        if (data.error && data.error.includes('Já existe um cliente cadastrado com este Telefone')) {
          setErrors(prev => ({ ...prev, telefone: 'Este telefone já está em uso.' }));
          toastError('Já existe um cliente cadastrado com este Telefone');
          return;
        }

        throw new Error(data.error || 'Erro ao cadastrar cliente');
      }

      success('Cliente cadastrado com sucesso!');
      onSuccess(data); // Pass back the new customer data
      onClose();
      
    } catch (err: any) {
      console.error('Error saving client:', err);
      toastError(err.message || 'Erro ao cadastrar cliente');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2>
              <User size={24} className={styles.cardIcon} />
              Novo Cliente
            </h2>
            <p>Preencha os dados para cadastrar</p>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formGrid}>
            {/* Main Column */}
            <div className={styles.mainColumn}>
              {/* Identification */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Identificação</h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nome Completo *</label>
                  <input 
                    type="text" 
                    className={`${styles.input} ${errors.nome ? styles.inputError : ''}`}
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Nome do cliente"
                  />
                  {errors.nome && <div className={styles.errorText}>{errors.nome}</div>}
                </div>

                <div className={styles.row}>
                  <div className={`${styles.formGroup} ${styles.col}`}>
                    <label className={styles.label}>CPF</label>
                    <input 
                      type="text" 
                      className={`${styles.input} ${errors.cpf ? styles.inputError : ''}`}
                      value={cpf}
                      onChange={handleCpfChange}
                      maxLength={14}
                      placeholder="000.000.000-00"
                    />
                    {errors.cpf && <div className={styles.errorText}>{errors.cpf}</div>}
                  </div>
                  <div className={`${styles.formGroup} ${styles.col}`}>
                    <label className={styles.label}>Telefone</label>
                    <input 
                      type="text" 
                      className={`${styles.input} ${errors.telefone ? styles.inputError : ''}`}
                      value={telefone}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      placeholder="(00) 00000-0000"
                    />
                    {errors.telefone && <div className={styles.errorText}>{errors.telefone}</div>}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>E-mail *</label>
                  <input 
                    type="email" 
                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                  {errors.email && <div className={styles.errorText}>{errors.email}</div>}
                </div>
              </div>

              {/* Address */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <MapPin size={20} className={styles.cardIcon} />
                  Endereço
                </h3>

                <div className={styles.row}>
                  <div className={`${styles.formGroup}`} style={{ width: '140px' }}>
                    <label className={styles.label}>CEP</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        className={`${styles.input} ${errors.cep ? styles.inputError : ''}`}
                        value={cep}
                        onChange={handleCepChange}
                        maxLength={9}
                        placeholder="00000-000"
                      />
                      {loadingCep && (
                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                          <Loader2 size={16} className="animate-spin text-emerald-500" />
                        </div>
                      )}
                    </div>
                    {errors.cep && <div className={styles.errorText}>{errors.cep}</div>}
                  </div>
                  <div className={`${styles.formGroup} ${styles.col}`}>
                    <label className={styles.label}>Logradouro</label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={logradouro}
                      onChange={e => setLogradouro(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={`${styles.formGroup}`} style={{ width: '100px' }}>
                    <label className={styles.label}>Número</label>
                    <input 
                      ref={numeroRef}
                      type="text" 
                      className={styles.input}
                      value={numero}
                      onChange={e => setNumero(e.target.value)}
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.col}`}>
                    <label className={styles.label}>Bairro</label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={bairro}
                      onChange={e => setBairro(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={`${styles.formGroup} ${styles.col}`}>
                    <label className={styles.label}>Cidade</label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={cidade}
                      onChange={e => setCidade(e.target.value)}
                    />
                  </div>
                  <div className={`${styles.formGroup}`} style={{ width: '60px' }}>
                    <label className={styles.label}>UF</label>
                    <input 
                      type="text" 
                      className={styles.input}
                      value={uf}
                      onChange={e => setUf(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Complemento</label>
                  <input 
                    type="text" 
                    className={styles.input}
                    value={complemento}
                    onChange={e => setComplemento(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Side Column */}
            <div className={styles.sideColumn}>
              {/* Photo */}
              <div className={styles.card}>
                <div className={styles.circularUpload}>
                  <ImageUpload
                    value={imagemUrl}
                    onChange={setImagemUrl}
                    bucket="avatars"
                    folder="clientes"
                    label="Foto do Cliente"
                    showUrlInput={false}
                    className={styles.avatarUploader}
                  />
                </div>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <p className={styles.label}>Foto do Cliente</p>
                </div>
              </div>

              {/* Status */}
              <div className={styles.card}>
                <div className={styles.switchContainer}>
                  <div className={styles.switchLabel}>
                    <span className={styles.switchTitle}>Status</span>
                    <span className={styles.switchDescription}>
                      {status ? 'Cliente Ativo' : 'Cliente Inativo'}
                    </span>
                  </div>
                  <label className={styles.switch}>
                    <input 
                      type="checkbox" 
                      checked={status}
                      onChange={e => setStatus(e.target.checked)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>
              </div>

              {/* Password */}
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <Lock size={20} className={styles.cardIcon} />
                  Acesso
                </h3>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showSenha ? "text" : "password"}
                      className={`${styles.input} ${errors.senha ? styles.inputError : ''}`}
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      style={{ 
                        position: 'absolute', 
                        right: '10px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8'
                      }}
                    >
                      {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.senha && <div className={styles.errorText}>{errors.senha}</div>}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Confirmar Senha *</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showConfirmarSenha ? "text" : "password"}
                      className={`${styles.input} ${errors.confirmarSenha ? styles.inputError : ''}`}
                      value={confirmarSenha}
                      onChange={e => setConfirmarSenha(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                      style={{ 
                        position: 'absolute', 
                        right: '10px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8'
                      }}
                    >
                      {showConfirmarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.confirmarSenha && <div className={styles.errorText}>{errors.confirmarSenha}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button 
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button 
            className={`${styles.button} ${styles.saveButton}`}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={18} />
                Salvar Cliente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
