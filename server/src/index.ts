import { createApp } from "./app.js";
import { classifierFromEnv } from "./services/geminiSkillClassifier.js";

const port = Number(process.env.PORT ?? 3000);

createApp({ classifier: classifierFromEnv(process.env) }).listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
