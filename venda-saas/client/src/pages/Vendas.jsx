import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { arred, brl, dataHora, hoje } from '../utils.js';
import Modal from '../components/Modal.jsx';
import Recibo from '../components/Recibo.jsx';

export default function Vendas() {
  const { admin } = useAuth();
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(null);

  const carregar = useCallback(
    () => api(`/vendas?de=${de}&ate=${ate}&q=${encodeURIComponent(q.trim())}`).then((r) => { setErro(''); setLista(r); }).catch((e) => setErro(e.message)),
    [de, ate, q]
  );
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  const abrir = (id) => api(`/vendas/${id}`).then(setAberta).catch((e) => setErro(e.message));

  const cancelar = async () => {
    if (!window.confirm(`Cancelar a venda ${aberta.numero}? Os itens voltam para o estoque.`)) return;
    try {
      setAberta(await api(`/vendas/${aberta.id}/cancelar`, { method: 'POST' }));
      carregar();
    } catch (e) {
      window.alert(e.message);
    }
  };

  const concluidas = lista.filter((v) => v.status === 'concluida');
  const faturado = arred(concluidas.reduce((s, v) => s + v.total, 0));

  return (
    <div>
      <div className="topo"><h1>Vendas</h1></div>
      <div className="filtros">
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <label className="cresce">Buscar<input placeholder="Número da venda ou nome do cliente" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      {erro && <div className="alerta">{erro}</div>}
      <p className="resumo">
        {concluidas.length} {concluidas.length === 1 ? 'venda concluída' : 'vendas concluídas'} no período, somando <b>{brl(faturado)}</b>
      </p>
      <div className="card tabela-wrap">
        <table className="tabela">
          <thead>
            <tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Operador</th><th className="dir">Total</th><th>Situação</th><th /></tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id} className={v.status === 'cancelada' ? 'inativo' : ''}>
                <td>{String(v.numero).padStart(6, '0')}</td>
                <td>{dataHora(v.criado_em)}</td>
                <td>{v.cliente_nome || 'Consumidor final'}</td>
                <td>{v.usuario_nome}</td>
                <td className="dir"><b>{brl(v.total)}</b></td>
                <td>{v.status === 'cancelada' ? 'Cancelada' : 'Concluída'}</td>
                <td className="dir"><button className="link" onClick={() => abrir(v.id)}>Ver comprovante</button></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan="7" className="vazio">Nenhuma venda neste período.</td></tr>}
          </tbody>
        </table>
      </div>

      {aberta && (
        <Modal titulo={`Venda ${String(aberta.numero).padStart(6, '0')}`} onClose={() => setAberta(null)}>
          <Recibo venda={aberta} />
          <div className="acoes">
            {admin && aberta.status === 'concluida' && <button className="btn perigo" onClick={cancelar}>Cancelar venda</button>}
            <button className="btn" onClick={() => window.print()}>Imprimir</button>
            <button className="btn primario" onClick={() => setAberta(null)}>Fechar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
