import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Task SME",
    short_name: "Task SME",
    description:
      "Task management for small and medium teams — plan, assign and track work in one workspace.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#2563eb",
    background_color: "#f8fafc",
    lang: "en",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/TaskSME.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/TaskSME.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open your workspace dashboard",
        url: "/dashboard",
        icons: [{ src: "/TaskSME.png", sizes: "1024x1024", type: "image/png" }],
      },
      {
        name: "Members",
        short_name: "Members",
        description: "Manage workspace members",
        url: "/members",
        icons: [{ src: "/TaskSME.png", sizes: "1024x1024", type: "image/png" }],
      },
    ],
  };
}
