// lib/billings.ts

export const UNIT_COST = {
  url: 0.7,   // 1回あたり0.7円
  vision: 1.0, // 1回あたり1円
  chat: 0.3,  // 1回あたり0.3円
} as const;

export type UsageType = keyof typeof UNIT_COST;

export function calcCostByType(counts: {
  url: number;
  vision: number;
  chat: number;
}) {
  const urlCost = counts.url * UNIT_COST.url;
  const visionCost = counts.vision * UNIT_COST.vision;
  const chatCost = counts.chat * UNIT_COST.chat;

  return {
    url: urlCost,
    vision: visionCost,
    chat: chatCost,
    total: urlCost + visionCost + chatCost,
  };
}
