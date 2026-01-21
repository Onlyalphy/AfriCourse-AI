
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { CourseContent, LearningDepth, VideoOrientation, VideoResolution, CertifiedPathway } from "../types";

const COMPLEX_MODEL = "gemini-3-pro-preview";
const VEO_MODEL = "veo-3.1-fast-generate-preview";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export const generateCourse = async (topic: string, depth: LearningDepth): Promise<CourseContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const depthInstruction = {
    express: "1-day crash course for immediate action.",
    standard: "3-day comprehensive overview.",
    deep: "7-day deep-dive curriculum with local context.",
    certified: "Foundational phase for a multi-year certified program."
  };

  const prompt = `
    Act as a world-class university professor expert in ${topic}. 
    Topic: ${topic}
    Depth: ${depthInstruction[depth]}
    Region: Kenya/Africa.
    
    Provide a highly accurate, verified course structure. Use simple English.
    Include specific source URLs for verification in each lesson.
  `;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          summary: { type: Type.STRING },
          lessons: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
                sources: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { title: { type: Type.STRING }, url: { type: Type.STRING } },
                    required: ["title", "url"]
                  }
                }
              },
              required: ["title", "content", "keyTakeaways", "sources"]
            }
          }
        },
        required: ["topic", "summary", "lessons"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateCertifiedPathway = async (topic: string, years: number): Promise<CertifiedPathway> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Create a detailed ${years}-year academic degree/diploma roadmap for "${topic}" in an African context. 
  Break it down by years and semesters (2 semesters per year).`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          duration: { type: Type.STRING },
          roadmap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                year: { type: Type.INTEGER },
                semesters: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["year", "semesters"]
            }
          }
        },
        required: ["title", "duration", "roadmap"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const expandLessonContent = async (topic: string, lessonTitle: string, currentContent: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Go significantly deeper into the topic "${lessonTitle}" as part of a course on "${topic}". 
  Provide advanced details, technical specifications, and case studies. Original content: ${currentContent}`;

  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 }
    }
  });

  return response.text || "Unable to expand content at this time.";
};

export const chatWithGemini = async (message: string, history: any[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const chat = ai.chats.create({
    model: COMPLEX_MODEL,
    config: {
      systemInstruction: "You are AfriCourse AI Assistant. Be precise, educational, and use thinking to answer complex student queries.",
      thinkingConfig: { thinkingBudget: 32768 }
    },
    history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }))
  });
  const result = await chat.sendMessage({ message });
  return result.text || "I'm sorry, I couldn't process that.";
};

export const generateCourseVideo = async (topic: string, lessonTitle: string, orientation: VideoOrientation, resolution: VideoResolution): Promise<string> => {
  if (!(await (window as any).aistudio.hasSelectedApiKey())) await (window as any).aistudio.openSelectKey();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let operation = await ai.models.generateVideos({
    model: VEO_MODEL,
    prompt: `Clean 2D animated educational explanation of "${lessonTitle}" for "${topic}". High quality visuals.`,
    config: { 
      numberOfVideos: 1, 
      resolution: resolution, 
      aspectRatio: orientation 
    }
  });
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }
  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const generateNarration = async (text: string): Promise<ArrayBuffer> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
    }
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
};

export const analyzeVideoContent = async (base64Video: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: COMPLEX_MODEL,
    contents: { parts: [{ inlineData: { data: base64Video, mimeType } }, { text: "Provide educational analysis." }] },
    config: { thinkingConfig: { thinkingBudget: 32768 } }
  });
  return response.text || "Could not analyze.";
};
