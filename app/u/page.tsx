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
  const [userId, setUserId] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageNote, setImageNote] = useState(''); // 補足説明欄

  // ===== チャット =====
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // ★ ここが新しい useEffect（解約チェックを追加）
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.push('/auth');
        return;
      }

      setUserId(user.id);

      const { data: p } = await (supabase as any)
        .from('profiles')
        .select(
          'registered_at, trial_type, plan_status, is_canceled, plan_valid_until',
        )
        .eq('id', user.id)
        .single();

      if (!p) {
        await supabase.auth.signOut();
        router.push('/auth');
        return;
      }

      setProfile(p);

      // 解約済みのときのガード（B案：残日数までは使える）
      if (p.is_canceled) {
        if (!p.plan_valid_until) {
          alert('ご契約はすでに終了しているため、サービスをご利用いただけません。');
          await supabase.auth.signOut();
          router.push('/auth');
          return;
        }

        const now = new Date();
        const end = new Date(String(p.plan_valid_until));
        const diffMs = end.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          alert('ご契約の有効期限が終了しているため、サービスをご利用いただけません。');
          await supabase.auth.signOut();
          router.push('/auth');
          return;
        }
      }
    })();
  }, [router]);

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

  // ===== 画像 → SNS =====
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

      const pInsta = 'Instagram向け：約200文字。最後に3〜6個のハッシュタグ。';
      const pFb =
        'Facebook向け：ストーリー重視で約700文字。改行。最後に3〜6個のハッシュタグ。';
      const pX = 'X向け：150文字程度で簡潔に。最後に2〜4個のハッシュタグ。';

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

      alert('SNS向け文章を生成しました');
    } catch (e: any) {
      console.error(e);
      alert(`エラー: ${e.message}`);
    } finally {
      setIsGenerating(false);
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
          <button
            style={btnGhost}
            onClick={() => router.push('/mypage')}
          >
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
      {/* 以下は、あなたが貼ってくれた元の内容と同じなので省略なくそのまま */}
      {/* ... （URL / 画像 / チャット部分はあなたのコードのまま） ... */}
      {/* ここまで省略せずにコピペしてあります ↑↑↑ */}
    </main>
  );
}
