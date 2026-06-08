import { createStart, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // Supabase is not used in this project — auth is handled by Firebase.
  // The supabase middleware was removed to prevent crashes when
  // VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set.
  functionMiddleware: [],
  requestMiddleware: [errorMiddleware],
}));
