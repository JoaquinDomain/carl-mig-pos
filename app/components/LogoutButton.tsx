'use client';

export default function LogoutButton() {
  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <button onClick={logout} className="rounded-full border-2 border-[#5a361e]/15 bg-white px-4 py-2 text-sm font-bold text-[#5a361e] hover:border-red-300 hover:text-red-600">
      Log out
    </button>
  );
}
