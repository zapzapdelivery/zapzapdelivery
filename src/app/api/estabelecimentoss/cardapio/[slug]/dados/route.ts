import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-auth';
 
export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const url = new URL(request.url);
    const rawSlug = params?.slug ?? '';
    const segments = url.pathname.split('/').filter(Boolean);
    let pathSlug = '';
    const idxDados = segments.lastIndexOf('dados');
    if (idxDados > 0) {
      pathSlug = segments[idxDados - 1] || '';
    } else {
      const idxCardapio = segments.indexOf('cardapio');
      if (idxCardapio >= 0 && segments[idxCardapio + 1]) {
        pathSlug = segments[idxCardapio + 1];
      } else {
        pathSlug = segments.pop() || '';
      }
    }
    const slugSource = rawSlug || pathSlug;
    const normalize = (v: string) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const slug = slugSource.trim();

    // Check if slug is a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    let est: any = null;

    if (isUuid) {
      const { data, error } = await supabaseAdmin
        .from('estabelecimentos')
        .select('*')
        .eq('id', slug)
        .single();
      
      if (!error && data) {
        est = data;
      }
    }

    if (!est) {
      const normalizedSlug = normalize(slug);
      if (!normalizedSlug) {
        return NextResponse.json({ error: 'Slug inválido' }, { status: 400 });
      }

      const likeByUrl = `%${slug}%`;
      const wildcardName = `%${normalizedSlug.split('').join('%')}%`;
      const { data: ests, error: estError } = await supabaseAdmin
        .from('estabelecimentos')
        .select('*')
        .or(`url_cardapio.ilike.${likeByUrl},nome_estabelecimento.ilike.${wildcardName}`)
        .limit(10);

      if (estError) {
        return NextResponse.json({ error: estError.message }, { status: 400 });
      }

      if (Array.isArray(ests) && ests.length > 0) {
        const pick = (rows: any[]) =>
          rows.find(
            (r: any) =>
              normalize(String(r.url_cardapio || '')) === normalizedSlug ||
              normalize(String(r.nome_estabelecimento || '')) === normalizedSlug
          ) || rows[0];
        est = pick(ests);
      }
    }
    if (!est) {
      return NextResponse.json({ error: 'Estabelecimento não encontrado' }, { status: 404 });
    }
 
    const e: any = est;
    const telefone =
      e?.whatsapp_principal ??
      e?.whatsapp_main ??
      e?.telefone ??
      e?.phone ??
      '';
 
    const estabelecimento = {
      id: e?.id,
      nome_estabelecimento:
        e?.nome_estabelecimento ??
        e?.name ??
        e?.nome ??
        'Estabelecimento',
      imagem_estabelecimento_url:
        e?.imagem_estabelecimento_url ??
        e?.logo_url ??
        e?.logoUrl ??
        undefined,
      telefone,
      whatsappMain:
        e?.whatsapp_principal ??
        e?.whatsapp_main ??
        undefined,
      endereco: e?.endereco ?? e?.address ?? '',
      numero:
        (e?.numero ?? e?.number ?? '') !== ''
          ? String(e?.numero ?? e?.number)
          : '',
      bairro: e?.bairro ?? e?.neighborhood ?? '',
      cidade: e?.cidade ?? e?.city ?? '',
      uf: e?.uf ?? e?.estado ?? e?.state ?? '',
    };

    // Fetch delivery fee config
    const { data: feeConfig } = await supabaseAdmin
      .from('taxa_entregas')
      .select(`
        *,
        taxas_bairros (*)
      `)
      .eq('estabelecimento_id', estabelecimento.id)
      .limit(1)
      .maybeSingle();

    if (feeConfig) {
      (estabelecimento as any).taxa_entrega = feeConfig;
    }

    // Fetch Mercado Pago config (only public_key)
    const { data: mpConfig } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('public_key')
      .eq('estabelecimento_id', estabelecimento.id)
      .maybeSingle();

    if (mpConfig) {
      (estabelecimento as any).mercadopago_public_key = mpConfig.public_key;
    }

    const { data: cats, error: catsError } = await supabaseAdmin
      .from('categorias')
      .select('id, nome_categoria, descricao')
      .eq('estabelecimento_id', estabelecimento.id)
      .eq('status_categoria', 'ativo')
      .order('ordem_exibicao', { ascending: true });
    if (catsError) {
      return NextResponse.json({ error: catsError.message }, { status: 400 });
    }
 
    return NextResponse.json({ estabelecimento, categorias: cats || [] });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
