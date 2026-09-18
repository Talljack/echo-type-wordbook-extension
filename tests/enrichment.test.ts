import { describe, expect, it } from "vitest";
import { mergeFallbackEnrichment, parseAiWordCard, parseDictionaryEntry } from "../src/lib/enrichment";

describe("dictionary enrichment", () => {
  it("normalizes pronunciation, definitions, related words, and examples", () => {
    const result = parseDictionaryEntry([{
      word: "resilient",
      phonetic: "/rɪˈzɪliənt/",
      meanings: [{
        partOfSpeech: "adjective",
        synonyms: ["strong", "elastic"],
        antonyms: ["fragile"],
        definitions: [{ definition: "Able to recover quickly.", example: "A resilient team." }]
      }]
    }]);

    expect(result).toEqual({
      pronunciation: "/rɪˈzɪliənt/",
      partOfSpeech: "adjective",
      definitions: ["Able to recover quickly."],
      synonyms: ["strong", "elastic"],
      antonyms: ["fragile"],
      examples: [{ text: "A resilient team.", translation: "", source: "dictionary" }]
    });
  });

  it("combines free dictionary data with a Chinese translation", () => {
    expect(mergeFallbackEnrichment(
      { definitions: ["Able to recover quickly."], synonyms: [], antonyms: [], examples: [] },
      { responseData: { translatedText: "有韧性的" } }
    )).toMatchObject({ translation: "有韧性的", provider: "free-dictionary" });
  });
});

describe("AI enrichment", () => {
  it("accepts fenced JSON and removes repeated related words", () => {
    const card = parseAiWordCard("```json\n{\"translation\":\"有韧性的\",\"pronunciation\":\"/x/\",\"partOfSpeech\":\"adjective\",\"definitions\":[\"able to recover\"],\"synonyms\":[\"strong\",\"strong\"],\"antonyms\":[\"fragile\"],\"examples\":[{\"text\":\"She is resilient.\",\"translation\":\"她很坚韧。\",\"source\":\"daily\"}]}\n```");
    expect(card.synonyms).toEqual(["strong"]);
    expect(card.translation).toBe("有韧性的");
  });
});
