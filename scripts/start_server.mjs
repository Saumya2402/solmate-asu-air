import { createAppServer } from "../src/server.mjs";

const mode = process.argv[2];
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const { server } = createAppServer({ mode });
server.listen(port, host, () => console.log(`SolMate running at http://${host}:${port} (${mode} mode)`));
