import { useState } from 'react';
import Cadastro from '../components/Cadastro.jsx';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { brl, dataHora } from '../utils.js';

const campos = [
  { k: 'nome', t: 'Nome', req: true, full: true },
  { k: 'documento', t: 'CPF ou CNPJ' },
  { k: 'telefone', t: 'Telefone' },
  { k: 'email', t: 'E-mail', tipo: 'email', full: true },
  { k: 'endereco', t: 'Endereço', full: true },
];
const colunas = [
  { k: 'nome', t: 'Nome' },
  { k: 'documento', t: 'CPF ou CNPJ' },
  { k: 'telefone', t: 'Telefone' },
  { k: 'email', t: 'E-mail' },
];
const formas = [['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['debito', 'Débito'], ['credito', 'Crédito']];

export default function Clientes() {
  const { admin, usuario } = useAuth();
  const [historico, setHistorico] = useState(null);
  const [erro, setErro] = useState('');
  const [cobranca, setCobranca] = useState(null);
  const [forma, setForma] = useState('pix');
  const [valor, setValor] = useState('');

  const abrirHistorico = async (cliente) => {
    setErro('');
    try {
      setHistorico(await api(`/clientes/${cliente.id}/historico`));
    } catch (e) {
      setErro(e.message);
    }
  };
  const receber = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      await api(`/clientes/${historico.cliente.id}/cobrancas`, {
        method: 'POST',
        body: { vendaId: cobranca.id, forma, valor: Number(valor) },
      });
      setHistorico(await api(`/clientes/${historico.cliente.id}/historico`));
      setCobranca(null);
      setValor('');
      window.dispatchEvent(new CustomEvent('toast', { detail: 'Recebimento registrado com sucesso.' }));
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <>
      {erro && !historico && <div className="alerta espaco-abaixo">{erro}</div>}
      <Cadastro
        titulo="Clientes"
        singular="cliente"
        rota="/clientes"
        colunas={colunas}
        campos={campos}
        vazio={{}}
        podeEditar
        vazioTexto="Nenhum cliente cadastrado. Cadastre o primeiro para associar vendas e pedidos."
        renderExtra={(cliente) => <button className="link" onClick={() => abrirHistorico(cliente)}>Histórico</button>}
      />
      {historico && (
        <Modal titulo={`Histórico · ${historico.cliente.nome}`} onClose={() => { setHistorico(null); setErro(''); }} largo>
          {erro && <div className="alerta espaco-abaixo">{erro}</div>}
          <section className="metricas metricas-compactas">
            <article className="card metrica"><span>Compras</span><b>{historico.resumo.compras}</b></article>
            <article className="card metrica"><span>Total comprado</span><b>{brl(historico.resumo.total_comprado)}</b></article>
            <article className="card metrica"><span>Em aberto / fiado</span><b>{brl(historico.resumo.saldo_devedor)}</b></article>
          </section>
          <div className="card tabela-wrap espaco-cima">
            <table className="tabela"><thead><tr><th>Venda</th><th>Data</th><th>Situação</th><th className="dir">Total</th><th className="dir">Saldo</th><th /></tr></thead>
              <tbody>{historico.vendas.map((v) => (
                <tr key={v.id} className={v.status === 'cancelada' ? 'inativo' : ''}>
                  <td>{String(v.numero).padStart(6, '0')}</td><td>{dataHora(v.data)}</td>
                  <td>{v.status === 'cancelada' ? 'Cancelada / devolvida' : 'Concluída'}</td>
                  <td className="dir">{brl(v.total)}</td><td className="dir">{brl(v.saldo_devedor)}</td>
                  <td className="dir">{usuario.perfil !== 'vendedor' && v.saldo_devedor > 0 && <button className="link" onClick={() => { setCobranca(v); setValor(Number(v.saldo_devedor).toFixed(2)); }}>Receber</button>}</td>
                </tr>
              ))}
                {!historico.vendas.length && <tr><td colSpan="6" className="vazio">Este cliente ainda não possui vendas.</td></tr>}</tbody>
            </table>
          </div>
          {cobranca && (
            <form className="form espaco-cima" onSubmit={receber}>
              <h2 className="full">Receber venda {String(cobranca.numero).padStart(6, '0')}</h2>
              <label>Forma de pagamento<select value={forma} onChange={(e) => setForma(e.target.value)}>{formas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
              <label>Valor recebido (R$)<input type="number" min="0.01" max={cobranca.saldo_devedor} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required /></label>
              <div className="acoes full"><button type="button" className="btn" onClick={() => setCobranca(null)}>Cancelar</button><button className="btn primario">Registrar recebimento</button></div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
