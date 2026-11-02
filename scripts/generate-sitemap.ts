import { writeFileSync } from "node:fs";
const origin = "https://access-ace-friend.lovable.app";
// Only public content routes: private chats, profiles and admin pages are excluded.
const paths = ["/tanzanian-draft-game", "/contact", "/install"];
writeFileSync("public/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${origin}${path}</loc></url>`).join("\n")}\n</urlset>\n`);