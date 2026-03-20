// src/lib/forms.js
export const required = (v) => (!!v || v === 0) ? null : "Requerido";
export const minLen = (n) => (v) => (v && v.length >= n) ? null : `Mínimo ${n} caracteres`;
export function validate(fields) { // {name:[rules...]}
  const errors = {}; Object.entries(fields).forEach(([k,rules])=>{
    const msg = rules.map(fn=>fn(fields.$values?.[k])).find(Boolean); if (msg) errors[k]=msg;
  }); return errors;
}