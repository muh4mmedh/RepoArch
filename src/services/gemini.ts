import { GoogleGenAI, Type } from "@google/genai";
import { AISettings, UsageStats } from "../types";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const FREE_TIER_LIMIT_USD = 1.0;
const COST_PER_1K_TOKENS = 0.0005; // Simplified estimate for Gemini Flash/Pro

export const geminiService = {
  async checkUsage(uid: string, settings?: AISettings): Promise<boolean> {
    // If user has their own key for the selected provider, bypass limit
    if (settings) {
      if (settings.provider === 'gemini' && settings.geminiKey) return true;
      if (settings.provider === 'openai' && settings.openaiKey) return true;
      if (settings.provider === 'anthropic' && settings.anthropicKey) return true;
    }

    // Otherwise check free tier limit
    const userDoc = await getDoc(doc(db, 'users', uid));
    const stats = userDoc.data()?.usageStats as UsageStats | undefined;
    
    if (!stats) return true;
    return stats.totalCost < FREE_TIER_LIMIT_USD;
  },

  async updateUsage(uid: string, tokenCount: number) {
    const cost = (tokenCount / 1000) * COST_PER_1K_TOKENS;
    await updateDoc(doc(db, 'users', uid), {
      'usageStats.totalCost': increment(cost),
      'usageStats.requestCount': increment(1),
      'usageStats.lastReset': new Date().toISOString()
    });
  },

  async analyzeRepository(uid: string, repoName: string, structure: any, keyFiles: { path: string, content: string }[], settings?: AISettings) {
    const canProceed = await this.checkUsage(uid, settings);
    if (!canProceed) throw new Error("Free tier limit reached ($1.00). Please provide your own API key in settings.");

    const provider = settings?.provider || 'gemini';
    const temperature = settings?.temperature ?? 0.7;
    
    // For now, we only implement Gemini as requested by the framework instructions
    // But we use the user's key if provided
    const apiKey = (provider === 'gemini' && settings?.geminiKey) ? settings.geminiKey : DEFAULT_GEMINI_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    const model = "gemini-3.1-pro-preview";
    
    const fileContents = keyFiles.map(f => `FILE: ${f.path}\nCONTENT:\n${f.content}`).join("\n\n---\n\n");
    const tree = structure.tree.map((t: any) => t.path).join("\n");

    const prompt = `
      Analyze the following repository structure and key file contents to generate a comprehensive system architecture documentation.
      
      REPOSITORY: ${repoName}
      
      FILE TREE:
      ${tree}
      
      KEY FILE CONTENTS:
      ${fileContents}
      
      Please provide:
      1. A high-level summary of what the project does.
      2. A detailed system architecture overview.
      3. Key components and their responsibilities.
      4. Data flow and interaction between components.
      5. Technologies and libraries used.
      6. A Mermaid diagram representing the architecture (if possible).
      
      Format the output in Markdown. Be professional and insightful.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { temperature }
    });

    // Track usage (rough estimate of tokens)
    await this.updateUsage(uid, prompt.length / 4 + response.text.length / 4);

    return response.text;
  },

  async chatAboutAnalysis(uid: string, analysisMarkdown: string, history: { role: string, content: string }[], newMessage: string, settings?: AISettings) {
    const canProceed = await this.checkUsage(uid, settings);
    if (!canProceed) throw new Error("Free tier limit reached ($1.00). Please provide your own API key in settings.");

    const provider = settings?.provider || 'gemini';
    const temperature = settings?.temperature ?? 0.7;
    const apiKey = (provider === 'gemini' && settings?.geminiKey) ? settings.geminiKey : DEFAULT_GEMINI_KEY;
    const ai = new GoogleGenAI({ apiKey });

    const model = "gemini-3.1-pro-preview";
    
    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction: `You are an expert software architect. You are discussing a repository analysis with a user. 
        The analysis context is as follows:
        
        ${analysisMarkdown}
        
        Answer the user's questions based on this context and your general knowledge of software engineering.`,
        temperature
      },
    });

    const response = await chat.sendMessage({ message: newMessage });
    
    // Track usage
    await this.updateUsage(uid, (analysisMarkdown.length + newMessage.length + response.text.length) / 4);

    return response.text;
  }
};
