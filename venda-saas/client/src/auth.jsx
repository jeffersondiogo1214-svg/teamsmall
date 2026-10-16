import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, definirAoExpirar } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(localStorage.getItem('token')));

  const sair = useCallback(() => {
    localStorage.removeItem('token');
    setSessao(null);
  }, []);

  useEffect(() => {
    definirAoExpirar(sair);
    if (!localStorage.getItem('token')) return;
    api('/auth/eu').then(setSessao).catch(sair).finally(() => setCarregando(false));
  }, [sair]);

  const entrar = async (caminho, body) => {
    const r = await api(caminho, { method: 'POST', body });
    localStorage.setItem('token', r.token);
    setSessao({ usuario: r.usuario, empresa: r.empresa });
  };

  const valor = {
    ...sessao,
    carregando,
    sair,
    admin: sessao?.usuario.perfil === 'admin',
    login: (email, senha) => entrar('/auth/login', { email, senha }),
    registrar: (dados) => entrar('/auth/registrar', dados),
    setEmpresa: (empresa) => setSessao((s) => ({ ...s, empresa })),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
