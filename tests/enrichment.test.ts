import { describe, expect, it } from "vitest";
import { mergeFallbackEnrichment, parseAiWordCard, parseDatamuseEntry, parseDictionaryEntry } from "../src/lib/enrichment";

describe("dictionary enrichment", () => {
  it("normalizes pronunciation, definitions, related words, and examples", () => {
    const result = parseDictionaryEntry([{
      word: "resilient",
      phonetic: "/rɪˈzɪliənt/",
      meanings: [{
        partOfSpeech: "adjective",
        synonyms: ["strong", "elastic"],
        antonyms: ["fragile"],
        definitions: [
          { definition: "Able to recover quickly.", example: "A resilient team." },
          { definition: "Returning to an original shape." },
          { definition: "Withstanding difficult conditions." },
          { definition: "Capable of springing back." },
          { definition: "Recovering readily from adversity." },
          { definition: "Flexible without lasting damage." }
        ]
      }]
    }]);

    expect(result).toMatchObject({
      pronunciation: "/rɪˈzɪliənt/",
      partOfSpeech: "adjective",
      synonyms: ["strong", "elastic"],
      antonyms: ["fragile"],
      examples: [{ text: "A resilient team.", translation: "", source: "dictionary" }]
    });
    expect(result.definitions).toHaveLength(6);
    expect(result.senses).toHaveLength(6);
    expect(result.senses?.[0]).toEqual({
      partOfSpeech: "adjective",
      definition: "Able to recover quickly.",
      translation: ""
    });
  });

  it("combines free dictionary data with a Chinese translation", () => {
    expect(mergeFallbackEnrichment(
      { definitions: ["Able to recover quickly."], senses: [], phrases: [], synonyms: [], antonyms: [], examples: [] },
      { responseData: { translatedText: "有韧性的" } }
    )).toMatchObject({ translation: "有韧性的", provider: "free-dictionary" });
  });

  it("uses every Datamuse definition when the primary dictionary is unavailable", () => {
    const result = parseDatamuseEntry([{ word: "provide", tags: ["v"], defs: [
      "v\tTo give what is needed.",
      "v\tTo make possible.",
      "v\tTo stipulate beforehand."
    ] }]);
    expect(result.partOfSpeech).toBe("verb");
    expect(result.senses).toHaveLength(3);
    expect(result.definitions).toEqual(["To give what is needed.", "To make possible.", "To stipulate beforehand."]);
  });
});

describe("AI enrichment", () => {
  it("accepts fenced JSON and removes repeated related words", () => {
    const card = parseAiWordCard("```json\n{\"translation\":\"有韧性的\",\"pronunciation\":\"/x/\",\"partOfSpeech\":\"adjective\",\"definitions\":[\"able to recover\"],\"senses\":[{\"partOfSpeech\":\"adjective\",\"definition\":\"able to recover\",\"translation\":\"有恢复力的\"},{\"partOfSpeech\":\"adjective\",\"definition\":\"able to spring back\",\"translation\":\"有弹性的\"}],\"phrases\":[{\"text\":\"resilient economy\",\"translation\":\"有韧性的经济\"},{\"text\":\"resilient economy\",\"translation\":\"有韧性的经济\"}],\"synonyms\":[\"strong\",\"strong\"],\"antonyms\":[\"fragile\"],\"examples\":[{\"text\":\"She is resilient.\",\"translation\":\"她很坚韧。\",\"source\":\"daily\"}]}\n```");
    expect(card.synonyms).toEqual(["strong"]);
    expect(card.translation).toBe("有韧性的");
    expect(card.senses).toHaveLength(2);
    expect(card.phrases).toEqual([{ text: "resilient economy", translation: "有韧性的经济" }]);
  });
});
