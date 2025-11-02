'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Msg = { role: 'user'|'assistant', content: string };

export default function UPage() {
  const [userId, setUserId] = useState<string>('');

  // 画像→SNS
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [instaText, setInstaText] = useState('');
  const [fbText, setFbText] = useState('');
  const [xText, setXText] = useState('');

  // チャット
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || '');
    })();
  }, []);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('コピーしました'); }
    catch { alert('コピーに失敗しました'); }
  };

  const panel: React.CSSProperties = { background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:16 };
  const btn: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #111', background:'#111', color:'#fff' };
  const btnGhost: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', background:'#fff' };
  const inputStyle: React.CSSProperties = { border:'1px solid #ddd', padding:12, borderRadius:8, width:'100%' };
  const labelStyle: React.CSSProperties = { fontSize:12, color:'#6b7280', marginBottom:6, display:'block' };

  // 画像からSNS文作成（/api/vision をSNS別に3回呼ぶ）
  const generateFromImage = async () => {
    if (!userId) { alert('ログインが必要です'); return; }
    if (!imageFile) { alert('画像を選択してください'); return; }
    if ((imageFile.type || '').toLowerCase().includes('heic') || (imageFile.type || '').toLowerCase().includes('heif')) {
      alert('HEICは非対応です。iPhoneは「互換性優先」かスクショ画像で試してください。');
      return;
    }
    if (imageFile.size > 8 * 1024 * 1024) { alert('画像は8MB以下でお願いします。'); return; }

    setIsGenerating(true);
    const path = `${userId}/${Date.now()}_${imageFile.name}`;
    const up = await supabase.storage.from('uploads').upload(path, imageFile, {
      upsert: true,
      contentType: imageFile.type || 'image/jpeg'
    });
    if (up.error) { alert(`アップロード失敗：${up.error.message}`); setIsGenerating(false); return; }

    const pInsta = `Instagram向け：約200文字。最後に3〜6個のハッシュタグ。`;
    const pFb    = `Facebook向け：ストーリー重視で約700文字。改行。最後に3〜6個のハッシュタグ。`;
    const pX     = `X向け：150文字程度で簡潔に。最後に2〜4個のハッシュタグ。`;

    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/vision', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, prompt: pInsta, filePath: path }) }),
        fetch('/api/vision', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, prompt: pFb,    filePath: path }) }),
        fetch('/api/vision', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, prompt: pX,     filePath: path }) }),
      ]);
      const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      if (j1?.error || j2?.error || j3?.error) throw new Error(j1?.error || j2?.error || j3?.error || '生成に失敗しました');
      setInstaText(j1.text || ''); setFbText(j2.text || ''); setXText(j3.text || '');
      alert('SNS向け文章を生成しました');
    } catch (e:any) {
      alert(`エラー: ${e.message}`);
    } finally { setIsGenerating(false); }
  };

  // 通常チャット
  const sendChat = async () => {
    if (!userId || !chatInput) return;
    setChatLoading(true);
    setMessages(m => [...m, { role:'user', content: chatInput }]);
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, userText: chatInput }) });
    const j = await res.json();
    setMessages(m => [...m, { role:'assistant', content: j.text || '' }]);
    setChatInput(''); setChatLoading(false);
  };

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>ユーザーページ</h2>

      {/* 上段：画像→SNS生成 */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>① 画像からSNS向け文章を自動生成</h3>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
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
                e.currentTarget.value = '';
                setImageFile(null);
                return;
              }
              setImageFile(f);
            }}
          />
          <div>
            <button style={isGenerating ? btnGhost : btn} onClick={generateFromImage} disabled={!imageFile || isGenerating}>
              {isGenerating ? '生成中…' : '画像から3種類の原稿を作る'}
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div style={{ border:'1px solid #eee', borderRadius:10, padding:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Instagram（約200文字＋ハッシュタグ）</div>
            <textarea style={{ ...inputStyle, height:160 }} value={instaText} onChange={e=>setInstaText(e.target.value)} placeholder="ここにInstagram向けの説明が入ります" />
            <div style={{ marginTop:8, display:'flex', gap:8 }}>
              <button style={btnGhost} onClick={() => copy(instaText)}>コピー</button>
            </div>
          </div>
          <div style={{ border:'1px solid #eee', borderRadius:10, padding:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>Facebook（ストーリー重視・約700文字＋ハッシュタグ）</div>
            <textarea style={{ ...inputStyle, height:220 }} value={fbText} onChange={e=>setFbText(e.target.value)} placeholder="ここにFacebook向けの説明が入ります" />
            <div style={{ marginTop:8, display:'flex', gap:8 }}>
              <button style={btnGhost} onClick={() => copy(fbText)}>コピー</button>
            </div>
          </div>
          <div style={{ border:'1px solid #eee', borderRadius:10, padding:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>X（150文字コンパクト＋ハッシュタグ）</div>
            <textarea style={{ ...inputStyle, height:140 }} value={xText} onChange={e=>setXText(e.target.value)} placeholder="ここにX向けの説明が入ります" />
            <div style={{ marginTop:8, display:'flex', gap:8 }}>
              <button style={btnGhost} onClick={() => copy(xText)}>コピー</button>
            </div>
          </div>
        </div>
      </div>

      {/* 下段：通常チャット */}
      <div style={{ ...panel }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>② 通常チャット</h3>
        <div style={{ display:'grid', gap:8, marginBottom:8 }}>
          <label style={labelStyle}>記載例（そのまま書き換えてOK）</label>
          <textarea
            style={{ ...inputStyle, height: 96 }}
            placeholder={
              '例: 「このテキストを要約して、X向けに150文字で」\n' +
              '例: 「Instagram / Facebook / X それぞれのトーンで整えて」'
            }
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
          />
          <div>
            <button style={chatLoading ? btnGhost : btn} disabled={chatLoading || !chatInput} onClick={sendChat}>
              {chatLoading ? '送信中…' : '送信'}
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gap:8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              border:'1px solid #eee', borderRadius:10, padding:12,
              background: m.role === 'user' ? '#f0f9ff' : '#f9fafb'
            }}>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>{m.role}</div>
              <div style={{ whiteSpace:'pre-wrap' }}>{m.content}</div>
              {m.role === 'assistant' && (
                <div style={{ marginTop:8 }}>
                  <button style={btnGhost} onClick={() => copy(m.content)}>この返信をコピー</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}


  // ...（この後の fetch('/api/vision', ...) はそのまま）
};
