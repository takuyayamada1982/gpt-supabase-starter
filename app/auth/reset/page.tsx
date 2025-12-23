'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [status, setStatus] = useState<'checking'|'ready'|'error'>('checking');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      // Supabaseがエラーを付けて返してくることがある
      const errCode = sp.get('error_code');
      const errDesc = sp.get('error_description');
      if (errCode) {
        setStatus('error');
        setMessage(decodeURIComponent(errDesc ?? 'リンクが無効です'));
        return;
      }

      // 新方式： ?code=... を交換する（これをやらないと未ログイン扱いになりがち）
      const code = sp.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus('error');
          setMessage(error.message);
          return;
        }
      }

      // ここまで来たら「パスワード更新画面」を見せられる状態
      setStatus('ready');
    };

    run();
  }, [sp]);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [saving, setSaving] = useState(false);

  const update = async () => {
    if (!pw || pw.length < 8) return alert('パスワードは8文字以上にしてください');
    if (pw !== pw2) return alert('確認用パスワードが一致しません');

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);

    if (error) return alert(error.message);

    alert('パスワードを更新しました。ログインしてください。');
    router.push('/auth'); // あなたのログインページに合わせて
  };

  if (status === 'checking') return <div style={{padding:24}}>確認中...</div>;

  if (status === 'error') {
    return (
      <div style={{padding:24}}>
        <h2>リンクが無効/期限切れです</h2>
        <p>{message}</p>
        <p>もう一度「パスワードを忘れた」からメールを送り直してください。</p>
      </div>
    );
  }

  return (
    <div style={{padding:24, maxWidth:420}}>
      <h2>新しいパスワードを設定</h2>

      <div style={{marginTop:12}}>
        <div>新しいパスワード</div>
        <input value={pw} onChange={(e)=>setPw(e.target.value)} type="password" style={{width:'100%'}} />
      </div>

      <div style={{marginTop:12}}>
        <div>確認用</div>
        <input value={pw2} onChange={(e)=>setPw2(e.target.value)} type="password" style={{width:'100%'}} />
      </div>

      <button onClick={update} disabled={saving} style={{marginTop:16}}>
        {saving ? '更新中...' : '更新する'}
      </button>
    </div>
  );
}
