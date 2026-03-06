'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Check, 
  X, 
  User, 
  ImageIcon, 
  Settings,
  MapPin
} from 'lucide-react';
import { ImageUpload } from '@/components/Upload/ImageUpload';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/Header/AdminHeader';
import { useToast } from '@/components/Toast/ToastProvider';
import { validateCPF, formatCPF, formatCEP, validateCEP, validateEmail } from '@/utils/validators';
import styles from '../../novo/novo-cliente.module.css';

interface Establishment {
  id: string;
  nome_estabelecimento: string;
}

export default function EditarClientePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { success, error: toastError, warning } = useToast();

  // Form States
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(true); // true = ativo
  const [imagemUrl, setImagemUrl] = useState('');
  const [estabelecimentoId, setEstabelecimentoId] = useState('');

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
  const [addressId, setAddressId] = useState<string | null>(null); // To update existing address
  const [loadingCep, setLoadingCep] = useState(false);

  // Data States
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Refs
  const numeroRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }

        // 1. Fetch User Profile & Establishments (similar to Novo)
        const roleRes = await fetch('/api/me/role', {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const roleData = await roleRes.json();
        const role = roleData.role;
        const establishmentIdFromApi = roleData.establishment_id;
        const establishmentNameFromApi = roleData.establishment_name;

        const isSuper = role === 'admin';
        setIsSuperAdmin(isSuper);

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

        // 2. Fetch Client Data
        const response = await fetch(`/api/clientes/${id}`, {
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                toastError('Cliente não encontrado');
                router.push('/clientes');
                return;
            }
            throw new Error('Erro ao buscar cliente');
        }

        const client = await response.json();
        
        setNome(client.nome_cliente || '');
        setCpf(client.cpf || '');
        setTelefone(client.telefone || '');
        setEmail(client.email || '');
        setStatus(client.status_cliente === 'ativo' || client.status_cliente === 'Ativo');
        setImagemUrl(client.imagem_cliente_url || '');
        setEstabelecimentoId(client.estabelecimento_id || '');

        // 3. Fetch Client Address
        const addrResponse = await fetch(`/api/clientes/${id}/enderecos`, {
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });

        if (addrResponse.ok) {
            const addresses = await addrResponse.json();
            if (addresses && addresses.length > 0) {
                const addr = addresses[0]; // Take the first address
                setAddressId(addr.id);
                setCep(addr.cep || '');
                setLogradouro(addr.endereco || '');
                setNumero(addr.numero || '');
                setComplemento(addr.complemento || '');
                setBairro(addr.bairro || '');
                setCidade(addr.cidade || '');
                setUf(addr.uf || '');
                // Since columns removed, we keep state empty or could parse from complemento
                // setPontoReferencia(addr.ponto_referencia || '');
                // setTipoEndereco(addr.tipo_endereco || 'casa');
            }
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        toastError('Erro ao carregar dados do cliente.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
        fetchData();
    }
  }, [id, router, toastError]);

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
      
      const cleanCep = formatted.replace(/\D/g, '');

      if (cleanCep.length === 8) {
          if (validateCEP(formatted)) {
              setErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.cep;
                  return newErrors;
              });
              fetchAddress(formatted);
          } else {
              setErrors(prev => ({ ...prev, cep: 'CEP inválido' }));
          }
      } else if (cleanCep.length > 0 && cleanCep.length < 8) {
           setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.cep;
                return newErrors;
           });
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
          setErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors.cep;
              return newErrors;
          });
          
          setTimeout(() => {
             numeroRef.current?.focus();
          }, 100);
          
      } catch (err) {
          console.error('Error fetching CEP:', err);
          setErrors(prev => ({ ...prev, cep: 'Erro ao buscar CEP' }));
      } finally {
          setLoadingCep(false);
      }
  };
  
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

  const handleSave = async () => {
    // Validation
    if (!nome.trim()) {
      warning('Por favor, informe o nome do cliente.');
      return;
    }
    
    if (!estabelecimentoId) {
        warning('Por favor, selecione um estabelecimento.');
        return;
    }

    if (email && !validateEmail(email)) {
        warning('E-mail inválido.');
        return;
    }

    // Address Validations
    if (cep) {
        if (!logradouro.trim() || !bairro.trim() || !cidade.trim() || !uf.trim() || !numero.trim()) {
            warning('Ao informar o CEP, preencha também Logradouro, Número, Bairro, Cidade e UF.');
            return;
        }
    }

    if (errors.cpf || errors.cep || errors.email) {
        warning('Corrija os erros no formulário para continuar.');
        return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();

      const payload = {
        estabelecimento_id: estabelecimentoId,
        nome_cliente: nome,
        email: email || null,
        cpf: cpf || null,
        telefone: telefone || null,
        status_cliente: status ? 'ativo' : 'inativo',
        imagem_cliente_url: imagemUrl || null,
        // Address Data (Flat) - API will handle update/insert
        address_id: addressId || null,
        cep: cep || null,
        endereco: logradouro || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        uf: uf || null,
        ponto_referencia: pontoReferencia || null,
        tipo_endereco: tipoEndereco || 'casa'
      };

      const response = await fetch(`/api/clientes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar cliente');
      }
      
      success('Cliente atualizado com sucesso!');
      router.push('/clientes');

    } catch (err: any) {
      console.error('Error updating client:', err);
      toastError('Erro ao salvar cliente: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
      return (
        <div className={styles.container}>
            <Sidebar />
            <div className={styles.content}>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#6b7280' }}>
                    Carregando dados...
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
            <Link href="/clientes" className={styles.backLink}>
              ← Voltar para Clientes
            </Link>
            <h1 className={styles.title}>Editar Cliente</h1>
            <p className={styles.subtitle}>Atualize as informações do cliente abaixo.</p>
          </div>

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

            {/* Photo Card */}
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
                  className={styles.circularUpload}
                  showUrlInput={false}
                />
              </div>
              {!imagemUrl && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>URL da Imagem (Opcional)</label>
                    <input 
                      type="text" 
                      className={styles.input} 
                      placeholder="https://..."
                      value={imagemUrl}
                      onChange={(e) => setImagemUrl(e.target.value)}
                    />
                  </div>
              )}
            </div>

            {/* Establishment Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <Settings size={20} className={styles.cardIcon} />
                Estabelecimento
              </h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>Vincular a</label>
                <select 
                  className={styles.select}
                  value={estabelecimentoId}
                  onChange={(e) => setEstabelecimentoId(e.target.value)}
                  disabled={!isSuperAdmin}
                >
                  <option value="">Selecione...</option>
                  {establishments.map(est => (
                    <option key={est.id} value={est.id}>
                      {est.nome_estabelecimento}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                  className={styles.input} 
                  placeholder="Ex: João da Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
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
                  className={styles.input} 
                  placeholder="cliente@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Address Card */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <MapPin size={20} className={styles.cardIcon} />
                Endereços
              </h2>
              
              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.col}`}>
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
                <div className={`${styles.formGroup} ${styles.col}`}>
                  <label className={styles.label}>Tipo de Endereço</label>
                  <select 
                    className={styles.select}
                    value={tipoEndereco}
                    onChange={(e) => setTipoEndereco(e.target.value)}
                  >
                    <option value="casa">Casa</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="comercial">Comercial</option>
                  </select>
                </div>
              </div>

              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.col}`} style={{ flex: 2 }}>
                  <label className={styles.label}>Logradouro</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Rua, Avenida, etc"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.col}`} style={{ flex: 1 }}>
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

              <div className={styles.formGroup}>
                <label className={styles.label}>Complemento</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="Apto 101, Bloco B"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                />
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
                  <label className={styles.label}>Cidade</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    placeholder="Cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.col}`} style={{ flex: 0.5 }}>
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

              <div className={styles.formGroup}>
                <label className={styles.label}>Ponto de Referência</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  placeholder="Próximo ao mercado..."
                  value={pontoReferencia}
                  onChange={(e) => setPontoReferencia(e.target.value)}
                />
              </div>
            </div>

          <div className={styles.footer}>
            <button 
              className={`${styles.button} ${styles.cancelButton}`}
              onClick={() => router.push('/clientes')}
              disabled={saving}
            >
              <X size={20} />
              Cancelar
            </button>
            <button 
              className={`${styles.button} ${styles.saveButton}`}
              onClick={handleSave}
              disabled={saving}
            >
              <Check size={20} />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}