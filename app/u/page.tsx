'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Msg = { role: 'user' | 'assistant', content: string };

export default function UPage() {
  const [userId, setUserId] = useState<string>('');

  // ===== URL → 要約/タイトル/ハッシュタグ/投稿文 =====
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlSummary, setUrlSummary] = useState('');
  const [urlTitles, setUrlTitles] = useState<string[]>([]);
  const [urlHashtags, setUrlHashtags] = useState<string[]>([]);
  const [instaText, setInstaText] = useState('');
  const [fbText, setFbText] = useState('');
  const [xText, setXText] = useState('');

  // ①②③ 立場の選択
  const [stance, setStance] = useState<'self' | 'others' | 'third'>('self');

  const stancePrompts = {
    self:
      'あなたは投稿者本人です。自分が作成したSNS記事を紹介する立場で、要約とSNS投稿文を作成してください。主語は「私」「当方」でも自然に。過度な自画自賛は控えつつ、背景やねらいを簡潔に添える。',
    others:
      'あなたは第三者として、他人のSNS記事を自分のフォロワーに紹介します。著者へのリスペクトを示し、引用であることを明確にしつつ、紹介者として視点を添えてください。',
    third:
      'あなたは完全に中立の紹介者です。第三者の記事を客観的に要約し、価値とポイントを読者に伝える形で整えてください。'
  } as const;

  // ===== 画像 → SNS =====
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageNote, setImageNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // ===== チャット =====
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // ===== ログインユーザー取得 =====
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
  };

  const panel: React.CSSProperties = {
    background: colors.panelBg,
    border: `1px solid ${colors.panelBorder}`,
    borderRadius: 14,
    padding: 16,
    boxShadow: colors.panelShadow,
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
    background: '#FFFFFF',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    display: 'block',
  };

  // =============================
  // 🌐 URL → SNS文章生成
  // =============================
  const generateFromURL = async () => {
    if (!userId) return alert('ログインが必要です');
    if (!urlInput) return alert('URLを入力してください');

    setUrlLoading(true);

    try {
      const res = await fetch('/api/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          url: urlInput,
          promptContext: stancePrompts[stance],
          type: 'url'
        })
      });

      const j = await res.json();
      if (j?.error) throw new Error(j.error);

      setUrlSummary(j.summary ?? '');
      setUrlTitles(j.titles ?? []);
      setUrlHashtags(j.hashtags ?? []);
      setInstaText(j.instagram ?? '');
      setFbText(j.facebook ?? '');
      setXText(j.x ?? '');

      alert('URLからSNS文を生成しました');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUrlLoading(false);
    }
  };

  // =============================
  // 🖼 画像 → SNS文章生成
  // =============================
  const generateFromImage = async () => {
    if (!userId) return alert('ログインが必要です');
    if (!imageFile) return alert('画像を選択してください');
    if (imageFile.size > 8 * 1024 * 1024)
      return alert('画像は8MB以下でお願いします');

    setIsGenerating(true);

    const path = `${userId}/${Date.now()}_${imageFile.name}`;
    const up = await supabase.storage.from('uploads').upload(path, imageFile);

    if (up.error) {
      setIsGenerating(false);
      return alert('画像アップロードに失敗しました');
    }

    const pInsta = `Instagram向け：約200文字。`;
    const pFb = `Facebook向け：ストーリー重視。`;
    const pX = `X向け：150文字以内。`;

    const payload = (prompt: string) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        filePath: path,
        prompt: `${prompt}\n\n【補足説明】${imageNote}`,
        type: 'vision'
      })
    });

    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/vision', payload(pInsta)),
        fetch('/api/vision', payload(pFb)),
        fetch('/api/vision', payload(pX))
      ]);

      const [j1, j2, j3] = await Promise.all([
        r1.json(),
        r2.json(),
        r3.json()
      ]);

      setInstaText(j1.text ?? '');
      setFbText(j2.text ?? '');
      setXText(j3.text ?? '');

      alert('画像からSNS文を生成しました');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // =============================
  // 💬 チャット
  // =============================
  const sendChat = async () => {
    if (!chatInput) return;
    if (!userId) return;

    setChatLoading(true);
    setMessages((m) => [...m, { role: 'user', content: chatInput }]);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userText: chatInput, type: 'chat' })
    });

    const j = await res.json();

    setMessages((m) => [
      ...m,
      { role: 'assistant', content: j.text ?? '' }
    ]);

    setChatInput('');
    setChatLoading(false);
  };

  return (
    <main style={pageStyle}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
        ユーザーページ
      </h2>

      {/* ================================= */}
      {/* ① URL → SNS文章生成 */}
      {/* ================================= */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          ① URLからSNS向け文章を自動生成
        </h3>

        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={labelStyle}>記事URL</label>
          <input
            style={inputStyle}
            placeholder="https://example.com/article"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />

          {/* 立場のラジオボタン */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              紹介する立場を選択
            </div>

            <label>
              <input
                type="radio"
                checked={stance === 'self'}
                onChange={() => setStance('self')}
              />
              自分の記事として紹介
            </label>

            <label>
              <input
                type="radio"
                checked={stance === 'others'}
                onChange={() => setStance('others')}
              />
              他人の記事を紹介
            </label>

            <label>
              <input
                type="radio"
                checked={stance === 'third'}
                onChange={() => setStance('third')}
              />
              中立の立場で紹介
            </label>
          </div>

          <button
            style={urlLoading ? btnGhost : btn}
            disabled={urlLoading}
            onClick={generateFromURL}
          >
            {urlLoading ? '生成中…' : 'URLから３種類のSNS文を作成'}
          </button>
        </div>

        {/* ========== URL生成後の表示部分 ========== */}
        {urlSummary && (
          <>
            <h4 style={{ fontWeight: 700 }}>要約</h4>
            <div style={{ whiteSpace: 'pre-wrap' }}>{urlSummary}</div>

            <h4 style={{ fontWeight: 700, marginTop: 12 }}>タイトル案</h4>
            <ul>
              {urlTitles.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>

            <h4 style={{ fontWeight: 700, marginTop: 12 }}>ハッシュタグ案</h4>
            <div>{urlHashtags.join(' ')}</div>
          </>
        )}
      </div>

      {/* ================================= */}
      {/* ② 画像 → SNS文章生成 */}
      {/* ================================= */}

      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>② 画像からSNS文章を生成</h3>

        <label style={labelStyle}>補足説明（写真の状況など3行）</label>
        <textarea
          style={{ ...inputStyle, height: 70 }}
          placeholder="例：地域イベントで撮影した写真です..."
          value={imageNote}
          onChange={(e) => setImageNote(e.target.value)}
        />

        <label style={labelStyle}>画像ファイル</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />

        <button
          style={{ ...btn, marginTop: 8 }}
          disabled={!imageFile || isGenerating}
          onClick={generateFromImage}
        >
          {isGenerating ? '生成中…' : '画像からSNS文を生成'}
        </button>
      </div>

      {/* ========== SNS 3種類の表示欄 ========== */}

      <div style={{ ...panel, marginBottom: 16 }}>
        <h3>SNS出力</h3>

        <div>
          <h4>Instagram</h4>
          <textarea
            style={{ ...inputStyle, height: 140 }}
            value={instaText}
            onChange={(e) => setInstaText(e.target.value)}
          />
        </div>

        <div>
          <h4>Facebook</h4>
          <textarea
            style={{ ...inputStyle, height: 180 }}
            value={fbText}
            onChange={(e) => setFbText(e.target.value)}
          />
        </div>

        <div>
          <h4>X（Twitter）</h4>
          <textarea
            style={{ ...inputStyle, height: 120 }}
            value={xText}
            onChange={(e) => setXText(e.target.value)}
          />
        </div>
      </div>

      {/* ================================= */}
      {/* ③ チャット */}
      {/* ================================= */}

      <div style={{ ...panel }}>
        <h3>③ チャット</h3>

        <textarea
          style={{ ...inputStyle, height: 80 }}
          placeholder="例：この文章をX向けに150文字に要約して…"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
        />

        <button
          style={{ ...btn, marginTop: 8 }}
          disabled={chatLoading}
          onClick={sendChat}
        >
          {chatLoading ? '送信中…' : '送信'}
        </button>

        <div style={{ marginTop: 12 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                padding: 10,
                background: m.role === 'user' ? '#E0F2FE' : '#F8FAFC',
                borderRadius: 8
              }}
            >
              <div style={{ fontSize: 12, color: '#6B7280' }}>{m.role}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
