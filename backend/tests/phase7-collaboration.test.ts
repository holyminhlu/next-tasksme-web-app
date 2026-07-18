import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database.js";
import {
  extractMentionTokens,
  sanitizePlainText,
} from "../src/lib/sanitize.js";
import { validateCustomFieldValue } from "../src/modules/custom-fields/custom-field-values.js";
import { authorizeTaskRoomJoin } from "../src/realtime/socket-hub.js";
import { registerLoginAndCreateWorkspace } from "./helpers.js";

describe("phase 7.1 task metadata & collaboration", () => {
  it("sanitizes comment content and validates custom field types", () => {
    expect(sanitizePlainText("<script>alert(1)</script>Hello")).toBe("Hello");
    expect(
      extractMentionTokens(
        "Hi @person@example.com and @550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toEqual([
      "person@example.com",
      "550e8400-e29b-41d4-a716-446655440000",
    ]);
    expect(
      validateCustomFieldValue("NUMBER", 42, [], false, "Score"),
    ).toBe(42);
    expect(() =>
      validateCustomFieldValue("SELECT", "nope", [{ value: "a", label: "A" }], true, "Choice"),
    ).toThrow(/options/i);
    expect(
      validateCustomFieldValue(
        "MULTI_SELECT",
        ["a", "b"],
        [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        false,
        "Choices",
      ),
    ).toEqual(["a", "b"]);
  });

  it("supports checklist CRUD, completion, and reorder", async () => {
    const owner = await registerLoginAndCreateWorkspace({ name: "Checklist WS" });
    const tasksBase = `/api/v1/workspaces/${owner.workspaceId}/tasks`;

    const task = await request(owner.app)
      .post(tasksBase)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Ship checklist" });
    expect(task.status).toBe(201);

    const base = `${tasksBase}/${task.body.data.id}/checklist-items`;
    const a = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Step A" });
    const b = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Step B" });
    expect([a.status, b.status]).toEqual([201, 201]);

    const completed = await request(owner.app)
      .patch(`${base}/${a.body.data.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ isCompleted: true });
    expect(completed.status).toBe(200);
    expect(completed.body.data.isCompleted).toBe(true);

    const reordered = await request(owner.app)
      .post(`${base}/reorder`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ orderedIds: [b.body.data.id, a.body.data.id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.data.items.map((item: { id: string }) => item.id)).toEqual([
      b.body.data.id,
      a.body.data.id,
    ]);
    expect(reordered.body.data.progress).toEqual({ completed: 1, total: 2 });

    const removed = await request(owner.app)
      .delete(`${base}/${b.body.data.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(removed.status).toBe(200);
  });

  it("keeps tags workspace-scoped and deleting a tag does not delete tasks", async () => {
    const ownerA = await registerLoginAndCreateWorkspace({ name: "Tags A" });
    const ownerB = await registerLoginAndCreateWorkspace({ name: "Tags B" });

    const tagA = await request(ownerA.app)
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/tags`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`)
      .send({ name: "Urgent", color: "#EF4444" });
    expect(tagA.status).toBe(201);

    const cross = await request(ownerB.app)
      .get(`/api/v1/workspaces/${ownerA.workspaceId}/tags`)
      .set("Authorization", `Bearer ${ownerB.accessToken}`);
    expect(cross.status).toBe(403);

    const task = await request(ownerA.app)
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`)
      .send({ title: "Tagged task" });
    expect(task.status).toBe(201);

    const assigned = await request(ownerA.app)
      .put(`/api/v1/workspaces/${ownerA.workspaceId}/tasks/${task.body.data.id}/tags`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`)
      .send({ tagIds: [tagA.body.data.id] });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data).toHaveLength(1);

    const filtered = await request(ownerA.app)
      .get(`/api/v1/workspaces/${ownerA.workspaceId}/tasks`)
      .query({ tagIds: tagA.body.data.id })
      .set("Authorization", `Bearer ${ownerA.accessToken}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.some((item: { id: string }) => item.id === task.body.data.id)).toBe(
      true,
    );

    const deleted = await request(ownerA.app)
      .delete(`/api/v1/workspaces/${ownerA.workspaceId}/tags/${tagA.body.data.id}`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`);
    expect(deleted.status).toBe(200);

    const stillThere = await request(ownerA.app)
      .get(`/api/v1/workspaces/${ownerA.workspaceId}/tasks/${task.body.data.id}`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.title).toBe("Tagged task");
  });

  it("validates custom field values and enforces required fields", async () => {
    const owner = await registerLoginAndCreateWorkspace({ name: "Fields WS" });
    const field = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/custom-fields`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Effort",
        fieldType: "NUMBER",
        isRequired: true,
      });
    expect(field.status).toBe(201);

    const task = await request(owner.app)
      .post(`/api/v1/workspaces/${owner.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Estimate me" });
    expect(task.status).toBe(201);

    const invalid = await request(owner.app)
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${task.body.data.id}/custom-field-values`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        values: [{ customFieldId: field.body.data.id, value: "not-a-number" }],
      });
    expect(invalid.status).toBe(400);

    const valid = await request(owner.app)
      .put(
        `/api/v1/workspaces/${owner.workspaceId}/tasks/${task.body.data.id}/custom-field-values`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        values: [{ customFieldId: field.body.data.id, value: 5 }],
      });
    expect(valid.status).toBe(200);
    expect(valid.body.data[0].value).toBe(5);
  });

  it("persists sanitized comments before realtime broadcast and mentions only visible users", async () => {
    const owner = await registerLoginAndCreateWorkspace({ name: "Comments WS" });
    const tasksBase = `/api/v1/workspaces/${owner.workspaceId}/tasks`;
    const task = await request(owner.app)
      .post(tasksBase)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Discuss" });
    expect(task.status).toBe(201);

    const created = await request(owner.app)
      .post(`${tasksBase}/${task.body.data.id}/comments`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ content: "<b>Hello</b> @nobody@example.com" });
    expect(created.status).toBe(201);
    expect(created.body.data.content).toBe("Hello @nobody@example.com");
    expect(created.body.data.mentionUserIds).toEqual([]);

    const persisted = await prisma.comment.findUnique({
      where: { id: created.body.data.id },
    });
    expect(persisted?.content).toBe("Hello @nobody@example.com");

    const mentionSelf = await request(owner.app)
      .post(`${tasksBase}/${task.body.data.id}/comments`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        content: `Ping @${owner.loginResponse.body.data.user.email as string}`,
      });
    expect(mentionSelf.status).toBe(201);
    // Mentions exclude the author.
    expect(mentionSelf.body.data.mentionUserIds).toEqual([]);
  });

  it("denies task room joins outside the user's workspace and task visibility", async () => {
    const ownerA = await registerLoginAndCreateWorkspace({
      name: "Realtime A",
    });
    const ownerB = await registerLoginAndCreateWorkspace({
      name: "Realtime B",
    });
    const task = await request(ownerA.app)
      .post(`/api/v1/workspaces/${ownerA.workspaceId}/tasks`)
      .set("Authorization", `Bearer ${ownerA.accessToken}`)
      .send({ title: "Private realtime room" });
    expect(task.status).toBe(201);

    await expect(
      authorizeTaskRoomJoin(
        ownerB.userId!,
        ownerA.workspaceId!,
        task.body.data.id,
      ),
    ).resolves.toEqual({ ok: false, error: "Forbidden" });

    await expect(
      authorizeTaskRoomJoin(
        ownerA.userId!,
        ownerA.workspaceId!,
        "550e8400-e29b-41d4-a716-446655440000",
      ),
    ).resolves.toEqual({ ok: false, error: "Task not found" });
  });

  it("uploads attachments with limits and returns time-limited download URLs", async () => {
    const owner = await registerLoginAndCreateWorkspace({ name: "Files WS" });
    const tasksBase = `/api/v1/workspaces/${owner.workspaceId}/tasks`;
    const task = await request(owner.app)
      .post(tasksBase)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "Attach me" });
    expect(task.status).toBe(201);

    const base = `${tasksBase}/${task.body.data.id}/attachments`;
    const denied = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("file", Buffer.from("MZ"), "malware.exe");
    expect(denied.status).toBe(400);

    const uploaded = await request(owner.app)
      .post(base)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("file", Buffer.from("hello world"), "notes.txt");
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data.mimeType).toBe("text/plain");
    expect(uploaded.body.data.scanStatus).toBe("CLEAN");

    const download = await request(owner.app)
      .get(`${base}/${uploaded.body.data.id}/download`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(download.status).toBe(200);
    expect(download.body.data.downloadUrl).toContain("/api/v1/internal/local-files");
    expect(download.body.data.expiresIn).toBeGreaterThan(0);

    const ownerB = await registerLoginAndCreateWorkspace({ name: "Other WS" });
    const cross = await request(ownerB.app)
      .get(`${base}/${uploaded.body.data.id}/download`)
      .set("Authorization", `Bearer ${ownerB.accessToken}`);
    expect(cross.status).toBe(403);
  });
});
