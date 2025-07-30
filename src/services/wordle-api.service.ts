import { logApiCall, logError } from "../utils/logger";

export class WordleApiService {
  private static readonly WORDLE_API_URL = "https://api.wordle.com/api/v1/words/random";
  private static readonly FALLBACK_WORDS = [
    "ASSET", "BRAVE", "CHARM", "DREAM", "EARTH", "FAITH", "GLORY", "HAPPY", "IDEAL", "JOYCE",
    "KNIFE", "LIGHT", "MAGIC", "NIGHT", "OCEAN", "PEACE", "QUIET", "RADIO", "SPACE", "TRUTH",
    "UNITY", "VOICE", "WATER", "YOUTH", "ZEBRA"
  ];

  static async fetchTodayWord(): Promise<string | null> {
    try {
      const startTime = Date.now();
      const response = await fetch(this.WORDLE_API_URL);
      const duration = Date.now() - startTime;
      
      logApiCall("Wordle API", "fetchTodayWord", duration, response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as unknown;
      
      // Extract word from various possible response formats
      const word = this.extractWordFromResponse(data);
      if (!word) {
        throw new Error("Invalid response format from Wordle API");
      }

      const cleanWord = word.trim().toUpperCase();
      if (!/^[A-Z]{5}$/.test(cleanWord)) {
        throw new Error(`Invalid word format: ${cleanWord}`);
      }

      return cleanWord;
    } catch (error) {
      logError(error, { event: "wordle_api_fetch_error" });
      return null;
    }
  }

  private static extractWordFromResponse(data: unknown): string | undefined {
    if (typeof data === "string") return data;
    if (Array.isArray(data) && typeof data[0] === "string") return data[0];
    
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (typeof obj.word === "string") return obj.word;
      if (typeof obj.today === "string") return obj.today;
      if (typeof obj.solution === "string") return obj.solution;
      if (typeof obj.answer === "string") return obj.answer;
    }
    
    return undefined;
  }

  static getFallbackWord(): string {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    return this.FALLBACK_WORDS[dayOfYear % this.FALLBACK_WORDS.length]!;
  }

  static async getTodayWord(): Promise<string> {
    const apiWord = await this.fetchTodayWord();
    if (apiWord) return apiWord;

    const fallbackWord = this.getFallbackWord();
    logError(new Error("Using fallback word due to API failure"), { 
      event: "wordle_api_fallback_used", 
      fallbackWord 
    });
    return fallbackWord;
  }

  static isValidWord(word: string): boolean {
    return /^[A-Z]{5}$/.test(word.trim().toUpperCase());
  }
}