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
    username TEXT
)`);

io.on("connection", async (socket) => {
  console.log("user connected");

  // socket es mensaje de usuario a servidor
  socket.on("chat message", async (msg) => {
    let result;
    let user = socket.handshake.auth.username || "visitor67";
    try {
      result = await dbClient.execute({
        sql: "INSERT INTO messages (content, username) VALUES (:message, :username)",
        args: { message: msg, username: user },
      });
    } catch (e) {
      console.log(e);
      throw new Error("Have an error ehh check it idk");
      return;
    }

    // io es mensaje de otros usuarios a el usuario.
    console.log("Received message on server: " + msg);

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

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.use(logger("dev"));

app.get("/", (req, res) => {
  console.log("yapp");
  res.sendFile(process.cwd() + "/client/index.html");
});

const port = 3000;

server.listen(port, () => {
  console.log(`server listening to port http://localhost:${port}`);
});
