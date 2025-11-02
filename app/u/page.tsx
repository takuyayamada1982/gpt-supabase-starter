'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Msg = { role: 'user'|'assistant', content: string };

export default function UPage() {
  // ==== Auth / 基本状態 ====
  const [userId, setUserId] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('あなたは親切なアシスタントです。');

  // ==== 画像処理：入力・結果 ====
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [instaText, setInstaText] = useState('');
  const [fbText, setFbText] = useState('');
  const [xText, setXText] = useState('');

  // ==== チャット ====
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id || '';
      setUserId(uid);
      if (!uid) return;

      const { data: rows } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (rows?.system_prompt) {
        setSystemPrompt(rows.system_prompt);
      } else {
        await supabase.from('user_settings').upsert({
          user_id: uid,
          system_prompt: 'あなたは親切なアシスタントです。',
        });
      }
    })();
  }, []);

  // ==== ユーティリティ ====
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('コピーしました'); }
    catch { alert('コピーに失敗しました'); }
  };

  const panel: React.CSSProperties = useMemo(() => ({
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16
  }), []);

  const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #111', background: '#111', color: '#fff' };
  const btnGhost: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' };
  const inputStyle: React.CSSProperties = { border: '1px solid #ddd', padding: 12, borderRadius: 8, width: '100%' };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 6, display: 'block' };

  // ==== 画像 → SNS文生成 ====
  /**
   * それぞれのSNSに最適化したプロンプトをサーバAPI(/api/vision)へ送り、
   * 3本の文章を生成します（APIは3回呼びます）。
   */
  const generateFromImage = async () => {
    if (!userId) { alert('ログインが必要です'); return; }
    if (!imageFile) { alert('画像を選択してください'); return; }
    setIsGenerating(true);

    // 1) 画像をStorageへアップロード
    const path = `${userId}/${Date.now()}_${imageFile.name}`;
    const up = await supabase.storage.from('uploads').upload(path, imageFile, { upsert: true });
    if (up.error) {
      alert(`アップロードに失敗しました: ${up.error.message}`);
      setIsGenerating(false);
      return;
    }

    // 2) SNS別プロンプトを定義
    const pInsta =
      `あなたはSNS用のコピーライターです。与えられた画像の内容から、Instagram向けの説明文を日本語で作成。
- 200文字程度に収める
- 画像の要点を端的に
- 最後に3〜6個のハッシュタグを付ける（#から始める、日本語/英語混在OK）
出力は本文のみ。`;

    const pFb =
      `あなたはSNS用のコピーライターです。与えられた画像の内容から、Facebook向けの投稿文を日本語で作成。
- ストーリー重視（経緯→発見→気づき→次の行動）で約700文字
- 読みやすい改行を入れる
- 最後に3〜6個のハッシュタグ
出力は本文のみ。`;

    const pX =
      `あなたはSNS用のコピーライターです。与えられた画像の内容から、X（Twitter）向けの投稿を日本語で作成。
- 150文字程度にコンパクトに
- 端的な要点＋1つの気づき
- 最後に2〜4個のハッシュタグ
出力は本文のみ。`;

    try {
      // 3) /api/vision を各SNSプロンプトで叩く（3回）
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/vision', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, prompt: pInsta, filePath: path }) }),
        fetch('/api/vision', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, prompt: pFb, filePath: path }) }),
        fetch('/api/vision', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId, prompt: pX, filePath: path }) }),
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

  // ==== チャット送信 ====
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
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>ユーザーページ</h2>

      {/* 固定プロンプト（任意で編集） */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <label style={labelStyle}>固定プロンプト（system）</label>
        <textarea
          style={{ ...inputStyle, height: 96 }}
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button
            style={btnGhost}
            onClick={async () => {
              if (!userId) return;
              await supabase.from('user_settings').upsert({ user_id: userId, system_prompt: systemPrompt });
              alert('保存しました');
            }}
          >
            保存
          </button>
        </div>
      </div>

      {/* ===== 画像→SNS文  上段  ===== */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>① 画像からSNS向け文章を自動生成</h3>

        {/* 画像アップ */}
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={labelStyle}>画像ファイル</label>
          <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
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

        {/* 3カラム：各SNS */}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {/* Instagram */}
          <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Instagram（約200文字＋ハッシュタグ）</div>
            <textarea style={{ ...inputStyle, height: 160 }} placeholder="ここにInstagram向けの説明が入ります" value={instaText} onChange={e=>setInstaText(e.target.value)} />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button style={btnGhost} onClick={() => copy(instaText)}>コピー</button>
              <small style={{ color:'#6b7280' }}>#ハッシュタグ付き</small>
            </div>
          </div>

          {/* Facebook */}
          <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Facebook（ストーリー重視・約700文字＋ハッシュタグ）</div>
            <textarea style={{ ...inputStyle, height: 220 }} placeholder="ここにFacebook向けの説明が入ります" value={fbText} onChange={e=>setFbText(e.target.value)} />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button style={btnGhost} onClick={() => copy(fbText)}>コピー</button>
              <small style={{ color:'#6b7280' }}>読みやすい改行推奨</small>
            </div>
          </div>

          {/* X（Twitter） */}
          <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>X（150文字コンパクト＋ハッシュタグ）</div>
            <textarea style={{ ...inputStyle, height: 140 }} placeholder="ここにX向けの説明が入ります" value={xText} onChange={e=>setXText(e.target.value)} />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button style={btnGhost} onClick={() => copy(xText)}>コピー</button>
              <small style={{ color:'#6b7280' }}>短く要点＋2〜4タグ</small>
            </div>
          </div>
        </div>
      </div>

      {/* ===== チャット  下段  ===== */}
      <div style={{ ...panel }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>② 通常チャット</h3>
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <label style={labelStyle}>記載例（そのまま書き換えてOK）</label>
          <textarea
            style={{ ...inputStyle, height: 96 }}
            placeholder={
              '例: 「次の画像から、Instagram・Facebook・X向けの投稿文を生成してください。条件は…」\n' +
              '例: 「このテキストを要約して、X向けに150文字で」'
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

        {/* 履歴 */}
        <div style={{ display: 'grid', gap: 8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 12,
              background: m.role === 'user' ? '#f0f9ff' : '#f9fafb'
            }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{m.role}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              {m.role === 'assistant' && (
                <div style={{ marginTop: 8 }}>
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
const generateFromImage = async () => {
  if (!userId) { alert('ログインが必要です（プライベートタブは使わないでください）'); return; }
  if (!imageFile) { alert('画像を選択してください'); return; }

  // サイズ制限（例：8MB）
  if (imageFile.size > 8 * 1024 * 1024) {
    alert('画像が大きすぎます。8MB以下にして再アップしてください（スクショやトリミング推奨）');
    return;
  }

  setIsGenerating(true);
  const path = `${userId}/${Date.now()}_${imageFile.name}`;

  // コンテンツタイプを明示（iOSで空になることへの保険）
  const contentType = imageFile.type || 'image/jpeg';
  const up = await supabase.storage.from('uploads').upload(path, imageFile, {
    upsert: true,
    contentType
  });

  if (up.error) {
    alert(`アップロードに失敗しました：${up.error.message}`);
    setIsGenerating(false);
    return;
  }

  // ...（この後の fetch('/api/vision', ...) はそのまま）
};
