'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ リセットメールのリンクで戻ってきたら code を session に交換
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        // code が無い場合（直アクセス等）はそのまま入力させる（最小）
        if (!code) return;

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('exchangeCodeForSession error:', error);
          setMsg(
            'リンクの有効期限が切れている可能性があります。ログイン画面から再度「パスワードを忘れた方はこちら」をお試しください。'
          );
        }
      } catch (e) {
        console.error('exchangeCodeForSession unexpected error:', e);
        setMsg('予期しないエラーが発生しました。時間をおいて再度お試しください。');
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

        // 🔽 ここで「旧パスワードと同じ」エラーを日本語に変換
        if (
          error.message?.toLowerCase().includes('different from the old password')
        ) {
          setMsg('以前と同じパスワードは使用できません。別のパスワードを設定してください。');
        } else {
          setMsg('更新に失敗しました。リセットを再度お試しください。');
        }

        return;
      }

      setMsg('パスワードを更新しました。ログイン画面に戻ってログインしてください。');
    } catch (err) {
      console.error('updateUser unexpected error:', err);
      setMsg('予期しないエラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        background:
          'radial-gradient(circle at 10% 20%, #ffb8d9 0, transparent 55%),' +
          'radial-gradient(circle at 80% 25%, #b7e4ff 0, transparent 55%),' +
          'radial-gradient(circle at 30% 80%, #c8ffc4 0, transparent 55%),' +
          '#ffffff',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderRadius: '20px',
          border: '1.6px solid rgba(140,140,140,0.28)',
          padding: '40px 36px 42px',
          boxShadow:
            '0 14px 40px rgba(0,0,0,0.07), 0 0 0 4px rgba(255,255,255,0.45)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            textAlign: 'center',
            margin: '0 0 10px',
            color: '#333',
          }}
        >
          パスワード再設定
        </h1>

        <p
          style={{
            textAlign: 'center',
            fontSize: 13,
            lineHeight: 1.7,
            color: '#6b7280',
            marginBottom: 22,
            opacity: 0.95,
          }}
        >
          新しいパスワードを設定してください（8文字以上）。
        </p>

        <form
          onSubmit={onSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <label
            style={{
              width: '100%',
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#444',
            }}
          >
            新しいパスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 6,
                padding: '12px 15px',
                borderRadius: 10,
                border: '1px solid #d2d2d2',
                fontSize: 15,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              }}
              required
            />
          </label>

          <label
            style={{
              width: '100%',
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#444',
            }}
          >
            新しいパスワード（確認）
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: 6,
                padding: '12px 15px',
                borderRadius: 10,
                border: '1px solid #d2d2d2',
                fontSize: 15,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              }}
              required
            />
          </label>

          {msg && (
            <p
              style={{
                marginTop: 2,
                fontSize: 12,
                color: msg.includes('更新しました') ? '#166534' : '#b91c1c',
              }}
            >
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              width: '100%',
              padding: 14,
              borderRadius: 999,
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              background: 'linear-gradient(120deg, #bfe0ff, #ffd6f5)',
              color: '#333',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 28px rgba(150,150,150,0.28)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '更新中…' : 'パスワードを更新'}
          </button>

          <a
            href="/auth"
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontSize: 12,
              color: '#6b7280',
              textDecoration: 'underline',
            }}
          >
            ログイン画面に戻る
          </a>
        </form>
      </section>
    </main>
  );
}
