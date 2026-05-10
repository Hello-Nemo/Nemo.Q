import { AuthStorage, ModelRegistry, createAgentSession, SessionManager, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
import path from "path";

async function main() {
  console.log("Testing AuthStorage.create()...");
  try {
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    
    const agentDir = path.join(process.cwd(), '.pi');
    console.log("Testing createAgentSession with agentDir:", agentDir);
    const { session } = await createAgentSession({
      agentDir,
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
      resourceLoader: new DefaultResourceLoader({
        agentDir,
        systemPromptOverride: () => "Test"
      })
    });
    console.log("Session created.");
  } catch (error: any) {
    console.error("Caught error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

main();
