import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useEstablishment() {
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchEstablishment() {
      const establishmentSlug = window.location.pathname.split('/estabelecimentos/cardapio/')[1]?.split('/')[0];
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!mounted) return;

        if (!user) {
          setLoading(false);
          return;
        }

        // Check for Super Admin
        const isSuper = user.email === 'everaldozs@gmail.com';
        if (mounted) setIsSuperAdmin(isSuper);

        // Busca o perfil do usuário para obter o estabelecimento_id
        const { data: profile, error: profileError } = await supabase
          .from('usuarios')
          .select('estabelecimento_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          console.error('Erro ao buscar perfil do usuário:', profileError);
          setError('Erro ao buscar perfil do usuário');
          setLoading(false);
          return;
        }

        if (!profile?.estabelecimento_id) {
          if (isSuper) {
            // Super Admin without establishment: allow access
            setEstablishmentName('Visão Super Admin');
            setLoading(false);
            return;
          }
          console.warn('Usuário logado sem estabelecimento vinculado. ID:', user.id);
          setError('Usuário sem estabelecimento vinculado');
          setLoading(false);
          return;
        }

        setEstablishmentId(profile.estabelecimento_id);

        // Busca o nome do estabelecimento via API para evitar erros de RLS
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/estabelecimentos/${profile.estabelecimento_id}`, {
            headers: { Authorization: `Bearer ${session?.access_token}` }
        });

        if (!mounted) return;

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.error('Erro ao buscar dados do estabelecimento via API:', errData.error || response.statusText);
        } else {
          const estab = await response.json();
          setEstablishmentName(estab.nome_estabelecimento || estab.name);
        }

      } catch (err: any) {
        if (mounted) {
          console.error('Erro inesperado em useEstablishment:', err);
          setError(err.message || 'Erro inesperado');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchEstablishment();

    return () => {
      mounted = false;
    };
  }, []);

  return { establishmentId, establishmentName, loading, error, isSuperAdmin };
}
