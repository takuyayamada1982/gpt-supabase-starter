'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<
    'checking' | 'ready' | 'updating' | 'done' | 'error'
  >('checking');

  const [message, setMessage] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // URL（?code=...）があるか
  const code = useMemo(() => searchParams.get('code'), [searchParams]);

  // URLにエラーが付いていたら表示
  useEffect(() => {
    const e = searchParams.get('error');
    const desc = searchParams.get('error_description');
    if (e || desc) {
      setStatus('error');
      setMessage(
        decodeURIComponent(desc ?? '') ||
          'リンクが無効か期限切れです。もう一度「パスワード再設定」をやり直してください。'
      );
    }
  }, [searchParams]);

  // 1) code形式（?code=...）のとき：セッション交換
  useEffect(() => {
    const run = async () => {
      if (!code) {
        // codeがない場合でも #access_token 形式で来ることがある
        // それは supabase が自動で拾ってくれるケースもあるので
        // 一応セッション確認だけして進める
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus('ready');
          return;
        }

        // どっちも無い → リセットリンクとして成立してない
        setStatus('error');
        setMessage(
          'リセット用の情報がURLに見つかりません。メールのリンクをもう一度開き直してください。'
        );
        return;
      }

      // codeがある → 交換する
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setStatus('error');
        setMessage(
          error.message ||
            'リンクが無効か期限切れです。もう一度「パスワード再設定」をやり直してください。'
        );
        return;
      }

      if (data.session) {
        setStatus('ready');
        return;
      }

      setStatus('error');
      setMessage(
        'セッションを取得できませんでした。もう一度「パスワード再設定」をやり直してください。'
      );
    };

    // すでにerror状態なら何もしない
    if (status === 'error') return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // 2) パスワード更新
  const updatePassword = async () => {
    if (!newPassword || !confirm) {
      alert('新しいパスワードを入力してください');
      return;
    }
    if (newPassword !== confirm) {
      alert('パスワードが一致しません');
      return;
    }
    if (newPassword.length < 6) {
      alert('パスワードは6文字以上にしてください');
      return;
    }

    setStatus('updating');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setStatus('error');
      setMessage(error.message || '更新に失敗しました');
      return;
    }

    setStatus('done');
    setMessage('パスワードを更新しました。ログイン画面へ移動します。');

    // 少し待ってからログインへ
    setTimeout(() => {
      router.push('/auth');
    }, 1200);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(520px, 100%)', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>パスワード再設定</h1>
        <p style={{ marginTop: 8, color: '#6b7280' }}>
          メールのリンクから来た方は、この画面で新しいパスワードを設定できます。
        </p>

        {status === 'checking' && (
          <div style={{ marginTop: 16 }}>確認中…</div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <div style={{ fontWeight: 700, color: '#991b1b' }}>エラー</div>
              <div style={{ marginTop: 8, color: '#7f1d1d' }}>{message}</div>
            </div>

            <button
              style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', cursor: 'pointer' }}
              onClick={() => router.push('/auth')}
            >
              ログイン画面へ
            </button>
          </div>
        )}

        {status === 'ready' && (
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <input
              type="password"
              placeholder="新しいパスワード（6文字以上）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}
            />
            <input
              type="password"
              placeholder="新しいパスワード（確認）"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}
            />

            <button
              onClick={updatePassword}
              disabled={status === 'updating'}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {status === 'updating' ? '更新中…' : 'パスワードを更新する'}
            </button>

            <button
              onClick={() => router.push('/auth')}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                cursor: 'pointer',
                background: 'transparent',
              }}
            >
              ログイン画面へ戻る
            </button>
          </div>
        )}

        {status === 'done' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontWeight: 700, color: '#065f46' }}>完了</div>
              <div style={{ marginTop: 8, color: '#064e3b' }}>{message}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
