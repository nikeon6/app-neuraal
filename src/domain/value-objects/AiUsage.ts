/**
 * Value object for monthly AI usage (requests + tokens).
 */
export interface AiUsage {
  requestsUsed: number;
  tokensUsed: number;
}

export function createAiUsage(
  requestsUsed: number,
  tokensUsed: number
): AiUsage {
  return {
    requestsUsed: Math.max(0, Math.floor(requestsUsed)),
    tokensUsed: Math.max(0, Math.floor(tokensUsed)),
  };
}
