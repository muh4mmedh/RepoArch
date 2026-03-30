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

  async analyzeRepository(uid: string, repoName: string, structure: any, keyFiles: { path: string, content: string }[], settings?: AISettings, onProgress?: (msg: string) => void) {
    const canProceed = await this.checkUsage(uid, settings);
    if (!canProceed) throw new Error("Free tier limit reached ($1.00). Please provide your own API key in settings.");

    const provider = settings?.provider || 'gemini';
    const temperature = settings?.temperature ?? 0.7;
    const apiKey = (provider === 'gemini' && settings?.geminiKey) ? settings.geminiKey : DEFAULT_GEMINI_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    // Model Selection
    let modelName = settings?.model || "gemini-3.1-pro-preview";
    if (settings?.autoSelectModel) {
      // Logic for auto-selecting model based on repo size or complexity
      const fileCount = structure.tree.length;
      modelName = fileCount > 500 ? "gemini-3.1-pro-preview" : "gemini-3.1-flash-preview";
    }

    onProgress?.("Planning analysis sub-tasks...");
    
    // 1. Plan Sub-tasks
    const planResponse = await ai.models.generateContent({
      model: modelName,
      contents: `You are a lead software architect. Break down the analysis of the repository "${repoName}" into 3-5 specific sub-tasks.
      Repo Structure:
      ${structure.tree.slice(0, 100).map((t: any) => t.path).join("\n")}
      
      Return a JSON array of tasks, each with a "title" and "description".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "description"]
          }
        }
      }
    });

    const tasks = JSON.parse(planResponse.text);
    
    // Track usage for planning step
    await this.updateUsage(uid, (structure.tree.length * 10 + planResponse.text.length) / 4);
    
    const results: string[] = [];

    // 2. Execute Sub-tasks
    for (const task of tasks) {
      onProgress?.(`Executing: ${task.title}...`);
      
      const fileContents = keyFiles.map(f => `FILE: ${f.path}\nCONTENT:\n${f.content}`).join("\n\n---\n\n");
      const tree = structure.tree.map((t: any) => t.path).join("\n");

      const taskResponse = await ai.models.generateContent({
        model: modelName,
        contents: `TASK: ${task.title}\nDESCRIPTION: ${task.description}\n\nCONTEXT:\nRepo: ${repoName}\nTree:\n${tree}\n\nFiles:\n${fileContents}\n\nProvide a detailed analysis for this specific task.`,
        config: { temperature }
      });
      
      results.push(`## ${task.title}\n\n${taskResponse.text}`);
      await this.updateUsage(uid, (tree.length + fileContents.length + taskResponse.text.length) / 4);
    }

    onProgress?.("Consolidating analysis...");

    // 3. Consolidate
    const finalResponse = await ai.models.generateContent({
      model: modelName,
      contents: `Consolidate the following sub-task analysis results into a single, professional system architecture documentation for "${repoName}".
      Include a high-level summary, detailed components, data flow, and a Mermaid diagram.
      
      RESULTS:
      ${results.join("\n\n")}`,
      config: { temperature }
    });

    await this.updateUsage(uid, (results.join("").length + finalResponse.text.length) / 4);

    return finalResponse.text;
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
