import { useState } from 'react';
import Cadastro from '../components/Cadastro.jsx';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { brl, dataHora, qtd } from '../utils.js';

const campos = [
  { k: 'codigo', t: 'Código', req: true },
  { k: 'barras', t: 'Código de barras' },
  { k: 'descricao', t: 'Descrição', req: true, full: true },
  { k: 'categoria', t: 'Categoria' },
  { k: 'imagem_url', t: 'URL da foto do produto', full: true, dica: 'Informe uma imagem pública em HTTPS, se houver.' },
  { k: 'unidade', t: 'Unidade', req: true, dica: 'UN, KG, CX…' },
  { k: 'preco', t: 'Preço de venda (R$)', tipo: 'number', step: '0.01', req: true },
  { k: 'estoque', t: 'Estoque atual', tipo: 'number', step: 'any' },
  { k: 'estoque_minimo', t: 'Avisar quando chegar a', tipo: 'number', step: 'any' },
  { k: 'controla_estoque', t: 'Controlar estoque (bloqueia a venda quando acabar)', tipo: 'check' },
  { k: 'ativo', t: 'Produto ativo', tipo: 'check', soEdicao: true },
];

const colunas = [
  { k: 'codigo', t: 'Código' },
  { k: 'descricao', t: 'Produto', f: (p) => <span className="produto-celula">{p.imagem_url && <img src={p.imagem_url} alt="" loading="lazy" />}<span>{p.descricao}<small className="bloco suave">{p.categoria || 'Sem categoria'}</small></span></span> },
  { k: 'preco', t: 'Preço', dir: true, f: (p) => brl(p.preco) },
  { k: 'estoque', t: 'Estoque', dir: true, f: (p) => (
    p.controla_estoque
      ? <span className={Number(p.estoque) <= Number(p.estoque_minimo) ? 'estoque-baixo' : ''}>{qtd(p.estoque)} {p.unidade}{Number(p.estoque) <= Number(p.estoque_minimo) && <small className="bloco">Estoque baixo</small>}</span>
      : 'Sem controle'
  ) },
  { k: 'ativo', t: 'Situação', f: (p) => (p.ativo ? 'Ativo' : 'Inativo') },
];

export default function Produtos() {
  const { admin } = useAuth();
  const [produto, setProduto] = useState(null);
  const [tipo, setTipo] = useState('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [movimentos, setMovimentos] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const abrirEstoque = async (p) => {
    setProduto(p);
    setQuantidade('');
    setMotivo('');
    setErro('');
    try {
      setMovimentos(await api(`/produtos/${p.id}/movimentos`));
    } catch (e) {
      setErro(e.message);
    }
  };
  const salvarEstoque = async (e) => {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api(`/produtos/${produto.id}/estoque`, { method: 'POST', body: { tipo, quantidade: Number(quantidade), motivo } });
      setProduto(null);
      window.dispatchEvent(new CustomEvent('toast', { detail: `Estoque de ${produto.descricao} atualizado.` }));
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Cadastro
        titulo="Produtos"
        singular="produto"
        rota="/produtos"
        colunas={colunas}
        campos={campos}
        vazio={{ unidade: 'UN', estoque: 0, estoque_minimo: 0, controla_estoque: true, ativo: true }}
        podeEditar={admin}
        vazioTexto="Nenhum produto cadastrado. Cadastre o primeiro para começar as vendas."
        rotuloRemover="Inativar"
        renderExtra={(p) => <button className="link" onClick={() => abrirEstoque(p)}>Estoque</button>}
      />
      {produto && (
        <Modal titulo={`Estoque · ${produto.descricao}`} onClose={() => setProduto(null)} largo>
          {erro && <div className="alerta espaco-abaixo">{erro}</div>}
          {produto.controla_estoque ? (
            <>
              <p>Estoque atual: <b>{qtd(produto.estoque)} {produto.unidade}</b></p>
              <form className="form" onSubmit={salvarEstoque}>
                <label>Operação<select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="entrada">Entrada de mercadoria</option><option value="ajuste">Ajuste para uma nova quantidade</option></select></label>
                <label>{tipo === 'entrada' ? 'Quantidade que entrou' : 'Quantidade física contada'}<input type="number" min="0.001" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required /></label>
                <label className="full">Motivo<input value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={3} required /></label>
                <div className="acoes full"><button className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar entrada/ajuste'}</button></div>
              </form>
            </>
          ) : <p>Este produto está configurado sem controle de estoque.</p>}
          <h2 className="espaco-cima">Histórico de movimentações</h2>
          <div className="card tabela-wrap">
            <table className="tabela"><thead><tr><th>Data</th><th>Tipo</th><th>Motivo</th><th className="dir">Variação</th><th className="dir">Após</th></tr></thead>
              <tbody>{movimentos.map((m) => <tr key={m.id}><td>{dataHora(m.criado_em)}</td><td>{m.tipo.replaceAll('_', ' ')}</td><td>{m.motivo || '—'}</td><td className="dir">{m.variacao > 0 ? '+' : ''}{qtd(m.variacao)}</td><td className="dir">{qtd(m.estoque_apos)}</td></tr>)}
                {!movimentos.length && <tr><td colSpan="5" className="vazio">Ainda sem movimentações registradas.</td></tr>}</tbody></table>
          </div>
        </Modal>
      )}
    </>
  );
}
