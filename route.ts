// 0. Initial setup instructions

//   a. Clone the repository from this link: https://github.com/vercel-labs/ai/tree/main/examples/next-openai
//   b. Get an API key from OpenAI platform: https://platform.openai.com/account/api-keys
//   c. Upgrade langchain to the latest version using npm: npm update langchain@latest
//   d. Remove the ".example" from the ".env.local" file
//   e. OPTIONAL: Go to https://smith.langchain.com/, create a new project, and put environment variables into the ".env" file
//   f. Get your API key from langsmith.com and put it into the ".env" file

// 1. Import necessary modules for chat functionality and schema validation

//   a. Import the DynamicTool and DynamicStructuredTool classes for creating custom tools
import { DynamicTool, DynamicStructuredTool } from "langchain/tools";

//  b. Import the ChatOpenAI class for using the OpenAI model in the chat
import { ChatOpenAI } from "langchain/chat_models/openai";

//  c. Import the initializeAgentExecutorWithOptions function for setting up the agent executor
import { initializeAgentExecutorWithOptions } from "langchain/agents";

//  d. Import the WikipediaQueryRun class for fetching information from Wikipedia
import { WikipediaQueryRun } from "langchain/tools";

//  e. Import the StreamingTextResponse class for streaming text responses
import { StreamingTextResponse } from 'ai';

//  f. Import the zod library for schema validation
import * as z from 'zod';

// 2. Specify the execution runtime as 'edge'
export const runtime = 'edge';

// 3. Define the POST method to handle incoming requests
export async function POST(req: Request, res: Response) {
  // 4. Extract message data from incoming request
  const { messages } = await req.json();

  // 5. Initialize the ChatOpenAI model with specified configurations
  const model = new ChatOpenAI({ temperature: 0, streaming: true });

  // 6. Set up a Wikipedia query tool for fetching relevant information
  const wikipediaQuery = new WikipediaQueryRun({
    topKResults: 1,
    maxDocContentLength: 300,
  });

  // 7. Define a tool named 'foo' primarily for demonstration purposes on YouTube
  const foo = new DynamicTool({
    name: 'foo',
    description: 'returns the answer to what foo is',
    func: async () => {
      console.log('Triggered foo function');
      return 'The value of food is "This is a demo for YouTube"'
    }
  });

  // 8. Define a structured tool to fetch cryptocurrency prices from CoinGecko API
  const fetchCryptoPrice = new DynamicStructuredTool({
    name: 'fetchCryptoPrice',
    description: 'Fetches the current price of a specified cryptocurrency',
    schema: z.object({
      cryptoName: z.string(),
      vsCurrency: z.string().optional().default('USD'),
    }),
    func: async (options) => {
      console.log('Triggered fetchCryptoPrice function with options: ', options);
      const { cryptoName, vsCurrency } = options;
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoName}&vs_currencies=${vsCurrency}`;
      const response = await fetch(url);
      const data = await response.json();
      return data[cryptoName.toLowerCase()][vsCurrency.toLowerCase()].toString();
    },
  });

  // 9. List all the tools that will be used by the agent during execution
  const tools = [wikipediaQuery, foo, fetchCryptoPrice];

  // 10. Initialize the agent executor, which will use the specified tools and model to process input
  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "openai-functions",
  });

  // 11. Extract the most recent input message from the array of messages
  const input = messages[messages.length - 1].content;

  // 12. Execute the agent with the provided input to get a response
  const result = await executor.run(input);

  // 13. Break the result into individual word chunks for streaming
  const chunks = result.split(" ");

  // 14. Define the streaming mechanism to send chunks of data to the client
  const responseStream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        const bytes = new TextEncoder().encode(chunk + " ");
        controller.enqueue(bytes);
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20 + 10)));
      }
      controller.close();
    },
  });

  // 15. Send the created stream as a response to the client
  return new StreamingTextResponse(responseStream)
}