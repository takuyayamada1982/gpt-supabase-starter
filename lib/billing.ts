export const UNIT_COST = {
  url: 0.7,
  vision: 1.0,
  chat: 0.3,
} as const;

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
