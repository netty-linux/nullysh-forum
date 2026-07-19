/** Nullain Agent — ferramenta staff (Railway). */

export const NULLAIN_AGENT_URL =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_NULLAIN_AGENT_URL?.trim()) ||
  "https://nullain-production.up.railway.app/";

export const NULLAIN_AGENT_LABEL = "Nullain Agent";
