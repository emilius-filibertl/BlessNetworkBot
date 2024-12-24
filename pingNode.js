import axios from "axios";
import chalk from "chalk";
import { HttpsProxyAgent } from "https-proxy-agent";

import { readAccounts, readProxy } from "./src/readConfig.js";

const { green, red, yellow, cyan } = chalk;

const equals = "=".repeat(100);
const dash = "-".repeat(100);

const retry = async (retryCount) => {
  console.log(
    red(`Wait 2.5 seconds before retrying... (Retry #${retryCount})\n`)
  );

  // Delay 2.5 second
  await new Promise((resolve) => setTimeout(resolve, 2500));
};

const pingNode = async (publicKey, token) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const { username, password, hostname, port } = await readProxy();

  const proxy = `http://${username}:${password}@${hostname}:${port}`;

  const proxyAgent = new HttpsProxyAgent(proxy);

  const maxRetries = 5;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await axios.post(
        `https://gateway-run.bls.dev/api/v1/nodes/${publicKey}/ping`,
        null,
        {
          headers: headers,
          httpsAgent: proxyAgent,
        }
      );

      const { status, data } = response;

      if (status === 200) {
        console.log(green("Success\n"));
        return;
      } else {
        // Error response 2xx
        console.log(red(`Error encountered during pingNode:`));
        console.log(red(`Status: ${status}`));
        console.log(red(`Message: ${data?.message || "Unknown error"}`));

        await retry(++retryCount);
      }
    } catch (error) {
      // Error response 4xx and 5xx etc
      console.log(red(`Error encountered during pingNode:`));

      if (error.response) {
        const { status, data } = error.response;

        // Response from server, handle error response status
        if (status === 401 || status === 403) {
          console.log(red(`Authentication Error: ${status}`));
          console.log(red(`Please check your token or credentials.\n`));
          // Stop retrying after authentication error
          return;
        }

        console.log(red(`Status: ${status}`));
        console.log(red(`Message: ${data?.message || "Unknown error"}`));
      } else {
        // Network or unknown error
        console.log(red(`Network or unknown error: ${error.message}`));
      }

      await retry(++retryCount);
    }
  }

  console.log(red(`Max retries reached. Giving up :(\n`));
};

const runSession = async () => {
  let session = 1;

  const accounts = await readAccounts();

  while (true) {
    console.log(equals);
    console.log(green(`Starting session ${session}... `));

    for (const account of accounts) {
      console.log(dash);

      const { email, nodes } = account;

      console.log(yellow(`Running for email: ${cyan(email)}\n`));

      for (const node of nodes) {
        const { publicKey, token } = node;

        console.log(
          yellow(`Attempting to ping node for Public Key: ${publicKey}`)
        );

        await pingNode(publicKey, token);
      }
    }

    const temp = session + 1;

    console.log(dash);
    console.log(
      green(
        `End of session ${session} | Wait 1 hour for the next session ${temp} | Stop code execution "Ctrl+c"`
      )
    );
    console.log(`${equals}\n`);

    session++;

    // Delay 1 hour
    await new Promise((resolve) => setTimeout(resolve, 3600000));
  }
};

await runSession();
