import { join } from "path";
import { readFileSync } from "fs";
import Big from "big.js";
import {
  // @ts-ignore
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
  // @ts-ignore
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

type ScriptType = string | Script;

export const buildTx = (
  inputs: Utxo[],
  scripts: (ScriptType | [ScriptType, number])[],
  inputScripts: (Script | undefined)[] = []
) => {
  const { address, privKey } = inputs[0];
  const tx = new Transaction();
  inputs.forEach((input, index) => {
    if (inputScripts[index]) {
      tx.addInput(
        new Transaction.Input({
          prevTxId: input.txId,
          outputIndex: input.outputIndex,
          script: new Script(),
          output: new Transaction.Output({
            script: input.script,
            satoshis: input.satoshis,
          }),
        })
      );
      // @ts-ignore
      tx.setInputScript(index, inputScripts[index]);
    } else {
      tx.from(input);
    }
  });
  scripts.forEach((output) => {
    const [script, value] = Array.isArray(output) ? output : [output, 1];
    tx.addOutput(
      new Transaction.Output({
        script:
          // @ts-ignore
          typeof script === "string" ? Script.fromASM(script).toHex() : script,
        satoshis: value,
      })
    );
  });
  tx.change(address).sign(privKey).seal();
  return tx;
};

export const buildSplitTx = (input: Utxo, n: number) => {
  const { address, privKey } = input;
  const splitTx = new Transaction().from(input);
  for (let i = 0; i < n; i++) splitTx.to(address, 1);
  splitTx.change(address).sign(privKey).seal();
  return splitTx;
};

export const buildRef = (utxo: Utxo) =>
  `${swap(utxo.txId)}${outpointHex(utxo.outputIndex)}`;
