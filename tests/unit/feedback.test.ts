import { describe, expect, it } from "vitest";
import {
  feedbackAudienceWhere,
  parseFeedbackComment,
  parseFeedbackScore,
} from "@/lib/feedback";

describe("parseFeedbackScore", () => {
  it("accepts the integers 1 through 5", () => {
    expect(parseFeedbackScore("1")).toBe(1);
    expect(parseFeedbackScore("5")).toBe(5);
    expect(parseFeedbackScore(3)).toBe(3);
  });

  it("refuses anything outside that", () => {
    expect(parseFeedbackScore("0")).toBeNull();
    expect(parseFeedbackScore("6")).toBeNull();
    expect(parseFeedbackScore("1.5")).toBeNull();
    expect(parseFeedbackScore("")).toBeNull();
    expect(parseFeedbackScore(null)).toBeNull();
  });
});

describe("parseFeedbackComment", () => {
  it("treats a blank note as no note", () => {
    expect(parseFeedbackComment("  \n")).toEqual({ ok: null });
    expect(parseFeedbackComment(null)).toEqual({ ok: null });
  });

  it("keeps the words and refuses a novel", () => {
    expect(parseFeedbackComment("  The room was loud.  ")).toEqual({
      ok: "The room was loud.",
    });
    expect(parseFeedbackComment("a".repeat(2001))).toEqual({
      error: "Keep the note under 2000 characters.",
    });
  });
});

describe("feedbackAudienceWhere", () => {
  it("asks scanned guests when the door gates the night", () => {
    expect(feedbackAudienceWhere({ id: "evt", perksRequireCheckIn: true })).toEqual({
      eventId: "evt",
      approvalStatus: { not: "declined" },
      checkedInAt: { not: null },
    });
  });

  it("asks approved guests when a scan is not required", () => {
    expect(feedbackAudienceWhere({ id: "evt", perksRequireCheckIn: false })).toEqual({
      eventId: "evt",
      approvalStatus: { not: "declined" },
      OR: [{ approvalStatus: "approved" }, { checkedInAt: { not: null } }],
    });
  });
});
