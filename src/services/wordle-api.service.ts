import { logApiCall, logError } from "../utils/logger";

/**
 * Service for fetching daily Wordle words from online APIs.
 * Provides automatic daily word generation without admin input.
 */
export class WordleApiService {
  private static readonly WORDLE_API_URL = "https://wordle-api.vercel.app/api/wordle";
  private static readonly FALLBACK_WORDS = [
    "ASSET", "BRAVE", "CHARM", "DREAM", "EARTH", "FAITH", "GLORY", "HAPPY", "IDEAL", "JOYCE",
    "KNIFE", "LIGHT", "MAGIC", "NIGHT", "OCEAN", "PEACE", "QUIET", "RADIO", "SPACE", "TRUTH",
    "UNITY", "VOICE", "WATER", "YOUTH", "ZEBRA"
  ];

  /**
   * Fetch today's word from the Wordle API
   */
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
      
      // The API returns the word in different formats depending on the endpoint
      // Try to extract the word from various possible response structures
      let word: string | undefined;
      
      if (typeof data === "string") {
        word = data;
      } else if (data && typeof data === "object" && "word" in data && typeof data.word === "string") {
        word = data.word;
      } else if (data && typeof data === "object" && "today" in data && typeof data.today === "string") {
        word = data.today;
      } else if (data && typeof data === "object" && "solution" in data && typeof data.solution === "string") {
        word = data.solution;
      } else if (Array.isArray(data) && data.length > 0 && typeof data[0] === "string") {
        word = data[0];
      }

      if (!word || typeof word !== "string") {
        throw new Error("Invalid response format from Wordle API");
      }

      // Clean and validate the word
      const cleanWord = word.trim().toUpperCase();
      
      if (!/^[A-Z]{5}$/.test(cleanWord)) {
        throw new Error(`Invalid word format: ${cleanWord}`);
      }

      return cleanWord;
    } catch (error) {
      logError(error, { event: "wordle_api_fetch_error" });
      
      // Return null to indicate failure, let the service handle fallback
      return null;
    }
  }

  /**
   * Get a fallback word based on the current date
   * This ensures we always have a word even if the API fails
   */
  static getFallbackWord(): string {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    
    // Use the day of year to select a consistent fallback word
    const index = dayOfYear % this.FALLBACK_WORDS.length;
    return this.FALLBACK_WORDS[index]!;
  }

  /**
   * Get today's word with fallback support
   */
  static async getTodayWord(): Promise<string> {
    // Try to fetch from API first
    const apiWord = await this.fetchTodayWord();
    
    if (apiWord) {
      return apiWord;
    }

    // If API fails, use fallback word
    const fallbackWord = this.getFallbackWord();
    logError(new Error("Using fallback word due to API failure"), { 
      event: "wordle_api_fallback_used", 
      fallbackWord 
    });
    
    return fallbackWord;
  }

  /**
   * Validate if a word is a valid 5-letter word
   */
  static isValidWord(word: string): boolean {
    return /^[A-Z]{5}$/.test(word.trim().toUpperCase());
  }
}