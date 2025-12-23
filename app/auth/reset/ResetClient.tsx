'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Supabase のリセットリンクには状況により色々入るので全部拾う
  const code = searchParams.get('code'); // 新しめのフローで入ることがある
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const type = searchParams.get('type'); // recovery など
  const errorDesc = searchParams.get('error_description');

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // 「このページに来たらセッションを成立させる」処理
  useEffect(() => {
    const run = async () => {
      // 1) URLにトークンが来ている場合は、セッション化しておく（重要）
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        setReady(true);
        return;
      }

      // 2) code が来ている場合（環境や設定により）
      // ※ Supabase のフロー差異があるので、ここは “失敗しても続行” にしておく
      if (code) {
        try {
          // @supabase/supabase-js のバージョンによっては exchangeCodeForSession が使えます
          // もし型エラーが出る場合は、このブロックを丸ごと削除してOK（access_token方式で動けばOK）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyAuth: any = supabase.auth;
          if (anyAuth.exchangeCodeForSession) {
            await anyAuth.exchangeCodeForSession(code);
          }
        } catch {
          // 無視してOK
        }
        setReady(true);
        return;
      }

      // 3) どれも無い = 正しいリセットリンクから来てない/期限切れの可能性
      setReady(false);
    };

    run();
  }, [accessToken, refreshToken, code]);

  const canSubmit = useMemo(() => {
    if (!ready) return false;
    if (!password || !password2) return false;
    if (password.length < 8) return false;
    if (password !== password2) return false;
    return true;
  }, [ready, password, password2]);

  const handleUpdatePassword = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData.session;

      if (!hasSession) {
        alert('セッションが確認できません。パスワードリセットリンクを再発行してください。');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      alert('パスワードを更新しました。ログイン画面へ戻ります。');
      router.push('/auth');
    } finally {
      setLoading(false);
    }
  };

  // 画面
  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>パスワード再設定</h1>

      {errorDesc && (
        <div style={{ background: '#ffecec', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>エラー</div>
          <div style={{ marginTop: 6 }}>{errorDesc}</div>
        </div>
      )}

      {!ready && (
        <div style={{ background: '#fff7e6', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>このリンクは無効か期限切れの可能性があります</div>
          <div style={{ marginTop: 6 }}>
            もう一度「パスワードリセット」を実行して、新しいメールのリンクから開いてください。
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => router.push('/auth')} style={{ padding: '10px 12px' }}>
              ログイン画面へ
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        <input
          type="password"
          placeholder="新しいパスワード（8文字以上）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="新しいパスワード（確認）"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #ccc' }}
        />

        <button
          onClick={handleUpdatePassword}
          disabled={!canSubmit || loading}
          style={{ padding: 12, borderRadius: 10, border: '1px solid #000', fontWeight: 700 }}
        >
          {loading ? '更新中…' : 'パスワードを更新'}
        </button>

        <button onClick={() => router.push('/auth')} style={{ padding: 12, borderRadius: 10 }}>
          ログイン画面に戻る
        </button>

        {/* デバッグ表示（不要なら削除OK） */}
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
          <div>type: {type ?? '-'}</div>
          <div>has access_token: {accessToken ? 'yes' : 'no'}</div>
          <div>has refresh_token: {refreshToken ? 'yes' : 'no'}</div>
          <div>has code: {code ? 'yes' : 'no'}</div>
        </div>
      </div>
    </div>
  );
}
