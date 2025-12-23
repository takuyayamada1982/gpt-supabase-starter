'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string>('');

  // ✅ windowは「useEffectの中だけ」で触る（これが最重要）
  useEffect(() => {
    const err = searchParams.get('error_description') || searchParams.get('error');
    if (err) setMessage(decodeURIComponent(err));

    const hash = window.location.hash?.replace('#', '');
    if (!hash) {
      setReady(true);
      return;
    }

    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    (async () => {
      try {
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            setMessage(`セッション設定に失敗: ${error.message}`);
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, [searchParams]);

  const onUpdatePassword = async () => {
    if (!password || !password2) {
      alert('新しいパスワードを2回入力してください');
      return;
    }
    if (password !== password2) {
      alert('パスワードが一致しません');
      return;
    }
    if (password.length < 6) {
      alert('パスワードは6文字以上にしてください');
      return;
    }

    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(`更新失敗: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage('パスワードを更新しました。ログイン画面へ移動します。');
    setLoading(false);

    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold mb-2">パスワード再設定</h1>
        <p className="text-sm text-slate-600 mb-6">
          メールのリンクから開いた場合、ここで新しいパスワードを設定できます。
        </p>

        {!ready ? (
          <div className="text-sm text-slate-600">準備中...</div>
        ) : (
          <>
            {message && (
              <div className="mb-4 text-sm text-red-600 whitespace-pre-wrap">
                {message}
              </div>
            )}

            <label className="block text-sm font-medium mb-1">新しいパスワード</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 mb-4"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
            />

            <label className="block text-sm font-medium mb-1">新しいパスワード（確認）</label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 mb-6"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="もう一度入力"
            />

            <button
              onClick={onUpdatePassword}
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium disabled:opacity-60"
            >
              {loading ? '更新中...' : 'パスワードを更新'}
            </button>

            <button
              onClick={() => router.push('/auth')}
              className="w-full mt-3 rounded-lg border py-2 font-medium"
            >
              ログインに戻る
            </button>
          </>
        )}
      </div>
    </div>
  );
}
