// backend/scripts/geminiClassifier.js
// Gemini를 사용해 제목/내용을 카테고리 7종으로 분류하는 헬퍼
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const GEMINI_ENABLED = !!GEMINI_API_KEY;
let modelInstance = null;

if (GEMINI_ENABLED) {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    modelInstance = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    console.log("[GEMINI] initialized", { model: GEMINI_MODEL });
  } catch (err) {
    console.warn("[GEMINI] init failed:", err?.message || err);
  }
}

/**
 * Gemini로 카테고리 분류
 * @param {string} title
 * @param {string} body
 * @param {(raw:string)=>string|null} normalizeCategoryFn
 * @param {Set<string>} allowedCategories
 * @returns {Promise<string|null>}
 */
async function classifyCategoryGemini(title, body, normalizeCategoryFn, allowedCategories) {
  if (!GEMINI_ENABLED || !modelInstance) return null;

  const categories = Array.from(allowedCategories || []);
  const prompt = `
다음 글을 아래 카테고리 중 하나로만 분류하세요. 
반드시 목록 중 하나만 그대로 출력합니다.
카테고리: ${categories.join(", ")}
제목: ${title || ""}
내용: ${body || ""}
답변 형식: 카테고리명만 출력 (추가 단어/설명 금지)
  `.trim();

  try {
    const result = await modelInstance.generateContent(prompt);
    const text = result?.response?.text?.() || result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const normalized = normalizeCategoryFn ? normalizeCategoryFn(text) : text;
    if (normalized && allowedCategories?.has(normalized)) return normalized;
    return null;
  } catch (err) {
    console.warn("[GEMINI] classify failed:", err?.message || err);
    return null;
  }
}

module.exports = {
  classifyCategoryGemini,
  GEMINI_ENABLED: GEMINI_ENABLED && !!modelInstance,
};
