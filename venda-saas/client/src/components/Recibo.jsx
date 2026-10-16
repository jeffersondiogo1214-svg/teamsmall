import { createPortal } from 'react-dom';
import { brl, dataHora, FORMAS, qtd } from '../utils.js';

function Conteudo({ v }) {
  const e = v.empresa;
  return (
    <div className="recibo">
      <div className="c b">{e.nome}</div>
      {e.documento && <div className="c">CNPJ/CPF: {e.documento}</div>}
      {e.endereco && <div className="c">{e.endereco}</div>}
      {e.telefone && <div className="c">Tel.: {e.telefone}</div>}
      <hr />
      <div className="c b">COMPROVANTE DE VENDA</div>
      <div className="c b">*** SEM VALOR FISCAL ***</div>
      {v.status === 'cancelada' && <div className="c b">*** VENDA CANCELADA ***</div>}
      <hr />
      <div>Venda nº {String(v.numero).padStart(6, '0')}</div>
      <div>{dataHora(v.criado_em)}</div>
      <div>Cliente: {v.cliente_nome || 'Consumidor final'}</div>
      {v.vendedor_nome && <div>Vendedor: {v.vendedor_nome}</div>}
      <div>Operador: {v.usuario_nome}</div>
      <hr />
      {v.itens.map((i) => (
        <div key={i.id} className="item">
          <div>{String(i.item).padStart(2, '0')} {i.codigo} {i.descricao}</div>
          <div className="l">
            <span>{qtd(i.quantidade)} {i.unidade} x {brl(i.preco_unit)}</span>
            <span>{brl(i.total)}</span>
          </div>
        </div>
      ))}
      <hr />
      <div className="l"><span>Subtotal</span><span>{brl(v.subtotal)}</span></div>
      {v.desconto > 0 && <div className="l"><span>Desconto</span><span>- {brl(v.desconto)}</span></div>}
      <div className="l b g"><span>TOTAL</span><span>{brl(v.total)}</span></div>
      {v.pagamentos.map((p) => (
        <div key={p.id} className="l"><span>{FORMAS[p.forma]}</span><span>{brl(p.valor)}</span></div>
      ))}
      {v.troco > 0 && <div className="l"><span>Troco</span><span>{brl(v.troco)}</span></div>}
      <hr />
      <div className="c">Obrigado pela preferência!</div>
      <div className="c">Este documento não é cupom fiscal.</div>
    </div>
  );
}

/* Pré-visualização na tela + cópia em #print-root, que é a única parte impressa (bobina de 80 mm) */
export default function Recibo({ venda }) {
  return (
    <>
      <div className="recibo-preview"><Conteudo v={venda} /></div>
      {createPortal(<Conteudo v={venda} />, document.getElementById('print-root'))}
    </>
  );
}
