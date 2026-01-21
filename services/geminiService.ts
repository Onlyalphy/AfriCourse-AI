
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { CourseContent, LearningDepth } from "../types";

export const generateCourse = async (topic: string, depth: LearningDepth): Promise<CourseContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const depthInstruction = {
    express: "Create a 1-day crash course. Focus on the most vital facts and urgent advice.",
    standard: "Create a 3-day overview. Balance breadth and actionable steps.",
    deep: "Create a detailed 7-day curriculum. Go deep into theories, practical applications, and local context (Kenya/Africa)."
  };

  const prompt = `
    Act as a world-class educator and expert in ${topic}. 
    Provide a highly accurate, verified crash course for individuals in marginalized regions of Kenya and Africa. 
    Use simple English and provide Swahili translations for key concepts where helpful.
    
    Topic: ${topic}
    Depth: ${depthInstruction[depth]}
    
    Requirements:
    1. Highly accurate information, grounded in factual research.
    2. Practical advice tailored for low-resource environments.
    3. Clear, concise structure.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
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
                content: { type: Type.STRING, description: "Detailed explanation in simple terms." },
                keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "content", "keyTakeaways"]
            }
          }
        },
        required: ["topic", "summary", "lessons"]
      }
    }
  });

  const rawJson = JSON.parse(response.text);
  
  // Extract grounding sources
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = groundingChunks
    .filter((c: any) => c.web)
    .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));

  return {
    ...rawJson,
    groundingSources: sources
  };
};

export const generateCourseVideo = async (topic: string, lessonTitle: string): Promise<string> => {
  if (!(await (window as any).aistudio.hasSelectedApiKey())) {
    await (window as any).aistudio.openSelectKey();
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `An educational, clean, 2D animated style explanation of "${lessonTitle}" within the context of "${topic}". Use bright, clear visuals suitable for simple educational videos for low-income communities.`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 8000));
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
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this clearly and supportively: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // Warm, clear voice
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};
