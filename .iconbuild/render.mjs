import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";

const svg = fs.readFileSync("D:/loop-kickstart/loop-icon.svg");
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
const png = resvg.render().asPng();
fs.writeFileSync("D:/loop-kickstart/loop-icon.png", png);
console.log("wrote loop-icon.png", png.length, "bytes");
