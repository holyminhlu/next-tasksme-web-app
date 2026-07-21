import { describe, expect, it } from "vitest";
import {
  canonicalizeTemplateContent,
  templateContentV2Schema,
  type TemplateContentV2,
} from "../src/lib/template-content.js";
import { addWorkspaceCalendarDays } from "../src/lib/template-dates.js";

function validContent(): TemplateContentV2 {
  return {
    schemaVersion: 2,
    project: {
      status: "ACTIVE",
      priority: "MEDIUM",
      visibility: "WORKSPACE",
      completionPolicy: "WARN_ONLY",
    },
    memberPlaceholders: [],
    workflow: {
      name: "Delivery",
      stages: [
        {
          key: "todo",
          name: "Todo",
          category: "NOT_STARTED",
          position: 0,
          isInitial: true,
          isTerminal: false,
          isActive: true,
        },
        {
          key: "done",
          name: "Done",
          category: "COMPLETED",
          position: 1,
          isInitial: false,
          isTerminal: true,
          isActive: true,
        },
      ],
      transitions: [{ fromKey: "todo", toKey: "done", conditionsJson: {} }],
    },
    tags: [],
    customFields: [],
    milestones: [],
    tasks: [
      {
        key: "one",
        title: "One",
        priority: "MEDIUM",
        stageKey: "todo",
        position: 0,
        checklist: [],
        tagKeys: [],
        customValues: {},
      },
      {
        key: "two",
        title: "Two",
        priority: "MEDIUM",
        stageKey: "todo",
        position: 1,
        checklist: [],
        tagKeys: [],
        customValues: {},
      },
    ],
    dependencies: [],
  };
}

describe("TemplateContentV2", () => {
  it("rejects unknown references", () => {
    const value = validContent();
    value.tasks[0]!.stageKey = "missing";
    expect(templateContentV2Schema.safeParse(value).success).toBe(false);
  });

  it("rejects parent and dependency cycles", () => {
    const value = validContent();
    value.tasks[0]!.parentKey = "two";
    value.tasks[1]!.parentKey = "one";
    value.dependencies = [
      { predecessorKey: "one", successorKey: "two", dependencyType: "FINISH_TO_START" },
      { predecessorKey: "two", successorKey: "one", dependencyType: "FINISH_TO_START" },
    ];
    const result = templateContentV2Schema.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining(["Task parent cycle detected", "Task dependency cycle detected"]),
      );
  });

  it("produces a stable canonical SHA-256 hash", () => {
    const value = validContent();
    const reordered = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    const project = reordered.project as Record<string, unknown>;
    reordered.project = Object.fromEntries(Object.entries(project).reverse());
    expect(canonicalizeTemplateContent(reordered).hash).toBe(
      canonicalizeTemplateContent(value).hash,
    );
  });
});

describe("template calendar dates", () => {
  it("preserves local wall time across daylight-saving changes", () => {
    const before = new Date("2026-03-07T17:00:00.000Z"); // noon in New York
    const after = addWorkspaceCalendarDays(before, 1, "America/New_York");
    expect(after.toISOString()).toBe("2026-03-08T16:00:00.000Z");
    expect(after.getTime() - before.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});
