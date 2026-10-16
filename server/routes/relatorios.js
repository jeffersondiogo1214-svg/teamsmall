const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../db');
const { wrap, parse } = require('../util');
const { soAdmin } = require('../auth');

const TZ = process.env.TZ_EMPRESA || 'America/Sao_Paulo';
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

router.get('/', soAdmin, wrap(async (req, res) => {
  const periodo = parse(z.object({
    de: data,
    ate: data,
  }), { de: req.query.de, ate: req.query.ate });
  if (periodo.de > periodo.ate) {
    return res.status(400).json({ erro: 'A data inicial deve ser anterior à data final.' });
  }
  const emp = req.user.empresa_id;
  const params = [emp, periodo.de, periodo.ate, TZ];

  const [vendas, vendedores, pagamentos, produtos] = await Promise.all([
    query(
      `select v.id, v.numero, coalesce(v.finalizada_em, v.criado_em) as data, v.cliente_nome,
              v.vendedor_nome, v.usuario_nome, v.total,
              coalesce((select sum(d.valor) from venda_devolucoes d where d.venda_id = v.id), 0) as devolvido,
              v.total - coalesce((select sum(d.valor) from venda_devolucoes d where d.venda_id = v.id), 0) as liquido
         from vendas v
        where v.empresa_id = $1 and v.status = 'concluida'
          and (coalesce(v.finalizada_em, v.criado_em) at time zone $4)::date >= $2::date
          and (coalesce(v.finalizada_em, v.criado_em) at time zone $4)::date <= $3::date
        order by data desc, v.numero desc`,
      params
    ),
    query(
      `select coalesce(v.vendedor_nome, v.usuario_nome, 'Sem vendedor') as vendedor,
              coalesce(v.comissao_percentual, u.comissao_percentual, e.comissao_percentual) as percentual,
              sum(v.total - coalesce(d.valor, 0)) as liquido,
              sum((v.total - coalesce(d.valor, 0)) *
                  coalesce(v.comissao_percentual, u.comissao_percentual, e.comissao_percentual) / 100) as comissao
         from vendas v
         join empresas e on e.id = v.empresa_id
         left join usuarios u on u.id = v.vendedor_id
         left join lateral (
           select sum(valor) as valor from venda_devolucoes where venda_id = v.id
         ) d on true
        where v.empresa_id = $1 and v.status = 'concluida'
          and (coalesce(v.finalizada_em, v.criado_em) at time zone $4)::date >= $2::date
          and (coalesce(v.finalizada_em, v.criado_em) at time zone $4)::date <= $3::date
        group by vendedor, percentual
        order by liquido desc`,
      params
    ),
    query(
      `with pagamentos_por_origem as (
         select p.venda_id, p.forma, p.origem, sum(p.valor) as valor, max(v.troco) as troco
           from venda_pagamentos p
           join vendas v on v.id = p.venda_id
          where v.empresa_id = $1 and v.status in ('concluida', 'cancelada')
            and (p.criado_em at time zone $4)::date between $2::date and $3::date
          group by p.venda_id, p.forma, p.origem
       ), recebimentos as (
         select forma,
                sum(valor - case when origem = 'venda' and forma = 'dinheiro' then troco else 0 end) as valor
           from pagamentos_por_origem
          group by forma
         union all
         select forma_reembolso as forma, -sum(valor_reembolsado) as valor
           from venda_devolucoes
          where empresa_id = $1 and forma_reembolso is not null
            and (criado_em at time zone $4)::date between $2::date and $3::date
          group by forma_reembolso
       )
       select forma, sum(valor) as recebido
         from recebimentos
        group by forma
       having sum(valor) <> 0
        order by recebido desc`,
      params
    ),
    query(
      `select i.codigo, i.descricao,
              sum(i.quantidade - i.quantidade_devolvida) as quantidade,
              sum(i.total - i.quantidade_devolvida * i.preco_unit) as liquido
         from venda_itens i join vendas v on v.id = i.venda_id
        where v.empresa_id = $1 and v.status = 'concluida'
          and (coalesce(v.finalizada_em, v.criado_em) at time zone $4)::date >= $2::date
          and (coalesce(v.finalizada_em, v.criado_em) at time zone $4)::date <= $3::date
        group by i.codigo, i.descricao
       having sum(i.quantidade - i.quantidade_devolvida) > 0
        order by liquido desc`,
      params
    ),
  ]);

  res.json({
    periodo,
    vendas: vendas.rows,
    vendedores: vendedores.rows,
    pagamentos: pagamentos.rows,
    produtos: produtos.rows,
  });
}));

module.exports = router;
