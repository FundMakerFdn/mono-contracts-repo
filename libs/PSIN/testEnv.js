const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Function to get a secret value by key
async function getSecretValueByKey(secretName, key) {
  const regionName = "eu-central-1";

  // Initialize the Secrets Manager client
  const client = new SecretsManagerClient({ region: regionName });

  try {
    // Fetch the secret value
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    // Parse the JSON secret string
    const secretData = JSON.parse(response.SecretString);
    return secretData[key] || "Key not found";
  } catch (error) {
    throw error; // Re-throw for upstream handling
  }
}

// Usage
const secretName = "webull_solver_proxy";
const keyToExtract = "BINANCE_API_KEY";

(async () => {
  try {
    const secretValue = await getSecretValueByKey(secretName, keyToExtract);
    console.log(`Value for ${keyToExtract}: ${secretValue}`);
  } catch (error) {
    console.error("Error retrieving secret:", error);
  }
})();