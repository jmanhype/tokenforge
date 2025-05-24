import { httpRouter } from "convex/server";

const http = httpRouter();

// Add any custom HTTP endpoints here
// Example:
// http.route({
//   path: "/webhook",
//   method: "POST",
//   handler: httpAction(async (ctx, request) => {
//     // Handle webhook
//     return new Response("OK", { status: 200 });
//   }),
// });

export default http;
