import "dotenv/config"
import { loadConfig } from "./src/config/environment.js"

export default loadConfig(process.env)
