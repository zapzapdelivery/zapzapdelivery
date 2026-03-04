import { supabase } from '@/lib/supabase';

export interface AuditLogParams {
  action: string;
  entity: string;
  entity_id?: string;
  details?: any;
}

export async function logAction({ action, entity, entity_id, details }: AuditLogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Tentativa de log sem usuário autenticado');
      return;
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action,
        entity,
        entity_id,
        details,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Erro ao gravar log de auditoria:', error);
      // Don't throw error to avoid blocking the main action if logging fails
    }
  } catch (err) {
    console.error('Erro inesperado ao gravar log:', err);
  }
}
