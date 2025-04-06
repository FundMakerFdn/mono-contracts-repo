import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getContractAddresses = async () => {
  const contractsPath = join(__dirname, "contracts.json");
  const contractsData = await readFile(contractsPath, "utf8");
  return JSON.parse(contractsData);
};
