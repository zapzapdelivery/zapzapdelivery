import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { role } = await getAuthContext(request);
    
    if (role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado: Usuários atendentes não têm permissão para acessar este módulo.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('parceiros')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      const p: any = data;
      const nome =
        p?.nome ??
        p?.nome_parceiro ??
        p?.nome_fantasia ??
        p?.fantasia ??
        p?.name ??
        'Parceiro';
      const documento = p?.documento ?? p?.cpf ?? p?.cnpj ?? p?.cnpj_cpf ?? '';
      const email = p?.email ?? p?.email_parceiro ?? '';
      const telefone = p?.telefone ?? p?.phone ?? p?.contato ?? '';
      const cep = p?.cep ?? '';
      const endereco = p?.endereco ?? p?.logradouro ?? '';
      const numero = p?.numero ?? '';
      const bairro = p?.bairro ?? '';
      const cidade = p?.cidade ?? '';
      const uf = p?.uf ?? p?.estado ?? '';
      const complemento = p?.complemento ?? '';
      const comissao = p?.comissao ?? p?.percentual_comissao ?? '';
      const statusRaw = p?.status ?? p?.status_parceiro;
      const status =
        statusRaw === 'ativo' || statusRaw === true
          ? 'ativo'
          : 'inativo';
      const logo_url = p?.logo_url ?? p?.logoUrl ?? null;
      return NextResponse.json({
        id: p?.id,
        nome,
        documento,
        email,
        telefone,
        cep,
        endereco,
        numero,
        bairro,
        cidade,
        uf,
        complemento,
        comissao,
        status,
        logo_url,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('parceiros')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (data ?? []).map((p: any) => {
      const nome =
        p?.nome ??
        p?.nome_parceiro ??
        p?.nome_fantasia ??
        p?.fantasia ??
        p?.name ??
        'Parceiro';
      const email = p?.email ?? p?.email_parceiro ?? '';
      const telefone = p?.telefone ?? p?.phone ?? p?.contato ?? '';
      const statusRaw = p?.status ?? p?.status_parceiro;
      const status =
        statusRaw === 'ativo' || statusRaw === true
          ? 'ativo'
          : 'inativo';
      const logo_url = p?.logo_url ?? p?.logoUrl ?? null;
      return {
        id: p?.id,
        nome,
        email,
        telefone,
        status,
        logo_url,
      };
    });

    normalized.sort((a: any, b: any) =>
      String(a.nome).localeCompare(String(b.nome))
    );

    return NextResponse.json(normalized);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  try {
    const { role } = await getAuthContext(request);
    if (role === 'estabelecimento' || role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
    }

    const body = await request.json();
    const { data: sampleRows } = await supabaseAdmin
      .from('parceiros')
      .select('*')
      .limit(1);
    const available = new Set(Object.keys(sampleRows?.[0] || {}));

    const choose = (candidates: string[], value: any) => {
      for (const key of candidates) {
        if (available.has(key)) {
          return { [key]: value };
        }
      }
      return {};
    };

    const insertObj: Record<string, any> = {
      ...choose(['nome_parceiro','nome','name','nome_fantasia','fantasia'], body.nome),
      ...choose(['documento','cpf','cnpj','cnpj_cpf'], body.documento),
      ...choose(['email','email_parceiro'], body.email),
      ...choose(['telefone','phone','contato'], body.telefone),
      ...choose(['cep'], body.cep),
      ...choose(['endereco','logradouro'], body.endereco),
      ...choose(['numero'], body.numero),
      ...choose(['bairro'], body.bairro),
      ...choose(['cidade'], body.cidade),
      ...choose(['uf','estado'], body.uf),
      ...choose(['complemento'], body.complemento),
      ...choose(['comissao','percentual_comissao'], body.comissao),
      ...choose(['logo_url','logoUrl','imagem_url'], body.logoUrl),
    };

    if (available.has('status')) {
      insertObj['status'] = body.status === 'ativo' || body.status === true ? 'ativo' : 'inativo';
    } else if (available.has('status_parceiro')) {
      insertObj['status_parceiro'] = body.status === 'ativo' || body.status === true ? 'ativo' : 'inativo';
    } else if (available.has('ativo')) {
      insertObj['ativo'] = body.status === 'ativo' || body.status === true;
    }

    // Fallback if empty table
    if (sampleRows?.length === 0) {
       insertObj['nome_parceiro'] = insertObj['nome_parceiro'] ?? body.nome ?? 'Parceiro';
       insertObj['status'] = insertObj['status'] ?? 'ativo';
    }

    const { data, error } = await supabaseAdmin
      .from('parceiros')
      .insert([insertObj])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    const message = err?.message || 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  try {
    const { role } = await getAuthContext(request);
    if (role === 'estabelecimento' || role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const body = await request.json();
    const { data: sampleRows } = await supabaseAdmin
      .from('parceiros')
      .select('*')
      .limit(1);
    const available = new Set(Object.keys(sampleRows?.[0] || {}));

    const choose = (candidates: string[], value: any) => {
      for (const key of candidates) {
        if (available.has(key)) {
          return { [key]: value };
        }
      }
      return {};
    };

    const updateObj: Record<string, any> = {
      ...choose(['nome_parceiro','nome','name','nome_fantasia','fantasia'], body.nome),
      ...choose(['documento','cpf','cnpj','cnpj_cpf'], body.documento),
      ...choose(['email','email_parceiro'], body.email),
      ...choose(['telefone','phone','contato'], body.telefone),
      ...choose(['cep'], body.cep),
      ...choose(['endereco','logradouro'], body.endereco),
      ...choose(['numero'], body.numero),
      ...choose(['bairro'], body.bairro),
      ...choose(['cidade'], body.cidade),
      ...choose(['uf','estado'], body.uf),
      ...choose(['complemento'], body.complemento),
      ...choose(['comissao','percentual_comissao'], body.comissao),
      ...choose(['logo_url','logoUrl','imagem_url'], body.logoUrl),
    };

    if (available.has('status')) {
      updateObj['status'] = body.status === 'ativo' || body.status === true ? 'ativo' : 'inativo';
    } else if (available.has('status_parceiro')) {
      updateObj['status_parceiro'] = body.status === 'ativo' || body.status === true ? 'ativo' : 'inativo';
    } else if (available.has('ativo')) {
      updateObj['ativo'] = body.status === 'ativo' || body.status === true;
    }

    const { data, error } = await supabaseAdmin
      .from('parceiros')
      .update(updateObj)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    const message = err?.message || 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  try {
    const { role } = await getAuthContext(request);
    if (role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado: Usuários atendentes não têm permissão para acessar este módulo.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    // 1. Fetch partner to get logo_url
    const { data: partner, error: fetchError } = await supabaseAdmin
      .from('parceiros')
      .select('logo_url')
      .eq('id', id)
      .single();

    if (!fetchError && partner?.logo_url) {
      // 2. Delete image from Storage
      // Assuming bucket 'partners' based on standard usage
      const bucket = 'partners';
      const url = partner.logo_url;
      
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
        if (pathParts.length === 2) {
          const path = decodeURIComponent(pathParts[1]);
          await supabaseAdmin.storage.from(bucket).remove([path]);
        }
      } catch (e) {
        console.warn('Error deleting partner image:', e);
      }
    }

    const { error } = await supabaseAdmin
      .from('parceiros')
      .delete()
      .eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
