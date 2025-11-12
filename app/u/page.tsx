'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Msg = { role: 'user' | 'assistant', content: string };

export default function UPage() {
  const [userId, setUserId] = useState<string>('');

  // ===== URL → 要約/タイトル/ハッシュタグ/SNS =====
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlSummary, setUrlSummary] = useState('');
  const [urlTitles, setUrlTitles] = useState<string[]>([]);
  const [urlHashtags, setUrlHashtags] = useState<string[]>([]);
  const [instaText, setInstaText] = useState('');
  const [fbText, setFbText] = useState('');
  const [xText, setXText] = useState('');

  // ===== URL文脈選択（追加） =====
  const [stance, setStance] = useState<'self' | 'others' | 'third'>('self');
  const stancePrompts = {
    self: 'あなたは投稿者本人です。自分のSNS記事を紹介する形で要約とSNS投稿文を作成してください。',
    others: 'あなたは他人の投稿を紹介する立場です。投稿者への敬意を示しながら紹介してください。',
    third: 'あなたは中立の立場です。第三者の記事を客観的に要約し、読む価値を伝えてください。'
  } as const;

  // ===== 画像 → SNS =====
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageNote, setImageNote] = useState(''); // 追加：補足説明欄

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

  // ===== THEME（デザイン共通） =====
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
    boxShadow: colors.panelShadow
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
    boxSizing: 'border-box'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
    display: 'block'
  };

  const textAreaStyle: React.CSSProperties = {
    ...inputStyle,
    height: 160,
    resize: 'vertical',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('コピーしました'); }
    catch { alert('コピーに失敗しました'); }
  };

  // ===== URL → 自動生成 =====
  const generateFromURL = async () => {
    if (!userId) { alert('ログインが必要です'); return; }
    if (!urlInput) { alert('URLを入力してください'); return; }
    setUrlLoading(true);

    try {
      const res = await fetch('/api/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, url: urlInput, promptContext: stancePrompts[stance] })
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error);

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
    if ((imageFile.type || '').includes('heic')) {
      alert('HEICは非対応です。スクショまたは互換モードで保存してください。');
      return;
    }

    setIsGenerating(true);
    const path = `${userId}/${Date.now()}_${imageFile.name}`;
    const up = await supabase.storage.from('uploads').upload(path, imageFile, {
      upsert: true,
      contentType: imageFile.type || 'image/jpeg'
    });
    if (up.error) { alert(`アップロード失敗：${up.error.message}`); setIsGenerating(false); return; }

    const pInsta = 'Instagram向け：約200文字。最後に3〜6個のハッシュタグ。';
    const pFb = 'Facebook向け：約700文字。最後に3〜6個のハッシュタグ。';
    const pX = 'X向け：150文字程度で簡潔に。';

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
      if (j1.error || j2.error || j3.error) throw new Error('生成に失敗しました');

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

  // ===== UI =====
  return (
    <main style={pageStyle}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>ユーザーページ</h2>

      {/* ① URL生成 */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>① URLからSNS向け文章を自動生成</h3>
        <label style={labelStyle}>記事URLを入力</label>
        <input style={inputStyle} placeholder="https://example.com/article" value={urlInput} onChange={e => setUrlInput(e.target.value)} />

        {/* 立場選択ラジオ */}
        <div style={{ margin: '12px 0' }}>
          <label style={labelStyle}>生成する視点</label>
          <label><input type="radio" name="stance" checked={stance === 'self'} onChange={() => setStance('self')} /> 自分の投稿を紹介する</label><br />
          <label><input type="radio" name="stance" checked={stance === 'others'} onChange={() => setStance('others')} /> 他人の投稿を紹介する</label><br />
          <label><input type="radio" name="stance" checked={stance === 'third'} onChange={() => setStance('third')} /> 第三者の記事を紹介する</label>
        </div>

        <button style={urlLoading ? btnGhost : btn} disabled={!urlInput || urlLoading} onClick={generateFromURL}>
          {urlLoading ? '生成中…' : 'URLから文章を生成'}
        </button>

        {/* 要約など（省略） */}
      </div>

      {/* ② 画像生成 */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>② 画像からSNS向け文章を自動生成</h3>
        <label style={labelStyle}>補足説明（写真の状況など3行程度）</label>
        <textarea style={{ ...inputStyle, height: 80 }} placeholder="例：地域イベントで撮影。子ども達が作った作品展示の様子。" value={imageNote} onChange={e => setImageNote(e.target.value)} />
        <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
        <button style={isGenerating ? btnGhost : btn} disabled={!imageFile || isGenerating} onClick={generateFromImage}>
          {isGenerating ? '生成中…' : '画像から文章を生成'}
        </button>
      </div>

      {/* ③ チャット */}
      <div style={{ ...panel }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>③ 通常チャット</h3>
        <textarea style={{ ...inputStyle, height: 96 }} value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="例: Instagram用に150文字で要約して" />
        <button style={chatLoading ? btnGhost : btn} disabled={!chatInput || chatLoading} onClick={sendChat}>
          {chatLoading ? '送信中…' : '送信'}
        </button>
        <div style={{ marginTop: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, background: m.role === 'user' ? '#F0F9FF' : '#FAFAFA' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{m.role}</div>
              <div>{m.content}</div>
              {m.role === 'assistant' && <button style={btnGhost} onClick={() => copy(m.content)}>コピー</button>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
