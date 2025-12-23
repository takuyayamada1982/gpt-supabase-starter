'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // リセットリンクから戻ってきた時、code をセッションに交換
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) return;

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('exchangeCodeForSession error:', error);
        setMsg('リンクの有効期限が切れている可能性があります。再度リセットをお試しください。');
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!password || password.length < 8) {
      setMsg('パスワードは8文字以上で入力してください。');
      return;
    }
    if (password !== password2) {
      setMsg('パスワードが一致しません。');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error('updateUser error:', error);
        setMsg('更新に失敗しました。リセットを再度お試しください。');
        return;
      }
      setMsg('パスワードを更新しました。/auth に戻ってログインしてください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>パスワード再設定</h1>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            placeholder="新しいパスワード（8文字以上）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 12, borderRadius: 10, border: '1px solid #d1d5db' }}
          />
          <input
            type="password"
            placeholder="新しいパスワード（確認）"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={{ padding: 12, borderRadius: 10, border: '1px solid #d1d5db' }}
          />
          {msg && <p style={{ fontSize: 12, color: '#b91c1c' }}>{msg}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: 12, borderRadius: 999, border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '更新中…' : '更新する'}
          </button>
        </form>
      </section>
    </main>
  );
}
