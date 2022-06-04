import express, { Express, Request, Response } from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";
dotenv.config();

const app: Express = express();
const port = 1234;
const GAME_SERVER_URL = process.env.GAME_SERVER_URL as string;
const GAME_SERVER_PORT = process.env.GAME_SERVER_PORT as string;

const URL = `https://${GAME_SERVER_URL}:${GAME_SERVER_PORT}`;

app.post("/login", async (_, res: Response) => {
  const user = process.env.USER as string;
  const pass = process.env.PASS as string;

  if (!user || !pass) {
    return res.status(400).send("User or password not set");
  }

  const response = await fetch(`${URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    body: JSON.stringify({
      username: user,
      password: pass,
    }),
  });

  if (!response.ok) {
    return res.status(400).send(await response.text());
  }

  const tokenJson = await response.json();

  writeFileSync("./token.json", JSON.stringify(tokenJson, null, 2), "utf8");

  return res.status(200).send(tokenJson);
});

app.post("/save", async (req: Request, res: Response) => {
  const flags = readJsonFromFile("./flags.json");
  if (!flags?.data) {
    res.status(500).send("No flags found");
    return;
  }

  flags.data = [...flags.data, ...req.body.data];
  writeFileSync("./flags.json", JSON.stringify(flags, null, 2), "utf8");
});

async function submitSavedFlags() {
  const tokenObj = readJsonFromFile("./token.json");
  if (!tokenObj) {
    console.error("Token not found");
    return;
  }
  const flags = readJsonFromFile("./flags.json");
  if (!flags?.data?.length) {
    console.error("Flags not found");
    return;
  }

  const response = await fetch(`${URL}/api/flags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      Authorization: `Bearer ${tokenObj.token}`,
    },
    body: JSON.stringify(flags),
  });

  if (!response.ok) {
    console.error(await response.text());
    return;
  }

  console.log("Submitted flags");
  const flagResponse = (await response.json()) as any;
  if (!flagResponse?.data?.length) {
    console.error("Recieved unexpected: ", flagResponse);
    return;
  }

  for (const flag of flagResponse.data) {
    if (
      flag.result === "INVALID" ||
      flag.result === "EXPIREDFLAG" ||
      flag.result === "OWNFLAG" ||
      flag.result === "TESTFLAG"
    ) {
      console.log("Flag Not OK: ", flag);
      console.log("Removing flag");
      flags.data = flags.data.filter((f: string) => f !== flag.flag);
    }

    console.log("Keeping: ", flag);
  }

  writeFileSync("./flags.json", JSON.stringify(flags, null, 2), "utf8");
}

function readJsonFromFile(file: string) {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, any>;
  } catch (e) {
    console.error(`could not parse ${file}`);
    return null;
  }
}

app.listen(port, () => {
  setInterval(submitSavedFlags, 1000 * 60 * 5);
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
