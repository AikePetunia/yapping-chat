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

// todo change to uuid
await dbClient.execute(`CREATE TABLE IF NOT EXISTS messages ( 
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    content TEXT )`);

io.on("connection", (socket) => {
  console.log("user connected");

  socket.on("visitor number", (number) => {
    console.log("received visitor number", number);
    io.emit("visitor number", number);
  });

  // socket es mensaje de usuario a servidor
  socket.on("chat message", async (msg) => {
    let result;
    try {
      result = await dbClient.execute({
        sql: "INSERT INTO messages (content) VALUES (:message)",
        args: { message: msg },
      });
    } catch (e) {
      throw new Error("Have an error ehh check it idk");
    }

    // io es mensaje de otros usuarios a el usuario.
    console.log("Receibed message on server: " + msg);
    io.emit("chat message", msg);
  });

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
