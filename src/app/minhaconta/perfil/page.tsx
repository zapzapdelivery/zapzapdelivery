'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  User, 
  Lock, 
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { CustomerSidebar } from '@/components/CustomerSidebar/CustomerSidebar';
import { MobileHeader } from '@/components/Mobile/Header/MobileHeader';
import { Loading } from '@/components/Loading/Loading';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { formatCPF } from '@/utils/validators';
import styles from './perfil.module.css';

export default function PerfilPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Informações Pessoais
    nome_cliente: '',
    cpf: '',
    telefone: '',
    email: '',
    
    // Segurança
    nova_senha: '',
    confirmar_senha: ''
  });

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clientEstabelecimentoId, setClientEstabelecimentoId] = useState<string | null>(null);

  const novaSenha = formData.nova_senha;
  const confirmarSenha = formData.confirmar_senha;
  const hasNewPassword = novaSenha.length > 0;
  const isNewPasswordShort = hasNewPassword && novaSenha.length < 6;
  const passwordsMatch =
    hasNewPassword && confirmarSenha.length > 0 && novaSenha === confirmarSenha;
  const showConfirmFeedback = confirmarSenha.length > 0;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        console.log('--- PERFIL: Iniciando carregamento de dados ---');
        
        // Use getSession for immediate session check
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('--- PERFIL: Erro ao buscar sessão:', sessionError);
          router.push('/login');
          return;
        }

        const user = session?.user;
        
        if (!user) {
          console.warn('--- PERFIL: Nenhum usuário na sessão, tentando getUser()');
          const { data: { user: userRetry } } = await supabase.auth.getUser();
          if (!userRetry) {
            router.push('/login');
            return;
          }
        }

        const currentUser = user || (await supabase.auth.getUser()).data.user;
        if (!currentUser) return;

        console.log('--- PERFIL: Usuário logado:', { id: currentUser.id, email: currentUser.email });

        // 1. Fetch Client Info
        const { data: client, error: clientError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        let activeClient = client;

        if (!activeClient) {
          console.log('--- PERFIL: Cliente não encontrado por ID, tentando por e-mail:', currentUser.email);
          const { data: clientByEmail } = await supabase
            .from('clientes')
            .select('*')
            .eq('email', currentUser.email)
            .maybeSingle();
          activeClient = clientByEmail;
        }

        if (activeClient) {
          console.log('--- PERFIL: Cliente encontrado:', activeClient);
          setClienteId(activeClient.id);
          setClientEstabelecimentoId(activeClient.estabelecimento_id);
          
          setFormData(prev => ({
            ...prev,
            nome_cliente: activeClient.nome_cliente || '',
            cpf: activeClient.cpf || '',
            telefone: activeClient.telefone || '',
            email: activeClient.email || '',
          }));
        } else {
          console.error('--- PERFIL: Cliente não existe na tabela clientes');
          showError('Perfil não encontrado no sistema.');
        }
      } catch (err: any) {
        console.error('--- PERFIL: Erro crítico:', err);
        showError('Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, showError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cpf') formattedValue = formatCPF(value);

    setFormData(prev => {
      const next = { ...prev, [name]: formattedValue };
      if (name === 'nova_senha') {
        const shouldSyncConfirm =
          !prev.confirmar_senha || prev.confirmar_senha === prev.nova_senha;
        if (shouldSyncConfirm) {
          next.confirmar_senha = formattedValue;
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // 1. Validate Password if provided
      if (formData.nova_senha) {
        if (formData.nova_senha !== formData.confirmar_senha) {
          showError('As senhas não coincidem.');
          setSaving(false);
          return;
        }
        if (formData.nova_senha.length < 6) {
          showError('A senha deve ter pelo menos 6 caracteres.');
          setSaving(false);
          return;
        }
      }

      // 2. Update Client Data
      if (clienteId) {
        const { error: clientUpdateError } = await supabase
          .from('clientes')
          .update({
            nome_cliente: formData.nome_cliente,
            cpf: formData.cpf,
            telefone: formData.telefone,
            // email: formData.email, // Usually email is handled via Auth
          })
          .eq('id', clienteId);

        if (clientUpdateError) throw clientUpdateError;
      }

      // 3. Update Password if provided
      if (formData.nova_senha) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: formData.nova_senha
        });
        if (pwdError) throw pwdError;
      }

      success('Alterações salvas com sucesso!');
      setFormData(prev => ({ ...prev, nova_senha: '', confirmar_senha: '' }));
    } catch (err: any) {
      console.error('Error saving profile:', err);
      showError('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading message="Carregando minha conta..." fullScreen />;
  }

  return (
    <div className={styles.container}>
      <CustomerSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mobileOnly}>
        <MobileHeader 
          onMenuClick={() => setIsSidebarOpen(true)} 
          title="Meu Perfil"
          subtitle="Gerencie suas informações pessoais"
          showGreeting={false}
        />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.desktopOnly}>
          <Link href="/minhaconta" className={styles.backButton}>
            <ArrowLeft size={18} />
            Voltar para Dashboard
          </Link>

          <header className={styles.header}>
            <h1 className={styles.title}>Meu Perfil</h1>
            <p className={styles.subtitle}>Gerencie suas informações pessoais e segurança</p>
          </header>
        </div>

        <div className={styles.mobileOnly} style={{ marginBottom: '1rem', marginTop: '-0.5rem' }}>
          <Link href="/minhaconta" className={styles.backButton} style={{ marginBottom: '0' }}>
            <ArrowLeft size={18} />
            Voltar
          </Link>
        </div>

        <div className={styles.formContainer}>
          {/* Informações Pessoais */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <User size={20} className={styles.iconPersonal} />
              <h2>Informações Pessoais</h2>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome Completo</label>
                <input 
                  type="text" 
                  name="nome_cliente"
                  value={formData.nome_cliente}
                  onChange={handleChange}
                  placeholder="João Silva" 
                  className={styles.input} 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>CPF</label>
                <input 
                  type="text" 
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  placeholder="123.456.789-00" 
                  className={styles.input} 
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Telefone</label>
                <input 
                  type="text" 
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  placeholder="(11) 98765-4321" 
                  className={styles.input} 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>E-mail</label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  disabled
                  placeholder="joao.silva@exemplo.com" 
                  className={styles.input} 
                  style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                />
              </div>
            </div>
          </section>

          {/* Segurança */}
          <section className={`${styles.section} ${styles.securitySection}`}>
            <div className={styles.sectionHeader}>
              <Lock size={20} className={styles.iconSecurity} />
              <h2>Segurança</h2>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Nova Senha</label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={20} />
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    name="nova_senha"
                    value={formData.nova_senha}
                    onChange={handleChange}
                    placeholder="••••••••" 
                    className={`${styles.input} ${styles.inputWithIcon} ${isNewPasswordShort ? styles.inputError : ''} ${hasNewPassword && !isNewPasswordShort ? styles.inputSuccess : ''}`.trim()} 
                  />
                  <button 
                    type="button"
                    className={styles.eyeIcon}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {hasNewPassword && (
                  <div
                    className={`${styles.passwordHint} ${
                      isNewPasswordShort ? styles.passwordHintError : styles.passwordHintSuccess
                    }`.trim()}
                  >
                    {isNewPasswordShort
                      ? 'Mínimo 6 caracteres.'
                      : 'Senha com tamanho adequado.'}
                  </div>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Confirmar Senha</label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={20} />
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    name="confirmar_senha"
                    value={formData.confirmar_senha}
                    onChange={handleChange}
                    placeholder="••••••••" 
                    className={`${styles.input} ${styles.inputWithIcon} ${showConfirmFeedback && !passwordsMatch ? styles.inputError : ''} ${passwordsMatch ? styles.inputSuccess : ''}`.trim()} 
                  />
                  <button 
                    type="button"
                    className={styles.eyeIcon}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {showConfirmFeedback && (
                  <div
                    className={`${styles.passwordHint} ${
                      passwordsMatch ? styles.passwordHintSuccess : styles.passwordHintError
                    }`.trim()}
                  >
                    {passwordsMatch ? 'As senhas coincidem.' : 'As senhas não coincidem.'}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className={styles.actions}>
          <button 
            type="button" 
            onClick={() => router.push('/minhaconta')}
            className={styles.btnCancel}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSave}
            disabled={saving}
            className={styles.btnSave}
          >
            {saving ? 'Salvando...' : (
              <>
                <CheckCircle2 size={18} />
                Salvar Alterações
              </>
            )}
          </button>
        </footer>
      </main>
    </div>
  );
}
