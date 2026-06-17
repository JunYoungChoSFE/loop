import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";

const svg = fs.readFileSync("D:/loop-kickstart/restock-kickstart/pinged-icon.svg");
const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
const png = resvg.render().asPng();
fs.writeFileSync("D:/loop-kickstart/restock-kickstart/pinged-icon.png", png);
console.log("wrote pinged-icon.png", png.length, "bytes");
