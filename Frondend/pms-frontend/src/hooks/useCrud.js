// src/hooks/useCrud.js
import { useEffect, useState } from "react";
export function useCrud(api, base) {
  const [items, setItems] = useState([]), [loading, setLoading] = useState(false), [error, setError] = useState(null);
  const load = async (params) => { setLoading(true); setError(null);
    try { const { data } = await api.get(base, { params }); setItems(data||[]); } 
    catch (e) { setError(e); } finally { setLoading(false); } };
  const createItem = async (payload) => { const { data } = await api.post(base, payload); setItems(x=>[data,...x]); return data; };
  const updateItem = async (id, payload) => { const { data } = await api.put(`${base}/${id}`, payload); setItems(x=>x.map(i=>i.id===id?data:i)); return data; };
  const removeItem = async (id) => { await api.delete(`${base}/${id}`); setItems(x=>x.filter(i=>i.id!==id)); };
  return { items, setItems, load, createItem, updateItem, removeItem, loading, error };
}
