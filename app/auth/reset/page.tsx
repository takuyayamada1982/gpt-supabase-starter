'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// ✅ あなたの環境変数名に合わせてください（一般的な構成）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ ブラウザ用クライアント（サーバー側で使わない）
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Status =
  | 'init'
  | 'processing'
  | 'ready'
  | 'updated'
  | 'expired'
  | 'error';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<Status>('init');
  const [message, setMessage] = useState<string>('');
  const [detail, setDetail] = useState<string>('');

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [saving, setSaving] = useState(false);

  // URLクエリのエラー（?error=...&error_code=...&error_description=...）
  const urlError = useMemo(() => {
    const error = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    if (!error && !errorCode && !errorDescription) return null;
    return {
      error: error ?? '',
      errorCode: errorCode ?? '',
      errorDescription: (errorDescription ?? '').replace(/\+/g, ' '),
    };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus('processing');
      setMessage('リンクを確認しています…');

      // ① URLクエリにエラーが来ている場合（otp_expiredなど）
      if (urlError) {
        if (cancelled) return;

        const isExpired =
          urlError.errorCode === 'otp_expired' ||
          urlError.error === 'access_denied';

        setStatus(isExpired ? 'expired' : 'error');
        setMessage(
          isExpired
            ? 'このリンクは無効、または期限切れです。'
            : 'リンクの確認でエラーが発生しました。'
        );
        setDetail(
          `${urlError.errorCode || urlError.error}\n${urlError.errorDescription}`
        );
        return;
      }

      // ② PKCE: ?code=xxxx がある場合
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;

        if (error) {
          const isExpired =
            (error.message || '').toLowerCase().includes('expired') ||
            (error.message || '').toLowerCase().includes('invalid');

          setStatus(isExpired ? 'expired' : 'error');
          setMessage(
            isExpired
              ? 'このリンクは無効、または期限切れです。'
              : 'セッションの確立に失敗しました。'
          );
          setDetail(error.message);
          return;
        }

        setStatus('ready');
        setMessage('新しいパスワードを入力してください。');
        return;
      }

      // ③ Implicit系: #access_token=...&refresh_token=... がある場合
      // 例: /auth/reset#access_token=...&refresh_token=...&type=recovery
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        // URLのhashを消しておく（再読込で変な挙動になりにくい）
        try {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
        } catch {}

        if (cancelled) return;

        if (error) {
          const isExpired =
            (error.message || '').toLowerCase().includes('expired') ||
            (error.message || '').toLowerCase().includes('invalid');

          setStatus(isExpired ? 'expired' : 'error');
          setMessage(
            isExpired
              ? 'このリンクは無効、または期限切れです。'
              : 'セッションの確立に失敗しました。'
          );
          setDetail(error.message);
          return;
        }

        setStatus('ready');
        setMessage('新しいパスワードを入力してください。');
        return;
      }

      // ④ どちらでもない（直アクセス等）
      if (cancelled) return;
      setStatus('error');
      setMessage('リセットリンクが見つかりません。');
      setDetail('メールのリンクから開いてください。');
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, urlError]);

  const canSubmit =
    status === 'ready' &&
    password.length >= 8 &&
    password === password2 &&
    !saving;

  async function handleUpdate() {
    if (!canSubmit) return;

    setSaving(true);
    setMessage('パスワードを更新しています…');
    setDetail('');

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        const isExpired =
          (error.message || '').toLowerCase().includes('expired') ||
          (error.message || '').toLowerCase().includes('invalid');

        setStatus(isExpired ? 'expired' : 'error');
        setMessage(
          isExpired
            ? 'このリンクは無効、または期限切れです。'
            : '更新に失敗しました。'
        );
        setDetail(error.message);
        return;
      }

      setStatus('updated');
      setMessage('パスワードを更新しました。ログイン画面へ移動します。');

      // 少し待ってからログインへ
      setTimeout(() => {
        router.push('/auth'); // あなたのログインページのパスに合わせてください
      }, 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #ffb7c5 0%, #d8f4d8 45%, #b8e2ff 100%)',
      }}
    >
      <div
        style={{
          width: 'min(720px, 100%)',
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, color: '#0f172a' }}>
          パスワード再設定
        </h1>

        <p style={{ marginTop: 10, marginBottom: 14, color: '#334155' }}>
          {message}
        </p>

        {detail ? (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#0f172a',
              color: 'white',
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.4,
              marginTop: 10,
              marginBottom: 14,
            }}
          >
            {detail}
          </pre>
        ) : null}

        {status === 'ready' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#334155' }}>
                新しいパスワード（8文字以上）
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                style={{
                  height: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#334155' }}>
                新しいパスワード（確認）
              </span>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Confirm password"
                style={{
                  height: 44,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                }}
              />
            </label>

            {password && password2 && password !== password2 ? (
              <p style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>
                パスワードが一致しません。
              </p>
            ) : null}

            <button
              disabled={!canSubmit}
              onClick={handleUpdate}
              style={{
                height: 44,
                borderRadius: 999,
                border: 'none',
                background: canSubmit ? '#0f172a' : '#94a3b8',
                color: 'white',
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? '更新中…' : 'パスワードを更新'}
            </button>
          </div>
        ) : null}

        {status === 'expired' ? (
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/auth')}
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 999,
                border: '1px solid #0f172a',
                background: 'white',
                color: '#0f172a',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ログインへ
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 999,
                border: 'none',
                background: '#0f172a',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              もう一度試す
            </button>
          </div>
        ) : null}

        {status === 'error' ? (
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => router.push('/auth')}
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 999,
                border: '1px solid #0f172a',
                background: 'white',
                color: '#0f172a',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ログインへ
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
