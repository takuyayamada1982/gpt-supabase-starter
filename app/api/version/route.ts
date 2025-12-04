// app/api/vision/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1画像あたりの原価（ざっくり設定）
const IMAGE_COST_YEN = 3;
// サムネ＋文字生成（動画由来）の原価
const VIDEO_THUMB_COST_YEN = 20;

function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  return { start, end };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const userId = body.userId as string | undefined;
    const prompt = body.prompt as string | undefined;
    const filePath = body.filePath as string | undefined;
    const mode = (body.mode as 'image' | 'video_thumb' | undefined) ?? 'image';

    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'filePath required' },
        { status: 400 }
      );
    }

    // 1) プロファイル取得（プラン・登録日など）
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan_status, plan_tier, registered_at, trial_type')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('profile error in /api/vision:', profileErr);
      return NextResponse.json(
        {
          error: 'profile_error',
          message: 'プロフィールの取得に失敗しました。',
        },
        { status: 500 }
      );
    }

    const planStatus = profile?.plan_status as 'trial' | 'paid' | null;
    const planTier = profile?.plan_tier as 'starter' | 'pro' | null;

    // ===== 2) プラン・回数制限チェック =====

    // 画像（通常）: Trial / Starter / Pro で利用OK（今回回数制限なし）
    if (mode === 'image') {
      const canUseImage =
        planStatus === 'trial' ||
        (planStatus === 'paid' &&
          (planTier === 'starter' || planTier === 'pro'));

      if (!canUseImage) {
        return NextResponse.json(
          {
            error: 'plan_not_supported_for_image',
            message:
              'この画像からの文字生成機能は、トライアルまたは Starter / Pro プランでご利用いただけます。',
            planStatus,
            planTier,
          },
          { status: 403 }
        );
      }
    }

    // 動画サムネ: Trial / Pro のみ & 回数制限付き
    let isVideoThumb = mode === 'video_thumb';
    let maxCount = 0;
    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    let usedCount = 0;

    if (isVideoThumb) {
      if (planStatus === 'trial') {
        // Trial → トライアル期間中 合計10回まで
        maxCount = 10;
        const reg =
          profile?.registered_at != null
            ? new Date(profile.registered_at)
            : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        periodStart = reg.toISOString();
        periodEnd = new Date().toISOString();
      } else if (planStatus === 'paid' && planTier === 'pro') {
        // Pro → 1カ月あたり30回まで
        maxCount = 30;
        const { start, end } = getMonthRange();
        periodStart = start;
        periodEnd = end;
      } else {
        // Starter or 未契約はNG
        return NextResponse.json(
          {
            error: 'plan_not_supported_for_video_thumb',
            message:
              '「動画からサムネ＋文字生成」は、トライアル期間中または Pro プランでのみご利用いただけます。',
            planStatus,
            planTier,
          },
          { status: 403 }
        );
      }

      // 実際の利用回数カウント
      const { data: usedLogs, error: usedErr } = await supabase
        .from('usage_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'video_thumb')
        .gte('created_at', periodStart!)
        .lt('created_at', periodEnd!);

      if (usedErr) {
        console.error('usage_logs count error (video_thumb):', usedErr);
        return NextResponse.json(
          {
            error: 'usage_count_error',
            message: '動画サムネ機能の利用回数の取得に失敗しました。',
          },
          { status: 500 }
        );
      }

      usedCount = usedLogs?.length ?? 0;

      if (usedCount >= maxCount) {
        return NextResponse.json(
          {
            error: 'video_thumb_limit_exceeded',
            message:
              planStatus === 'trial'
                ? 'トライアル期間中の「動画サムネ＋文字生成」は 10 回までです。上限に達しました。'
                : '今月の「動画サムネ＋文字生成」は 30 回までです。上限に達しました。',
            usedCount,
            maxCount,
            remaining: 0,
            planStatus,
            planTier,
          },
          { status: 400 }
        );
      }
    }

  // 3) Supabase Storage 上の画像の public URL を取得
const { data: publicUrlData } = supabase.storage
  .from('uploads')
  .getPublicUrl(filePath);

const imageUrl = publicUrlData?.publicUrl;
if (!imageUrl) {
  return NextResponse.json(
    {
      error: 'no_public_url',
      message: '画像ファイルのURLが取得できませんでした。',
    },
    { status: 400 }
  );
}


    const imageUrl = publicUrlData?.publicUrl;
    if (!imageUrl) {
      return NextResponse.json(
        {
          error: 'no_public_url',
          message: '画像ファイルのURLが取得できませんでした。',
        },
        { status: 400 }
      );
    }

    // 4) OpenAIに画像＋テキストで投げる
    const userContent: any[] = [
      {
        type: 'input_text',
        text: prompt,
      },
      {
        type: 'input_image',
        image_url: imageUrl,
      },
    ];

    const ai = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: userContent,
        } as any,
      ],
      max_output_tokens: 1200,
      temperature: 0.6,
    });

    const usage: any = (ai as any).usage;

    // 出力テキストの取り出し（output_text優先）
    let text = '';
    try {
      const out = (ai as any).output?.[0];
      if (out?.content) {
        for (const c of out.content) {
          if (c.type === 'output_text') {
            text += c.text ?? '';
          }
        }
      }
      if (!text && (ai as any).output_text) {
        text = (ai as any).output_text;
      }
    } catch (e) {
      console.error('parse output error in /api/vision:', e);
    }

    // 5) usage_logs に記録
    const logType = isVideoThumb ? 'video_thumb' : 'vision';

    try {
      await supabase.from('usage_logs').insert({
        user_id: userId,
        model: (ai as any).model ?? 'gpt-4.1-mini',
        type: logType,
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
        cost: isVideoThumb ? VIDEO_THUMB_COST_YEN : IMAGE_COST_YEN,
      });
    } catch (logErr) {
      console.error('usage_logs insert error (vision):', logErr);
      // ここは致命的ではないので処理は続行
    }

    // 6) 残り回数（動画サムネの場合のみ計算）
    const remaining =
      isVideoThumb && maxCount > 0
        ? Math.max(0, maxCount - (usedCount + 1))
        : null;

    return NextResponse.json({
      text,
      mode,
      remaining,
      maxLimit: isVideoThumb ? maxCount : null,
      planStatus,
      planTier,
    });
  } catch (e: any) {
    console.error('API /api/vision error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
