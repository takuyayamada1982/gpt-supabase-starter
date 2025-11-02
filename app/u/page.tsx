'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Msg = { role: 'user'|'assistant', content: string };

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

  // ===== 画像 → SNS =====
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('コピーしました'); }
    catch { alert('コピーに失敗しました'); }
  };

  const panel: React.CSSProperties = { background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:16 };
  const btn: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #111', background:'#111', color:'#fff' };
  const btnGhost: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', background:'#fff' };
  const inputStyle: React.CSSProperties = { border:'1px solid #ddd', padding:12, borderRadius:8, width:'100%' };
  const labelStyle: React.CSSProperties = { fontSize:12, color:'#6b7280', marginBottom:6, display:'block' };

  // ===== URL → まとめて生成（要約/タイトル/ハッシュタグ + 3SNS） =====
  const generateFromURL = async () => {
    if (!userId) { alert('ログインが必要です'); return; }
    if (!urlInput) { alert('URLを入力してください'); return; }

    setUrlLoading(true);
    try {
      const res = await fetch('/api/url', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ userId, url: urlInput })
      });
      const j = await res.json();
      if (j?.error) throw new Error(j.error);

      // 要約/タイトル/ハッシュタグ
      setUrlSummary(j.summary || '');
      setUrlTitles(Array.isArray(j.titles) ? j.titles : []);
      setUrlHashtags(Array.isArray(j.hashtags) ? j.hashtags : []);

      // SNS 3種
      setInstaText(j.instagram || '');
      setFbText(j.facebook || '');
      setXText(j.x || '');

      alert('URLからSNS向け文章を生成しました');
    } catch (e:any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setUrlLoading(false);
    }
  };

  // ===== 画像 → SNS（/api/vision を3回呼ぶ既存方式） =====
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

  // ===== チャット =====
  const sendChat = async () => {
    if (!userId || !chatInput) return;
    setChatLoading(true);
    setMessages(m => [...m, { role:'user', content: chatInput }]);
    const res = await fetch('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId, userText: chatInput })
    });
    const j = await res.json();
    setMessages(m => [...m, { role:'assistant', content: j.text || '' }]);
    setChatInput(''); setChatLoading(false);
  };

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>ユーザーページ</h2>

      {/* ===== ① URL → 生成（上段） ===== */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>① URLからSNS向け文章を自動生成</h3>
        <div style={{ display:'grid', gap:8, marginBottom:12 }}>
          <label style={labelStyle}>記事やブログのURL</label>
          <input
            style={{ ...inputStyle }}
            placeholder="https://example.com/article"
            value={urlInput}
            onChange={e=>setUrlInput(e.target.value)}
            inputMode="url"
          />
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

        {/* 要約・タイトル案・ハッシュタグ候補（URL生成後に表示） */}
        {(urlSummary || urlTitles.length || urlHashtags.length) ? (
          <div style={{ borderTop:'1px dashed #e5e7eb', marginTop:12, paddingTop:12, display:'grid', gap:12 }}>
            {/* 要約 */}
            {urlSummary && (
              <div>
                <div style={{ fontWeight:700, marginBottom:6 }}>要約（200〜300文字）</div>
                <div style={{ border:'1px solid #eee', borderRadius:8, padding:12, background:'#fafafa', whiteSpace:'pre-wrap' }}>
                  {urlSummary}
                </div>
                <div style={{ marginTop:8 }}>
                  <button style={btnGhost} onClick={()=>copy(urlSummary)}>要約をコピー</button>
                </div>
              </div>
            )}

            {/* タイトル案 */}
            {urlTitles.length > 0 && (
              <div>
                <div style={{ fontWeight:700, marginBottom:6 }}>タイトル案（3つ）</div>
                <ul style={{ listStyle:'disc', paddingLeft:20, margin:0 }}>
                  {urlTitles.map((t, i)=>(
                    <li key={i} style={{ marginBottom:6, display:'flex', gap:8, alignItems:'flex-start' }}>
                      <span style={{ flex:1 }}>{t}</span>
                      <button style={btnGhost} onClick={()=>copy(t)}>コピー</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ハッシュタグ候補 */}
            {urlHashtags.length > 0 && (
              <div>
                <div style={{ fontWeight:700, marginBottom:6 }}>ハッシュタグ候補（10〜15）</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {urlHashtags.map((h, i)=>(
                    <span key={i} style={{ border:'1px solid #eee', borderRadius:999, padding:'6px 10px', background:'#fff' }}>{h}</span>
                  ))}
                </div>
                <div style={{ marginTop:8 }}>
                  <button style={btnGhost} onClick={()=>copy(urlHashtags.join(' '))}>すべてコピー</button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ===== ② 画像 → 生成（中段） ===== */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>② 画像からSNS向け文章を自動生成</h3>
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
                (e.currentTarget as HTMLInputElement).value = '';
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

        {/* 3カラム：SNS欄（URL生成でも画像生成でもここに反映） */}
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

      {/* ===== ③ 通常チャット（下段） ===== */}
      <div style={{ ...panel }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>③ 通常チャット</h3>
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
