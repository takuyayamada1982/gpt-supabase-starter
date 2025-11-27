'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  email: string | null;
  account_id: string | null;
  is_master: boolean | null;
  registered_at: string | null;   // ✅ created_at → registered_at に変更
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingIdFor, setSavingIdFor] = useState<string | null>(null);

  // ① ログインユーザーがマスターか確認 → ② ユーザー一覧取得
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // 認証ユーザー取得
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setError('ログインが必要です。/login からログインしてください。');
        setLoading(false);
        return;
      }

      // 自分のプロフィールを取得
      const { data: myProfile, error: myProfileError } = await supabase
        .from('profiles')
        .select('id, email, account_id, is_master, registered_at') // ✅ ここを修正
        .eq('id', authData.user.id)
        .single();

      if (myProfileError || !myProfile) {
        console.error(myProfileError);
        setError(
          'プロフィール情報の取得に失敗しました。profiles テーブルと registered_at 列を確認してください。'
        );
        setLoading(false);
        return;
      }

      // マスター権限チェック
      if (!myProfile.is_master) {
        setError('このページを閲覧する権限がありません。（is_master = true のユーザーのみアクセス可能）');
        setLoading(false);
        return;
      }

      setMe(myProfile);

      // 全ユーザー一覧を取得
      const { data: allProfiles, error: listError } = await supabase
        .from('profiles')
        .select('id, email, account_id, is_master, registered_at') // ✅ ここも修正
        .order('registered_at', { ascending: true });

      if (listError) {
        console.error(listError);
        setError('ユーザー一覧の取得に失敗しました。');
        setLoading(false);
        return;
      }

      setProfiles(allProfiles || []);
      setLoading(false);
    })();
  }, []);

  // アカウントID更新
  const handleUpdateAccountId = async (p: Profile, newId: string) => {
    const trimmed = newId.trim();

    if (!trimmed) {
      alert('アカウントIDを入力してください。');
      return;
    }
    if (!/^\d{5}$/.test(trimmed)) {
      alert('アカウントIDは5桁の数字にしてください。');
      return;
    }

    setSavingIdFor(p.id);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ account_id: trimmed })
        .eq('id', p.id);

      if (updateError) throw updateError;

      // ローカル状態も更新
      setProfiles((prev) =>
        prev.map((row) =>
          row.id === p.id ? { ...row, account_id: trimmed } : row
        )
      );
      alert('アカウントIDを更新しました。');
    } catch (e: any) {
      console.error(e);
      alert(`更新に失敗しました: ${e.message}`);
    } finally {
      setSavingIdFor(null);
    }
  };

  // ===== 画面レンダリング =====

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">読み込み中です…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-white border border-red-100 p-4 shadow">
          <div className="text-sm font-semibold text-red-600 mb-2">エラー</div>
          <div className="text-xs text-slate-700 whitespace-pre-wrap">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">管理ダッシュボード</h1>
          <p className="text-xs text-slate-500">
            ログイン中: {me?.email ?? '-'} / アカウントID:{' '}
            {me?.account_id ?? '未設定'} / マスター権限:{' '}
            {me?.is_master ? 'ON' : 'OFF'}
          </p>
        </header>

        {/* ユーザー一覧 ＋ アカウントID編集 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            ユーザー一覧 ＆ アカウントID編集
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            メールアドレスごとに 5桁のアカウントIDを設定・変更できます。
            ログイン時は「メール＋パスワード＋アカウントID」で認証を行います（将来的な仕様）。
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-1">#</th>
                  <th className="px-3 py-1">メールアドレス</th>
                  <th className="px-3 py-1">アカウントID（5桁）</th>
                  <th className="px-3 py-1">マスター</th>
                  <th className="px-3 py-1">登録日</th>
                  <th className="px-3 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p, idx) => (
                  <tr
                    key={p.id}
                    className="bg-slate-50/80 hover:bg-slate-100 transition-colors"
                  >
                    <td className="px-3 py-1 align-middle text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-1 align-middle">
                      <div
                        className="max-w-[200px] md:max-w-xs truncate"
                        title={p.email ?? ''}
                      >
                        {p.email ?? '(no email)'}
                      </div>
                    </td>
                    <td className="px-3 py-1 align-middle">
                      <input
                        id={`account-${p.id}`}
                        defaultValue={p.account_id ?? ''}
                        maxLength={5}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                        onChange={(e) => {
                          const onlyDigits = e.target.value.replace(/\D/g, '');
                          e.target.value = onlyDigits;
                        }}
                      />
                    </td>
                    <td className="px-3 py-1 align-middle">
                      {p.is_master ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          MASTER
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          user
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1 align-middle text-slate-500">
                      {p.registered_at
                        ? new Date(p.registered_at).toLocaleDateString('ja-JP')
                        : '-'}
                    </td>
                    <td className="px-3 py-1 align-middle">
                      <button
                        type="button"
                        className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        disabled={savingIdFor === p.id}
                        onClick={() => {
                          const input = document.getElementById(
                            `account-${p.id}`
                          ) as HTMLInputElement | null;
                          if (!input) return;
                          handleUpdateAccountId(p, input.value);
                        }}
                      >
                        {savingIdFor === p.id ? '保存中…' : 'IDを保存'}
                      </button>
                    </td>
                  </tr>
                ))}

                {profiles.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-xs text-slate-500"
                    >
                      まだ登録ユーザーがいません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
