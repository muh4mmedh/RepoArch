import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async analyzeRepository(repoName: string, structure: any, keyFiles: { path: string, content: string }[]) {
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
    });

    return response.text;
  },

  async chatAboutAnalysis(analysisMarkdown: string, history: { role: string, content: string }[], newMessage: string) {
    const model = "gemini-3.1-pro-preview";
    
    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction: `You are an expert software architect. You are discussing a repository analysis with a user. 
        The analysis context is as follows:
        
        ${analysisMarkdown}
        
        Answer the user's questions based on this context and your general knowledge of software engineering.`,
      },
    });

    // Send history if needed, but for simplicity we'll just send the new message with context
    // In a real app, we'd use chat.sendMessage with history
    const response = await chat.sendMessage({ message: newMessage });
    return response.text;
  }
};
