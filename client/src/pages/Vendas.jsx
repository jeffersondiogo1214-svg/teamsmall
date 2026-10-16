import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { arred, brl, dataHora, hoje } from '../utils.js';
import Modal from '../components/Modal.jsx';
import Recibo from '../components/Recibo.jsx';

export default function Vendas() {
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [formaReembolso, setFormaReembolso] = useState('');
  const [quantidades, setQuantidades] = useState({});
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(
    () => api(`/vendas?de=${de}&ate=${ate}&q=${encodeURIComponent(q.trim())}`).then((r) => { setErro(''); setLista(r); }).catch((e) => setErro(e.message)),
    [de, ate, q]
  );
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  const abrir = (id) => api(`/vendas/${id}`).then(setAberta).catch((e) => setErro(e.message));

  const registrarDevolucao = async (cancelar = false) => {
    if (!motivo.trim()) {
      setErro('Informe o motivo da devolução ou cancelamento.');
      return;
    }
    const itens = aberta.itens
      .map((item) => ({
        itemId: item.id,
        quantidade: cancelar
          ? Number(item.quantidade) - Number(item.quantidade_devolvida)
          : Number(quantidades[item.id] || 0),
      }))
      .filter((item) => item.quantidade > 0);
    if (!cancelar && !itens.length) {
      setErro('Informe a quantidade de pelo menos um item para devolver.');
      return;
    }
    if (cancelar && !window.confirm(`Cancelar a venda ${aberta.numero} e devolver todos os itens restantes?`)) return;
    setSalvando(true);
    setErro('');
    try {
      const atualizada = await api(
        cancelar ? `/vendas/${aberta.id}/cancelar` : `/vendas/${aberta.id}/devolucoes`,
        {
          method: 'POST',
          body: cancelar
            ? { motivo: motivo.trim(), formaReembolso: formaReembolso || null }
            : { motivo: motivo.trim(), formaReembolso: formaReembolso || null, itens },
        }
      );
      setAberta(atualizada);
      setMotivo('');
      setFormaReembolso('');
      setQuantidades({});
      carregar();
      window.dispatchEvent(new CustomEvent('toast', { detail: cancelar ? 'Venda cancelada.' : 'Devolução registrada.' }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const concluidas = lista.filter((v) => v.status === 'concluida');
  const faturado = arred(concluidas.reduce((s, v) => s + Number(v.liquido), 0));

  return (
    <div>
      <div className="topo"><h1>Vendas</h1></div>
      <div className="filtros">
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <label className="cresce">Buscar<input placeholder="Número da venda ou nome do cliente" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      {erro && !aberta && <div className="alerta">{erro}</div>}
      <p className="resumo">
        {concluidas.length} {concluidas.length === 1 ? 'venda concluída' : 'vendas concluídas'} no período, somando <b>{brl(faturado)}</b>
      </p>
      <div className="card tabela-wrap">
        <table className="tabela">
          <thead>
            <tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Vendedor / caixa</th><th className="dir">Líquido</th><th>Situação</th><th /></tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id} className={v.status === 'cancelada' ? 'inativo' : ''}>
                <td>{String(v.numero).padStart(6, '0')}</td>
                <td>{dataHora(v.criado_em)}</td>
                <td>{v.cliente_nome || 'Consumidor final'}</td>
                <td>{v.vendedor_nome ? `${v.vendedor_nome} / ${v.usuario_nome}` : v.usuario_nome}</td>
                <td className="dir"><b>{brl(v.liquido)}</b>{Number(v.devolvido) > 0 && <small className="bloco suave">Devolvido: {brl(v.devolvido)}</small>}</td>
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
          {erro && <div className="alerta espaco-cima">{erro}</div>}
          {aberta.devolucoes?.length > 0 && (
            <section className="espaco-cima">
              <h2>Devoluções registradas</h2>
              {aberta.devolucoes.map((d) => (
                <p key={d.id} className="suave">
                  {dataHora(d.criado_em)} · {d.motivo} · {brl(d.valor)}
                  {Number(d.valor_reembolsado) > 0 && ` · Reembolsado ${brl(d.valor_reembolsado)} (${d.forma_reembolso})`}
                </p>
              ))}
            </section>
          )}
          {aberta.status === 'concluida' && (
            <form className="form espaco-cima" onSubmit={(e) => { e.preventDefault(); registrarDevolucao(); }}>
              <h2 className="full">Devolver itens ou cancelar venda</h2>
              <label className="full">Motivo<input value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={3} maxLength={300} required /></label>
              <label>Forma de reembolso<select value={formaReembolso} onChange={(e) => setFormaReembolso(e.target.value)}>
                <option value="">Sem reembolso (abater saldo em aberto)</option>
                <option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="debito">Débito</option><option value="credito">Crédito</option>
              </select></label>
              <div className="full tabela-wrap">
                <table className="tabela">
                  <thead><tr><th>Produto</th><th className="dir">Disponível</th><th className="dir">Devolver</th></tr></thead>
                  <tbody>{aberta.itens.map((item) => {
                    const disponivel = Number(item.quantidade) - Number(item.quantidade_devolvida);
                    return <tr key={item.id}>
                      <td>{item.descricao}</td>
                      <td className="dir">{disponivel}</td>
                      <td className="dir"><input
                        className="qtd"
                        type="number"
                        min="0"
                        max={disponivel}
                        step="0.001"
                        value={quantidades[item.id] ?? ''}
                        onChange={(e) => setQuantidades((s) => ({ ...s, [item.id]: e.target.value }))}
                        disabled={!disponivel}
                        aria-label={`Quantidade a devolver de ${item.descricao}`}
                      /></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <div className="acoes full">
                <button type="submit" className="btn primario" disabled={salvando}>{salvando ? 'Registrando…' : 'Registrar devolução parcial'}</button>
                <button type="button" className="btn perigo" disabled={salvando} onClick={() => registrarDevolucao(true)}>Cancelar venda inteira</button>
              </div>
            </form>
          )}
          <div className="acoes">
            <button className="btn" onClick={() => window.print()}>Imprimir</button>
            <button className="btn primario" onClick={() => setAberta(null)}>Fechar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
