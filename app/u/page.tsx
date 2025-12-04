// app/u/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Msg = { role: 'user' | 'assistant'; content: string };

// 上部に出すバナー（トライアル + ご契約中）
function TrialBanner({ profile }: { profile: any }) {
  if (!profile?.registered_at) return null;

  // 契約中（plan_status = 'paid'）なら「ご契約中」表示
  if (profile.plan_status === 'paid') {
    return (
      <div
        style={{
          backgroundColor: '#111827', // ダークネイビー
          color: '#bfdbfe',
          padding: '8px 12px',
          borderRadius: 10,
          fontSize: 12,
          textAlign: 'center',
          marginBottom: 12,
          border: '1px solid #1f2937',
        }}
      >
        ✅ ご契約中です。いつもご利用ありがとうございます。
      </div>
    );
  }

  // ここから下はトライアル中/終了後の表示
  const registered = new Date(profile.registered_at);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - registered.getTime()) / (1000 * 60 * 60 * 24),
  );

  const trialDays = profile.trial_type === 'referral' ? 30 : 7;
  const remaining = trialDays - diffDays;

  let bg = '#064e3b';
  let textColor = '#bbf7d0';
  let text = `無料期間：残り ${remaining}日`;

  if (remaining > 2) {
    if (profile.trial_type === 'referral') {
      bg = '#1d4ed8';
      textColor = '#bfdbfe';
      text = `紹介経由：無料期間 残り ${remaining}日`;
    } else {
      bg = '#064e3b';
      textColor = '#bbf7d0';
      text = `無料期間：残り ${remaining}日`;
    }
  } else if (remaining > 0) {
    bg = '#7c2d12';
    textColor = '#fed7aa';
    text = `まもなく終了（残り${remaining}日）`;
  } else if (remaining === 0) {
    bg = '#b91c1c';
    textColor = '#fee2e2';
    text = '無料期間は本日で終了します';
  } else {
    const daysAgo = Math.abs(remaining);
    bg = '#7f1d1d';
    textColor = '#fecaca';
    text = `無料期間終了（${daysAgo}日前）`;
  }

  return (
    <div
      style={{
        backgroundColor: bg,
        color: textColor,
        padding: '8px 12px',
        borderRadius: 10,
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 12,
      }}
    >
      {text}
    </div>
  );
}

export default function UPage() {
  const router = useRouter();

  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState<any>(null);

  // ===== URL → 要約/タイトル/ハッシュタグ/SNS =====
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlSummary, setUrlSummary] = useState('');
  const [urlTitles, setUrlTitles] = useState<string[]>([]);
  const [urlHashtags, setUrlHashtags] = useState<string[]>([]);
  const [instaText, setInstaText] = useState('');
  const [fbText, setFbText] = useState('');
  const [xText, setXText] = useState('');

  // 紹介パターン（1〜3のラジオボタン）
  const [stance, setStance] = useState<'self' | 'others' | 'third'>('self');

  const stancePrompts = {
    self:
      'あなたは投稿者本人です。自分が作成したSNS記事を紹介する立場で、要約とSNS投稿文を作成してください。主語は「私」「当方」でも自然に。過度な自画自賛は避けつつ、背景やねらい、見どころを簡潔に添えてください。',
  others:
      'あなたは第三者として、他人のSNS記事を自分のフォロワーに紹介します。著者へのリスペクトを示し、出典・引用であることを明確にしつつ、紹介者としての簡単な一言コメントを添えてください。',
    third:
      'あなたは中立の紹介者です。第三者の記事を客観的に要約し、価値やポイント、読むべき理由を端的に伝えてください。主観を抑え、出典明記を前提にしてください。',
  } as const;

  // ===== 画像 → SNS =====
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false); // 画像→3原稿（全プランOK）
  const [imageNote, setImageNote] = useState(''); // 補足説明欄

  // ★ 動画サムネ用（Trial / Proのみ）
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoRemaining, setVideoRemaining] = useState<number | null>(null);
  const [videoMaxLimit, setVideoMaxLimit] = useState<number | null>(null);

  // ===== チャット =====
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // === 認証 + 解約チェック ===
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      // セッションが無ければ /auth へ
      if (!user) {
        router.push('/auth');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || '');

      // プロファイル取得（解約情報込み）: id ではなく email で紐づける
      const { data: p, error: profileError } = await supabase
        .from('profiles')
        .select(
          'registered_at, trial_type, plan_status, plan_tier, is_canceled, plan_valid_until, email',
        )
        .eq('email', user.email)
        .maybeSingle();

      if (profileError) {
        console.error('profileError in /u:', profileError);
      }

      if (!p) {
        setProfile(null);
        return;
      }

      setProfile(p);

      // 解約済み & 有効期限切れなら強制ログアウト
      if (p.is_canceled) {
        if (!p.plan_valid_until) {
          alert(
            'ご契約はすでに終了しているため、サービスをご利用いただけません。',
          );
          await supabase.auth.signOut();
          router.push('/auth');
          return;
        }

        const now = new Date();
        const end = new Date(String(p.plan_valid_until));
        const diffMs = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          alert(
            'ご契約の有効期限が終了しているため、サービスをご利用いただけません。',
          );
          await supabase.auth.signOut();
          router.push('/auth');
          return;
        }
      }
    })();
  }, [router]);

  const planStatus = profile?.plan_status as 'trial' | 'paid' | null | undefined;
  const planTier = profile?.plan_tier as 'starter' | 'pro' | null | undefined;
  const canUseVideoThumb =
    planStatus === 'trial' || (planStatus === 'paid' && planTier === 'pro');

  // ===== テーマ（色など） =====
  const colors = {
    pageBg: '#FCFAF5',
    ink: '#111111',
    panelBorder: '#E5E7EB',
    panelBg: '#FFFFFF',
    panelShadow: '0 6px 20px rgba(0,0,0,0.06)',

    igBg: '#FFF5F9',
    igBorder: '#F8C2D8',
    igText: '#3B1C2A',

    fbBg: '#F3F8FF',
    fbBorder: '#BBD5FF',
    fbText: '#0F2357',

    xBg: '#F7F7F8',
    xBorder: '#D6D6DA',
    xText: '#111111',

    btnBg: '#111111',
    btnText: '#FFFFFF',
    btnBorder: '#111111',
    btnGhostBorder: '#DDDDDD',
    btnGhostBg: '#FFFFFF',
  };

  const pageStyle = {
    maxWidth: 1080,
    margin: '0 auto',
    padding: 16,
    background: colors.pageBg,
    boxSizing: 'border-box' as const,
  };

  const panel = {
    background: colors.panelBg,
    border: `1px solid ${colors.panelBorder}`,
    borderRadius: 14,
    padding: 16,
    boxShadow: colors.panelShadow,
    overflow: 'hidden' as const,
  };

  const btn = {
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${colors.btnBorder}`,
    background: colors.btnBg,
    color: colors.btnText,
    fontWeight: 600 as const,
  };
  const btnGhost = {
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${colors.btnGhostBorder}`,
    background: colors.btnGhostBg,
    color: colors.ink,
    fontWeight: 600 as const,
  };
  const inputStyle = {
    border: `1px solid ${colors.btnGhostBorder}`,
    padding: 12,
    borderRadius: 10,
    width: '100%',
    boxSizing: 'border-box' as const,
    background: '#FFFFFF',
  };
  const labelStyle = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    display: 'block' as const,
  };

  const cardGrid = {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  };

  const snsCardBase = {
    borderRadius: 12,
    padding: 12,
    boxSizing: 'border-box' as const,
    overflow: 'hidden' as const,
  };

  const textAreaStyle = {
    ...inputStyle,
    height: 160,
    resize: 'vertical' as const,
    overflow: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('コピーしました');
    } catch {
      alert('コピーに失敗しました');
    }
  };

  // ===== URL → まとめて生成 =====
  const generateFromURL = async () => {
    if (!userId) {
      alert('ログインが必要です');
      return;
    }
    if (!urlInput) {
      alert('URLを入力してください');
      return;
    }

    setUrlLoading(true);
    try {
      const res = await fetch('/api/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          url: urlInput,
          promptContext: stancePrompts[stance],
        }),
      });
      const j = await res.json();
      if (j?.error) throw new Error(j.error);

      setUrlSummary(j.summary || '');
      setUrlTitles(Array.isArray(j.titles) ? j.titles : []);
      setUrlHashtags(Array.isArray(j.hashtags) ? j.hashtags : []);

      setInstaText(j.instagram || '');
      setFbText(j.facebook || '');
      setXText(j.x || '');

      alert('URLからSNS向け文章を生成しました');
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setUrlLoading(false);
    }
  };

  // ===== 画像 → SNS（全プランOK、従来どおり /api/vision） =====
  const generateFromImage = async () => {
    if (!userId) {
      alert('ログインが必要です');
      return;
    }
    if (!imageFile) {
      alert('画像を選択してください');
      return;
    }
    if (
      (imageFile.type || '').toLowerCase().includes('heic') ||
      (imageFile.type || '').toLowerCase().includes('heif')
    ) {
      alert('HEICは非対応です。iPhoneは「互換性優先」かスクショ画像で試してください。');
      return;
    }
    if (imageFile.size > 8 * 1024 * 1024) {
      alert('画像は8MB以下でお願いします。');
      return;
    }

    setIsGenerating(true);

    try {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const safeFileName = `${Date.now()}.${ext}`;
      const path = `${userId}/${safeFileName}`;

      const up = await supabase.storage
        .from('uploads')
        .upload(path, imageFile, {
          upsert: true,
          contentType: imageFile.type || 'image/jpeg',
        });

      if (up.error) {
        alert(`アップロード失敗：${up.error.message}`);
        return;
      }

      const pInsta =
        'Instagram向け：画像の雰囲気が一目で伝わるように、' +
        '冒頭に1〜2個のアイコン（例：📸✨🎨など）を入れ、文中にも合計5個以上の絵文字・顔文字を必ず入れてください。' +
        '砕けた口調で300〜400文字程度、日本語で書き、最後に3〜6個のハッシュタグを付けてください。';

      const pFb =
        'Facebook向け：人情味のある長文ストーリーとして、起→承→転→結の流れで約700文字の日本語文章を作ってください。' +
        '途中で場面や気持ちの変化が分かるように、段落ごとに改行を入れてください。' +
        '最後は「あなたならどう感じますか？」「ぜひコメントで教えてください。」のような問いかけで締めてください。' +
        '絵文字は1〜3個までに控えめにし、最後に3〜6個のハッシュタグを付けてください。';

      const pX =
        'X向け：150文字程度で要点だけを伝えるコンパクトな投稿文を日本語で作ってください。' +
        '文中に2〜3個の絵文字を入れ、最後に2〜4個のハッシュタグを付けてください。';

      const payload = (prompt: string) => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prompt: prompt + (imageNote ? `\n【補足説明】${imageNote}` : ''),
          filePath: path,
        }),
      });

      const [r1, r2, r3] = await Promise.all([
        fetch('/api/vision', payload(pInsta)),
        fetch('/api/vision', payload(pFb)),
        fetch('/api/vision', payload(pX)),
      ]);

      const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);

      if (j1?.error || j2?.error || j3?.error) {
        throw new Error(
          j1?.error || j2?.error || j3?.error || '生成に失敗しました',
        );
      }

      setInstaText(j1.text || '');
      setFbText(j2.text || '');
      setXText(j3.text || '');

      alert('画像からSNS向け文章を生成しました');
    } catch (e: any) {
      console.error(e);
      alert(`エラー: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ===== 動画サムネ（サムネ画像＋メモ想定）→ 3種類の原稿（Trial / Pro限定、回数制限あり） =====
  const generateFromVideoThumb = async () => {
    if (!userId || !userEmail) {
      alert('ログイン情報の取得に失敗しました。いったんログインし直してください。');
      return;
    }
    if (!imageFile) {
      alert('動画のサムネイル用の画像を選択してください');
      return;
    }

    // プランチェック（Starterでは利用不可）
    if (!canUseVideoThumb) {
      if (planStatus === 'paid' && planTier === 'starter') {
        alert(
          '「動画からサムネを作って原稿をつくる」機能は Starter プランではご利用いただけません。トライアル期間中または Pro プランでご利用いただけます。',
        );
      } else {
        alert(
          'この機能はトライアル期間中または Pro プランでご利用いただけます。マイページからプランをご確認ください。',
        );
      }
      return;
    }

    if (
      (imageFile.type || '').toLowerCase().includes('heic') ||
      (imageFile.type || '').toLowerCase().includes('heif')
    ) {
      alert(
        'HEICは非対応です。iPhoneは「互換性優先」かスクショでアップしてください。',
      );
      return;
    }
    if (imageFile.size > 8 * 1024 * 1024) {
      alert('画像は8MB以下でお願いします。');
      return;
    }

    setVideoGenerating(true);

    try {
      const ext = imageFile.name.split('.').pop() || 'jpg';
      const safeFileName = `video-thumb-${Date.now()}.${ext}`;
      const path = `${userId}/${safeFileName}`;

      const up = await supabase.storage
        .from('uploads')
        .upload(path, imageFile, {
          upsert: true,
          contentType: imageFile.type || 'image/jpeg',
        });

      if (up.error) {
        alert(`アップロード失敗：${up.error.message}`);
        setVideoGenerating(false);
        return;
      }

      const videoPrompt =
        'この画像は動画のサムネイルです。動画全体の雰囲気やストーリーが伝わるように、Instagram / Facebook / X 向けの投稿文をそれぞれ1つずつ作成してください。\n\n' +
        '出力フォーマットは必ず次の形にしてください:\n' +
        '【INSTAGRAM】\n' +
        '（Instagram向けの日本語テキスト）\n' +
        '【FACEBOOK】\n' +
        '（Facebook向けの日本語テキスト）\n' +
        '【X】\n' +
        '（X向けの日本語テキスト）\n\n' +
        '各テキストには、動画の内容が想像できるような一文を含め、最後にハッシュタグも適度に含めてください。';

      const res = await fetch('/api/version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userEmail,
          prompt:
            videoPrompt +
            (imageNote ? `\n【補足説明】この動画についてのメモ：${imageNote}` : ''),
          filePath: path,
          mode: 'video_thumb',
        }),
      });

      const j = await res.json();

      if (!res.ok) {
        const msg =
          j?.message ||
          j?.error ||
          '動画サムネイル用の文章生成に失敗しました。';
        alert(msg);
        setVideoGenerating(false);
        return;
      }

      const rawText: string = j.text || '';

      // 【INSTAGRAM】〜【FACEBOOK】〜【X】〜 を分解
      const instaPart = rawText.split('【FACEBOOK】')[0].split('【INSTAGRAM】')[1];
      const fbPart = rawText.split('【X】')[0].split('【FACEBOOK】')[1];
      const xPart = rawText.split('【X】')[1];

      if (instaPart) setInstaText(instaPart.trim());
      if (fbPart) setFbText(fbPart.trim());
      if (xPart) setXText(xPart.trim());

      if (typeof j.remaining === 'number') {
        setVideoRemaining(j.remaining);
      }
      if (typeof j.maxLimit === 'number') {
        setVideoMaxLimit(j.maxLimit);
      }

      alert('動画サムネイル用としてSNS向け文章を生成しました');
    } catch (e: any) {
      console.error(e);
      alert(`サムネイル生成または文章生成に失敗しました: ${e.message}`);
    } finally {
      setVideoGenerating(false);
    }
  };

  // ===== チャット =====
  const sendChat = async () => {
    if (!userId || !chatInput) return;
    setChatLoading(true);
    setMessages((m) => [...m, { role: 'user', content: chatInput }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userText: chatInput }),
      });
      const j = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: j.text || '' }]);
      setChatInput('');
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      {/* 🔔 トライアル / ご契約中バナー */}
      <TrialBanner profile={profile} />

      {/* ヘッダー：左にタイトル、右にマイページ＆ログアウト */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: colors.ink,
          }}
        >
          ユーザーページ
        </h2>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnGhost} onClick={() => router.push('/mypage')}>
            マイページ
          </button>

          <button
            style={btnGhost}
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/auth');
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* ===== ① URL → 生成（上段） ===== */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 8,
            color: colors.ink,
          }}
        >
          ① URLからSNS向け文章を自動生成
        </h3>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={labelStyle}>記事やブログのURL</label>
          <input
            style={inputStyle}
            placeholder="https://example.com/article"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            inputMode="url"
          />

          {/* ラジオボタン：紹介する立場 */}
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 6,
                color: '#374151',
              }}
            >
              紹介する立場を選んでください
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="stance"
                  value="self"
                  checked={stance === 'self'}
                  onChange={() => setStance('self')}
                />
                ① 自分が作成したSNS記事を紹介（自分目線）
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="stance"
                  value="others"
                  checked={stance === 'others'}
                  onChange={() => setStance('others')}
                />
                ② 他人のSNS記事を自分が紹介（紹介者目線）
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="stance"
                  value="third"
                  checked={stance === 'third'}
                  onChange={() => setStance('third')}
                />
                ③ 第三者の記事を紹介（中立・客観）
              </label>
            </div>
          </div>

          <div>
            <button
              style={urlLoading ? btnGhost : btn}
              disabled={!urlInput || urlLoading}
              onClick={generateFromURL}
            >
              {urlLoading ? '生成中…' : 'URLから3種類の原稿を作る'}
            </button>
          </div>
        </div>

        {/* 要約・タイトル案・ハッシュタグ候補 */}
        {(urlSummary || urlTitles.length || urlHashtags.length) ? (
          <div
            style={{
              borderTop: '1px dashed #e5e7eb',
              marginTop: 12,
              paddingTop: 12,
              display: 'grid',
              gap: 12,
            }}
          >
            {/* 要約 */}
            {urlSummary && (
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 6,
                    color: colors.ink,
                  }}
                >
                  要約（200〜300文字）
                </div>
                <div
                  style={{
                    border: '1px solid #eee',
                    borderRadius: 10,
                    padding: 12,
                    background: '#FAFAFA',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {urlSummary}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button style={btnGhost} onClick={() => copy(urlSummary)}>
                    要約をコピー
                  </button>
                </div>
              </div>
            )}

            {/* タイトル案 */}
            {urlTitles.length > 0 && (
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 6,
                    color: colors.ink,
                  }}
                >
                  タイトル案（3つ）
                </div>
                <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: 0 }}>
                  {urlTitles.map((t, i) => (
                    <li
                      key={i}
                      style={{
                        marginBottom: 6,
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span style={{ flex: 1 }}>{t}</span>
                      <button style={btnGhost} onClick={() => copy(t)}>
                        コピー
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ハッシュタグ候補 */}
            {urlHashtags.length > 0 && (
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 6,
                    color: colors.ink,
                  }}
                >
                  ハッシュタグ候補（10〜15）
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {urlHashtags.map((h, i) => (
                    <span
                      key={i}
                      style={{
                        border: '1px solid #eee',
                        borderRadius: 999,
                        padding: '6px 10px',
                        background: '#fff',
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    style={btnGhost}
                    onClick={() => copy(urlHashtags.join(' '))}
                  >
                    すべてコピー
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ===== ② 画像 → 生成（中段） ===== */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 8,
            color: colors.ink,
          }}
        >
          ② 画像からSNS向け文章を自動生成
        </h3>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={labelStyle}>画像ファイル</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (!f) {
                setImageFile(null);
                return;
              }
              const t = (f.type || '').toLowerCase();
              if (t.includes('heic') || t.includes('heif')) {
                alert(
                  'HEICは非対応です。iPhoneは「互換性優先」かスクショでアップしてください。',
                );
                (e.currentTarget as HTMLInputElement).value = '';
                setImageFile(null);
                return;
              }
              setImageFile(f);
            }}
          />

          {/* 補足説明欄 */}
          <label style={labelStyle}>補足説明（どんな写真か、状況など）</label>
          <textarea
            style={{
              ...inputStyle,
              height: 72,
              resize: 'vertical' as const,
              whiteSpace: 'pre-wrap' as const,
            }}
            placeholder="例：地域イベントで撮影した写真。子どもたちが作った作品展示の様子。"
            value={imageNote}
            onChange={(e) => setImageNote(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 画像 → 3種類の原稿（全プランOK） */}
            <button
              style={isGenerating ? btnGhost : btn}
              onClick={generateFromImage}
              disabled={!imageFile || isGenerating || videoGenerating}
            >
              {isGenerating ? '生成中…' : '画像から3種類の原稿を作る'}
            </button>

            {/* 動画サムネ用 → 3種類の原稿（Trial / Pro限定） */}
            <button
              style={videoGenerating ? btnGhost : btn}
              onClick={generateFromVideoThumb}
              disabled={
                !imageFile || videoGenerating || isGenerating || !canUseVideoThumb
              }
            >
              {videoGenerating
                ? '動画サムネ用の原稿を生成中…'
                : '動画からサムネを作って3種類の原稿を作る（Trial / Pro）'}
            </button>

            <div style={{ fontSize: 11, color: '#6b7280' }}>
              {canUseVideoThumb ? (
                <>
                  {planStatus === 'trial' && (
                    <div>トライアル期間中：動画サムネ機能は期間中 合計10回まで利用できます。</div>
                  )}
                  {planStatus === 'paid' && planTier === 'pro' && (
                    <div>Proプラン：動画サムネ機能は1ヶ月 30回まで利用できます。</div>
                  )}
                  {videoMaxLimit !== null && videoRemaining !== null && (
                    <div>
                      現在の残り回数：{videoRemaining} / {videoMaxLimit} 回
                    </div>
                  )}
                </>
              ) : (
                <div>
                  動画サムネイル機能はトライアル期間中または Pro プランでご利用いただけます。
                  Starterプランではご利用いただけません。
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3カラム：SNS欄（元の構成そのまま） */}
        <div style={cardGrid}>
          {/* Instagram */}
          <div
            style={{
              ...snsCardBase,
              background: colors.igBg,
              border: `1px solid ${colors.igBorder}`,
              color: colors.igText,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Instagram（約200文字＋ハッシュタグ）
            </div>
            <textarea
              style={{ ...textAreaStyle, background: '#FFFFFF' }}
              value={instaText}
              onChange={(e) => setInstaText(e.target.value)}
              placeholder="ここにInstagram向けの説明が入ります"
            />
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button style={btnGhost} onClick={() => copy(instaText)}>
                コピー
              </button>
            </div>
          </div>

          {/* Facebook */}
          <div
            style={{
              ...snsCardBase,
              background: colors.fbBg,
              border: `1px solid ${colors.fbBorder}`,
              color: colors.fbText,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Facebook（ストーリー重視・約700文字＋ハッシュタグ）
            </div>
            <textarea
              style={{ ...textAreaStyle, height: 220, background: '#FFFFFF' }}
              value={fbText}
              onChange={(e) => setFbText(e.target.value)}
              placeholder="ここにFacebook向けの説明が入ります"
            />
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button style={btnGhost} onClick={() => copy(fbText)}>
                コピー
              </button>
            </div>
          </div>

          {/* X */}
          <div
            style={{
              ...snsCardBase,
              background: colors.xBg,
              border: `1px solid ${colors.xBorder}`,
              color: colors.xText,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              X（150文字コンパクト＋ハッシュタグ）
            </div>
            <textarea
              style={{ ...textAreaStyle, height: 140, background: '#FFFFFF' }}
              value={xText}
              onChange={(e) => setXText(e.target.value)}
              placeholder="ここにX向けの説明が入ります"
            />
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button style={btnGhost} onClick={() => copy(xText)}>
                コピー
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ③ 通常チャット（下段） ===== */}
      <div style={{ ...panel }}>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 8,
            color: colors.ink,
          }}
        >
          ③ 通常チャット
        </h3>
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <label style={labelStyle}>記載例（そのまま書き換えてOK）</label>
          <textarea
            style={{
              ...inputStyle,
              height: 96,
              resize: 'vertical' as const,
              overflow: 'auto' as const,
              whiteSpace: 'pre-wrap' as const,
            }}
            placeholder={
              '例: 「このテキストを要約して、X向けに150文字で」\n' +
              '例: 「Instagram / Facebook / X それぞれのトーンで整えて」'
            }
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <div>
            <button
              style={chatLoading ? btnGhost : btn}
              disabled={chatLoading || !chatInput}
              onClick={sendChat}
            >
              {chatLoading ? '送信中…' : '送信'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                border: '1px solid #eee',
                borderRadius: 10,
                padding: 12,
                background: m.role === 'user' ? '#F0F9FF' : '#F9FAFB',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginBottom: 4,
                }}
              >
                {m.role}
              </div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.content}
              </div>
              {m.role === 'assistant' && (
                <div style={{ marginTop: 8 }}>
                  <button style={btnGhost} onClick={() => copy(m.content)}>
                    この返信をコピー
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
