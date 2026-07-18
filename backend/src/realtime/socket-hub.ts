import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { getEnv } from "../config/env.js";
import { prisma } from "../config/database.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { buildTaskVisibilityWhere } from "../lib/task-scope.js";
import { logger } from "../config/logger.js";

export type CommentRealtimePayload = {
  workspaceId: string;
  taskId: string;
  comment: unknown;
  event: "comment:created" | "comment:updated" | "comment:deleted";
};

let io: Server | null = null;

export function getSocketServer() {
  return io;
}

export async function authorizeTaskRoomJoin(
  userId: string,
  workspaceId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      deletedAt: null,
      status: "ACTIVE",
    },
    include: { role: true },
  });
  if (!membership) {
    return { ok: false, error: "Forbidden" };
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      ...buildTaskVisibilityWhere({
        workspaceId,
        userId,
        roleKey: membership.role.key,
      }),
    },
    select: { id: true },
  });
  if (!task) {
    return { ok: false, error: "Task not found" };
  }

  return { ok: true };
}

export function attachSocketServer(httpServer: HttpServer) {
  const env = getEnv();
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (typeof socket.handshake.auth?.token === "string"
          ? socket.handshake.auth.token
          : null) ??
        (typeof socket.handshake.headers.authorization === "string" &&
        socket.handshake.headers.authorization.startsWith("Bearer ")
          ? socket.handshake.headers.authorization.slice("Bearer ".length)
          : null);

      if (!token) {
        next(new Error("Unauthorized"));
        return;
      }

      const payload = verifyAccessToken(token);
      const [user, session] = await Promise.all([
        prisma.user.findFirst({
          where: { id: payload.sub, deletedAt: null, status: "ACTIVE" },
        }),
        prisma.refreshSession.findFirst({
          where: {
            id: payload.sid,
            userId: payload.sub,
            revokedAt: null,
            absoluteExpiresAt: { gt: new Date() },
          },
        }),
      ]);

      if (!user || !session || user.authVersion !== payload.authVersion) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on(
      "task:join",
      async (
        payload: { workspaceId?: string; taskId?: string },
        ack?: (result: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          const workspaceId = payload?.workspaceId;
          const taskId = payload?.taskId;
          const userId = socket.data.userId as string;
          if (!workspaceId || !taskId) {
            ack?.({ ok: false, error: "workspaceId and taskId are required" });
            return;
          }

          const authorization = await authorizeTaskRoomJoin(
            userId,
            workspaceId,
            taskId,
          );
          if (!authorization.ok) {
            ack?.(authorization);
            return;
          }

          await socket.join(taskRoom(taskId));
          ack?.({ ok: true });
        } catch (error) {
          logger.warn({ err: error }, "task:join failed");
          ack?.({ ok: false, error: "Join failed" });
        }
      },
    );

    socket.on("task:leave", (payload: { taskId?: string }) => {
      if (payload?.taskId) {
        void socket.leave(taskRoom(payload.taskId));
      }
    });
  });

  return io;
}

export function taskRoom(taskId: string) {
  return `task:${taskId}`;
}

export function broadcastCommentEvent(payload: CommentRealtimePayload) {
  if (!io) return;
  io.to(taskRoom(payload.taskId)).emit(payload.event, {
    workspaceId: payload.workspaceId,
    taskId: payload.taskId,
    comment: payload.comment,
  });
}
