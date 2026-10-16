import { useEffect } from 'react';

export default function Modal({ titulo, onClose, children, largo }) {
  useEffect(() => {
    const fechar = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${largo ? ' largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="x" onClick={onClose} aria-label="Fechar janela">×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
