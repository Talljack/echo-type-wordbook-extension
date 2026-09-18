import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Options } from "../src/pages/Options";

describe("Options", () => {
  it("keeps the settings form semantically enabled when AI is off", async () => {
    localStorage.clear();
    render(<Options />);
    const save = await screen.findByRole("button", { name: "保存设置" });
    expect(save.closest("section")).not.toHaveAttribute("aria-disabled", "true");
  });
});
