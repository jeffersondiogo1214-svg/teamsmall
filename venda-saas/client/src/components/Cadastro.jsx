import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from './Modal.jsx';

/* Formulário genérico dentro de um modal. campos: { k, t, tipo, req, full, dica, opcoes, soNovo, soEdicao, reqNovo } */
export function FormCadastro({ titulo, campos, inicial, rota, onClose, onSalvo }) {
  const edicao = Boolean(inicial.id);
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const mudar = (c) => (e) => setF((s) => ({ ...s, [c.k]: c.tipo === 'check' ? e.target.checked : e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    const body = {};
    for (const c of campos) {
      const v = f[c.k];
      if (c.tipo === 'password' && !v) continue;
      body[c.k] = c.tipo === 'number' ? Number(v) || 0 : c.tipo === 'check' ? Boolean(v) : v ?? '';
    }
    try {
      await api(edicao ? `${rota}/${inicial.id}` : rota, { method: edicao ? 'PUT' : 'POST', body });
      onSalvo();
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <form className="form" onSubmit={enviar}>
        {campos.filter((c) => !(c.soEdicao && !edicao)).map((c) =>
          c.tipo === 'check' ? (
            <label key={c.k} className="check full">
              <input type="checkbox" checked={Boolean(f[c.k])} onChange={mudar(c)} /> {c.t}
            </label>
          ) : (
            <label key={c.k} className={c.full ? 'full' : ''}>
              {c.t}
              {c.tipo === 'select' ? (
                <select value={f[c.k] ?? ''} onChange={mudar(c)}>
                  {c.opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              ) : (
                <input
                  type={c.tipo || 'text'}
                  step={c.step}
                  min={c.tipo === 'number' ? 0 : undefined}
                  minLength={c.tipo === 'password' ? 8 : undefined}
                  required={c.req || (c.reqNovo && !edicao)}
                  disabled={c.soNovo && edicao}
                  autoComplete={c.tipo === 'password' ? 'new-password' : 'off'}
                  value={f[c.k] ?? ''}
                  onChange={mudar(c)}
                />
              )}
              {c.dica && <small>{c.dica}</small>}
            </label>
          )
        )}
        {erro && <div className="alerta full">{erro}</div>}
        <div className="acoes full">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* Tela de listagem com busca, criação, edição e remoção */
export default function Cadastro({ titulo, singular, rota, colunas, campos, vazio, podeEditar, rotuloRemover = 'Remover' }) {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState(null);

  const carregar = useCallback(
    () => api(`${rota}?q=${encodeURIComponent(q.trim())}&limite=200`).then(setLista).catch((e) => setErro(e.message)),
    [rota, q]
  );
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  const remover = async (x) => {
    if (!window.confirm(`${rotuloRemover} "${x.nome || x.descricao}"?`)) return;
    try {
      await api(`${rota}/${x.id}`, { method: 'DELETE' });
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div>
      <div className="topo">
        <h1>{titulo}</h1>
        {podeEditar && <button className="btn primario" onClick={() => setForm(vazio)}>Novo {singular}</button>}
      </div>
      <input className="busca" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
      {erro && <div className="alerta">{erro}</div>}
      <div className="card tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              {colunas.map((c) => <th key={c.k} className={c.dir ? 'dir' : ''}>{c.t}</th>)}
              {podeEditar && <th />}
            </tr>
          </thead>
          <tbody>
            {lista.map((x) => (
              <tr key={x.id} className={x.ativo === false ? 'inativo' : ''}>
                {colunas.map((c) => <td key={c.k} className={c.dir ? 'dir' : ''}>{c.f ? c.f(x) : x[c.k]}</td>)}
                {podeEditar && (
                  <td className="dir nowrap">
                    <button className="link" onClick={() => setForm(x)}>Editar</button>
                    {x.ativo !== false && <button className="link perigo" onClick={() => remover(x)}>{rotuloRemover}</button>}
                  </td>
                )}
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={colunas.length + 1} className="vazio">Nada por aqui ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {form && (
        <FormCadastro
          titulo={form.id ? `Editar ${singular}` : `Novo ${singular}`}
          campos={campos}
          inicial={form}
          rota={rota}
          onClose={() => setForm(null)}
          onSalvo={() => { setForm(null); carregar(); }}
        />
      )}
    </div>
  );
}
