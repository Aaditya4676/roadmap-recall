import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { FocusTextarea } from "@/components/focus-textarea";

afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState("");
  return (
    <FocusTextarea
      label="What can you explain from memory?"
      dialogTitle="Event loop: recall from memory"
      maxLength={20000}
      value={value}
      onChange={setValue}
    />
  );
}

describe("FocusTextarea", () => {
  it("keeps one synchronized draft and restores focus after closing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inlineEditor = screen.getByRole("textbox", { name: "What can you explain from memory?" });
    const expand = screen.getByRole("button", { name: "Expand Event loop: recall from memory" });

    await user.type(inlineEditor, "Microtasks run before the next task.");
    await user.click(expand);

    const dialog = await screen.findByRole("dialog", { name: "Event loop: recall from memory" });
    const focusedEditor = within(dialog).getByRole("textbox", { name: "Event loop: recall from memory" });
    expect(focusedEditor).toHaveValue("Microtasks run before the next task.");

    await user.type(focusedEditor, " Rendering follows.");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(inlineEditor).toHaveValue("Microtasks run before the next task. Rendering follows.");
    expect(expand).toHaveFocus();
  });

  it("lets the browser own Escape dismissal", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Expand Event loop: recall from memory" }));
    const dialog = await screen.findByRole("dialog");

    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
