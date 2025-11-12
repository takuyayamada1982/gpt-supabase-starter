'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Msg = { role: 'user'|'assistant', content: string };

export default function UPage() {
  const [userId, setUserId] = useState<string>('');

  // ===== URL → 要約/タイトル/ハッシュタグ/SNS =====
  const [stance, setStance] = useState<'self' | 'others' | 'third'>('self');

  const stancePrompts = {
    self:
      'あなたは投稿者本人です。自分が作成したSNS記事を紹介する立場で、要約とSNS投稿文を作成してください。主語は「私」「当方」でも自然に。過度な自画自賛は避けつつ、背景やねらい、見どころを簡潔に添えてください。',
    others:
      'あなたは第三者として、他人のSNS記事を自分のフォロワーに紹介します。著者へのリスペクトを示し、出典・引用であることを明確にしつつ、紹介者としての簡単な一言コメントを添えてください。',
    third:
      'あなたは中立の紹介者です。第三者の記事を客観的に要約し、価値やポイント、読むべき理由を端的に伝えてください。主観を抑え、出典明記を前提にしてください。'
  } as const;

  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlSummary, setUrlSummary] = useState('');
  const [urlTitles, setUrlTitles] = useState<string[]>([]);
  const [urlHashtags, setUrlHashtags] = useState<string[]>([]);
  const [instaText, setInstaText] = useState('');
  const [fbText, setFbText] = useState('');
  const [xText, setXText] = useState('');

  // ===== 画像 → SNS =====
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageNote, setImageNote] = useState('');

  // ===== チャット =====
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || '');
    })();
  }, []);

  // ===== THEME =====
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
    btnGhostBg: '#FFFFFF'
  };

  const pageStyle: React.CSSProperties = {
    maxWidth: 1080,
    margin: '0 auto',
    padding: 16,
    background: colors.pageBg,
    boxSizing: 'border-box'
  };

  const panel: React.CSSProperties = {
    background: colors.panelBg,
    border: `1px solid ${colors.panelBorder}`,
    borderRadius: 14,
    padding: 16,
    boxShadow: colors.panelShadow,
    overflow: 'hidden'
  };

  const btn: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${colors.btnBorder}`,
    background: colors.btnBg,
    color: colors.btnText,
    fontWeight: 600
  };
  const btnGhost: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${colors.btnGhostBorder}`,
    background: colors.btnGhostBg,
    color: colors.ink,
    fontWeight: 600
  };
  const inputStyle: React.CSSProperties = {
    border: `1px solid ${colors.btnGhostBorder}`,
    padding: 12,
    borderRadius: 10,
    width: '100%',
    boxSizing: 'border-box',
    background: '#FFFFFF'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    display: 'block'
  };

  const cardGrid: React.CSSProperties = {
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
  };

  const snsCardBase: React.CSSProperties = {
    borderRadius: 12,
    padding: 12,
    boxSizing: 'border-box',
    overflow: 'hidden'
  };

  const textAreaStyle: React.CSSProperties = {
    ...inputStyle,
    height: 160,
    resize: 'vertical',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('コピーしました');
    } catch {
      alert('コピーに失敗しました');
    }
  };

  // ===== URL → SNS生成 =====
  const generateFromURL = async () => {
    if (!userId) { alert('ログインが必要です'); return; }
    if (!urlInput) { alert('URLを入力してください'); return; }

    setUrlLoading(true);
    try {
      const res = await fetch('/api/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          url: urlInput,
          promptContext: stancePrompts[stance]
        })
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

  // ===== 画像 → SNS生成 =====
  const generateFromImage = async () => {
    if (!userId) { alert('ログインが必要です'); return; }
    if (!imageFile) { alert('画像を選択してください'); return; }
    if ((imageFile.type || '').toLowerCase().includes('heic') || (imageFile.type || '').toLowerCase().includes('heif')) {
      alert('HEICは非対応です。iPhoneは「互換性優先」かスクショ画像で試してください。');
      return;
    }
    if (imageFile.size > 8 * 1024 * 1024) {
      alert('画像は8MB以下でお願いします。');
      return;
    }

    setIsGenerating(true);
    const path = `${userId}/${Date.now()}_${imageFile.name}`;
    const up = await supabase.storage.from('uploads').upload(path, imageFile, {
      upsert: true,
      contentType: imageFile.type || 'image/jpeg'
    });
    if (up.error) {
      alert(`アップロード失敗：${up.error.message}`);
      setIsGenerating(false);
      return;
    }

    const pInsta = `Instagram向け：約200文字。最後に3〜6個のハッシュタグ。`;
    const pFb = `Facebook向け：ストーリー重視で約700文字。改行。最後に3〜6個のハッシュタグ。`;
    const pX = `X向け：150文字程度で簡潔に。最後に2〜4個のハッシュタグ。`;

    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            prompt: pInsta + (imageNote ? `\n【補足説明】${imageNote}` : ''),
            filePath: path
          })
        }),
        fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            prompt: pFb + (imageNote ? `\n【補足説明】${imageNote}` : ''),
            filePath: path
          })
        }),
        fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            prompt: pX + (imageNote ? `\n【補足説明】${imageNote}` : ''),
            filePath: path
          })
        })
      ]);

      const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      if (j1?.error || j2?.error || j3?.error) {
        throw new Error(j1?.error || j2?.error || j3?.error || '生成に失敗しました');
      }

      setInstaText(j1.text || '');
      setFbText(j2.text || '');
      setXText(j3.text || '');
      alert('SNS向け文章を生成しました');
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ===== チャット =====
  const sendChat = async () => {
    if (!userId || !chatInput) return;
    setChatLoading(true);
    setMessages(m => [...m, { role: 'user', content: chatInput }]);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userText: chatInput })
    });
    const j = await res.json();
    setMessages(m => [...m, { role: 'assistant', content: j.text || '' }]);
    setChatInput('');
    setChatLoading(false);
  };

  return (
    <main style={pageStyle}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: colors.ink }}>
        ユーザーページ
      </h2>

      {/* ===== ① URLからSNS生成 ===== */}
      {/* 既存のURL生成ブロックをここに保持（省略可） */}

      {/* ===== ② 画像からSNS生成 ===== */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: colors.ink }}>
          ② 画像からSNS向け文章を自動生成
        </h3>

        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={labelStyle}>補足説明（どんな写真か、状況など）</label>
          <textarea
            style={{
              ...inputStyle,
              height: 72,
              resize: 'vertical',
              whiteSpace: 'pre-wrap'
            }}
            placeholder="例：地域イベントで撮影した写真。子どもたちが作った作品展示の様子。"
            value={imageNote}
            onChange={e => setImageNote(e.target.value)}
          />

          <label style={labelStyle}>画像ファイル</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const f = e.target.files?.[0] || null;
              if (!f) { setImageFile(null); return; }
              const t = (f.type || '').toLowerCase();
              if (t.includes('heic') || t.includes('heif')) {
                alert('HEICは非対応です。iPhoneは「互換性優先」かスクショでアップしてください。');
                (e.currentTarget as HTMLInputElement).value = '';
                setImageFile(null);
                return;
              }
              setImageFile(f);
            }}
          />
          <div>
            <button
              style={isGenerating ? btnGhost : btn}
              onClick={generateFromImage}
              disabled={!imageFile || isGenerating}
            >
              {isGenerating ? '生成中…' : '画像から3種類の原稿を作る'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== ③ 通常チャット ===== */}
      {/* 既存のチャット部分そのままでOK */}
    </main>
  );
}
