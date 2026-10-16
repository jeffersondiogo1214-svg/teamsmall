import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { arred, brl, FORMAS, qtd } from '../utils.js';
import Modal from '../components/Modal.jsx';
import Recibo from '../components/Recibo.jsx';

export function ClienteBusca({ cliente, onChange, somenteLeitura = false }) {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState([]);

  useEffect(() => {
    if (!q.trim()) { setLista([]); return undefined; }
    let vivo = true;
    const t = setTimeout(
      () => api(`/clientes?q=${encodeURIComponent(q.trim())}&limite=6`).then((r) => vivo && setLista(r)).catch(() => {}),
      250
    );
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);

  if (cliente) {
    return (
      <div className="cliente-sel">
        <span><small>Cliente</small><b>{cliente.nome}</b></span>
        {!somenteLeitura && <button className="link" onClick={() => onChange(null)}>Trocar</button>}
      </div>
    );
  }
  return (
    <div className="cliente-busca">
      <input placeholder="Consumidor final. Para identificar, busque por nome, CPF ou telefone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cliente" />
      {lista.length > 0 && (
        <ul className="sugestoes">
          {lista.map((c) => (
            <li key={c.id}>
              <button onClick={() => { onChange(c); setQ(''); setLista([]); }}>
                {c.nome}<small>{c.documento || c.telefone || ''}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PDV() {
  const buscaRef = useRef(null);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [itens, setItens] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [desconto, setDesconto] = useState('');
  const [pagamentos, setPagamentos] = useState([]);
  const [valorPg, setValorPg] = useState('');
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [vendaFeita, setVendaFeita] = useState(null);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

  const linhaTotal = (i) => arred((Number(i.quantidade) || 0) * i.preco);
  const subtotal = arred(itens.reduce((s, i) => s + linhaTotal(i), 0));
  const desc = Math.min(Math.max(Number(desconto) || 0, 0), subtotal);
  const total = arred(subtotal - desc);
  const pago = arred(pagamentos.reduce((s, p) => s + p.valor, 0));
  const falta = Math.max(arred(total - pago), 0);
  const troco = Math.max(arred(pago - total), 0);
  const itensOk = itens.length > 0 && itens.every((i) => Number(i.quantidade) > 0);
  const podeFinalizar = itensOk && pago >= total && !salvando && !vendaFeita;

  useEffect(() => {
    const q = busca.trim();
    if (!q) { setResultados([]); return undefined; }
    let vivo = true;
    const t = setTimeout(
      () => api(`/produtos?q=${encodeURIComponent(q)}&ativos=1&limite=8`).then((r) => vivo && setResultados(r)).catch(() => {}),
      250
    );
    return () => { vivo = false; clearTimeout(t); };
  }, [busca]);

  const carregarPedidos = () => api('/pedidos').then(setPedidosPendentes).catch((e) => setErro(e.message));
  useEffect(() => { carregarPedidos(); }, []);

  const adicionar = (p) => {
    setItens((l) => {
      const i = l.findIndex((x) => x.produtoId === p.id);
      if (i >= 0) return l.map((x, n) => (n === i ? { ...x, quantidade: Math.round((Number(x.quantidade) + 1) * 1000) / 1000 } : x));
      return [...l, { produtoId: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, preco: p.preco, quantidade: 1, estoque: p.estoque, controla: p.controla_estoque }];
    });
    setBusca('');
    setResultados([]);
    setErro('');
    buscaRef.current?.focus();
  };

  /* Enter (leitor de código de barras ou digitação): adiciona na hora se houver um único produto certo */
  const aoEnter = async (e) => {
    if (e.key !== 'Enter' || !busca.trim()) return;
    e.preventDefault();
    const q = busca.trim();
    try {
      const r = await api(`/produtos?q=${encodeURIComponent(q)}&ativos=1&limite=8`);
      const alvo = r.find((p) => p.barras === q || p.codigo === q) || (r.length === 1 ? r[0] : null);
      if (alvo) adicionar(alvo);
      else { setResultados(r); setErro(r.length ? '' : 'Produto não encontrado.'); }
    } catch (err) {
      setErro(err.message);
    }
  };

  const mudaQtd = (idx, v) => setItens((l) => l.map((x, n) => (n === idx ? { ...x, quantidade: v === '' ? '' : Number(v) } : x)));
  const removeItem = (idx) => setItens((l) => l.filter((_, n) => n !== idx));

  const addPagamento = (forma) => {
    let v = valorPg === '' ? falta : arred(Number(valorPg));
    if (forma !== 'dinheiro') v = Math.min(v, falta);
    if (!(v > 0)) return;
    setPagamentos((l) => [...l, { forma, valor: v }]);
    setValorPg('');
  };

  const limpar = () => {
    setItens([]); setCliente(null); setDesconto(''); setPagamentos([]); setValorPg('');
    setErro(''); setBusca(''); setVendaFeita(null); setChave(crypto.randomUUID()); setPedidoSelecionado(null);
    buscaRef.current?.focus();
  };

  const selecionarPedido = (pedido) => {
    if (itens.length && !window.confirm('Substituir a venda atual pelo pedido selecionado?')) return;
    setPedidoSelecionado(pedido);
    setItens(pedido.itens.map((i) => ({
      produtoId: i.produto_id,
      codigo: i.codigo,
      descricao: i.descricao,
      unidade: i.unidade,
      preco: Number(i.preco_unit),
      quantidade: Number(i.quantidade),
      controla: false,
    })));
    setCliente({ id: pedido.cliente_id, nome: pedido.cliente_nome });
    setDesconto(String(pedido.desconto || 0));
    setPagamentos([]);
    setValorPg('');
    setErro('');
  };

  const finalizar = async () => {
    setErro('');
    setSalvando(true);
    try {
      let v;
      if (pedidoSelecionado) {
        await api(`/pedidos/${pedidoSelecionado.id}/finalizar`, { method: 'POST', body: { pagamentos } });
        v = await api(`/vendas/${pedidoSelecionado.id}`);
        setPedidosPendentes((lista) => lista.filter((p) => p.id !== pedidoSelecionado.id));
      } else {
        v = await api('/vendas', {
          method: 'POST',
          body: {
            chave,
            clienteId: cliente?.id || null,
            itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: Number(i.quantidade) })),
            desconto: desc,
            pagamentos,
          },
        });
      }
      setVendaFeita(v);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  /* Atalhos: F2 busca, F9 finaliza (o ref mantém sempre a versão mais recente das funções) */
  const atalho = useRef();
  atalho.current = (e) => {
    if (e.key === 'F2') { e.preventDefault(); buscaRef.current?.focus(); }
    if (e.key === 'F9' && podeFinalizar) { e.preventDefault(); finalizar(); }
  };
  useEffect(() => {
    const f = (e) => atalho.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  return (
    <div className="pdv">
      <section className="pdv-venda">
        {pedidoSelecionado ? (
          <div className="card pedido-em-caixa">
            <div><b>Pedido {String(pedidoSelecionado.numero).padStart(6, '0')}</b><small>Cliente: {pedidoSelecionado.cliente_nome} · Vendedor: {pedidoSelecionado.vendedor_nome}</small></div>
            <button className="link perigo" onClick={limpar}>Sair do pedido</button>
          </div>
        ) : (
          <>
            <div className="card pedidos-caixa">
              <div className="topo"><h2>Pedidos aguardando pagamento</h2><button className="link" onClick={carregarPedidos}>Atualizar</button></div>
              {pedidosPendentes.map((p) => (
                <button key={p.id} className="pedido-caixa-item" onClick={() => selecionarPedido(p)}>
                  <span><b>Pedido {String(p.numero).padStart(6, '0')} · {p.cliente_nome}</b><small>Vendedor: {p.vendedor_nome} · {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}</small></span>
                  <b>{brl(p.total)}</b>
                </button>
              ))}
              {!pedidosPendentes.length && <p className="suave sem-margem">Nenhum pedido aguardando pagamento.</p>}
            </div>
            <input
              ref={buscaRef}
              className="busca-pdv"
              autoFocus
              placeholder="Bipe o código de barras ou digite nome ou código (F2)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={aoEnter}
              aria-label="Buscar produto"
            />
          </>
        )}
        {erro && <div className="alerta">{erro}</div>}
        {resultados.length > 0 && (
          <ul className="resultados">
            {resultados.map((p) => (
              <li key={p.id}>
                <button onClick={() => adicionar(p)}>
                  <span><b>{p.descricao}</b><small>código {p.codigo}{p.barras ? `, barras ${p.barras}` : ''}</small></span>
                  <span className="dir"><b>{brl(p.preco)}</b><small>{p.controla_estoque ? `${qtd(p.estoque)} ${p.unidade} em estoque` : 'sem controle de estoque'}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="card tabela-wrap">
          <table className="tabela">
            <thead>
              <tr><th>Produto</th><th className="dir">Qtd</th><th className="dir">Preço</th><th className="dir">Total</th><th /></tr>
            </thead>
            <tbody>
              {itens.map((i, n) => {
                const semEstoque = i.controla && Number(i.quantidade) > i.estoque;
                return (
                  <tr key={i.produtoId} className={semEstoque ? 'aviso' : ''}>
                    <td>
                      {i.descricao}
                      <small className="bloco suave">{semEstoque ? `Só há ${qtd(i.estoque)} ${i.unidade} em estoque` : `código ${i.codigo}`}</small>
                    </td>
                    <td className="dir">
                      <input className="qtd" type="number" min="0.001" step="any" value={i.quantidade} onChange={(e) => mudaQtd(n, e.target.value)} disabled={Boolean(pedidoSelecionado)} aria-label={`Quantidade de ${i.descricao}`} />
                    </td>
                    <td className="dir">{brl(i.preco)}</td>
                    <td className="dir"><b>{brl(linhaTotal(i))}</b></td>
                    <td className="dir">{!pedidoSelecionado && <button className="link perigo" onClick={() => removeItem(n)} aria-label={`Remover ${i.descricao}`}>Remover</button>}</td>
                  </tr>
                );
              })}
              {!itens.length && <tr><td colSpan="5" className="vazio">Nenhum item na venda. Bipe um código de barras ou busque um produto.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="pdv-pagto">
        <div className="visor">
          <span>Total a pagar</span>
          <output aria-live="polite">{brl(total)}</output>
        </div>

        <div className="card">
          <ClienteBusca cliente={cliente} onChange={setCliente} somenteLeitura={Boolean(pedidoSelecionado)} />
          <div className="linhas">
            <div><span>Subtotal</span><b>{brl(subtotal)}</b></div>
            <label className="desconto">
              <span>Desconto (R$)</span>
              <input type="number" min="0" step="0.01" placeholder="0,00" value={desconto} onChange={(e) => setDesconto(e.target.value)} disabled={Boolean(pedidoSelecionado)} />
            </label>
          </div>
        </div>

        <div className="card">
          <h2>Pagamento</h2>
          <label>
            Valor recebido
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder={falta > 0 ? falta.toFixed(2) : '0.00'} value={valorPg} onChange={(e) => setValorPg(e.target.value)} />
          </label>
          <div className="formas">
            {Object.entries(FORMAS).map(([k, nome]) => (
              <button key={k} className="btn" disabled={!itensOk || falta <= 0} onClick={() => addPagamento(k)}>{nome}</button>
            ))}
          </div>
          {pagamentos.length > 0 && (
            <ul className="pagos">
              {pagamentos.map((p, n) => (
                <li key={n}>
                  <span>{FORMAS[p.forma]}</span>
                  <b>{brl(p.valor)}</b>
                  <button className="link perigo" onClick={() => setPagamentos((l) => l.filter((_, x) => x !== n))} aria-label={`Remover pagamento em ${FORMAS[p.forma]}`}>Remover</button>
                </li>
              ))}
            </ul>
          )}
          <div className="situacao">
            {falta > 0 && itensOk && <div><span>Falta receber</span><b>{brl(falta)}</b></div>}
            {troco > 0 && <div className="troco"><span>Troco</span><b>{brl(troco)}</b></div>}
          </div>
          <button className="btn primario grande" disabled={!podeFinalizar} onClick={finalizar}>
            {salvando ? 'Gravando…' : pedidoSelecionado ? 'Finalizar pedido (F9)' : 'Finalizar venda (F9)'}
          </button>
          {itens.length > 0 && !salvando && <button className="link perigo centro-txt" onClick={() => window.confirm('Descartar esta venda?') && limpar()}>Descartar venda</button>}
        </div>
      </aside>

      {vendaFeita && (
        <Modal titulo={`Venda ${String(vendaFeita.numero).padStart(6, '0')} concluída`} onClose={limpar}>
          <Recibo venda={vendaFeita} />
          <div className="acoes">
            <button className="btn" onClick={() => window.print()}>Imprimir comprovante</button>
            <button className="btn primario" onClick={limpar} autoFocus>Nova venda</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
