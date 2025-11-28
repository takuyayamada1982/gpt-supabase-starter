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

// ===== トークン前提（ユーザー指定の値） =====
const TOKENS = {
  url: { input: 4000, output: 2000 },   // 3000〜5000 の中間として 4000 に
  vision: { input: 200, output: 1200 },
  chat: { input: 1000, output: 2000 },
} as const;

// gpt-4.1-mini の目安
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

// 月別集計用の型
type MonthlyPoint = {
  label: string;   // "2025-11" みたいな表示用
  total: number;   // URL+画像+Chat の総回数
};

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

      // --- 自分のプロフィールを取得（id → email の順で保険をかけて探す） ---
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
        // 2) email で検索
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
          'プロフィール情報の取得に失敗しました。\n' +
            'profiles テーブルに、ログイン中ユーザーの行（id か email）があるか確認してください。'
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

      // --- usage_logs（24ヶ月分） ---
      const since = new Date();
      since.setMonth(since.getMonth() - 24);

      const { data: logs, error: usageErr } = await supabase
        .from('usage_logs')
        .select('user_id, type, created_at')
        .gte('created_at', since.toISOString());

      if (usageErr) {
        console.error(usageErr);
        setError(
          '使用ログの取得に失敗しました。usage_logs テーブルを確認してください。'
        );
        setLoading(false);
        return;
      }

      setUsage((logs ?? []) as UsageLog[]);
      setLoading(false);
    })();
  }, []);

  // --- ユーザー別集計 ---
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
    const calls = url + vision + chat;
    return { url, vision, chat, cost, calls };
  }, [perUser]);

  // --- 月別のグラフ用データ（直近 12 ヶ月） ---
  const monthlyData: MonthlyPoint[] = useMemo(() => {
    const now = new Date();
    const map = new Map<string, number>();

    // 12ヶ月分のキーだけ先に作成（0件の月も表示したいので）
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      map.set(key, 0);
    }

    for (const row of usage) {
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    }

    return Array.from(map.entries()).map(([label, total]) => ({
      label,
      total,
    }));
  }, [usage]);

  // グラフ描画用の最大値
  const monthlyMax = useMemo(() => {
    return Math.max(
      1,
      ...monthlyData.map((m) => m.total) // 1 以上にしておく
    );
  }, [monthlyData]);

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

  // ===== レンダリング =====

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
        {/* ===== ヘッダー ===== */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ダッシュボード
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ログイン中: {me?.email ?? '-'} / アカウントID:{' '}
              {me?.account_id ?? '未設定'} / マスター権限:{' '}
              {me?.is_master ? 'ON' : 'OFF'}
            </p>
          </div>
          <div className="flex gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-teal-500" /> URL要約
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-sky-500" /> 画像
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-emerald-500" /> Chat
            </span>
          </div>
        </header>

        {/* ===== 上段：サマリ＋ドーナツ＋グラフ ===== */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* 左：ドーナツ＋ミニカード */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row items-center gap-4">
            {/* ドーナツチャート風 */}
            <div className="relative h-32 w-32 md:h-40 md:w-40">
              <svg viewBox="0 0 120 120" className="h-full w-full">
                {/* 外側リング */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#e5f3f0"
                  strokeWidth="12"
                />
                {/* 使用率リング（全回数 / 目標10,000としてざっくり） */}
                {total.calls > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min(
                      (total.calls / 10000) * 314,
                      314
                    )} 314`}
                    transform="rotate(-90 60 60)"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-xs text-slate-400">総リクエスト数</div>
                <div className="text-xl md:text-2xl font-bold text-slate-900">
                  {total.calls}
                </div>
                <div className="text-[11px] text-slate-400">
                  概算原価 ${total.cost.toFixed(3)}
                </div>
              </div>
            </div>

            {/* 数値カード */}
            <div className="flex-1 grid gap-2 w-full">
              <div className="grid grid-cols-3 gap-2 text-[11px] md:text-xs">
                <div className="rounded-xl bg-teal-50 px-3 py-2">
                  <div className="text-slate-500 mb-1 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                    URL要約
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {total.url}
                  </div>
                </div>
                <div className="rounded-xl bg-sky-50 px-3 py-2">
                  <div className="text-slate-500 mb-1 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                    画像
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {total.vision}
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <div className="text-slate-500 mb-1 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    Chat
                  </div>
                  <div className="text-lg font-bold text-slate-900">
                    {total.chat}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-1">
                ※ 24ヶ月分の usage_logs を集計しています。金額は
                gpt-4.1-mini のトークン単価から算出した概算です。
              </p>
            </div>
          </div>

          {/* 右：月別グラフ（スマホでも見やすいバー） */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                月別リクエスト数（直近12ヶ月）
              </h2>
              <span className="text-[11px] text-slate-400">
                合計 {total.calls} 回
              </span>
            </div>

            <div className="relative w-full h-40 md:h-52">
              <svg
                viewBox="0 0 320 140"
                className="w-full h-full text-teal-500"
              >
                {/* 横グリッド */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                  <line
                    key={t}
                    x1={20}
                    x2={310}
                    y1={20 + 100 * t}
                    y2={20 + 100 * t}
                    stroke="#e5e7eb"
                    strokeWidth={0.5}
                  />
                ))}

                {/* 棒グラフ */}
                {monthlyData.map((m, idx) => {
                  const barWidth = 16;
                  const gap = 24;
                  const x = 30 + idx * gap;
                  const height = (m.total / monthlyMax) * 100;
                  const y = 120 - height;
                  return (
                    <g key={m.label}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={height}
                        rx={4}
                        className="fill-teal-500/70"
                      />
                    </g>
                  );
                })}

                {/* X軸ラベル（2ヶ月おきに表示） */}
                {monthlyData.map((m, idx) => {
                  if (idx % 2 !== 0) return null;
                  const x = 30 + idx * 24 + 8;
                  const [year, month] = m.label.split('-');
                  return (
                    <text
                      key={m.label}
                      x={x}
                      y={135}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#6b7280"
                    >
                      {`${Number(month)}月`}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        </section>

        {/* ===== 下段：ユーザー別 使用状況 ＋ アカウントID編集 ===== */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            ユーザー一覧 ＆ アカウントID編集
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            メールアドレスごとに 5桁のアカウントIDを設定・変更できます。
            使用回数と概算料金は usage_logs をもとに自動集計されています。
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs md:text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-1">#</th>
                  <th className="px-3 py-1">メールアドレス</th>
                  <th className="px-3 py-1">アカウントID</th>
                  <th className="px-3 py-1 text-right">URL</th>
                  <th className="px-3 py-1 text-right">画像</th>
                  <th className="px-3 py-1 text-right">Chat</th>
                  <th className="px-3 py-1 text-right">概算原価(USD)</th>
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
                          className="max-w-[180px] md:max-w-xs truncate"
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
