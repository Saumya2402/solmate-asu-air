import { createAppServer } from "../src/server.mjs";

const mode = process.argv[2];
const port = Number(process.env.PORT || 4173);
const { server } = createAppServer({ mode });
server.listen(port, "127.0.0.1", () => console.log(`SolMate running at http://127.0.0.1:${port} (${mode} mode)`));
