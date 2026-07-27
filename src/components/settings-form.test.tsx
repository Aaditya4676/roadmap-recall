import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountPanel } from "@/components/settings-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(cleanup);

describe("AccountPanel", () => {
  it("identifies the configured owner and unlimited AI review access", () => {
    render(<AccountPanel account={{
      id: "3ef54e20-7d09-4e99-8ea4-1f453227bbaa",
      email: "owner@example.com",
      displayName: "Owner",
      authProvider: "email",
      isOwner: true,
      aiJudgmentsUsedToday: 12,
      aiJudgmentDailyLimit: 5,
    }} />);
    expect(screen.getByText("owner@example.com")).toBeVisible();
    expect(screen.getByText("Owner account")).toBeVisible();
    expect(screen.getByText("Unlimited for owner")).toBeVisible();
  });

  it("shows a member's remaining rolling quota", () => {
    render(<AccountPanel account={{
      id: "8acefc73-997a-4db5-a24a-afadf8799623",
      email: "member@example.com",
      displayName: "Member",
      authProvider: "email",
      isOwner: false,
      aiJudgmentsUsedToday: 2,
      aiJudgmentDailyLimit: 5,
    }} />);
    expect(screen.getByText("Member account")).toBeVisible();
    expect(screen.getByText("3 of 5 remaining in 24 hours")).toBeVisible();
  });
});
