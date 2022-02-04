import { Cluster } from "@solana/web3.js";


require('dotenv').config()

// Endpoints, connection
export const ENV: Cluster = (process.env.cluster as Cluster) || "mainnet-beta";
export const SOLANA_RPC_ENDPOINT = ENV === "devnet"
    ? 'https://api.devnet.solana.com'
    : "https://ssc-dao.genesysgo.net";

// Wallets
export const USER_KEYPAIR_PATH = process.env.USER_KEYPAIR_PATH || "PASTE YOUR WALLET PRIVATE KEY";

// Token Mints
export const INPUT_MINT_ADDRESS = process.env.INPUT_MINT_ADDRESS || "So11111111111111111111111111111111111111112"; // SOL
export const OUTPUT_MINT_ADDRESS = process.env.OUTPUT_MINT_ADDRESS || "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"; // USDT

// Jupiter CACHE_DURATION_MS
export const CACHE_DURATION_MS = 4000

// Interface
export interface Token {
    chainId: number; // 101,
    address: string; // '8f9s1sUmzUbVZMoMh6bufMueYH1u4BJSM57RCEvuVmFp',
    symbol: string; // 'TRUE',
    name: string; // 'TrueSight',
    decimals: number; // 9,
    logoURI: string; // 'https://i.ibb.co/pKTWrwP/true.jpg',
    tags: string[]; // [ 'utility-token', 'capital-token' ]
}
