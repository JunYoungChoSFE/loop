import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";

const svg = fs.readFileSync("D:/loop-kickstart/loop-feature.svg");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1600 },
  font: { loadSystemFonts: true },
});
const png = resvg.render().asPng();
fs.writeFileSync("D:/loop-kickstart/loop-feature.png", png);
console.log("wrote loop-feature.png", png.length, "bytes");
