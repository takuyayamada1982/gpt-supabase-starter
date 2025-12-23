"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // code が付くタイプ（PKCE）の場合に備える
  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  useEffect(() => {
    const init = async () => {
      setMessage(null);

      // ① code がある場合は exchange して session 確立
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(`セッション確立に失敗しました: ${error.message}`);
          setReady(true);
          return;
        }
      }

      // ② すでにセッションがあるか確認（recovery の hash から入った場合もここで拾える）
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMessage(
          "リセット用セッションが見つかりません。リセットメールをもう一度送り、届いたリンクから開き直してください。"
        );
        setReady(true);
        return;
      }

      setReady(true);
    };

    init();
  }, [code]);

  const onUpdate = async () => {
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage("パスワードは8文字以上にしてください。");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(`更新に失敗しました: ${error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("パスワードを更新しました。ログインしてください。");
    router.push("/auth");
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        パスワード再設定
      </h1>

      {!ready && <p>確認中...</p>}

      {ready && (
        <>
          {message && (
            <p style={{ color: "crimson", marginBottom: 12 }}>{message}</p>
          )}

          <label style={{ display: "block", marginBottom: 8 }}>
            新しいパスワード
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8文字以上"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginBottom: 12,
            }}
          />

          <button
            onClick={onUpdate}
            disabled={saving}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            {saving ? "更新中..." : "パスワードを更新"}
          </button>

          <button
            onClick={() => router.push("/auth")}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              marginTop: 10,
              border: "1px solid #ddd",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            ログインへ戻る
          </button>
        </>
      )}
    </div>
  );
}
