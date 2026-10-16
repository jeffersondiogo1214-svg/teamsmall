import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { arred, brl, dataHora, qtd } from '../utils.js';
import { ClienteBusca } from './PDV.jsx';
import { FormCadastro } from '../components/Cadastro.jsx';

const camposCliente = [
  { k: 'nome', t: 'Nome', req: true, full: true },
  { k: 'documento', t: 'CPF ou CNPJ', req: true },
  { k: 'telefone', t: 'Telefone' },
  { k: 'email', t: 'E-mail', tipo: 'email', full: true },
  { k: 'endereco', t: 'Endereço', full: true },
];

export default function Pedidos() {
  const { admin, usuario } = useAuth();
  const [busca, setBusca] = useState('');
  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [desconto, setDesconto] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [novoCliente, setNovoCliente] = useState(false);

  const subtotal = arred(itens.reduce((s, i) => s + arred((Number(i.quantidade) || 0) * i.preco), 0));
  const desc = Math.min(Math.max(Number(desconto) || 0, 0), subtotal);
  const total = arred(subtotal - desc);

  const carregarPedidos = useCallback(
    () => api('/pedidos').then(setPedidos).catch((e) => setErro(e.message)),
    []
  );
  useEffect(() => { carregarPedidos(); }, [carregarPedidos]);

  useEffect(() => {
    const q = busca.trim();
    if (!q) { setProdutos([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => {
      api(`/produtos?q=${encodeURIComponent(q)}&ativos=1&limite=8`)
        .then((r) => vivo && setProdutos(r))
        .catch((e) => vivo && setErro(e.message));
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca]);

  const adicionar = (produto) => {
    setItens((lista) => {
      const existente = lista.findIndex((i) => i.produtoId === produto.id);
      if (existente >= 0) {
        return lista.map((i, n) => n === existente
          ? { ...i, quantidade: Math.round((Number(i.quantidade) + 1) * 1000) / 1000 }
          : i);
      }
      return [...lista, {
        produtoId: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        unidade: produto.unidade,
        preco: produto.preco,
        quantidade: 1,
        estoque: produto.estoque,
        controla: produto.controla_estoque,
      }];
    });
    setBusca('');
    setProdutos([]);
    setErro('');
  };

  const salvarPedido = async () => {
    setErro('');
    setMensagem('');
    setSalvando(true);
    try {
      const pedido = await api('/pedidos', {
        method: 'POST',
        body: {
          chave,
          clienteId: cliente.id,
          itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: Number(i.quantidade) })),
          desconto: desc,
        },
      });
      setMensagem(`Pedido ${String(pedido.numero).padStart(6, '0')} salvo. O estoque foi reservado para o caixa.`);
      setItens([]);
      setCliente(null);
      setDesconto('');
      setChave(crypto.randomUUID());
      carregarPedidos();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const cancelarPedido = async (pedido) => {
    if (!window.confirm(`Cancelar o pedido ${String(pedido.numero).padStart(6, '0')}? Os itens reservados voltarão ao estoque.`)) return;
    setErro('');
    try {
      await api(`/pedidos/${pedido.id}/cancelar`, { method: 'POST' });
      carregarPedidos();
    } catch (e) {
      setErro(e.message);
    }
  };

  const editarQtd = (idx, valor) => setItens((lista) => lista.map((i, n) => (
    n === idx ? { ...i, quantidade: valor === '' ? '' : Number(valor) } : i
  )));

  return (
    <div>
      <div className="topo"><h1>Montar pedido</h1></div>
      <p className="suave">Monte o pedido para o cliente. Ao salvar, o estoque fica reservado e o caixa conclui o pagamento no PDV.</p>
      {erro && <div className="alerta espaco-abaixo">{erro}</div>}
      {mensagem && <div className="ok espaco-abaixo">{mensagem}</div>}

      <section className="pedido-montagem">
        <div className="pdv-venda">
          <input
            className="busca-pdv"
            placeholder="Buscar produto por nome, código ou código de barras"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar produto para o pedido"
          />
          {produtos.length > 0 && (
            <ul className="resultados">
              {produtos.map((p) => (
                <li key={p.id}>
                  <button onClick={() => adicionar(p)}>
                    <span><b>{p.descricao}</b><small>Código {p.codigo}</small></span>
                    <span className="dir"><b>{brl(p.preco)}</b><small>{p.controla_estoque ? `${qtd(p.estoque)} ${p.unidade} disponíveis` : 'sem controle de estoque'}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="card tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Produto</th><th className="dir">Qtd</th><th className="dir">Preço</th><th className="dir">Total</th><th /></tr></thead>
              <tbody>
                {itens.map((i, idx) => (
                  <tr key={i.produtoId}>
                    <td>{i.descricao}<small className="bloco suave">Código {i.codigo}</small></td>
                    <td className="dir"><input className="qtd" type="number" min="0.001" step="any" value={i.quantidade} onChange={(e) => editarQtd(idx, e.target.value)} aria-label={`Quantidade de ${i.descricao}`} /></td>
                    <td className="dir">{brl(i.preco)}</td>
                    <td className="dir"><b>{brl(arred((Number(i.quantidade) || 0) * i.preco))}</b></td>
                    <td className="dir"><button className="link perigo" onClick={() => setItens((lista) => lista.filter((_, n) => n !== idx))}>Remover</button></td>
                  </tr>
                ))}
                {!itens.length && <tr><td colSpan="5" className="vazio">Adicione os produtos que o cliente vai levar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="pdv-pagto">
          <div className="card">
            <h2>Cliente</h2>
            <ClienteBusca cliente={cliente} onChange={setCliente} />
            <button className="link" onClick={() => setNovoCliente(true)}>Cadastrar cliente</button>
          </div>
          <div className="card linhas pedido-resumo">
            <label className="desconto">
              <span>Desconto (R$)</span>
              <input type="number" min="0" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
            </label>
            <div><span>Subtotal</span><b>{brl(subtotal)}</b></div>
            <div><span>Total do pedido</span><b>{brl(total)}</b></div>
            <button className="btn primario grande" disabled={!cliente || !itens.length || itens.some((i) => !(Number(i.quantidade) > 0)) || salvando} onClick={salvarPedido}>
              {salvando ? 'Salvando…' : 'Fechar pedido'}
            </button>
          </div>
        </aside>
      </section>

      <div className="topo espaco">
        <h2>Pedidos aguardando o caixa</h2>
        <button className="btn" onClick={carregarPedidos}>Atualizar</button>
      </div>
      <div className="card tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th className="dir">Total</th><th /></tr></thead>
          <tbody>
            {pedidos.map((p) => {
              const podeCancelar = admin || p.vendedor_id === usuario.id;
              return (
                <tr key={p.id}>
                  <td>{String(p.numero).padStart(6, '0')}</td>
                  <td>{dataHora(p.criado_em)}</td>
                  <td>{p.cliente_nome}</td>
                  <td>{p.vendedor_nome}</td>
                  <td className="dir"><b>{brl(p.total)}</b></td>
                  <td className="dir">{podeCancelar && <button className="link perigo" onClick={() => cancelarPedido(p)}>Cancelar</button>}</td>
                </tr>
              );
            })}
            {!pedidos.length && <tr><td colSpan="6" className="vazio">Nenhum pedido aguardando o caixa.</td></tr>}
          </tbody>
        </table>
      </div>

      {novoCliente && (
        <FormCadastro
          titulo="Cadastrar cliente"
          campos={camposCliente}
          inicial={{}}
          rota="/clientes"
          onClose={() => setNovoCliente(false)}
          onSalvo={() => { setNovoCliente(false); setMensagem('Cliente cadastrado. Busque-o pelo nome para associar ao pedido.'); }}
        />
      )}
    </div>
  );
}
