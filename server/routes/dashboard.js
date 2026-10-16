const router = require('express').Router();
const { query } = require('../db');
const { wrap } = require('../util');
const { soAdmin } = require('../auth');

const TZ = process.env.TZ_EMPRESA || 'America/Sao_Paulo';

router.get('/', soAdmin, wrap(async (req, res) => {
  const emp = req.user.empresa_id;
  const [resumo, semana, produtos] = await Promise.all([
    query(
      `select count(*)::int as quantidade,
              coalesce(sum(v.total - coalesce(d.valor, 0)), 0) as total,
              coalesce(avg(v.total - coalesce(d.valor, 0)), 0) as ticket_medio
         from vendas v
         left join lateral (
           select sum(valor) as valor from venda_devolucoes where venda_id = v.id
         ) d on true
        where v.empresa_id = $1 and v.status = 'concluida'
          and (v.finalizada_em at time zone $2)::date = (now() at time zone $2)::date`,
      [emp, TZ]
    ),
    query(
      `select dias.dia::date as dia,
              coalesce(sum(v.total - coalesce(d.valor, 0)), 0) as total
         from generate_series(
                (now() at time zone $2)::date - 6,
                (now() at time zone $2)::date,
                interval '1 day'
              ) as dias(dia)
         left join vendas v
           on v.empresa_id = $1 and v.status = 'concluida'
          and (v.finalizada_em at time zone $2)::date = dias.dia::date
         left join lateral (
           select sum(valor) as valor from venda_devolucoes where venda_id = v.id
         ) d on true
        group by dias.dia order by dias.dia`,
      [emp, TZ]
    ),
    query(
      `select i.descricao, sum(i.quantidade - i.quantidade_devolvida) as quantidade,
              sum(i.total - i.quantidade_devolvida * i.preco_unit) as total
         from venda_itens i join vendas v on v.id = i.venda_id
        where v.empresa_id = $1 and v.status = 'concluida'
          and (v.finalizada_em at time zone $2)::date = (now() at time zone $2)::date
        group by i.descricao
       having sum(i.quantidade - i.quantidade_devolvida) > 0
        order by quantidade desc, total desc limit 5`,
      [emp, TZ]
    ),
  ]);
  res.json({
    resumo: resumo.rows[0],
    semana: semana.rows,
    produtos: produtos.rows,
  });
}));

module.exports = router;
