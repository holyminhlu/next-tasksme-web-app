"use client";

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "@/lib/api/client";

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = getAccessToken();
  if (!token) {
    return null;
  }

  if (!socket) {
    socket = io(API_BASE_URL, {
      path: "/socket.io",
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
  }

  socket.auth = { token };
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function joinTaskRoom(workspaceId: string, taskId: string) {
  const client = getRealtimeSocket();
  if (!client) return;
  client.emit("task:join", { workspaceId, taskId });
}

export function leaveTaskRoom(taskId: string) {
  const client = getRealtimeSocket();
  if (!client) return;
  client.emit("task:leave", { taskId });
}

export function disconnectRealtimeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
