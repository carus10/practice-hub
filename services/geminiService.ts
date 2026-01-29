import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// Note: In a production environment, handle API keys securely.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractTextFromPdf = async (base64Data: string, mimeType: string = 'application/pdf'): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: "Bu dosyadaki tüm metni olduğu gibi çıkar. Sadece metni ver, yorum yapma. Türkçe karakterleri koru. Paragrafları koru.",
          },
        ],
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Metin çıkarılamadı.");
    }
    return text;
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw new Error("PDF işlenirken bir hata oluştu. Lütfen dosyanın geçerli olduğundan emin olun.");
  }
};