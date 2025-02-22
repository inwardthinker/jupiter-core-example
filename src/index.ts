import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import fetch from "isomorphic-fetch";
import { fs } from "mz";

import { Jupiter, RouteInfo, TOKEN_LIST_URL } from "@jup-ag/core";
import {
  ENV,
  INPUT_MINT_ADDRESS,
  OUTPUT_MINT_ADDRESS,
  SOLANA_RPC_ENDPOINT,
  Token,
  USER_KEYPAIR_PATH,
  CACHE_DURATION_MS,
} from "./constants";
import { sign } from "mz/crypto";

const signer = async () => {
  try {
    const secretKeyString: any = await fs.readFile(USER_KEYPAIR_PATH, {encoding: 'utf8'});
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  }
  catch (error) {
    throw error;
  }
};

const getPossiblePairsTokenInfo = ({
  tokens,
  routeMap,
  inputToken,
}: {
  tokens: Token[];
  routeMap: Map<string, string[]>;
  inputToken?: Token;
}) => {
  try {
    if (!inputToken) {
      return {};
    }

    const possiblePairs = inputToken
      ? routeMap.get(inputToken.address) || []
      : []; // return an array of token mints that can be swapped with SOL
    const possiblePairsTokenInfo: { [key: string]: Token | undefined } = {};
    possiblePairs.forEach((address) => {
      possiblePairsTokenInfo[address] = tokens.find((t) => {
        return t.address == address;
      });
    });
    // Perform your conditionals here to use other outputToken
    // const alternativeOutputToken = possiblePairsTokenInfo[USDT_MINT_ADDRESS]
    return possiblePairsTokenInfo;
  } catch (error) {
    throw error;
  }
};

const getRoutes = async ({
  jupiter,
  inputToken,
  outputToken,
  inputAmount,
  slippage,
}: {
  jupiter: Jupiter;
  inputToken?: Token;
  outputToken?: Token;
  inputAmount: number;
  slippage: number;
}) => {
  try {
    if (!inputToken || !outputToken) {
      return null;
    }

    console.log("Getting routes");
    const inputAmountInSmallestUnits = inputToken
      ? Math.round(inputAmount * 10 ** inputToken.decimals)
      : 0;
    const routes =
      inputToken && outputToken
        ? (await jupiter.computeRoutes(
          new PublicKey(inputToken.address),
          new PublicKey(outputToken.address),
          inputAmountInSmallestUnits, // raw input amount of tokens
          slippage,
          true
        ))
        : null;

    if (routes && routes.routesInfos) {
      console.log("Possible number of routes:", routes.routesInfos.length);
      console.log("Best quote: ", routes.routesInfos[0].outAmount);
      return routes;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

const executeSwap = async ({
  jupiter,
  route,
}: {
  jupiter: Jupiter;
  route: RouteInfo;
}) => {
  try {
    // Prepare execute exchange
    const { execute } = await jupiter.exchange({
      route,
    });
    // Execute swap
    const swapResult: any = await execute(); // Force any to ignore TS misidentifying SwapResult type

    if (swapResult.error) {
      console.log(swapResult.error);
    } else {
      console.log(`https://explorer.solana.com/tx/${swapResult.txid}`);
      console.log(`inputAddress=${swapResult.inputAddress.toString()} outputAddress=${swapResult.outputAddress.toString()}`);
      console.log(`inputAmount=${swapResult.inputAmount} outputAmount=${swapResult.outputAmount}`);
    }
  } catch (error) {
    throw error;
  }
};

const main = async () => {
  try {
    console.log("Connect to solana");
    const connection = new Connection(SOLANA_RPC_ENDPOINT); // Setup Solana RPC connection

    console.log("Fetch user keypair");
    const user_keypair: Keypair = await signer();
    
    console.log("Fetch token list");
    const tokens: Token[] = await (await fetch(TOKEN_LIST_URL[ENV])).json(); // Fetch token list from Jupiter API
    console.log(`Number of supported tokens: ${tokens.length}`);

    console.log("Load Jupiter");
    //  Load Jupiter
    const jupiter = await Jupiter.load({
      connection,
      cluster: ENV,
      user: user_keypair, // or public key
      routeCacheDuration: CACHE_DURATION_MS 
    });

    // Get USDH and USDC token account balance for this account

    // If you know which input/output pair you want
    const usdcToken = tokens.find((t) => t.address == INPUT_MINT_ADDRESS); // USDC Mint Info
    const ushToken = tokens.find((t) => t.address == OUTPUT_MINT_ADDRESS); // USDH Mint Info
    // Alternatively, find all possible outputToken based on your inputToken

    while(true) {
      console.log("Compute input and output token balances");
      const usdc_amount = await connection
        .getParsedTokenAccountsByOwner(
          new PublicKey(user_keypair.publicKey.toBase58()),
          {
            mint: new PublicKey(INPUT_MINT_ADDRESS)
          }
        )
        .then((b) => {
          if (b?.value.length > 0) {
            return b?.value[0].account.data.parsed.info.tokenAmount.uiAmount
          }
          else return 0
        });
      const ush_amount = await connection
        .getParsedTokenAccountsByOwner(
          new PublicKey(user_keypair.publicKey.toBase58()),
          {
            mint: new PublicKey(OUTPUT_MINT_ADDRESS)
          }
        )
        .then((b) => {
          if (b?.value.length > 0) {
            return b?.value[0].account.data.parsed.info.tokenAmount.uiAmount
          }
          else return 0
        });
      console.log(`USDC Balance: ${usdc_amount}--USH Balance: ${ush_amount}`);
      
      console.log(`Get routes for input: ${usdcToken?.symbol} and output: ${ushToken?.symbol} token pairs`);
      const routes = await getRoutes({
        jupiter,
        inputToken: usdcToken,
        outputToken: ushToken,
        inputAmount: 27000, // 27000 unit in UI
        slippage: 0.5, // 0.5% slippage
      });

      if (routes) {
        const routeInfos = routes.routesInfos
        if (routeInfos.length > 0) {
          const ratio = routeInfos[0].outAmount / routeInfos[0].inAmount;
          console.log(`USDC to USDH ratio: ${ratio}`)
          if (ratio > 985 && usdc_amount >= 27000) {
            const usdc_to_usdh  = await getRoutes({
              jupiter,
              inputToken: usdcToken,
              outputToken: ushToken,
              inputAmount: 27000, // 29900 unit in UI
              slippage: 0.5, // 1% slippage
            });
            if (usdc_to_usdh) {
              const routeInfos = usdc_to_usdh.routesInfos
              if (routeInfos.length > 0) {
                const ratio = routeInfos[0].outAmount / routeInfos[0].inAmount
                console.log(`USDC to USH ratio: ${ratio}`)
                if (ratio > 985) {
                  console.log(`Executing USDC to USH--usdc amount: ${routeInfos[0].inAmount}--usdh amount: ${routeInfos[0].outAmount}`);
                  await executeSwap({ jupiter, route: routeInfos[0] });
                }
              }
            }
          }
          else if (ratio < 970 && ush_amount >= 26000) {
            const ush_to_usdc  = await getRoutes({
              jupiter,
              inputToken: ushToken,
              outputToken: usdcToken,
              inputAmount: 26000, // 27000 unit in UI
              slippage: 0.5, // 1% slippage
            });
            if (ush_to_usdc) {
              const routeInfos = ush_to_usdc.routesInfos
              if (routeInfos.length > 0) {
                const ratio = routeInfos[0].outAmount / routeInfos[0].inAmount
                console.log(`USH to USDC ratio: ${ratio}`)
                if (ratio > 1030) {
                  console.log(`Executing USH to USDC--ush amount: ${routeInfos[0].inAmount}--usddc amount: ${routeInfos[0].outAmount}`);
                  await executeSwap({ jupiter, route: routeInfos[0] });
                }
              }
            }
          }
        }
      }
      await new Promise(f => setTimeout(f, 20000)); // sleep for 20 seconds
    }
  } catch (error) {
    console.log({ error });
  }
};

main();
