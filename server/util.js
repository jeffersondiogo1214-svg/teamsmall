const { z } = require('zod');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* Mensagens de validação em português */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case 'invalid_type':
      return { message: issue.received === 'undefined' ? 'obrigatório' : 'valor inválido' };
    case 'too_small':
      if (issue.type === 'string') return { message: issue.minimum === 1 ? 'obrigatório' : `mínimo de ${issue.minimum} caracteres` };
      if (issue.type === 'array') return { message: 'informe ao menos um item' };
      return { message: `deve ser ${issue.inclusive ? 'no mínimo' : 'maior que'} ${issue.minimum}` };
    case 'too_big':
      return { message: issue.type === 'string' ? `máximo de ${issue.maximum} caracteres` : `máximo de ${issue.maximum}` };
    case 'invalid_string':
      return { message: 'formato inválido' };
    case 'invalid_enum_value':
      return { message: 'opção inválida' };
    default:
      return { message: ctx.defaultError };
  }
});

const parse = (schema, data) => {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.') || 'dados'}: ${i.message}`).join('; '));
  }
  return r.data;
};

const opt = (max) => z.string().trim().max(max).nullish().transform((v) => v || null);
const email = z.string().trim().toLowerCase().email().max(160);
const arred = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const arred3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

module.exports = { HttpError, wrap, parse, opt, email, arred, arred3 };
