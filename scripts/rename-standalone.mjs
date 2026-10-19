import fs from "node:fs";
fs.renameSync("dist-standalone/index.html", "dist-standalone/cv-tailor.html");
const kb = Math.round(fs.statSync("dist-standalone/cv-tailor.html").size / 1024);
console.log(`dist-standalone/cv-tailor.html (${kb} KB)`);
