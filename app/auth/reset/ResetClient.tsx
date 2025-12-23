'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function parseHash(hash: string) {
  // 例: #access_token=...&refresh_token=...&type=recovery
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
    error: params.get('error'),
    error_code: params.get('error_code'),
    error_description: params.get('error_description'),
  };
}

export default function ResetClient() {
  const router = useRouter();

  const [step, setStep] = useState<'checking' | 'ready' | 'done'>('checking');
  const [message, setMessage] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const hashInfo = useMemo(() => parseHash(window.location.hash || ''), []);

  useEffect(() => {
    (async () => {
      // エラーがURLに付いている場合
      if (hashInfo.error) {
        setMessage(
          `リンクが無効か期限切れです。もう一度「パスワードを忘れた方はこちら」から送信してください。\n\n(${hashInfo.error_code ?? ''}) ${hashInfo.error_description ?? ''}`
        );
        setStep('ready'); // 入力は出さないが画面は表示
        return;
      }

      // recovery で来た access_token を session 化
      const access_token = hashInfo.access_token;
      const refresh_token = hashInfo.refresh_token;

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          setMessage(
            `セッション設定に失敗しました。リンクが期限切れの可能性があります。\n\n${error.message}`
          );
          setStep('ready');
          return;
        }

        setMessage('新しいパスワードを入力してください。');
        setStep('ready');
        return;
      }

      // ハッシュが無い（直アクセス等）
      setMessage(
        'このページは、パスワード再設定メールのリンクからアクセスしてください。'
      );
      setStep('ready');
    })();
  }, [hashInfo]);

  const handleUpdate = async () => {
    if (!newPassword || newPassword.length < 8) {
      alert('パスワードは8文字以上にしてください');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setStep('done');
    setMessage('パスワードを更新しました。ログイン画面へ戻ります。');

    // セッションを残す/消すは好みだが、わかりやすくログインへ戻す
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <div style={{ maxWidth: 520, margin: '48px auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Reset password
      </h1>

      <div style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{message}</div>

      {step === 'ready' && !hashInfo.error && (
        <>
          <input
            type="password"
            placeholder="新しいパスワード（8文字以上）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ width: '100%', padding: 10, marginBottom: 12 }}
          />
          <button
            onClick={handleUpdate}
            disabled={loading}
            style={{ padding: '10px 16px' }}
          >
            {loading ? '更新中…' : 'パスワードを更新'}
          </button>
        </>
      )}

      {step === 'checking' && <div>確認中…</div>}
    </div>
  );
}
