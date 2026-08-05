import { spawn } from "node:child_process";
import process from "node:process";

const command = process.argv[2] ?? "dev";
const args = process.argv.slice(3);
const hostname = process.env.ALLOW_LAN === "1" ? "0.0.0.0" : "127.0.0.1";
const nextBin = new URL("../node_modules/next/dist/bin/next", import.meta.url);
const child = spawn(process.execPath, [nextBin.pathname, command, "--hostname", hostname, ...args], { stdio: "inherit", env: process.env });
child.on("exit", (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
