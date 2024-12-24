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

const stopNode = async (publicKey, token) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const { username, password, hostname, port } = await readProxy();

  const proxy = `http://${username}:${password}@${hostname}:${port}`;

  const proxyAgent = new HttpsProxyAgent(proxy);

  let retryCount = 0;

  while (true) {
    try {
      const response = await axios.post(
        `https://gateway-run.bls.dev/api/v1/nodes/${publicKey}/stop-session`,
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
        console.log(red(`Error encountered during stopNode:`));
        console.log(red(`Status: ${status}`));
        console.log(red(`Message: ${data?.message || "Unknown error"}`));

        await retry(++retryCount);
      }
    } catch (error) {
      // Error response 4xx and 5xx etc
      console.log(red(`Error encountered during stopNode:`));

      if (error.response) {
        const { status, data } = error.response;

        // Response from server, handle error response status
        if (status === 401 || status === 403) {
          console.log(red(`Authentication Error: ${status}`));
          console.log(red(`Please check your token or credentials.\n`));
        } else {
          console.log(red(`Status: ${status}`));
          console.log(red(`Message: ${data?.message || "Unknown error"}`));
        }
      } else {
        // Network or unknown error
        console.log(red(`Network or unknown error: ${error.message}`));
      }

      await retry(++retryCount);
    }
  }
};

const runSession = async () => {
  const accounts = await readAccounts();

  console.log(equals);
  console.log(green("Stopping nodes..."));

  for (const account of accounts) {
    console.log(dash);

    const { email, nodes } = account;

    console.log(yellow(`Running for email: ${cyan(email)}\n`));

    for (const node of nodes) {
      const { publicKey, token } = node;

      console.log(yellow(`Shutting down node with Public Key: ${publicKey}`));

      await stopNode(publicKey, token);
    }
  }

  console.log(dash);
  console.log(green("All nodes have been successfully shut down."));
  console.log(equals);
};

await runSession();
