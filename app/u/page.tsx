'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type UsageType = 'url' | 'vision' | 'chat' | string;

type UsageLog = {
  id: string;
  user_id: string;
  type: UsageType;
  created_at: string;
  // 他のカラム（tokens, priceなど）があってもOK
};

type TotalsByType = {
  [key in UsageType]?: number;
};

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ① ログインチェック
  useEffect(() => {
    const checkSessionAndFetch = async () => {
      setCheckingAuth(true);
      const { data: authData, error: authError } = await supabase.auth.getSession();

      if (authError) {
        console.error(authError);
        setError('ログイン状態の確認中にエラーが発生しました。');
        setCheckingAuth(false);
        return;
      }

      if (!authData.session) {
        router.push('/auth');
        return;
      }

      const user = authData.session.user;

      // ② usage_logs 取得
      setLoading(true);
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500); // 直近500件くらい

      if (error) {
        console.error(error);
        setError('利用ログの取得に失敗しました。');
      } else if (data) {
        setLogs(data as UsageLog[]);
      }

      setLoading(false);
      setCheckingAuth(false);
    };

    checkSessionAndFetch();
  }, [router]);

  // ③ 集計処理
  const totalsByType: TotalsByType = useMemo(() => {
    const totals: TotalsByType = {};
    for (const log of logs) {
      totals[log.type] = (totals[log.type] ?? 0) + 1;
    }
    return totals;
  }, [logs]);

  const totalCount = useMemo(
    () => logs.length,
    [logs]
  );

  const maxCount = useMemo(() => {
    return Object.values(totalsByType).reduce(
      (max, value) => (value && value > max ? value : max),
      0
    );
  }, [totalsByType]);

  const summarizeType = (type: UsageType) => {
    switch (type) {
      case 'url':
        return 'URL要約';
      case 'vision':
        return '画像説明';
      case 'chat':
        return 'チャット';
      default:
        return type;
    }
  };

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        ログイン状態を確認中…
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '16px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundColor: '#f3f4f6',
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {/* ヘッダー */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                marginBottom: '4px',
              }}
            >
              マイページダッシュボード
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: '#6b7280',
              }}
            >
              Auto post studio のご利用状況を確認できます。
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/auth');
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </header>

        {/* サマリーカード群 */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            }}
          >
            <p
              style={{
                fontSize: '12px',
                color: '#9ca3af',
                marginBottom: '4px',
              }}
            >
              合計実行回数
            </p>
            <p
              style={{
                fontSize: '24px',
                fontWeight: 700,
              }}
            >
              {loading ? '…' : totalCount}
            </p>
          </div>

          {(['url', 'vision', 'chat'] as UsageType[]).map((type) => (
            <div
              key={type}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  marginBottom: '4px',
                }}
              >
                {summarizeType(type)}
              </p>
              <p
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                {loading ? '…' : totalsByType[type] ?? 0}
              </p>
              <p
                style={{
                  fontSize: '11px',
                  color: '#9ca3af',
                }}
              >
                全体に占める割合:{' '}
                {totalCount > 0
                  ? `${Math.round(((totalsByType[type] ?? 0) / totalCount) * 100)}%`
                  : '-'}
              </p>
            </div>
          ))}
        </section>

        {/* 棒グラフ風セクション */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '16px 16px 18px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            種別ごとの利用回数（簡易グラフ）
          </p>

          {maxCount === 0 ? (
            <p
              style={{
                fontSize: '12px',
                color: '#9ca3af',
              }}
            >
              まだご利用ログがありません。
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {Object.entries(totalsByType).map(([type, count]) => {
                const ratio = maxCount > 0 ? (count ?? 0) / maxCount : 0;
                const widthPercent = 10 + ratio * 90; // 最小10%, 最大100%

                return (
                  <div key={type}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        marginBottom: '2px',
                      }}
                    >
                      <span>{summarizeType(type)}</span>
                      <span>{count} 回</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '10px',
                        borderRadius: '999px',
                        backgroundColor: '#f3f4f6',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${widthPercent}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background:
                            'linear-gradient(90deg, #111827, #4b5563)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 直近ログ一覧（10件程度） */}
        <section
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '14px 16px 10px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.04)',
            marginBottom: '40px',
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            直近の利用ログ
          </p>

          {loading ? (
            <p
              style={{
                fontSize: '12px',
                color: '#9ca3af',
              }}
            >
              読み込み中…
            </p>
          ) : logs.length === 0 ? (
            <p
              style={{
                fontSize: '12px',
                color: '#9ca3af',
              }}
            >
              まだログがありません。Auto post studio を使ってみましょう。
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {logs.slice(0, 10).map((log) => {
                const d = new Date(log.created_at);
                const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d
                  .getHours()
                  .toString()
                  .padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

                return (
                  <li
                    key={log.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: '12px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 500,
                      }}
                    >
                      {summarizeType(log.type)}
                    </span>
                    <span
                      style={{
                        color: '#6b7280',
                        fontSize: '11px',
                      }}
                    >
                      {dateStr}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {error && (
          <p
            style={{
              fontSize: '12px',
              color: '#b91c1c',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
