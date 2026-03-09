'use client';


import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast/ToastProvider';
import { User, Lock, Eye, EyeOff, HelpCircle, MessageSquare, Bike } from 'lucide-react';
import styles from './paineladmin.module.css';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const { error: showError } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanEmail = email.trim();
      const cleanPassword = password.trim();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Se houver uma URL de redirecionamento, use-a prioritariamente
        if (redirectUrl) {
          router.push(decodeURIComponent(redirectUrl));
          return;
        }

        // Get user role for redirection
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          try {
            const res = await fetch('/api/me/role', {
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: 'no-store'
            });

            if (res.ok) {
              const roleData = await res.json();
              if (roleData.role === 'cliente') {
                router.push('/minhaconta');
                return;
              }
            }
          } catch (roleErr) {
            console.error('Error checking role during login:', roleErr);
          }
        }
        
        // Default redirection for admin/establishment
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      const msg = err.message || '';
      
      if (msg.includes('Invalid login credentials')) {
        showError('E-mail ou senha incorretos. Tente novamente.');
      } else if (msg.includes('fetch') || msg.includes('network')) {
        showError('Erro de conexão. Verifique sua internet ou se o serviço está disponível.');
      } else {
        showError('Falha ao autenticar. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Painel Esquerdo - Imagem */}
      <div className={styles.leftPanel}>
        <div className={styles.leftPanelContent}>
          <h2 className={styles.heroTitle}>Agilize seu delivery com inteligência.</h2>
          <p className={styles.heroSubtitle}>A plataforma líder para gestão de pedidos ZapZap.</p>
        </div>
      </div>

      {/* Painel Direito - Formulário */}
      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <div className={styles.header}>
            {/* Desktop Logo */}
            <div className={styles.desktopOnly}>
              <Link href="/" className={styles.logo} style={{ textDecoration: 'none' }}>
                <MessageSquare size={28} className={styles.logoIcon} fill="currentColor" />
                <span>ZapZap Delivery</span>
              </Link>
              <h1 className={styles.title}>Bem-vindo de volta!</h1>
              <p className={styles.subtitle}>Acesse o painel administrativo do seu negócio.</p>
            </div>

            {/* Mobile Logo & Header */}
            <div className={styles.mobileOnly}>
              <div className={styles.mobileLogoWrapper}>
                <Bike size={48} color="white" strokeWidth={1.5} />
              </div>
              <h1 className={styles.title}>Login Administrativo</h1>
              <p className={styles.subtitle}>Insira suas credenciais para acessar o painel de controle</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>E-mail ou Usuário</label>
              <div className={styles.inputWrapper}>
                <User className={styles.inputIcon} size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="Seu e-mail de acesso"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>Senha</label>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} size={20} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Sua senha secreta"
                  required
                  autoComplete="current-password"
                />
                <button 
                  type="button"
                  className={styles.eyeIcon}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className={styles.optionsRow}>
              <label className={styles.toggleLabel}>
                Manter conectado
                <input 
                  type="checkbox" 
                  className={styles.toggleInput}
                  checked={keepConnected}
                  onChange={(e) => setKeepConnected(e.target.checked)}
                />
                <span className={styles.toggleSlider}></span>
              </label>
            </div>

            <button 
              type="submit" 
              className={styles.button}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>

            <a href="#" className={styles.forgotLink} onClick={(e) => e.preventDefault()}>
              Esqueci minha senha
            </a>
          </form>

          <div className={styles.helpSection}>
            <div className={styles.helpDivider}>Precisa de ajuda?</div>
            <button className={styles.supportButton}>
              <HelpCircle size={18} className={styles.logoIcon} />
              Suporte ao Parceiro
            </button>
          </div>

          <div className={styles.footer}>
            <span className={styles.desktopOnly}>© 2024 ZapZap Delivery. Sistema de gestão administrativa.</span>
            <span className={styles.mobileOnly}>Desenvolvido por ZapZap Delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
      <LoginContent />
    </Suspense>
  );
}