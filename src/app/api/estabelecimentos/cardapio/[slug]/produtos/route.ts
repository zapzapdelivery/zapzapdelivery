import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const url = new URL(request.url);
    const rawSlug = params?.slug ?? '';
    const segments = url.pathname.split('/').filter(Boolean);
    let pathSlug = '';
    const idxProdutos = segments.lastIndexOf('produtos');
    if (idxProdutos > 0) {
      pathSlug = segments[idxProdutos - 1] || '';
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

    // Context opcional: se usuário autenticado, validar estabelecimento
    const ctx = await getAuthContext(request).catch(() => null);

    // Check if slug is a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    // Encontrar estabelecimento pelo slug (url_cardapio contém slug) ou nome como fallback
    let est: any = null;

    if (isUuid) {
      const { data, error } = await supabaseAdmin
        .from('estabelecimentos')
        .select('id, nome_estabelecimento, url_cardapio')
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
        .select('id, nome_estabelecimento, url_cardapio')
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
      } else {
        const { data: fallbackEsts, error: fallbackError } = await supabaseAdmin
          .from('estabelecimentos')
          .select('id, nome_estabelecimento, url_cardapio')
          .ilike('nome_estabelecimento', wildcardName)
          .limit(1);
        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 400 });
        }
        if (fallbackEsts && fallbackEsts.length > 0) {
          est = fallbackEsts[0];
        }
      }
    }

    if (!est) {
      return NextResponse.json({ error: 'Estabelecimento não encontrado' }, { status: 404 });
    }

    const estabId = est.id;

    // Buscar produtos ativos do estabelecimento
    const { data: prods, error: prodsError } = await supabaseAdmin
      .from('produtos')
      .select('id, categoria_id, nome_produto, descricao, valor_base, imagem_produto_url, status_produto, permite_observacao, permite_venda_sem_estoque')
      .eq('estabelecimento_id', estabId)
      .eq('status_produto', 'ativo');

    if (prodsError) {
      return NextResponse.json({ error: prodsError.message }, { status: 400 });
    }

    // Buscar resumo de estoque
    const { data: stockRows, error: stockError } = await supabaseAdmin
      .from('estoque_produtos')
      .select('produto_id, estoque_atual')
      .eq('estabelecimento_id', estabId);

    if (stockError) {
      // Se não houver tabela de estoque, permitir todos (mas é preferível bloquear)
      // Aqui retornamos erro para seguir a regra de só exibir com estoque
      return NextResponse.json({ error: stockError.message }, { status: 400 });
    }

    const stockMap = new Map<string, number>(
      (stockRows || []).map((row: any) => [String(row.produto_id), Number(row.estoque_atual) || 0])
    );

    // Tentar considerar variações: se existir tabela produtos_variacoes, filtrar por estoque > 0 em qualquer variação
    let variationsByProduct = new Map<string, number>();
    try {
      const { data: variations } = await supabaseAdmin
        .from('produtos_variacoes')
        .select('produto_id, estoque_atual')
        .eq('estabelecimento_id', estabId);
      if (variations && Array.isArray(variations)) {
        const grouped = new Map<string, number>();
        (variations as any[]).forEach((v: any) => {
          const pid = String(v.produto_id);
          const qty = Number(v.estoque_atual) || 0;
          const prev = grouped.get(pid) || 0;
          grouped.set(pid, prev + (qty > 0 ? 1 : 0));
        });
        variationsByProduct = grouped;
      }
    } catch {
      // tabela não existe ou sem permissão: ignora variações
    }

    const now = new Date();
    const filtered = (prods || []).filter((p: any) => {
      const allowsZeroStock = p.permite_venda_sem_estoque === true;
      const qty = stockMap.get(String(p.id)) || 0;
      
      // Se NÃO permite vender sem estoque E o estoque é <= 0, filtramos para fora.
      if (!allowsZeroStock && qty <= 0) {
          return false;
      }

      if (typeof p.pre_venda === 'boolean' && p.pre_venda === true) return false;
      if (p.disponivel_em) {
        const dt = new Date(p.disponivel_em);
        if (!Number.isNaN(dt.getTime()) && dt > now) return false;
      }
      return true;
    });

    // Enriquecer com grupos de adicionais e seus itens
    const productIds = filtered.map((p: any) => String(p.id));
    let rels: any[] = [];
    if (productIds.length > 0) {
      const { data: relRows, error: relError } = await supabaseAdmin
        .from('produtos_grupos_adicionais')
        .select('id, produto_id, grupo_id, max_opcoes, ordem_exibicao')
        .in('produto_id', productIds);
      if (relError) {
        return NextResponse.json({ error: relError.message }, { status: 400 });
      }
      rels = relRows || [];
    }

    const grupoIds = Array.from(new Set(rels.map((r: any) => String(r.grupo_id))));
    let grupos: any[] = [];
    if (grupoIds.length > 0) {
      const { data: grupoRows, error: grupoError } = await supabaseAdmin
        .from('grupos_adicionais')
        .select('id, estabelecimento_id, nome, tipo_selecao, obrigatorio, min_opcoes, max_opcoes, ordem_exibicao')
        .in('id', grupoIds)
        .eq('estabelecimento_id', estabId);
      if (grupoError) {
        return NextResponse.json({ error: grupoError.message }, { status: 400 });
      }
      grupos = grupoRows || [];
    }

    let adicionais: any[] = [];
    if (grupoIds.length > 0) {
      const { data: addRows, error: addError } = await supabaseAdmin
        .from('adicionais')
        .select('id, grupo_id, nome, preco, ativo, controla_estoque, estoque_atual, ordem_exibicao')
        .in('grupo_id', grupoIds)
        .eq('ativo', true);
      if (addError) {
        return NextResponse.json({ error: addError.message }, { status: 400 });
      }
      adicionais = addRows || [];
    }

    const gruposMap = new Map<string, any>();
    grupos.forEach((g: any) => {
      gruposMap.set(String(g.id), {
        ...g,
        adicionais: []
      });
    });
    adicionais.forEach((a: any) => {
      const gid = String(a.grupo_id);
      const g = gruposMap.get(gid);
      if (g) {
        g.adicionais.push(a);
      }
    });
    // Ordenar adicionais por ordem_exibicao
    gruposMap.forEach((g: any) => {
      g.adicionais.sort((x: any, y: any) => Number(x.ordem_exibicao) - Number(y.ordem_exibicao));
    });

    const relsByProduct = new Map<string, any[]>();
    rels.forEach((r: any) => {
      const pid = String(r.produto_id);
      const list = relsByProduct.get(pid) || [];
      list.push(r);
      relsByProduct.set(pid, list);
    });

    // Buscar tamanhos (pizzas, etc)
    const { data: tamanhosRows, error: tamError } = await supabaseAdmin
      .from('produtos_tamanhos')
      .select('*')
      .in('produto_id', productIds);

    const tamanhosByProduct = new Map<string, any[]>();
    if (!tamError && tamanhosRows) {
      tamanhosRows.forEach((t: any) => {
        const pid = String(t.produto_id);
        const list = tamanhosByProduct.get(pid) || [];
        list.push(t);
        tamanhosByProduct.set(pid, list);
      });
    }

    const enriched = filtered.map((p: any) => {
      const pid = String(p.id);
      const relList = (relsByProduct.get(pid) || []).sort(
        (a: any, b: any) => Number(a.ordem_exibicao) - Number(b.ordem_exibicao)
      );
      const gruposDoProduto = relList.map((rel: any) => {
        const base = gruposMap.get(String(rel.grupo_id));
        if (!base) return null;
        const maxResolvido =
          typeof rel.max_opcoes === 'number' && rel.max_opcoes > 0
            ? rel.max_opcoes
            : base.max_opcoes;
        return {
          grupo_id: base.id,
          nome: base.nome,
          tipo_selecao: base.tipo_selecao,
          obrigatorio: base.obrigatorio,
          min_opcoes: base.min_opcoes,
          max_opcoes_resolvido: maxResolvido,
          ordem_exibicao: rel.ordem_exibicao,
          adicionais: base.adicionais
        };
      }).filter(Boolean);

      return {
        ...p,
        estoque_atual: stockMap.get(String(p.id)) || 0,
        grupos_adicionais: gruposDoProduto,
        tamanhos: (tamanhosByProduct.get(String(p.id)) || []).sort((a: any, b: any) => Number(a.ordem) - Number(b.ordem))
      };
    });

    return NextResponse.json(enriched);
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
