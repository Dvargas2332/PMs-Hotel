import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login({ onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("secret123");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await login(email, password);
      onSuccess?.();
    } catch (e) {
      setErr("Credenciales inválidas o servidor no disponible");
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "40px auto" }}>
      <h2>Iniciar sesión</h2>
      <form onSubmit={submit}>
        <div>
          <label>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label>Contraseña</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        {err && <p style={{color:"crimson"}}>{err}</p>}
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
