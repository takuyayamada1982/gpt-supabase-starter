// app/admin/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  email: string | null;
  account_id: string | null;
  is_master: boolean | null;
  registered_at: string | null;
};

type UsageLog = {
  user_id: string;
  type: 'url' | 'vision' | 'chat';
  created_at: string;
};

// ★ トークン前提（ユーザー指定の値） ---------------------------------
const TOKENS = {
  url: { input: 4000, output: 2000 },      // 3000〜5000 の中間 4000 とした
  vision: { input: 200, output: 1200 },    // 画像＋補助説明
  chat: { input: 1000, output: 2000 },
} as const;

// ★ 料金（gpt-4.1-mini の目安：1K input=0.00015, 1K output=0.0006 ドル相当）
const PRICE = {
  per1kInput: 0.00015,
  per1kOutput: 0.0006,
};

// 1 回あたりの概算コスト（USD）
function costPerCall(type: 'url' | 'vision' | 'chat'): number {
  const t = TOKENS[type];
  const inputCost = (t.input / 1000) * PRICE.per1kInput;
  const outputCost = (t.output / 1000) * PRICE.per1kOutput;
  return inputCost + outputCost;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usage, setUsage] = useState<UsageLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingIdFor, setSavingIdFor] = useState<string | null>(null);

  // ① ログインユーザーがマスターか確認 → ② ユーザー一覧＋使用ログ取得
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // --- 認証ユーザー取得 ---
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user) {
        setError('ログインが必要です。/login からログインしてください。');
        setLoading(false);
        return;
      }

      // --- 自分のプロフィールを取得（id→email の順で探す） ---
      let myProfile: Profile | null = null;

      // 1) id で検索
      const { data: byId, error: byIdErr } = await supabase
        .from('profiles')
        .select('id, email, account_id, is_master, registered_at')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (byId && !byIdErr) {
        myProfile = byId as Profile;
      } else {
        // 2) email で検索（保険）
        const email = authData.user.email;
        if (email) {
          const { data: byEmail, error: byEmailErr } = await supabase
            .from('profiles')
            .select('id, email, account_id, is_master, registered_at')
            .eq('email', email)
            .maybeSingle();

          if (byEmail && !byEmailErr) {
            myProfile = byEmail as Profile;
          }
        }
      }

      if (!myProfile) {
        setError(
          'プロフィール情報の取得に失敗しました。\nprofiles テーブルに、ログイン中ユーザーの行（id か email）があるか確認してください。'
        );
        setLoading(false);
        return;
      }

      // --- マスター権限チェック ---
      if (!myProfile.is_master) {
        setError(
          'このページを閲覧する権限がありません。（is_master = true のユーザーのみアクセス可能）'
        );
        setLoading(false);
        return;
      }

      setMe(myProfile);

      // --- 全ユーザー一覧 ---
      const { data: allProfiles, error: listError } = await supabase
        .from('profiles')
        .select('id, email, account_id, is_master, registered_at')
        .order('registered_at', { ascending: true });

      if (listError) {
        console.error(listError);
        setError('ユーザー一覧の取得に失敗しました。');
        setLoading(false);
        return;
      }
      setProfiles((allProfiles ?? []) as Profile[]);

      // --- 使用ログ 24 ヶ月分 ---
      const since = new Date();
      since.setMonth(since.getMonth() - 24);

      const { data: logs, error: usageErr } = await supabase
        .from('usage_logs')
        .select('user_id, type, created_at')
        .gte('created_at', since.toISOString());

      if (usageErr) {
        console.error(usageErr);
        setError('使用ログの取得に失敗しました。usage_logs テーブルを確認してください。');
        setLoading(false);
        return;
      }

      setUsage((logs ?? []) as UsageLog[]);
      setLoading(false);
    })();
  }, []);

  // --- 使用状況を集計（ユーザー別） ---
  const perUser = useMemo(() => {
    const map: Record<
      string,
      {
        profile: Profile | null;
        url: number;
        vision: number;
        chat: number;
        cost: number;
      }
    > = {};

    for (const p of profiles) {
      map[p.id] = {
        profile: p,
        url: 0,
        vision: 0,
        chat: 0,
        cost: 0,
      };
    }

    for (const row of usage) {
      if (!map[row.user_id]) {
        map[row.user_id] = {
          profile: null,
          url: 0,
          vision: 0,
          chat: 0,
          cost: 0,
        };
      }
      const entry = map[row.user_id];
      if (row.type === 'url') {
        entry.url += 1;
        entry.cost += costPerCall('url');
      } else if (row.type === 'vision') {
        entry.vision += 1;
        entry.cost += costPerCall('vision');
      } else if (row.type === 'chat') {
        entry.chat += 1;
        entry.cost += costPerCall('chat');
      }
    }

    return Object.values(map);
  }, [profiles, usage]);

  // --- 全体集計 ---
  const total = useMemo(() => {
    let url = 0,
      vision = 0,
      chat = 0,
      cost = 0;
    for (const u of perUser) {
      url += u.url;
      vision += u.vision;
      chat += u.chat;
      cost += u.cost;
    }
    return { url, vision, chat, cost };
  }, [perUser]);

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

      // ローカル更新
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">管理ダッシュボード</h1>
          <p className="text-xs text-slate-500">
            ログイン中: {me?.email ?? '-'} / アカウントID:{' '}
            {me?.account_id ?? '未設定'} / マスター権限:{' '}
            {me?.is_master ? 'ON' : 'OFF'}
          </p>
        </header>

        {/* 全体サマリ */}
        <section className="grid gap-3 md:grid-cols-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="text-[11px] text-slate-500 mb-1">
              URL要約 実行回数（24ヶ月）
            </div>
            <div className="text-xl font-bold text-slate-900">{total.url}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="text-[11px] text-slate-500 mb-1">
              画像生成 実行回数（24ヶ月）
            </div>
            <div className="text-xl font-bold text-slate-900">
              {total.vision}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="text-[11px] text-slate-500 mb-1">
              Chat 実行回数（24ヶ月）
            </div>
            <div className="text-xl font-bold text-slate-900">{total.chat}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="text-[11px] text-slate-500 mb-1">
              概算 API 原価（USD, 24ヶ月）
            </div>
            <div className="text-xl font-bold text-slate-900">
              ${total.cost.toFixed(3)}
            </div>
          </div>
        </section>

        {/* ユーザー別 使用状況 + アカウントID編集 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            ユーザー別 使用状況 ＆ アカウントID編集
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            メールアドレスごとに 5桁のアカウントIDを設定・変更できます。
            使用回数と概算料金は usage_logs をもとに、自動集計されています。
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-1">#</th>
                  <th className="px-3 py-1">メールアドレス</th>
                  <th className="px-3 py-1">アカウントID</th>
                  <th className="px-3 py-1">URL回数</th>
                  <th className="px-3 py-1">画像回数</th>
                  <th className="px-3 py-1">Chat回数</th>
                  <th className="px-3 py-1">概算原価(USD)</th>
                  <th className="px-3 py-1">マスター</th>
                  <th className="px-3 py-1">登録日</th>
                  <th className="px-3 py-1"></th>
                </tr>
              </thead>
              <tbody>
                {perUser.map((u, idx) => {
                  const p = u.profile;
                  return (
                    <tr
                      key={p?.id ?? idx}
                      className="bg-slate-50/80 hover:bg-slate-100 transition-colors"
                    >
                      <td className="px-3 py-1 align-middle text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-1 align-middle">
                        <div
                          className="max-w-[200px] md:max-w-xs truncate"
                          title={p?.email ?? ''}
                        >
                          {p?.email ?? '(unknown user)'}
                        </div>
                      </td>
                      <td className="px-3 py-1 align-middle">
                        {p ? (
                          <input
                            id={`account-${p.id}`}
                            defaultValue={p.account_id ?? ''}
                            maxLength={5}
                            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                            onChange={(e) => {
                              const onlyDigits = e.target.value.replace(
                                /\D/g,
                                ''
                              );
                              e.target.value = onlyDigits;
                            }}
                          />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-1 align-middle text-right">
                        {u.url}
                      </td>
                      <td className="px-3 py-1 align-middle text-right">
                        {u.vision}
                      </td>
                      <td className="px-3 py-1 align-middle text-right">
                        {u.chat}
                      </td>
                      <td className="px-3 py-1 align-middle text-right">
                        ${u.cost.toFixed(3)}
                      </td>
                      <td className="px-3 py-1 align-middle">
                        {p?.is_master ? (
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
                        {p?.registered_at
                          ? new Date(
                              p.registered_at
                            ).toLocaleDateString('ja-JP')
                          : '-'}
                      </td>
                      <td className="px-3 py-1 align-middle">
                        {p && (
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
                        )}
                      </td>
                    </tr>
                  );
                })}

                {perUser.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
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
