import express from "express";
import logger from "morgan";
import dotenv from "dotenv";

import { Server } from "socket.io";
import { createServer } from "node:http";
import { createClient } from "@libsql/client";

dotenv.config();
const app = express();
const server = createServer(app);
const io = new Server(server, {
  // tiempo maximo de guardado de msg, costoso si es muy alto el valor
  connectionStateRecovery: {},
});

const dbClient = createClient({
  url: process.env.URL,
  authToken: process.env.TOKEN,
});

await dbClient.execute(`CREATE TABLE IF NOT EXISTS messages ( 
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    content TEXT,
    username TEXT,
    visitCount INTEGER
)`);

await dbClient.execute(`CREATE TABLE IF NOT EXISTS stats (
  
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE,
  value INTEGER
)`)

await dbClient.execute(`INSERT OR IGNORE INTO stats (key, value) VALUES ('total_visits', 0);`)
io.on("connection", async (socket) => {
  console.log("user connected");

 
  const lastMessageTime = new Map();
  socket.on("chat message", async (msg) => {
    const now = Date.now();
    const lastTime = lastMessageTime.get(socket.id) || 0;

    if (now - lastTime < 1000) return;
    if (msg.length > 500) return;

    lastMessageTime.set(socket.id, now);

    let result;
    let user = socket.handshake.auth.username || "visitor67";
    try {
      result = await dbClient.execute({
        sql: "INSERT INTO messages (content, username) VALUES (:message, :username)",
        args: { message: msg, username: user },
      });
    } catch (e) {
      throw new Error("Have an error ehh check it idk");
      return;
    }

    // incremento id de mensaje
    io.emit("chat message", msg, result.lastInsertRowid.toString(), user);
  
  
  });

  // have history
  if (!socket.recovered) {
    try {
      const results = await dbClient.execute({
        sql: "SELECT id, content, username FROM messages WHERE id > ?",
        args: [socket.handshake.auth.serverOffset ?? 0],
      });

      results.rows.forEach((row) => {
        socket.emit(
          "chat message",
          row.content,
          row.id.toString(),
          row.username,
        );
      });
    } catch (e) {
      throw new Error("Have an error ehh check it idk");
    }
  }

   // increase visit counter for each connection
  await dbClient.execute({
      sql: "UPDATE stats SET value = value + 1 WHERE key = 'total_visits'",
      args: []
    });
  
  // gives the actual visit counter
  const resultV = await dbClient.execute({
    sql: "SELECT value FROM stats WHERE key = 'total_visits'",
    args: []
  })
  io.emit("visit count", resultV.rows[0].value)
  

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
  // prettier-ignore
});

app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

const port = 3000;

server.listen(port, () => {
  console.log(`server listening to port http://localhost:${port}`);
});
