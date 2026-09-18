import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickAddForm } from "../src/components/QuickAddForm";

const books = [
  { id: "daily", name: "日常", color: "#4f46e5", description: "", createdAt: 1, updatedAt: 1 },
  { id: "business", name: "商务", color: "#0f766e", description: "", createdAt: 1, updatedAt: 1 }
];

describe("QuickAddForm", () => {
  it("submits a selected word to the chosen wordbook", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddForm books={books} initialBookId="daily" initialWord="Resilient" initialContext="A resilient team." onSave={onSave} onCreateBook={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("保存到词书"), "business");
    await user.click(screen.getByRole("button", { name: "加入词书" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ word: "Resilient", bookId: "business", context: "A resilient team." }));
  });

  it("keeps the action disabled when no word is present", () => {
    render(<QuickAddForm books={books} initialBookId="daily" initialWord="" initialContext="" onSave={vi.fn()} onCreateBook={vi.fn()} />);
    expect(screen.getByRole("button", { name: "加入词书" })).toBeDisabled();
  });
});
