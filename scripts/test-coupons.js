
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testCoupons() {
  console.log('Iniciando teste de cupons...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: Variáveis de ambiente do Supabase não encontradas.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Obter um estabelecimento existente
  const { data: estab, error: estabError } = await supabase
    .from('estabelecimentos')
    .select('id, nome_estabelecimento')
    .limit(1)
    .single();

  if (estabError || !estab) {
    console.error('Erro ao buscar estabelecimento:', estabError);
    process.exit(1);
  }

  console.log(`Estabelecimento encontrado: ${estab.nome_estabelecimento} (${estab.id})`);

  // 2. Criar cupons de teste com o SCHEMA CORRETO
  const testCoupons = [
    {
      codigo_cupom: 'TESTE10',
      tipo_desconto: 'percentual',
      valor_desconto: 10,
      status_cupom: 'ativo',
      estabelecimento_id: estab.id
    },
    {
      codigo_cupom: 'TESTEFIXO5',
      tipo_desconto: 'valor', // Assumindo 'valor' como opção
      valor_desconto: 5,
      status_cupom: 'ativo',
      estabelecimento_id: estab.id
    },
    {
      codigo_cupom: 'TESTEEXPIRADO',
      tipo_desconto: 'valor',
      valor_desconto: 5,
      status_cupom: 'ativo',
      data_fim: new Date(Date.now() - 86400000).toISOString(), // Ontem
      estabelecimento_id: estab.id
    }
  ];

  for (const coupon of testCoupons) {
    // Remover se já existir
    await supabase.from('cupons').delete().eq('codigo_cupom', coupon.codigo_cupom).eq('estabelecimento_id', estab.id);
    
    const { error } = await supabase.from('cupons').insert(coupon);
    if (error) {
      console.error(`Erro ao criar cupom ${coupon.codigo_cupom}:`, error);
    } else {
      console.log(`Cupom criado: ${coupon.codigo_cupom}`);
    }
  }

  // 3. Testar validação via API (localhost:3000)
  console.log('\n--- Validando Cupons via API ---');

  async function validateCouponViaApi(code, orderValue) {
    try {
      const response = await fetch('http://localhost:3000/api/estabelecimentos/cardapio/teste/cupons/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: code,
          estabelecimento_id: estab.id,
          valor_pedido: orderValue
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${code}: Sucesso!`, data);
      } else {
        console.log(`❌ ${code}: Falha (${response.status})`, data);
      }
    } catch (error) {
      console.error(`Erro ao chamar API para ${code}:`, error.message);
    }
  }

  // Aguardar um pouco para garantir que o banco processou (embora o await insert deva ser suficiente)
  await new Promise(resolve => setTimeout(resolve, 1000));

  await validateCouponViaApi('TESTE10', 50);
  await validateCouponViaApi('TESTEFIXO5', 50);
  await validateCouponViaApi('TESTEEXPIRADO', 50);
  await validateCouponViaApi('NAOEXISTE', 50);

  console.log('\nTeste finalizado.');
}

testCoupons();
