import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login, registrar } = useAuth();
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ empresa: '', nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const mudar = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      if (novo) await registrar(f);
      else await login(f.email, f.senha);
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={enviar}>
        <h1>{novo ? 'Criar a conta da sua empresa' : 'Entrar no caixa'}</h1>
        <p className="suave">
          {novo ? 'Você será o administrador e depois cadastra os outros usuários.' : 'Use o e-mail e a senha da sua empresa.'}
        </p>
        {novo && (
          <>
            <label>Nome da empresa<input value={f.empresa} onChange={mudar('empresa')} required minLength={2} autoFocus /></label>
            <label>Seu nome<input value={f.nome} onChange={mudar('nome')} required minLength={2} autoComplete="name" /></label>
          </>
        )}
        <label>E-mail<input type="email" value={f.email} onChange={mudar('email')} required autoComplete="email" autoFocus={!novo} /></label>
        <label>
          Senha
          <input type="password" value={f.senha} onChange={mudar('senha')} required minLength={novo ? 8 : 1} autoComplete={novo ? 'new-password' : 'current-password'} />
          {novo && <small>Mínimo de 8 caracteres.</small>}
        </label>
        {erro && <div className="alerta">{erro}</div>}
        <button className="btn primario grande" disabled={enviando}>
          {enviando ? 'Aguarde…' : novo ? 'Criar empresa e entrar' : 'Entrar'}
        </button>
        <button type="button" className="link" onClick={() => { setNovo(!novo); setErro(''); }}>
          {novo ? 'Já tenho conta' : 'Quero criar a conta da minha empresa'}
        </button>
      </form>
    </div>
  );
}
