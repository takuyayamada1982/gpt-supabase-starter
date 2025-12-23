'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // searchParams からも取れるように（環境差対策）
  const spAccessToken = useMemo(() => searchParams.get('access_token'), [searchParams]);
  const spRefreshToken = useMemo(() => searchParams.get('refresh_token'), [searchParams]);

  useEffect(() => {
    const prepare = async () => {
      setErrorMsg(null);

      // ✅ Supabaseのrecoveryは hash(#access_token=...) で来ることが多い
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

      const access_token = spAccessToken ?? hashParams.get('access_token');
      const refresh_token = spRefreshToken ?? hashParams.get('refresh_token');

      if (!access_token || !refresh_token) {
        setErrorMsg('リセット用トークンが見つかりません。メールのリンクをもう一度開いてください。');
        setReady(true);
        return;
      }

      // ✅ このページに入った時点でセッションをセット（これが無いと updateUser が失敗することがある）
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        setErrorMsg(`セッション設定に失敗しました: ${error.message}`);
      }

      setReady(true);
    };

    prepare();
  }, [spAccessToken, spRefreshToken]);

  const onSubmit = async () => {
    if (!password || !password2) {
      alert('パスワードを入力してください');
      return;
    }
    if (password !== password2) {
      alert('パスワードが一致しません');
      return;
    }
    if (password.length < 8) {
      alert('パスワードは8文字以上にしてください');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrorMsg(`更新に失敗しました: ${error.message}`);
      return;
    }

    // ✅ 更新できたら一度ログアウトして、ログイン画面へ
    await supabase.auth.signOut();
    router.replace('/auth?reset=done');
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>パスワード再設定</h1>

      {!ready ? (
        <div>確認中...</div>
      ) : (
        <>
          {errorMsg && (
            <div style={{ background: '#fee', padding: 12, borderRadius: 8, marginBottom: 12 }}>
              {errorMsg}
            </div>
          )}

          <label style={{ display: 'block', marginBottom: 6 }}>新しいパスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 10, marginBottom: 12 }}
            placeholder="8文字以上"
          />

          <label style={{ display: 'block', marginBottom: 6 }}>新しいパスワード（確認）</label>
          <input
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={{ width: '100%', padding: 10, marginBottom: 16 }}
            placeholder="同じものを入力"
          />

          <button
            onClick={onSubmit}
            disabled={loading}
            style={{ width: '100%', padding: 12, fontWeight: 700 }}
          >
            {loading ? '更新中...' : 'パスワードを更新'}
          </button>

          <button
            onClick={() => router.replace('/auth')}
            style={{ width: '100%', padding: 12, marginTop: 10 }}
          >
            ログイン画面へ戻る
          </button>
        </>
      )}
    </div>
  );
}
