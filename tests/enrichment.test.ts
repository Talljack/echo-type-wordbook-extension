import { describe, expect, it } from "vitest";
import { mergeFallbackEnrichment, parseAiWordCard, parseDatamuseEntry, parseDictionaryEntry } from "../src/lib/enrichment";
import * as enrichment from "../src/lib/enrichment";

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

  it("filters rare senses and keeps a balanced set of common meanings", () => {
    const result = parseDatamuseEntry([{ word: "run", tags: ["v", "n"], defs: [
      ...Array.from({ length: 14 }, (_, index) => `v\tCommon verb meaning ${index + 1}.`),
      "v\t(obsolete) A historical meaning.",
      ...Array.from({ length: 8 }, (_, index) => `n\tCommon noun meaning ${index + 1}.`),
      "n\t(rare) A specialist meaning."
    ] }]);
    expect(result.senses).toHaveLength(15);
    expect(result.senses.filter((sense) => sense.partOfSpeech === "verb")).toHaveLength(10);
    expect(result.senses.filter((sense) => sense.partOfSpeech === "noun")).toHaveLength(5);
    expect(result.definitions.join(" ")).not.toMatch(/obsolete|rare/i);
  });

  it("parses top-level Free Dictionary senses instead of flattening every subsense", () => {
    const parse = (enrichment as unknown as Record<string, (data: unknown) => ReturnType<typeof parseDatamuseEntry>>).parseFreeDictionaryEntry;
    expect(parse).toBeTypeOf("function");
    const result = parse({ entries: [{
      partOfSpeech: "verb",
      pronunciations: [{ type: "ipa", text: "/rʌn/" }],
      senses: [
        { definition: "To move swiftly.", tags: [], subsenses: [{ definition: "A narrow running subtype." }] },
        { definition: "To control or manage; to be in charge of.", tags: [], subsenses: [] },
        { definition: "To execute or carry out a plan, procedure, or program.", tags: [], subsenses: [] },
        { definition: "An obsolete use.", tags: ["obsolete"], subsenses: [] }
      ]
    }] });
    expect(result.pronunciation).toBe("/rʌn/");
    expect(result.definitions).toEqual([
      "To move swiftly.",
      "To control or manage; to be in charge of.",
      "To execute or carry out a plan, procedure, or program."
    ]);
  });

  it("parses curated bilingual Collins senses and phrases from Youdao", () => {
    const parse = (enrichment as unknown as Record<string, (data: unknown) => ReturnType<typeof parseDatamuseEntry>>).parseYoudaoEntry;
    expect(parse).toBeTypeOf("function");
    const result = parse({ collins_primary: { gramcat: [{
      partofspeech: "verb",
      pronunciation: "rʌn",
      senses: [
        { definition: "to move very quickly on your legs", word: "跑；跑动", examples: [] },
        { definition: "to be in charge of a business", word: "管理；经营", examples: [] }
      ],
      phrases: [{
        phrasalverb: [{ phrase: "run out of something" }],
        senses: [{ word: "用完某物；耗尽某物", definition: "to have no more of something left", examples: [] }]
      }]
    }] } });
    expect(result).toMatchObject({ translation: "跑；跑动", pronunciation: "/rʌn/", partOfSpeech: "verb" });
    expect(result.senses).toEqual([
      { partOfSpeech: "verb", definition: "to move very quickly on your legs", translation: "跑；跑动" },
      { partOfSpeech: "verb", definition: "to be in charge of a business", translation: "管理；经营" }
    ]);
    expect(result.phrases).toEqual([{ text: "run out of something", translation: "用完某物；耗尽某物" }]);
  });

  it("matches the collected context to the most relevant popular sense", () => {
    const match = (enrichment as unknown as Record<string, (senses: Array<{ partOfSpeech: string; definition: string; translation: string }>, context: string) => number>).matchContextSense;
    expect(match).toBeTypeOf("function");
    expect(match([
      { partOfSpeech: "verb", definition: "to move very quickly on your legs", translation: "跑；跑动" },
      { partOfSpeech: "verb", definition: "to flow in a particular direction", translation: "流动；流淌" },
      { partOfSpeech: "verb", definition: "to be in charge of a business or an activity", translation: "管理；经营" }
    ], "She runs a growing business and runs every morning.")).toBe(2);
  });

  it("matches organizational resilience to the recovery sense instead of physical elasticity", () => {
    const match = (enrichment as unknown as Record<string, (senses: Array<{ partOfSpeech: string; definition: string; translation: string }>, context: string) => number>).matchContextSense;
    expect(match([
      { partOfSpeech: "adjective", definition: "Returning quickly to original shape after force is applied; elastic. (of objects or substances)", translation: "有弹性的" },
      { partOfSpeech: "adjective", definition: "Returning quickly to normal after damaging events or conditions. (of systems, organisms or people)", translation: "有恢复力的；适应性强的" }
    ], "A resilient company adapts quickly to economic change.")).toBe(1);
  });

  it("promotes the sense used by the collected context to the top of the card", () => {
    const prioritize = (enrichment as unknown as Record<string, (result: ReturnType<typeof parseDatamuseEntry>, context: string) => ReturnType<typeof parseDatamuseEntry>>).prioritizeContextSense;
    const result = prioritize({
      definitions: ["to make a living", "to prepare", "to give what is needed"],
      senses: [
        { partOfSpeech: "verb", definition: "to make a living", translation: "谋生" },
        { partOfSpeech: "verb", definition: "to prepare for something", translation: "准备" },
        { partOfSpeech: "verb", definition: "to give what is needed, especially basic needs", translation: "提供所需事物" }
      ],
      phrases: [], synonyms: [], antonyms: [], examples: []
    }, "The organization provides financial support to families in need.");
    expect(result.senses[0]?.translation).toBe("提供所需事物");
    expect(result.definitions[0]).toBe("to give what is needed, especially basic needs");
    expect(result.contextSenseIndex).toBe(0);
  });

  it("builds several supplemental contexts that cover different popular senses", () => {
    const buildContexts = (enrichment as unknown as Record<string, (word: string, senses: Array<{ partOfSpeech: string; definition: string; translation: string }>, examples: Array<{ text: string; translation: string; source: "dictionary" }>, context: string, limit?: number) => Array<{ text: string; senseIndex: number; translation: string }>>).buildSupplementalContexts;
    const contexts = buildContexts("run", [
      { partOfSpeech: "verb", definition: "to move very quickly on your legs", translation: "跑；跑动" },
      { partOfSpeech: "verb", definition: "to be in charge of a business or activity", translation: "管理；经营" },
      { partOfSpeech: "verb", definition: "to flow in a particular direction", translation: "流动；流淌" }
    ], [
      { text: "She runs a restaurant in San Francisco.", translation: "她在旧金山经营一家餐馆。", source: "dictionary" },
      { text: "Tears were running down her cheeks.", translation: "眼泪顺着她的脸颊流下来。", source: "dictionary" },
      { text: "It is dangerous to run across the road.", translation: "跑过马路很危险。", source: "dictionary" }
    ], "Running is a method of moving quickly on foot.", 3);
    expect(contexts).toHaveLength(3);
    expect(new Set(contexts.map((item) => item.senseIndex)).size).toBe(3);
  });

  it("creates bilingual local contexts when a free dictionary has no examples", () => {
    const buildContexts = (enrichment as unknown as Record<string, (word: string, senses: Array<{ partOfSpeech: string; definition: string; translation: string }>, examples: [], context: string, limit?: number) => Array<{ text: string; senseIndex: number; translation: string }>>).buildSupplementalContexts;
    const contexts = buildContexts("resilient", [
      { partOfSpeech: "adjective", definition: "returning quickly to normal after damaging events", translation: "遭受打击后迅速恢复" },
      { partOfSpeech: "adjective", definition: "returning to its original shape after force", translation: "有弹性的" },
      { partOfSpeech: "adjective", definition: "able to absorb energy when deformed", translation: "变形时可吸收能量" }
    ], [], "A resilient company adapts quickly.", 3);
    expect(contexts).toHaveLength(3);
    expect(contexts[0]).toMatchObject({ senseIndex: 0, translation: "这里的 resilient 表示：遭受打击后迅速恢复。" });
    expect(contexts[0]?.text).toContain('"resilient" means returning quickly to normal');
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
