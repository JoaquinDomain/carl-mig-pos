'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(role: 'admin' | 'guest') {
    setLoading(true);
    setError('');
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, password })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error || 'Login failed.');
    router.push('/');
    router.refresh();
  }

  function submitAdmin(event: FormEvent) {
    event.preventDefault();
    login('admin');
  }

  return (
    <main className="min-h-screen bg-[#fbf7f1] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-[#5a361e]/10 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#5a361e] to-[#0a6c5d] p-8 text-white text-center">
          <div className="text-5xl mb-3">☕</div>
          <h1 className="text-3xl font-black">Carl-Mig POS</h1>
          <p className="text-sm opacity-80 mt-1">Espresso & Laundry Hub</p>
        </div>
        <div className="p-8 space-y-6">
          <form onSubmit={submitAdmin} className="space-y-3">
            <label className="block text-sm font-black text-[#5a361e]">Admin password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border-2 border-[#5a361e]/20 px-4 py-3 focus:outline-none focus:border-[#0a6c5d]"
              placeholder="Enter admin password"
            />
            <button disabled={loading} className="w-full rounded-xl bg-[#0a6c5d] py-3 font-black text-white disabled:bg-gray-300">
              {loading ? 'Signing in…' : 'Admin Login'}
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs font-bold text-[#5a361e]/40"><span className="h-px flex-1 bg-[#5a361e]/10" />OR<span className="h-px flex-1 bg-[#5a361e]/10" /></div>
          <button onClick={() => login('guest')} disabled={loading} className="w-full rounded-xl border-2 border-[#5a361e]/20 py-3 font-black text-[#5a361e] hover:border-[#0a6c5d] disabled:opacity-50">
            Continue as Guest
          </button>
          <p className="text-center text-xs text-[#5a361e]/60">Guests can view the menu only. Admins only bebong and nang kim hihi.</p>
          {error && <p className="rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">{error}</p>}
        </div>
      </div>
    </main>
  );
}
