import { join } from "path";
import { readFileSync } from "fs";
import Big from "big.js";
import {
  Output,
  Script,
  Transaction,
  PrivateKey,
  // @ts-ignore
} from "@radiantblockchain/radiantjs";
import { JsonRpc } from "./rpc";

export type Utxo = {
  privKey: string;
  address: string;
  txId: string;
  outputIndex: number;
  script: Script;
  satoshis: number;
};

export interface GetUtxo {
  (value: number): Promise<Utxo>;
}

const SATS = 100000000;

export const utxoHelper =
  (rpc: JsonRpc): GetUtxo =>
  async (value) => {
    const coins = new Big(value).div(SATS);
    const address = (await rpc("getnewaddress")).data.result;
    const WIF = (await rpc("dumpprivkey", [address])).data.result;
    const txId = (await rpc("sendtoaddress", [address, coins])).data.result;
    const {
      details: [, { amount, vout: outputIndex }],
    } = (await rpc("gettransaction", [txId])).data.result;
    return {
      privKey: PrivateKey.fromWIF(WIF),
      address,
      txId,
      outputIndex,
      script: Script.fromAddress(address),
      satoshis: +new Big(amount).times(SATS),
    };
  };

export const loadDescription = (fileName: string) => {
  return JSON.parse(readFileSync(join(__dirname, fileName)).toString());
};

export const swap = (str: string) =>
  Buffer.from(str, "hex").reverse().toString("hex");

export const setParams = (t: string, params: { [key: string]: string }) => {
  Object.entries(params).forEach(([name, value]) => {
    // @ts-ignore
    t = t.replaceAll(`<${name}>`, value);
  });
  return t;
};

export const outpointHex = (n: number) => swap(`${n}`.padStart(8, "0"));

export const updateUtxos = (
  input: Utxo,
  txId: string,
  tx: Transaction
): Utxo[] => {
  return (tx.outputs as Output[]).map(({ script, satoshis }, index) => ({
    privKey: input.privKey,
    address: input.address,
    txId,
    outputIndex: index,
    script,
    satoshis,
  }));
};

export const buildMintTx = (
  input: any,
  script: string,
  change: string,
  privKey: string
) => {
  return new Transaction()
    .from(input)
    .addOutput(
      new Transaction.Output({
        script,
        satoshis: 1,
      })
    )
    .change(change)
    .sign(privKey)
    .seal();
};

export const buildTransferTx = (
  input: any,
  funding: any,
  script: string,
  change: string,
  privKey: string,
  split: number[] = [1]
) => {
  const tx = new Transaction()
    .addInput(
      new Transaction.Input({
        prevTxId: input.txId,
        outputIndex: input.outputIndex,
        script: "",
        satoshis: 1,
        output: {
          script,
          satoshis: 1,
        },
      })
    )
    .from(funding);
  split.forEach((satoshis) =>
    tx.addOutput(
      new Transaction.Output({
        script,
        satoshis,
      })
    )
  );
  tx.change(change).sign(privKey).seal();
  return tx;
};

export const buildMeltTx = (
  inputs: [any, any][],
  funding: any,
  change: string,
  privKey: string
) => {
  const tx = new Transaction();
  inputs.forEach(([input, script]) =>
    tx.addInput(
      new Transaction.Input({
        prevTxId: input.txId,
        outputIndex: input.outputIndex,
        script: "",
        satoshis: 1,
        output: {
          script,
          satoshis: 1,
        },
      })
    )
  );
  tx.from(funding).change(change).sign(privKey).seal();
  return tx;
};
