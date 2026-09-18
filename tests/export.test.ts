import { describe, expect, it } from "vitest";
import { exportAnkiTsv, exportCsv, exportEchoTypeJson } from "../src/lib/export";
import { createWordDraft } from "../src/lib/words";

const word = Object.assign(createWordDraft({ word: "resilient", bookId: "business", now: 100 }), {
  translation: "有韧性的",
  definitions: ["Able to recover, quickly."],
  synonyms: ["strong"],
  antonyms: ["fragile"]
});

describe("exports", () => {
  it("escapes CSV fields", () => {
    const csv = exportCsv([word], new Map([["business", "商务"]]));
    expect(csv).toContain('"Able to recover, quickly."');
    expect(csv).toContain("resilient,有韧性的,商务");
  });

  it("creates an Anki-compatible TSV", () => {
    expect(exportAnkiTsv([word])).toContain("resilient\t有韧性的<br>Able to recover, quickly.");
  });

  it("creates EchoType-compatible favorites and content", () => {
    const json = JSON.parse(exportEchoTypeJson([word], new Map([["business", "商务"]])));
    expect(json.format).toBe("echotype-wordbook-v1");
    expect(json.favorites[0]).toMatchObject({ normalizedText: "resilient", type: "word", targetLang: "zh-CN" });
    expect(json.contents[0]).toMatchObject({ text: "resilient", type: "word", source: "imported" });
  });
});
